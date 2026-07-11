// 工具管理路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId, nowCST } = require('./db');
const { authenticate, requireMaterialManager } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: '参数校验失败', errors: errors.array() });
  }
  next();
};

// 获取工具列表（按借出次数降序→常用工具排前）
router.get('/tools', authenticate, (req, res) => {
  const db = readDB();
  const tools = db.tools || [];
  const toolkits = db.toolkits || [];
  const kitItems = db.toolkit_items || [];
  const shelves = db.shelves || [];
  const locations = db.storage_locations || [];

  // 注入 toolkit_name / toolkit_seq / shelf_name / location_name
  let enriched = tools.map(tool => {
    const shelf = shelves.find(s => s.shelf_id === tool.shelf_id);
    const loc = locations.find(l => l.location_id === tool.storage_location_id);
    const result = {
      ...tool,
      shelf_name: shelf?.shelf_name || '',
      location_name: loc?.location_name || loc?.location_code || '',
      toolkit_name: '',
      toolkit_seq: 0
    };
    const item = kitItems.find(i => i.tool_id === tool.tool_id);
    if (item) {
      const kit = toolkits.find(k => k.toolkit_id === item.toolkit_id);
      result.toolkit_name = kit?.toolkit_name || '';
      result.toolkit_seq = item.sort_order || 0;
    }
    return result;
  });

  // 部门权限过滤：非 admin/material_manager 只看本部门 + 共享仓库的工具
  if (req.user.role !== 'admin' && req.user.role !== 'material_manager') {
    const currentUser = db.users.find(u => u.user_id === req.user.user_id);
    const userDeptId = currentUser?.dept_id;
    const warehouses = db.warehouses || [];
    const allowedWarehouseIds = new Set(
      warehouses
        .filter(w => w.dept_id === null || w.dept_id === undefined || w.dept_id === userDeptId)
        .map(w => w.warehouse_id)
    );
    // 工具没有 warehouse_id 或 warehouse_id 在允许列表内才显示
    enriched = enriched.filter(t => !t.warehouse_id || allowedWarehouseIds.has(t.warehouse_id));
  }

  enriched.sort((a, b) => (b.borrow_count || 0) - (a.borrow_count || 0));
  res.json(enriched);
});

// ========== 工具箱独立实体 CRUD ==========

// 获取所有工具箱（含工具数量）
router.get('/toolkits', authenticate, (req, res) => {
  const db = readDB();
  const toolkits = db.toolkits || [];
  const items = db.toolkit_items || [];
  const result = toolkits.map(k => ({
    ...k,
    tool_count: items.filter(i => i.toolkit_id === k.toolkit_id).length
  }));
  res.json(result);
});

// 按 toolkit_code 查询工具箱详情（含内部工具列表）
router.get('/toolkits/code/:code', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const db = readDB();
  const toolkit = (db.toolkits || []).find(k => k.toolkit_code === code);
  if (!toolkit) {
    return res.status(404).json({ message: `未找到编码为 "${code}" 的工具箱` });
  }

  const items = (db.toolkit_items || [])
    .filter(i => i.toolkit_id === toolkit.toolkit_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const tools = items.map(item => {
    const tool = (db.tools || []).find(t => t.tool_id === item.tool_id);
    return tool ? { ...tool, toolkit_seq: item.sort_order } : null;
  }).filter(Boolean);

  res.json({ ...toolkit, tools, tool_count: tools.length });
});

// 获取单个工具箱详情（含内部工具列表）
router.get('/toolkits/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const toolkit = (db.toolkits || []).find(k => k.toolkit_id === id);
  if (!toolkit) return res.status(404).json({ message: '工具箱不存在' });

  const items = (db.toolkit_items || [])
    .filter(i => i.toolkit_id === id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const tools = items.map(item => {
    const tool = (db.tools || []).find(t => t.tool_id === item.tool_id);
    return tool ? { ...tool, toolkit_seq: item.sort_order } : null;
  }).filter(Boolean);

  res.json({ ...toolkit, tools, tool_count: tools.length });
});

// 创建工具箱
router.post('/toolkits', authenticate, requireMaterialManager, (req, res) => {
  const { toolkit_name, description, toolkit_code } = req.body;
  if (!toolkit_name) return res.status(400).json({ message: '工具箱名称不能为空' });
  const db = readDB();
  if ((db.toolkits || []).find(k => k.toolkit_name === toolkit_name)) {
    return res.status(400).json({ message: '工具箱名称已存在' });
  }
  const newId = nextId(db.toolkits || [], 'toolkit_id');
  // 自动生成 toolkit_code：如果用户提供了就用用户提供的，否则用 BX-{id} 格式
  const code = toolkit_code || `BX-${newId}`;
  // 检查 toolkit_code 唯一性
  if ((db.toolkits || []).find(k => k.toolkit_code === code)) {
    return res.status(400).json({ message: '工具箱编码已存在' });
  }
  const newKit = {
    toolkit_id: newId,
    toolkit_name,
    description: description || '',
    toolkit_code: code,
    created_at: nowCST()
  };
  if (!db.toolkits) db.toolkits = [];
  db.toolkits.push(newKit);
  writeDB(db);
  res.json(newKit);
});

// 更新工具箱
router.put('/toolkits/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const { toolkit_name, description, toolkit_code } = req.body;
  const db = readDB();
  const idx = (db.toolkits || []).findIndex(k => k.toolkit_id === id);
  if (idx === -1) return res.status(404).json({ message: '工具箱不存在' });
  if (toolkit_name) db.toolkits[idx].toolkit_name = toolkit_name;
  if (description !== undefined) db.toolkits[idx].description = description;
  // 支持修改 toolkit_code，需唯一性检查
  if (toolkit_code !== undefined) {
    if ((db.toolkits || []).find(k => k.toolkit_code === toolkit_code && k.toolkit_id !== id)) {
      return res.status(400).json({ message: '工具箱编码已存在' });
    }
    db.toolkits[idx].toolkit_code = toolkit_code;
  }
  writeDB(db);
  res.json(db.toolkits[idx]);
});

// 删除工具箱（同时清理关联项）
router.delete('/toolkits/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = (db.toolkits || []).findIndex(k => k.toolkit_id === id);
  if (idx === -1) return res.status(404).json({ message: '工具箱不存在' });
  db.toolkits.splice(idx, 1);
  // 清理关联的 toolkit_items
  db.toolkit_items = (db.toolkit_items || []).filter(i => i.toolkit_id !== id);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// 向工具箱添加工具
router.post('/toolkits/:id/add-tools', authenticate, requireMaterialManager, (req, res) => {
  const kitId = parseInt(req.params.id);
  const { tool_ids } = req.body;
  if (!tool_ids || !Array.isArray(tool_ids) || tool_ids.length === 0) {
    return res.status(400).json({ message: '请选择至少一个工具' });
  }
  const db = readDB();
  const toolkit = (db.toolkits || []).find(k => k.toolkit_id === kitId);
  if (!toolkit) return res.status(404).json({ message: '工具箱不存在' });

  if (!db.toolkit_items) db.toolkit_items = [];

  // 获取当前工具箱已有的最大 sort_order
  const existing = db.toolkit_items.filter(i => i.toolkit_id === kitId);
  let maxOrder = existing.length > 0 ? Math.max(...existing.map(i => i.sort_order || 0)) : 0;

  let added = 0;
  for (const tid of tool_ids) {
    const toolId = parseInt(tid);
    // 检查工具是否存在
    if (!(db.tools || []).find(t => t.tool_id === toolId)) continue;
    // 检查是否已在工具箱中
    if (db.toolkit_items.find(i => i.toolkit_id === kitId && i.tool_id === toolId)) continue;
    maxOrder++;
    db.toolkit_items.push({
      item_id: nextId(db.toolkit_items, 'item_id'),
      toolkit_id: kitId,
      tool_id: toolId,
      sort_order: maxOrder
    });
    added++;
  }

  // 同步工具的 toolkit_name（写入当前工具箱名称）
  const toolIndices = tool_ids.map(tid => db.tools.findIndex(t => t.tool_id === parseInt(tid))).filter(i => i > -1);
  toolIndices.forEach(i => { db.tools[i].toolkit_name = toolkit.toolkit_name; });

  writeDB(db);
  res.json({ message: `成功添加 ${added} 个工具` });
});

// 从工具箱移除工具
router.delete('/toolkits/:id/remove-tool/:toolId', authenticate, requireMaterialManager, (req, res) => {
  const kitId = parseInt(req.params.id);
  const toolId = parseInt(req.params.toolId);
  const db = readDB();

  const idx = (db.toolkit_items || []).findIndex(i => i.toolkit_id === kitId && i.tool_id === toolId);
  if (idx === -1) return res.status(404).json({ message: '该工具不在工具箱中' });

  db.toolkit_items.splice(idx, 1);

  // 检查该工具是否还属于其他工具箱
  const stillInKit = (db.toolkit_items || []).find(i => i.tool_id === toolId);
  if (!stillInKit) {
    const ti = db.tools.findIndex(t => t.tool_id === toolId);
    if (ti > -1) db.tools[ti].toolkit_name = '';
  }

  writeDB(db);
  res.json({ message: '已从工具箱移除' });
});

// 创建工具
router.post('/tools', authenticate, requireMaterialManager, [
  body('tool_code').notEmpty().withMessage('工具编码不能为空'),
  body('tool_name').notEmpty().withMessage('工具名称不能为空'),
  validate
], (req, res) => {
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description, toolkit, toolkit_name } = req.body;
  const db = readDB();

  if (db.tools.find(t => t.tool_code === tool_code)) {
    return res.status(400).json({ message: '工具编码已存在' });
  }

  const warehouse = db.warehouses.find(w => w.warehouse_id === warehouse_id);
  const shelf = db.shelves.find(s => s.shelf_id === shelf_id);
  const location = db.storage_locations.find(l => l.location_id === storage_location_id);

  if (shelf_id && warehouse_id && shelf && shelf.warehouse_id !== warehouse_id) {
    return res.status(400).json({ message: '货架不属于所选仓库' });
  }
  if (storage_location_id && shelf_id && warehouse_id && location && (location.shelf_id !== shelf_id || location.warehouse_id !== warehouse_id)) {
    return res.status(400).json({ message: '货位不属于所选货架或仓库' });
  }

  const newTool = {
    tool_id: nextId(db.tools, 'tool_id'),
    tool_code, tool_name, category_id,
    category_name: db.categories.find(c => c.category_id === category_id)?.category_name || '',
    status: status || 'available',
    warehouse_id: warehouse_id || null,
    warehouse: warehouse?.warehouse_name || '',
    shelf_id: shelf_id || null,
    storage_location_id: storage_location_id || null,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : '',
    scene: '', borrow_count: 0, description: description || '', image_url: '',
    toolkit_name: toolkit_name || toolkit || '', purchase_date: null, scrap_date: null
  };

  db.tools.push(newTool);
  writeDB(db);
  res.json(newTool);
});

// 更新工具
router.put('/tools/:id', authenticate, requireMaterialManager, (req, res) => {
  const toolId = parseInt(req.params.id);
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description, toolkit, toolkit_name, image_url } = req.body;
  const db = readDB();

  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) return res.status(404).json({ message: '工具不存在' });

  const warehouse = warehouse_id ? db.warehouses.find(w => w.warehouse_id === warehouse_id) : null;
  const shelf = shelf_id ? db.shelves.find(s => s.shelf_id === shelf_id) : null;
  const location = storage_location_id ? db.storage_locations.find(l => l.location_id === storage_location_id) : null;

  db.tools[toolIndex] = {
    ...db.tools[toolIndex],
    tool_code: tool_code || db.tools[toolIndex].tool_code,
    tool_name: tool_name || db.tools[toolIndex].tool_name,
    category_id: category_id || db.tools[toolIndex].category_id,
    category_name: category_id ? db.categories.find(c => c.category_id === category_id)?.category_name : db.tools[toolIndex].category_name,
    warehouse_id: warehouse_id !== undefined ? warehouse_id : db.tools[toolIndex].warehouse_id,
    warehouse: warehouse ? warehouse.warehouse_name : (warehouse_id === null ? '' : db.tools[toolIndex].warehouse),
    shelf_id: shelf_id !== undefined ? shelf_id : db.tools[toolIndex].shelf_id,
    storage_location_id: storage_location_id !== undefined ? storage_location_id : db.tools[toolIndex].storage_location_id,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : (storage_location_id === null ? '' : db.tools[toolIndex].storage_location),
    status: status || db.tools[toolIndex].status,
    description: description !== undefined ? description : db.tools[toolIndex].description,
    toolkit_name: toolkit_name !== undefined ? toolkit_name : (toolkit !== undefined ? toolkit : db.tools[toolIndex].toolkit_name),
    image_url: image_url !== undefined ? image_url : db.tools[toolIndex].image_url
  };

  writeDB(db);
  res.json(db.tools[toolIndex]);
});

// 删除工具
router.delete('/tools/:id', authenticate, requireMaterialManager, (req, res) => {
  const toolId = parseInt(req.params.id);
  const db = readDB();
  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) return res.status(404).json({ message: '工具不存在' });
  db.tools.splice(toolIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ============ 图片上传（含自动压缩，目标 ≤ 2MB）============
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer 用内存存储（文件先放内存，压缩后再写盘，避免残留临时文件）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 接受 ≤ 10MB 原始文件
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return cb(new Error('只支持 JPG/PNG/GIF/WebP 格式'));
    }
    cb(null, true);
  }
});

/**
 * 压缩图片到目标大小以内（目标 ≤ 2MB）
 * 策略：原图如果已经很小则保留原图不动；否则尝试 JPEG 压缩，
 *       如果 JPEG 反而更大则退回原图（例如 PNG 截图通常 JPEG 更差）
 * @param {Buffer} inputBuffer - 原始图片 buffer
 * @param {string} ext - 原始扩展名（含点，如 '.jpg'）
 * @returns {Promise<{buffer: Buffer, ext: string}>}
 */
async function compressImage(inputBuffer, ext) {
  const MAX_SIZE = 2 * 1024 * 1024;  // 目标 ≤ 2MB
  const MAX_DIM = 2048;              // 最长边 2048px

  const metadata = await sharp(inputBuffer).metadata();
  const needsResize = metadata.width > MAX_DIM || metadata.height > MAX_DIM;

  // 情况 A：原图已 ≤ 2MB 且无需缩放 → 直接保留原图
  if (inputBuffer.length <= MAX_SIZE && !needsResize) {
    return { buffer: inputBuffer, ext };
  }

  // 情况 B：需要压缩 — 统一走 JPEG（照片压缩效果最好）
  // 对透明 PNG 先垫白底再转 JPEG，避免透明区变黑
  let quality = 82;
  let result = await sharp(inputBuffer)
    .resize(needsResize ? MAX_DIM : undefined, needsResize ? MAX_DIM : undefined, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })  // 透明 → 白底
    .jpeg({ quality })
    .toBuffer();

  // 逐步降 quality
  while (result.length > MAX_SIZE && quality > 20) {
    quality -= 15;
    result = await sharp(inputBuffer)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality })
      .toBuffer();
  }

  // 极端情况：大幅缩小尺寸
  if (result.length > MAX_SIZE) {
    result = await sharp(inputBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 50 })
      .toBuffer();
  }

  // 情况 C：JPEG 压缩后反而比原图大（例如小 PNG 截图）
  // → 保留原图（只要原图本身 ≤ 2MB），否则仍用压缩版
  if (result.length > inputBuffer.length && inputBuffer.length <= MAX_SIZE) {
    return { buffer: inputBuffer, ext };
  }

  // 最终兜底
  if (result.length > MAX_SIZE) {
    return { buffer: inputBuffer, ext: '.jpg' }; // 极端情况，仍返回压缩版（会被外层 413 拦截）
  }

  return { buffer: result, ext: '.jpg' };
}

router.post('/tools/:id/upload-image', authenticate, requireMaterialManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择要上传的图片' });

    const toolId = parseInt(req.params.id);
    const db = readDB();
    const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
    if (toolIndex === -1) {
      return res.status(404).json({ message: '工具不存在' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log(`[Upload] 工具#${toolId} 收到图片: ${(req.file.size / 1024 / 1024).toFixed(2)}MB, 格式=${ext}`);

    // 压缩图片
    const { buffer: compressed, ext: finalExt } = await compressImage(req.file.buffer, ext);
    const reduction = req.file.size > 0
      ? ((1 - compressed.length / req.file.size) * 100).toFixed(0)
      : 0;

    console.log(`[Upload] 压缩完成: ${(compressed.length / 1024 / 1024).toFixed(2)}MB (缩减 ${reduction}%)`);

    // 最终兜底：如果压缩后仍 > 2MB，拒绝
    if (compressed.length > 2 * 1024 * 1024) {
      return res.status(413).json({
        message: `图片压缩后仍超过 2MB（当前 ${(compressed.length / 1024 / 1024).toFixed(1)}MB），请使用更小的图片`
      });
    }

    // 写入磁盘
    const filename = `tool_${toolId}_${Date.now()}${finalExt}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, compressed);

    // 删除旧图片（如果存在）
    const oldUrl = db.tools[toolIndex].image_url;
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // 更新数据库
    const imageUrl = `/uploads/${filename}`;
    db.tools[toolIndex].image_url = imageUrl;
    writeDB(db);

    res.json({
      message: '上传成功（已自动压缩）',
      image_url: imageUrl,
      original_size: req.file.size,
      compressed_size: compressed.length,
      reduction: `${reduction}%`
    });
  } catch (err) {
    console.error('[Upload] 压缩失败:', err.message);
    res.status(500).json({ message: '图片处理失败: ' + err.message });
  }
});

// 分类管理
router.get('/tool-categories', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.categories || []);
});

router.post('/tool-categories', authenticate, requireMaterialManager, (req, res) => {
  const { category_name, category_code, description, require_approval } = req.body;
  const db = readDB();
  if (db.categories.find(c => c.category_code === category_code)) {
    return res.status(400).json({ message: '分类编码已存在' });
  }
  const newCategory = { category_id: nextId(db.categories, 'category_id'), category_name, category_code, description: description || '', require_approval: require_approval || false };
  db.categories.push(newCategory);
  writeDB(db);
  res.json(newCategory);
});

router.put('/tool-categories/:id', authenticate, requireMaterialManager, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const { category_name, category_code, description, require_approval } = req.body;
  const db = readDB();
  const idx = db.categories.findIndex(c => c.category_id === categoryId);
  if (idx === -1) return res.status(404).json({ message: '分类不存在' });
  db.categories[idx] = {
    ...db.categories[idx],
    category_name: category_name || db.categories[idx].category_name,
    category_code: category_code || db.categories[idx].category_code,
    description: description !== undefined ? description : db.categories[idx].description,
    require_approval: require_approval !== undefined ? require_approval : db.categories[idx].require_approval
  };
  writeDB(db);
  res.json(db.categories[idx]);
});

router.delete('/tool-categories/:id', authenticate, requireMaterialManager, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.categories.findIndex(c => c.category_id === categoryId);
  if (idx === -1) return res.status(404).json({ message: '分类不存在' });
  if (db.tools.filter(t => t.category_id === categoryId).length > 0) {
    return res.status(400).json({ message: '该分类下有工具，无法删除' });
  }
  db.categories.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ========== 扫码相关接口 ==========

// 按 tool_code 查询工具详情
router.get('/tools/code/:code', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const db = readDB();
  const tools = db.tools || [];
  const toolkits = db.toolkits || [];
  const kitItems = db.toolkit_items || [];
  const shelves = db.shelves || [];
  const locations = db.storage_locations || [];

  const tool = tools.find(t => t.tool_code === code);
  if (!tool) {
    return res.status(404).json({ message: `未找到编码为 "${code}" 的工具` });
  }

  // 注入关联数据（与 GET /tools 保持一致）
  const shelf = shelves.find(s => s.shelf_id === tool.shelf_id);
  const loc = locations.find(l => l.location_id === tool.storage_location_id);
  const result = {
    ...tool,
    shelf_name: shelf?.shelf_name || '',
    location_name: loc?.location_name || loc?.location_code || '',
    toolkit_name: '',
    toolkit_seq: 0
  };
  const item = kitItems.find(i => i.tool_id === tool.tool_id);
  if (item) {
    const kit = toolkits.find(k => k.toolkit_id === item.toolkit_id);
    result.toolkit_name = kit?.toolkit_name || '';
    result.toolkit_seq = item.sort_order || 0;
  }

  res.json(result);
});

// 按 tool_code 快速领用（单件工具，扫码即借）
router.post('/tools/code/:code/borrow', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const { scene, expected_return, purpose } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  const tool = (db.tools || []).find(t => t.tool_code === code);
  if (!tool) {
    return res.status(404).json({ message: `未找到编码为 "${code}" 的工具` });
  }
  if (tool.status !== 'available') {
    return res.status(400).json({ message: `工具"${tool.tool_name}"当前状态为"${tool.status}"，不可领用` });
  }

  // 部门权限校验：非 admin 用户只能借本部门 + 共享仓库的工具
  if (req.user.role !== 'admin') {
    const warehouse = (db.warehouses || []).find(w => w.warehouse_id === tool.warehouse_id);
    if (warehouse && warehouse.dept_id !== null && warehouse.dept_id !== undefined && warehouse.dept_id !== user.dept_id) {
      return res.status(403).json({ message: `工具"${tool.tool_name}"属于其他部门仓库，无权领用` });
    }
  }

  // 生成订单号
  const orderNo = `ORD${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
  const itemCounter = Date.now();

  const item = {
    item_id: (itemCounter << 12) | (randomPart & 0xFFF),
    tool_id: tool.tool_id,
    tool_code: tool.tool_code,
    tool_name: tool.tool_name,
    item_status: 'reserved'
  };

  const category = (db.categories || []).find(c => c.category_id === tool.category_id);

  const newOrder = {
    order_id: nextId(db.orders || [], 'order_id'),
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_id: user.user_id,
    status: 'pending',
    warehouse: tool.warehouse || '',
    scene: scene || '扫码领用',
    borrow_time: new Date().toISOString(),
    expected_return: expected_return || null,
    actual_return: null,
    purpose: purpose || '',
    require_approval: category?.require_approval ?? true,
    created_at: new Date().toISOString(),
    items: [item]
  };

  // 更新工具状态
  const toolIndex = db.tools.findIndex(t => t.tool_id === tool.tool_id);
  if (toolIndex > -1) {
    db.tools[toolIndex].status = 'reserved';
    db.tools[toolIndex].borrow_count = (db.tools[toolIndex].borrow_count || 0) + 1;
  }

  // 写入订单
  if (!db.orders) db.orders = [];
  db.orders.push(newOrder);
  writeDB(db);

  res.json({
    message: `领用成功，订单号 ${orderNo}`,
    order_no: orderNo,
    order_id: newOrder.order_id,
    tool: {
      tool_id: tool.tool_id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      status: 'reserved'
    }
  });
});

module.exports = router;

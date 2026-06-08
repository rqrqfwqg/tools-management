// 工具管理路由
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId } = require('./db');
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

  // 注入 toolkit_name 和 toolkit_seq
  const enriched = tools.map(tool => {
    const item = kitItems.find(i => i.tool_id === tool.tool_id);
    if (item) {
      const kit = toolkits.find(k => k.toolkit_id === item.toolkit_id);
      return { ...tool, toolkit_name: kit?.toolkit_name || '', toolkit_seq: item.sort_order || 0 };
    }
    return { ...tool, toolkit_name: '', toolkit_seq: 0 };
  });

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
  const { toolkit_name, description } = req.body;
  if (!toolkit_name) return res.status(400).json({ message: '工具箱名称不能为空' });
  const db = readDB();
  if ((db.toolkits || []).find(k => k.toolkit_name === toolkit_name)) {
    return res.status(400).json({ message: '工具箱名称已存在' });
  }
  const newKit = {
    toolkit_id: nextId(db.toolkits || [], 'toolkit_id'),
    toolkit_name,
    description: description || '',
    created_at: new Date().toISOString()
  };
  if (!db.toolkits) db.toolkits = [];
  db.toolkits.push(newKit);
  writeDB(db);
  res.json(newKit);
});

// 更新工具箱
router.put('/toolkits/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const { toolkit_name, description } = req.body;
  const db = readDB();
  const idx = (db.toolkits || []).findIndex(k => k.toolkit_id === id);
  if (idx === -1) return res.status(404).json({ message: '工具箱不存在' });
  if (toolkit_name) db.toolkits[idx].toolkit_name = toolkit_name;
  if (description !== undefined) db.toolkits[idx].description = description;
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
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description, toolkit, toolkit_name } = req.body;
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
    toolkit_name: toolkit_name !== undefined ? toolkit_name : (toolkit !== undefined ? toolkit : db.tools[toolIndex].toolkit_name)
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

// 图片上传
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `tool_${req.params.id}_${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      return cb(new Error('只支持 JPG/PNG/GIF 格式'));
    }
    cb(null, true);
  }
});

router.post('/tools/:id/upload-image', authenticate, requireMaterialManager, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择要上传的图片' });

  const toolId = parseInt(req.params.id);
  const db = readDB();
  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: '工具不存在' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  db.tools[toolIndex].image_url = imageUrl;
  writeDB(db);
  res.json({ message: '上传成功', image_url: imageUrl });
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

module.exports = router;

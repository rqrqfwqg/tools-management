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
  tools.sort((a, b) => (b.borrow_count || 0) - (a.borrow_count || 0));
  res.json(tools);
});

// 获取工具包列表
router.get('/toolkits', authenticate, (req, res) => {
  const db = readDB();
  const toolkits = [...new Set((db.tools || []).map(t => t.toolkit).filter(Boolean))].sort();
  res.json(toolkits);
});

// 获取工具包详情（含工具列表）
router.get('/toolkits/:name', authenticate, (req, res) => {
  const { name } = req.params;
  const db = readDB();
  const tools = (db.tools || []).filter(t => t.toolkit === name);
  res.json({ name, tools, count: tools.length });
});

// 工具绑定到工具包
router.post('/tools/:id/bind-toolkit', authenticate, requireMaterialManager, (req, res) => {
  const toolId = parseInt(req.params.id);
  const { toolkit } = req.body;
  if (!toolkit) return res.status(400).json({ message: '请指定工具包名称' });
  const db = readDB();
  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) return res.status(404).json({ message: '工具不存在' });
  db.tools[toolIndex].toolkit = toolkit;
  writeDB(db);
  res.json({ message: `已绑定到工具包"${toolkit}"` });
});

// 工具从工具包解绑
router.delete('/tools/:id/unbind-toolkit', authenticate, requireMaterialManager, (req, res) => {
  const toolId = parseInt(req.params.id);
  const db = readDB();
  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) return res.status(404).json({ message: '工具不存在' });
  db.tools[toolIndex].toolkit = '';
  writeDB(db);
  res.json({ message: '已从工具包解绑' });
});

// 创建工具
router.post('/tools', authenticate, requireMaterialManager, [
  body('tool_code').notEmpty().withMessage('工具编码不能为空'),
  body('tool_name').notEmpty().withMessage('工具名称不能为空'),
  validate
], (req, res) => {
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description, toolkit } = req.body;
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
    toolkit: toolkit || '', purchase_date: null, scrap_date: null
  };

  db.tools.push(newTool);
  writeDB(db);
  res.json(newTool);
});

// 更新工具
router.put('/tools/:id', authenticate, requireMaterialManager, (req, res) => {
  const toolId = parseInt(req.params.id);
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description, toolkit } = req.body;
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
    toolkit: toolkit !== undefined ? toolkit : db.tools[toolIndex].toolkit
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

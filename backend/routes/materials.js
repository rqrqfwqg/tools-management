// 物料管理路由 v3.0.0（备件 / 消耗品 / 物料分类 / 出入库流水 / 盘库）
// 单文件合并 5 类接口，仿写 tools.js，复用 compressImage / upload / 库位归属链校验 / validate
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

// ============ 图片上传（与 tools.js 一致） ============
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return cb(new Error('只支持 JPG/PNG/GIF/WebP 格式'));
    }
    cb(null, true);
  }
});

async function compressImage(inputBuffer, ext) {
  const MAX_SIZE = 2 * 1024 * 1024;
  const MAX_DIM = 2048;
  const metadata = await sharp(inputBuffer).metadata();
  const needsResize = metadata.width > MAX_DIM || metadata.height > MAX_DIM;
  if (inputBuffer.length <= MAX_SIZE && !needsResize) {
    return { buffer: inputBuffer, ext };
  }
  let quality = 82;
  let result = await sharp(inputBuffer)
    .resize(needsResize ? MAX_DIM : undefined, needsResize ? MAX_DIM : undefined, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality })
    .toBuffer();
  while (result.length > MAX_SIZE && quality > 20) {
    quality -= 15;
    result = await sharp(inputBuffer)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality })
      .toBuffer();
  }
  if (result.length > MAX_SIZE) {
    result = await sharp(inputBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 50 })
      .toBuffer();
  }
  if (result.length > inputBuffer.length && inputBuffer.length <= MAX_SIZE) {
    return { buffer: inputBuffer, ext };
  }
  if (result.length > MAX_SIZE) {
    return { buffer: inputBuffer, ext: '.jpg' };
  }
  return { buffer: result, ext: '.jpg' };
}

// 写入一条出入库流水
function writeMovement(db, m) {
  const movement = {
    movement_id: nextId(db.stock_movements || [], 'movement_id'),
    item_type: m.item_type,
    item_id: m.item_id || null,
    item_code: m.item_code || '',
    item_name: m.item_name || '',
    movement_type: m.movement_type,
    qty: m.qty,
    operator_id: m.operator_id || null,
    operator_name: m.operator_name || '',
    order_id: m.order_id !== undefined ? m.order_id : null,
    scan_code: m.scan_code || '',
    remark: m.remark || '',
    created_at: nowCST()
  };
  if (!db.stock_movements) db.stock_movements = [];
  db.stock_movements.push(movement);
  return movement;
}

// ============ 物料分类 ============
router.get('/material-categories', authenticate, (req, res) => {
  res.json(readDB().material_categories || []);
});

router.post('/material-categories', authenticate, requireMaterialManager, [
  body('category_name').notEmpty().withMessage('分类名称不能为空'),
  body('category_code').notEmpty().withMessage('分类编码不能为空'),
  validate
], (req, res) => {
  const { category_name, category_code, category_type, description } = req.body;
  const db = readDB();
  if ((db.material_categories || []).find(c => c.category_code === category_code)) {
    return res.status(400).json({ message: '分类编码已存在' });
  }
  if (!['spare', 'consumable', 'both'].includes(category_type)) {
    return res.status(400).json({ message: '分类类型必须是 spare/consumable/both' });
  }
  const newCategory = {
    category_id: nextId(db.material_categories || [], 'category_id'),
    category_name, category_code, category_type, description: description || ''
  };
  if (!db.material_categories) db.material_categories = [];
  db.material_categories.push(newCategory);
  writeDB(db);
  res.json(newCategory);
});

router.put('/material-categories/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const { category_name, category_code, category_type, description } = req.body;
  const db = readDB();
  const idx = (db.material_categories || []).findIndex(c => c.category_id === id);
  if (idx === -1) return res.status(404).json({ message: '分类不存在' });
  if (category_code && category_code !== db.material_categories[idx].category_code &&
      (db.material_categories || []).find(c => c.category_code === category_code)) {
    return res.status(400).json({ message: '分类编码已存在' });
  }
  db.material_categories[idx] = {
    ...db.material_categories[idx],
    category_name: category_name || db.material_categories[idx].category_name,
    category_code: category_code || db.material_categories[idx].category_code,
    category_type: category_type || db.material_categories[idx].category_type,
    description: description !== undefined ? description : db.material_categories[idx].description
  };
  writeDB(db);
  res.json(db.material_categories[idx]);
});

router.delete('/material-categories/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = (db.material_categories || []).findIndex(c => c.category_id === id);
  if (idx === -1) return res.status(404).json({ message: '分类不存在' });
  if ((db.spare_parts || []).some(s => s.category_id === id)) {
    return res.status(400).json({ message: '该分类下有关联备件，无法删除' });
  }
  if ((db.consumables || []).some(c => c.category_id === id)) {
    return res.status(400).json({ message: '该分类下有关联消耗品，无法删除' });
  }
  db.material_categories.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ============ 备件 ============
router.get('/spare-parts', authenticate, (req, res) => {
  const db = readDB();
  const categories = db.material_categories || [];
  const warehouses = db.warehouses || [];
  const shelves = db.shelves || [];
  const locations = db.storage_locations || [];
  const enriched = (db.spare_parts || []).map(sp => ({
    ...sp,
    category_name: categories.find(c => c.category_id === sp.category_id)?.category_name || '',
    warehouse_name: warehouses.find(w => w.warehouse_id === sp.warehouse_id)?.warehouse_name || '',
    shelf_name: shelves.find(s => s.shelf_id === sp.shelf_id)?.shelf_name || '',
    location_name: locations.find(l => l.location_id === sp.storage_location_id)?.location_name ||
      locations.find(l => l.location_id === sp.storage_location_id)?.location_code || ''
  }));
  res.json(enriched);
});

router.post('/spare-parts', authenticate, requireMaterialManager, [
  body('spare_code').notEmpty().withMessage('备件编码不能为空'),
  body('spare_name').notEmpty().withMessage('备件名称不能为空'),
  validate
], (req, res) => {
  const { spare_code, spare_name, category_id, warehouse_id, shelf_id, storage_location_id, unit, status, description } = req.body;
  const db = readDB();
  if ((db.spare_parts || []).find(s => s.spare_code === spare_code)) {
    return res.status(400).json({ message: '备件编码已存在' });
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
  const newSpare = {
    spare_id: nextId(db.spare_parts || [], 'spare_id'),
    spare_code, spare_name, category_id: category_id || null,
    category_name: (db.material_categories || []).find(c => c.category_id === category_id)?.category_name || '',
    warehouse_id: warehouse_id || null,
    warehouse: warehouse?.warehouse_name || '',
    shelf_id: shelf_id || null,
    storage_location_id: storage_location_id || null,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : '',
    stock_qty: 1,
    unit: unit || '件',
    status: status || 'available',
    image_url: '', description: description || '',
    borrow_count: 0, created_at: nowCST()
  };
  if (!db.spare_parts) db.spare_parts = [];
  db.spare_parts.push(newSpare);
  writeDB(db);
  res.json(newSpare);
});

router.put('/spare-parts/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const { spare_code, spare_name, category_id, warehouse_id, shelf_id, storage_location_id, unit, status, description, image_url } = req.body;
  const db = readDB();
  const idx = (db.spare_parts || []).findIndex(s => s.spare_id === id);
  if (idx === -1) return res.status(404).json({ message: '备件不存在' });
  const warehouse = warehouse_id ? db.warehouses.find(w => w.warehouse_id === warehouse_id) : null;
  const shelf = shelf_id ? db.shelves.find(s => s.shelf_id === shelf_id) : null;
  const location = storage_location_id ? db.storage_locations.find(l => l.location_id === storage_location_id) : null;
  db.spare_parts[idx] = {
    ...db.spare_parts[idx],
    spare_code: spare_code || db.spare_parts[idx].spare_code,
    spare_name: spare_name || db.spare_parts[idx].spare_name,
    category_id: category_id !== undefined ? category_id : db.spare_parts[idx].category_id,
    category_name: category_id ? (db.material_categories || []).find(c => c.category_id === category_id)?.category_name : db.spare_parts[idx].category_name,
    warehouse_id: warehouse_id !== undefined ? warehouse_id : db.spare_parts[idx].warehouse_id,
    warehouse: warehouse ? warehouse.warehouse_name : (warehouse_id === null ? '' : db.spare_parts[idx].warehouse),
    shelf_id: shelf_id !== undefined ? shelf_id : db.spare_parts[idx].shelf_id,
    storage_location_id: storage_location_id !== undefined ? storage_location_id : db.spare_parts[idx].storage_location_id,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : (storage_location_id === null ? '' : db.spare_parts[idx].storage_location),
    unit: unit !== undefined ? unit : db.spare_parts[idx].unit,
    status: status || db.spare_parts[idx].status,
    description: description !== undefined ? description : db.spare_parts[idx].description,
    image_url: image_url !== undefined ? image_url : db.spare_parts[idx].image_url
  };
  writeDB(db);
  res.json(db.spare_parts[idx]);
});

router.delete('/spare-parts/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = (db.spare_parts || []).findIndex(s => s.spare_id === id);
  if (idx === -1) return res.status(404).json({ message: '备件不存在' });
  db.spare_parts.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

router.get('/spare-parts/code/:code', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const db = readDB();
  const sp = (db.spare_parts || []).find(s => s.spare_code === code);
  if (!sp) return res.status(404).json({ message: `未找到编码为 "${code}" 的备件` });
  const enriched = {
    ...sp,
    category_name: (db.material_categories || []).find(c => c.category_id === sp.category_id)?.category_name || '',
    warehouse_name: db.warehouses.find(w => w.warehouse_id === sp.warehouse_id)?.warehouse_name || '',
    shelf_name: db.shelves.find(s => s.shelf_id === sp.shelf_id)?.shelf_name || '',
    location_name: db.storage_locations.find(l => l.location_id === sp.storage_location_id)?.location_name ||
      db.storage_locations.find(l => l.location_id === sp.storage_location_id)?.location_code || ''
  };
  res.json(enriched);
});

// 备件扫码领用 → 生成 pending 工单（item_type='spare'）
router.post('/spare-parts/code/:code/borrow', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const { scene, expected_return, purpose } = req.body || {};
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const sp = (db.spare_parts || []).find(s => s.spare_code === code);
  if (!sp) return res.status(404).json({ message: `未找到编码为 "${code}" 的备件` });
  if (sp.status !== 'available') {
    return res.status(400).json({ message: `备件"${sp.spare_name}"当前状态为"${sp.status}"，不可领用` });
  }
  const orderNo = `ORD${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
  const itemCounter = Date.now();
  const item = {
    item_id: (itemCounter << 12) | (randomPart & 0xFFF),
    item_type: 'spare',
    spare_id: sp.spare_id,
    spare_code: sp.spare_code,
    spare_name: sp.spare_name,
    item_status: 'reserved'
  };
  const newOrder = {
    order_id: nextId(db.orders || [], 'order_id'),
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_id: user.user_id,
    status: 'pending',
    warehouse: sp.warehouse || '',
    scene: scene || '扫码领用',
    borrow_time: new Date().toISOString(),
    expected_return: expected_return || null,
    actual_return: null,
    purpose: purpose || '',
    require_approval: true,
    created_at: new Date().toISOString(),
    items: [item]
  };
  const spIdx = (db.spare_parts || []).findIndex(s => s.spare_id === sp.spare_id);
  if (spIdx > -1) {
    db.spare_parts[spIdx].status = 'reserved';
    db.spare_parts[spIdx].borrow_count = (db.spare_parts[spIdx].borrow_count || 0) + 1;
  }
  if (!db.orders) db.orders = [];
  db.orders.push(newOrder);
  writeDB(db);
  res.json({
    message: `领用成功，订单号 ${orderNo}`,
    order_no: orderNo,
    order_id: newOrder.order_id,
    spare: { spare_id: sp.spare_id, spare_code: sp.spare_code, spare_name: sp.spare_name, status: 'reserved' }
  });
});

router.post('/spare-parts/:id/upload-image', authenticate, requireMaterialManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择要上传的图片' });
    const id = parseInt(req.params.id);
    const db = readDB();
    const idx = (db.spare_parts || []).findIndex(s => s.spare_id === id);
    if (idx === -1) return res.status(404).json({ message: '备件不存在' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const { buffer: compressed, ext: finalExt } = await compressImage(req.file.buffer, ext);
    if (compressed.length > 2 * 1024 * 1024) {
      return res.status(413).json({ message: `图片压缩后仍超过 2MB（当前 ${(compressed.length / 1024 / 1024).toFixed(1)}MB），请使用更小的图片` });
    }
    const filename = `spare_${id}_${Date.now()}${finalExt}`;
    fs.writeFileSync(path.join(uploadDir, filename), compressed);
    const oldUrl = db.spare_parts[idx].image_url;
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const imageUrl = `/uploads/${filename}`;
    db.spare_parts[idx].image_url = imageUrl;
    writeDB(db);
    res.json({ message: '上传成功（已自动压缩）', image_url: imageUrl, compressed_size: compressed.length });
  } catch (err) {
    console.error('[Upload] 备件图片压缩失败:', err.message);
    res.status(500).json({ message: '图片处理失败: ' + err.message });
  }
});

// ============ 消耗品 ============
router.get('/consumables', authenticate, (req, res) => {
  const db = readDB();
  const categories = db.material_categories || [];
  const warehouses = db.warehouses || [];
  const shelves = db.shelves || [];
  const locations = db.storage_locations || [];
  const enriched = (db.consumables || []).map(c => ({
    ...c,
    category_name: categories.find(cc => cc.category_id === c.category_id)?.category_name || '',
    warehouse_name: warehouses.find(w => w.warehouse_id === c.warehouse_id)?.warehouse_name || '',
    shelf_name: shelves.find(s => s.shelf_id === c.shelf_id)?.shelf_name || '',
    location_name: locations.find(l => l.location_id === c.storage_location_id)?.location_name ||
      locations.find(l => l.location_id === c.storage_location_id)?.location_code || ''
  }));
  res.json(enriched);
});

router.post('/consumables', authenticate, requireMaterialManager, [
  body('consumable_code').notEmpty().withMessage('消耗品编码不能为空'),
  body('consumable_name').notEmpty().withMessage('消耗品名称不能为空'),
  validate
], (req, res) => {
  const { consumable_code, consumable_name, category_id, warehouse_id, shelf_id, storage_location_id, unit, stock_qty, warning_qty, price, description } = req.body;
  const db = readDB();
  if ((db.consumables || []).find(c => c.consumable_code === consumable_code)) {
    return res.status(400).json({ message: '消耗品编码已存在' });
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
  const newConsumable = {
    consumable_id: nextId(db.consumables || [], 'consumable_id'),
    consumable_code, consumable_name, category_id: category_id || null,
    category_name: (db.material_categories || []).find(c => c.category_id === category_id)?.category_name || '',
    warehouse_id: warehouse_id || null,
    warehouse: warehouse?.warehouse_name || '',
    shelf_id: shelf_id || null,
    storage_location_id: storage_location_id || null,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : '',
    stock_qty: stock_qty != null ? Number(stock_qty) : 0,
    unit: unit || '个',
    warning_qty: warning_qty != null && warning_qty !== '' ? Number(warning_qty) : null,
    price: price != null && price !== '' ? Number(price) : null,
    image_url: '', description: description || '',
    total_out: 0, created_at: nowCST()
  };
  if (!db.consumables) db.consumables = [];
  db.consumables.push(newConsumable);
  writeDB(db);
  res.json(newConsumable);
});

router.put('/consumables/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const { consumable_code, consumable_name, category_id, warehouse_id, shelf_id, storage_location_id, unit, stock_qty, warning_qty, price, description, image_url } = req.body;
  const db = readDB();
  const idx = (db.consumables || []).findIndex(c => c.consumable_id === id);
  if (idx === -1) return res.status(404).json({ message: '消耗品不存在' });
  const warehouse = warehouse_id ? db.warehouses.find(w => w.warehouse_id === warehouse_id) : null;
  const shelf = shelf_id ? db.shelves.find(s => s.shelf_id === shelf_id) : null;
  const location = storage_location_id ? db.storage_locations.find(l => l.location_id === storage_location_id) : null;
  db.consumables[idx] = {
    ...db.consumables[idx],
    consumable_code: consumable_code || db.consumables[idx].consumable_code,
    consumable_name: consumable_name || db.consumables[idx].consumable_name,
    category_id: category_id !== undefined ? category_id : db.consumables[idx].category_id,
    category_name: category_id ? (db.material_categories || []).find(c => c.category_id === category_id)?.category_name : db.consumables[idx].category_name,
    warehouse_id: warehouse_id !== undefined ? warehouse_id : db.consumables[idx].warehouse_id,
    warehouse: warehouse ? warehouse.warehouse_name : (warehouse_id === null ? '' : db.consumables[idx].warehouse),
    shelf_id: shelf_id !== undefined ? shelf_id : db.consumables[idx].shelf_id,
    storage_location_id: storage_location_id !== undefined ? storage_location_id : db.consumables[idx].storage_location_id,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : (storage_location_id === null ? '' : db.consumables[idx].storage_location),
    unit: unit !== undefined ? unit : db.consumables[idx].unit,
    stock_qty: stock_qty != null ? Number(stock_qty) : db.consumables[idx].stock_qty,
    warning_qty: warning_qty != null && warning_qty !== '' ? Number(warning_qty) : db.consumables[idx].warning_qty,
    price: price != null && price !== '' ? Number(price) : db.consumables[idx].price,
    description: description !== undefined ? description : db.consumables[idx].description,
    image_url: image_url !== undefined ? image_url : db.consumables[idx].image_url
  };
  writeDB(db);
  res.json(db.consumables[idx]);
});

router.delete('/consumables/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = (db.consumables || []).findIndex(c => c.consumable_id === id);
  if (idx === -1) return res.status(404).json({ message: '消耗品不存在' });
  db.consumables.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

router.get('/consumables/code/:code', authenticate, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const db = readDB();
  const c = (db.consumables || []).find(cc => cc.consumable_code === code);
  if (!c) return res.status(404).json({ message: `未找到编码为 "${code}" 的消耗品` });
  const enriched = {
    ...c,
    category_name: (db.material_categories || []).find(cc => cc.category_id === c.category_id)?.category_name || '',
    warehouse_name: db.warehouses.find(w => w.warehouse_id === c.warehouse_id)?.warehouse_name || '',
    shelf_name: db.shelves.find(s => s.shelf_id === c.shelf_id)?.shelf_name || '',
    location_name: db.storage_locations.find(l => l.location_id === c.storage_location_id)?.location_name ||
      db.storage_locations.find(l => l.location_id === c.storage_location_id)?.location_code || ''
  };
  res.json(enriched);
});

// 消耗品直领：扣库存 + 写流水（无工单）
router.post('/consumables/code/:code/take', authenticate, [
  body('qty').isInt({ min: 1 }).withMessage('领用数量必须为正整数'),
  validate
], (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const qty = parseInt(req.body.qty);
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  const c = (db.consumables || []).find(cc => cc.consumable_code === code);
  if (!c) return res.status(404).json({ message: `未找到编码为 "${code}" 的消耗品` });
  if (qty > c.stock_qty) {
    return res.status(400).json({ message: `领用数量 ${qty} 超出当前库存 ${c.stock_qty}` });
  }
  const idx = (db.consumables || []).findIndex(cc => cc.consumable_id === c.consumable_id);
  db.consumables[idx].stock_qty -= qty;
  db.consumables[idx].total_out = (db.consumables[idx].total_out || 0) + qty;
  writeMovement(db, {
    item_type: 'consumable', item_id: c.consumable_id, item_code: c.consumable_code, item_name: c.consumable_name,
    movement_type: 'out', qty: -qty, operator_id: user?.user_id, operator_name: user?.real_name || user?.username,
    order_id: null, scan_code: code, remark: '扫码直领'
  });
  writeDB(db);
  res.json({ message: '领用成功', consumable: db.consumables[idx] });
});

// 低库存消耗品
router.get('/consumables/low-stock', authenticate, (req, res) => {
  const db = readDB();
  const list = (db.consumables || []).filter(c => c.warning_qty != null && c.stock_qty <= c.warning_qty);
  res.json(list);
});

router.post('/consumables/:id/upload-image', authenticate, requireMaterialManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择要上传的图片' });
    const id = parseInt(req.params.id);
    const db = readDB();
    const idx = (db.consumables || []).findIndex(c => c.consumable_id === id);
    if (idx === -1) return res.status(404).json({ message: '消耗品不存在' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const { buffer: compressed, ext: finalExt } = await compressImage(req.file.buffer, ext);
    if (compressed.length > 2 * 1024 * 1024) {
      return res.status(413).json({ message: `图片压缩后仍超过 2MB，请使用更小的图片` });
    }
    const filename = `consumable_${id}_${Date.now()}${finalExt}`;
    fs.writeFileSync(path.join(uploadDir, filename), compressed);
    const oldUrl = db.consumables[idx].image_url;
    if (oldUrl) {
      const oldPath = path.join(__dirname, '..', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const imageUrl = `/uploads/${filename}`;
    db.consumables[idx].image_url = imageUrl;
    writeDB(db);
    res.json({ message: '上传成功（已自动压缩）', image_url: imageUrl, compressed_size: compressed.length });
  } catch (err) {
    console.error('[Upload] 消耗品图片压缩失败:', err.message);
    res.status(500).json({ message: '图片处理失败: ' + err.message });
  }
});

// ============ 出入库流水 ============
router.get('/stock-movements', authenticate, (req, res) => {
  const db = readDB();
  let list = db.stock_movements || [];
  const { item_type, operator_name, start, end, page, limit } = req.query;
  if (item_type) list = list.filter(m => m.item_type === item_type);
  if (operator_name) list = list.filter(m => m.operator_name && m.operator_name.includes(operator_name));
  if (start) list = list.filter(m => m.created_at >= start);
  if (end) list = list.filter(m => m.created_at <= end);
  list = list.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = list.length;
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 50;
  const data = list.slice((p - 1) * l, p * l);
  res.json({ total, page: p, limit: l, data });
});

// 手动登记（in/out/adjust）：写流水并同步主表（消耗品改 stock_qty；备件/工具记流水）
router.post('/stock-movements', authenticate, requireMaterialManager, [
  body('item_type').isIn(['tool', 'spare', 'consumable']).withMessage('物料类型不合法'),
  body('movement_type').isIn(['in', 'out', 'adjust']).withMessage('变动类型不合法'),
  body('qty').isInt({ min: 1 }).withMessage('数量必须为正整数'),
  validate
], (req, res) => {
  const { item_type, item_id, item_code, item_name, movement_type, qty, remark } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  let resolvedCode = item_code || '';
  let resolvedName = item_name || '';
  let sign = movement_type === 'out' ? -qty : qty; // in/adjust 为正，out 为负

  if (item_type === 'consumable') {
    const c = (db.consumables || []).find(x => x.consumable_id === Number(item_id)) ||
      (db.consumables || []).find(x => x.consumable_code === item_code);
    if (!c) return res.status(404).json({ message: '消耗品不存在' });
    const idx = (db.consumables || []).findIndex(x => x.consumable_id === c.consumable_id);
    if (movement_type === 'out') {
      if (qty > c.stock_qty) return res.status(400).json({ message: `出库数量 ${qty} 超出当前库存 ${c.stock_qty}` });
      db.consumables[idx].stock_qty -= qty;
      db.consumables[idx].total_out = (db.consumables[idx].total_out || 0) + qty;
    } else {
      db.consumables[idx].stock_qty += qty;
    }
    resolvedCode = c.consumable_code;
    resolvedName = c.consumable_name;
  } else if (item_type === 'spare') {
    const sp = (db.spare_parts || []).find(x => x.spare_id === Number(item_id)) ||
      (db.spare_parts || []).find(x => x.spare_code === item_code);
    if (!sp) return res.status(404).json({ message: '备件不存在' });
    resolvedCode = sp.spare_code;
    resolvedName = sp.spare_name;
  } else if (item_type === 'tool') {
    const t = (db.tools || []).find(x => x.tool_id === Number(item_id)) ||
      (db.tools || []).find(x => x.tool_code === item_code);
    if (!t) return res.status(404).json({ message: '工具不存在' });
    resolvedCode = t.tool_code;
    resolvedName = t.tool_name;
  }

  const movement = writeMovement(db, {
    item_type, item_id: Number(item_id) || null, item_code: resolvedCode, item_name: resolvedName,
    movement_type, qty: sign, operator_id: user?.user_id, operator_name: user?.real_name || user?.username,
    order_id: null, remark: remark || '手动登记'
  });
  writeDB(db);
  res.json(movement);
});

// ============ 盘库 ============
function genCheckNo(db) {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${M}${d}`;
  const count = (db.inventory_checks || []).filter(c => c.check_no && c.check_no.includes(`PD-${datePart}`)).length;
  return `PD-${datePart}-${count + 1}`;
}

router.get('/inventory-checks', authenticate, (req, res) => {
  const db = readDB();
  const list = (db.inventory_checks || []).slice().sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  res.json(list);
});

router.post('/inventory-checks', authenticate, requireMaterialManager, [
  body('warehouse_id').isInt().withMessage('请选择仓库'),
  validate
], (req, res) => {
  const { warehouse_id } = req.body;
  const db = readDB();
  const warehouse = db.warehouses.find(w => w.warehouse_id === Number(warehouse_id));
  if (!warehouse) return res.status(404).json({ message: '仓库不存在' });
  if ((db.inventory_checks || []).some(c => c.warehouse_id === Number(warehouse_id) && c.status === 'pending')) {
    return res.status(400).json({ message: '该仓库已存在进行中的盘库单，请先完成' });
  }
  const user = db.users.find(u => u.user_id === req.user.user_id);
  // 预置该仓库下全部备件与消耗品为盘库明细
  const items = [];
  (db.spare_parts || []).filter(s => s.warehouse_id === Number(warehouse_id)).forEach(s => {
    items.push({ item_type: 'spare', item_id: s.spare_id, item_code: s.spare_code, item_name: s.spare_name, system_qty: 1, actual_qty: 0, diff: -1 });
  });
  (db.consumables || []).filter(c => c.warehouse_id === Number(warehouse_id)).forEach(c => {
    items.push({ item_type: 'consumable', item_id: c.consumable_id, item_code: c.consumable_code, item_name: c.consumable_name, system_qty: c.stock_qty, actual_qty: 0, diff: -c.stock_qty });
  });
  const newCheck = {
    check_id: nextId(db.inventory_checks || [], 'check_id'),
    check_no: genCheckNo(db),
    warehouse_id: Number(warehouse_id),
    warehouse_name: warehouse.warehouse_name,
    status: 'pending',
    operator_id: user?.user_id || null,
    operator_name: user?.real_name || user?.username || '',
    items,
    started_at: nowCST(),
    completed_at: null
  };
  if (!db.inventory_checks) db.inventory_checks = [];
  db.inventory_checks.push(newCheck);
  writeDB(db);
  res.json(newCheck);
});

router.get('/inventory-checks/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const check = (db.inventory_checks || []).find(c => c.check_id === id);
  if (!check) return res.status(404).json({ message: '盘库单不存在' });
  res.json(check);
});

// 提交实际数量：按 code 前缀解析 → 命中则写/覆盖 actual_qty，计算 diff（未命中则追加）
router.post('/inventory-checks/:id/scan', authenticate, [
  body('code').notEmpty().withMessage('编码不能为空'),
  validate
], (req, res) => {
  const id = parseInt(req.params.id);
  const { code, actual_qty } = req.body;
  const db = readDB();
  const check = (db.inventory_checks || []).find(c => c.check_id === id);
  if (!check) return res.status(404).json({ message: '盘库单不存在' });
  if (check.status !== 'pending') return res.status(400).json({ message: '盘库单已完成，无法录入' });

  let itemType = null, item = null;
  if (code.startsWith('BJ-')) {
    itemType = 'spare';
    item = (db.spare_parts || []).find(s => s.spare_code === code);
  } else if (code.startsWith('XH-')) {
    itemType = 'consumable';
    item = (db.consumables || []).find(c => c.consumable_code === code);
  } else if (code.startsWith('G-')) {
    itemType = 'tool';
    item = (db.tools || []).find(t => t.tool_code === code);
  } else {
    return res.status(400).json({ message: '无法识别的编码前缀（应为 BJ-/XH-/G-）' });
  }
  if (!item) return res.status(404).json({ message: `盘库单中未找到编码为 "${code}" 的物料（仅盘点本仓库物料）` });

  // 实际数量：备件扫到即在位记 1；消耗品取传入值
  let actual = actual_qty;
  if (itemType === 'spare') actual = (actual_qty != null) ? Number(actual_qty) : 1;
  else actual = Number(actual_qty != null ? actual_qty : (item.stock_qty || 0));

  const system_qty = itemType === 'spare' ? 1 : (item.stock_qty || 0);
  const existingIdx = check.items.findIndex(it => it.item_code === code);
  if (existingIdx > -1) {
    check.items[existingIdx].actual_qty = actual;
    check.items[existingIdx].diff = actual - check.items[existingIdx].system_qty;
  } else {
    check.items.push({
      item_type: itemType, item_id: item.spare_id || item.consumable_id || item.tool_id,
      item_code: code, item_name: item.spare_name || item.consumable_name || item.tool_name,
      system_qty, actual_qty: actual, diff: actual - system_qty
    });
  }
  writeDB(db);
  res.json({ message: '录入成功', item: check.items.find(it => it.item_code === code) });
});

// 完成盘库：diff≠0 写 adjust 流水并落账（消耗品同步 stock_qty），置 completed
router.post('/inventory-checks/:id/complete', authenticate, requireMaterialManager, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const cIdx = (db.inventory_checks || []).findIndex(c => c.check_id === id);
  if (cIdx === -1) return res.status(404).json({ message: '盘库单不存在' });
  const check = db.inventory_checks[cIdx];
  if (check.status !== 'pending') return res.status(400).json({ message: '盘库单已完成' });
  const user = db.users.find(u => u.user_id === req.user.user_id);

  const adjustments = [];
  for (const it of check.items) {
    const diff = it.actual_qty - it.system_qty;
    if (diff === 0) continue;
    if (it.item_type === 'consumable') {
      const idx = (db.consumables || []).findIndex(c => c.consumable_id === it.item_id);
      if (idx > -1) {
        db.consumables[idx].stock_qty = it.actual_qty; // 落账为实点数
      }
    }
    // 备件：仅记调整流水（不丢件不改数量）；消耗品：已同步数量
    const movement = writeMovement(db, {
      item_type: it.item_type,
      item_id: it.item_id,
      item_code: it.item_code,
      item_name: it.item_name,
      movement_type: 'adjust',
      qty: diff,
      operator_id: user?.user_id,
      operator_name: user?.real_name || user?.username,
      order_id: null,
      remark: `盘库调整 ${check.check_no}`
    });
    adjustments.push({ ...it, movement_id: movement.movement_id });
  }
  check.status = 'completed';
  check.completed_at = nowCST();
  writeDB(db);
  res.json({ message: '盘库完成', check, adjustments });
});

module.exports = router;

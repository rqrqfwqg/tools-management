/**
 * 批量导入工具录入清单（131件工具）
 * Usage: NODE_PATH=backend/node_modules node scripts/import-batch-tools.js
 */
const XLSX = require('/tmp/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'backend', 'db.json');
const XLSX_PATH = '/home/ubuntu/.openclaw/media/inbound/工具录入清单_待补充---cb9ce22f-9f9e-4ee1-afb5-89c21354c70a.xlsx';

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

function nextId(arr) {
  const ids = arr.map(x => x[Object.keys(x).find(k => k.endsWith('_id'))]).filter(Boolean);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// 读取文件
const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets['工具录入清单'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// 主仓库 ID
const MAIN_WH = db.warehouses.find(w => w.warehouse_name === '主仓库');
if (!MAIN_WH) { console.error('❌ 找不到主仓库'); process.exit(1); }

// 缓存分类
const categories = {};
db.categories.forEach(c => categories[c.category_name] = c);

let shelfCache = {};
let locCache = {};
let imported = 0, skipped = 0, createdShelves = 0, createdLocs = 0;

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[0]) continue;
  const code = String(r[0]).trim();

  // 跳过标题行（如 "1号货架 · 1层"）
  if (code.includes('货架') || code.includes('此层暂无') || code === '') continue;

  const name = String(r[1]).trim();
  const categoryName = String(r[2]).trim();
  const warehouseName = String(r[3]).trim();
  const shelfName = String(r[4]).trim();
  const locName = String(r[5]).trim();
  const status = String(r[6] || 'available').trim();
  const desc = r[7] ? String(r[7]).trim() : '';
  const purchaseDate = r[8] ? String(r[8]).trim() : '';
  const scene = r[9] ? String(r[9]).trim() : '';

  // 检查编码重复
  if (db.tools.find(t => t.tool_code === code)) {
    console.log(`⏭ 跳过已存在: ${code} ${name}`);
    skipped++;
    continue;
  }

  // 分类
  let cat = categories[categoryName];
  if (!cat) {
    cat = { category_id: nextId(db.categories), category_name: categoryName, category_code: '', description: '', require_approval: false };
    db.categories.push(cat);
    categories[categoryName] = cat;
    console.log(`📁 新建分类: ${categoryName}`);
  }

  // 仓库
  let wh = db.warehouses.find(w => w.warehouse_name === warehouseName);
  if (!wh) {
    wh = { warehouse_id: nextId(db.warehouses), warehouse_name: warehouseName, warehouse_code: '', description: '' };
    db.warehouses.push(wh);
    console.log(`🏭 新建仓库: ${warehouseName}`);
  }

  // 货架
  let shelf = shelfCache[shelfName];
  if (!shelf) {
    shelf = db.shelves.find(s => s.shelf_name === shelfName && s.warehouse_id === wh.warehouse_id);
    if (!shelf) {
      shelf = { shelf_id: nextId(db.shelves), warehouse_id: wh.warehouse_id, shelf_name: shelfName };
      db.shelves.push(shelf);
      createdShelves++;
    }
    shelfCache[shelfName] = shelf;
  }

  // 库位
  let loc = locCache[locName];
  if (!loc) {
    loc = db.storage_locations.find(l =>
      l.location_name === locName && l.shelf_id === shelf.shelf_id && l.warehouse_id === wh.warehouse_id
    );
    if (!loc) {
      loc = {
        location_id: nextId(db.storage_locations),
        shelf_id: shelf.shelf_id,
        warehouse_id: wh.warehouse_id,
        location_name: locName,
        location_code: '',
        description: '',
        is_active: true
      };
      db.storage_locations.push(loc);
      createdLocs++;
    }
    locCache[locName] = loc;
  }

  // 创建工具
  const tool = {
    tool_id: nextId(db.tools),
    tool_code: code,
    tool_name: name,
    category_id: cat.category_id,
    category_name: cat.category_name,
    status: status,
    warehouse_id: wh.warehouse_id,
    warehouse: wh.warehouse_name,
    shelf_id: shelf.shelf_id,
    storage_location_id: loc.location_id,
    storage_location: loc.location_name,
    scene: scene,
    borrow_count: 0,
    description: desc,
    image_url: '',
    purchase_date: purchaseDate,
    scrap_date: '',
    toolkit_name: ''
  };
  db.tools.push(tool);
  imported++;
}

// 写回
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

console.log('\n========== 导入完成 ==========');
console.log(`📦 新增货架: ${createdShelves} 个`);
console.log(`📍 新增库位: ${createdLocs} 个`);
console.log(`✅ 导入工具: ${imported} 个`);
console.log(`⏭ 跳过重复: ${skipped} 个`);
console.log(`📊 工具总计: ${db.tools.length} 个`);
console.log(`📊 货架总计: ${db.shelves.length} 个`);
console.log(`📊 库位总计: ${db.storage_locations.length} 个`);

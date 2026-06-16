#!/usr/bin/env node
/**
 * 批量导入工具到生产环境
 * 用法：node deploy/production/import-tools.js
 * 无外部依赖，只用 Node.js 内置 http 模块
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 3000;

// 读取工具数据
const dataPath = path.join(__dirname, 'tools-data.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌ tools-data.json 不存在，请确保文件在 deploy/production/ 目录下');
  process.exit(1);
}
const tools = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
console.log(`📦 共 ${tools.length} 件工具待导入\n`);

// HTTP 请求封装
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST, port: PORT, method,
      path,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, data: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, data: text });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function login() {
  console.log('🔐 登录...');
  const res = await request('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  if (res.status !== 200 || !res.data.access_token) {
    throw new Error('登录失败: ' + JSON.stringify(res.data));
  }
  return res.data.access_token;
}

async function apiCall(token, method, path, body) {
  const headers = { 'Authorization': `Bearer ${token}` };
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST, port: PORT, method,
      path,
      headers: { ...headers, 'Content-Type': 'application/json' }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, data: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, data: text });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function ensureEntity(token, getPath, postPath, nameField, codeField, name, code, extras = {}) {
  // 先查列表
  const listRes = await apiCall(token, 'GET', getPath);
  if (listRes.status === 200) {
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data.tools || listRes.data.items || []);
    const found = items.find(item => item[nameField] === name);
    if (found) {
      return found.id || found.entity_id || found[Object.keys(found).find(k => k.endsWith('_id'))];
    }
  }
  // 不存在则创建
  const body = { [nameField]: name, [codeField]: code, ...extras };
  const res = await apiCall(token, 'POST', postPath, body);
  if (res.status === 200 || res.status === 201) {
    const id = res.data.id || res.data.tool_id || res.data[Object.keys(res.data).find(k => k.endsWith('_id'))];
    console.log(`  ✅ 创建 ${nameField}: ${name} (id=${id})`);
    return id;
  }
  console.log(`  ⚠️  ${name} -> ${res.status}: ${JSON.stringify(res.data).substring(0, 100)}`);
  return null;
}

async function main() {
  try {
    const token = await login();
    console.log('  ✅ 登录成功\n');

    // Category mapping from the data
    const catNames = [...new Set(tools.map(t => t.category_name))];
    const catMap = {};
    for (const cn of catNames) {
      const listRes = await apiCall(token, 'GET', '/api/tool-categories');
      const cats = Array.isArray(listRes.data) ? listRes.data : [];
      const found = cats.find(c => c.category_name === cn);
      if (found) {
        catMap[cn] = found.category_id;
        console.log(`  📂 ${cn} (id=${found.category_id})`);
      }
    }
    console.log();

    // Warehouse
    const whList = await apiCall(token, 'GET', '/api/warehouses');
    const whs = Array.isArray(whList.data) ? whList.data : [];
    let mainWh = whs.find(w => w.warehouse_name === '主仓库');
    if (!mainWh) {
      const cr = await apiCall(token, 'POST', '/api/warehouses', { warehouse_name: '主仓库', warehouse_code: '主仓库' });
      mainWh = cr.data;
      console.log(`  🏭 创建主仓库 (id=${mainWh.warehouse_id})`);
    } else {
      console.log(`  🏭 主仓库 (id=${mainWh.warehouse_id})`);
    }
    const mainWhId = mainWh.warehouse_id;

    // Shelves
    const shelfNames = [...new Set(tools.map(t => t.shelf_name))];
    const shelfMap = {};
    for (const sn of shelfNames) {
      const sc = sn.replace('号货架', ''); // "1号货架" -> "HJ-01"
      const id = await ensureEntity(token, '/api/shelves', '/api/shelves', 'shelf_name', 'shelf_code', sn, `HJ-${sc.padStart(2, '0')}`, { warehouse_id: mainWhId });
      if (id) shelfMap[sn] = id;
    }
    console.log();

    // Storage locations
    const locNames = [...new Set(tools.map(t => t.location_name).filter(Boolean))];
    const locMap = {};
    for (const ln of locNames) {
      const shelfName = ln.endsWith('层') ? ln.substring(0, ln.length - 2) + '货架' : ln;
      if (shelfName && shelfName.includes('号货架')) {
        const shelfNum = shelfName.charAt(0);
        const layerNum = ln.charAt(ln.length - 2);
        const lc = `HJ${shelfNum.padStart(2, '0')}-${layerNum.padStart(2, '0')}`;
        const sid = shelfMap[shelfName];
        const id = await ensureEntity(token, '/api/storage-locations', '/api/storage-locations', 'location_name', 'location_code', ln, lc, { warehouse_id: mainWhId, shelf_id: sid });
        if (id) locMap[ln] = id;
      }
    }
    console.log();

    // Import tools
    console.log('='.repeat(55));
    console.log(`🔧 批量导入 ${tools.length} 件工具...`);
    console.log('='.repeat(55));

    let ok = 0, skip = 0, fail = 0;
    const errs = [];

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      const body = {
        tool_code: t.tool_code,
        tool_name: t.tool_name,
        category_id: catMap[t.category_name],
        warehouse_id: mainWhId,
        shelf_id: shelfMap[t.shelf_name] || null,
        storage_location_id: locMap[t.location_name] || null,
        status: 'available',
        description: t.description || '',
      };
      const res = await apiCall(token, 'POST', '/api/tools', body);
      if (res.status === 200 || res.status === 201) {
        ok++;
      } else if (res.status === 400 && res.data && res.data.message && res.data.message.includes('已存在')) {
        skip++;
      } else {
        fail++;
        errs.push(`${t.tool_code} ${t.tool_name}`);
      }

      if ((i + 1) % 25 === 0 || i === tools.length - 1) {
        console.log(`  [${String(i+1).padStart(3)}/${tools.length}] ✅${ok} ⏭️${skip} ❌${fail}`);
      }
    }

    console.log(`\n${'='.repeat(55)}`);
    console.log(`📊 导入完成: ${ok} 新建, ${skip} 已存在, ${fail} 失败`);
    if (errs.length > 0) {
      console.log(`\n失败明细 (前10):`);
      errs.slice(0, 10).forEach(e => console.log(`  ❌ ${e}`));
    }
  } catch (err) {
    console.error('💥 错误:', err.message);
    process.exit(1);
  }
}

main();

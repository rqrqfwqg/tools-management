// 安全防护用品管理路由
// 表格增删查改 + 定期检查提醒 + 过期前提醒
// 风格对齐 materials.js：express.Router + authenticate/requireMaterialManager + express-validator
const express = require('express');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId, nowCST } = require('./db');
const { authenticate, requireMaterialManager } = require('../middleware/auth');

const router = express.Router();

// 统一的校验结果处理（与 materials.js 一致）
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: '参数校验失败', errors: errors.array() });
  }
  next();
};

// ============ 日期工具（纯函数） ============

/**
 * 将 'YYYY-MM-DD' 解析为 UTC 零点 Date（非法或空返回 null）。
 * 使用 UTC 零点可避免本地时区/夏令时导致的天数偏差。
 * @param {string|null|undefined} str
 * @returns {Date|null}
 */
function toDateOnly(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 防御：形如 2026-02-30 会被 Date 自动进位，需二次校验
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) {
    return null;
  }
  return d;
}

/**
 * 在 UTC 零点 Date 上增加天数，返回 'YYYY-MM-DD' 字符串。
 * @param {Date} date
 * @param {number} days
 * @returns {string}
 */
function addDaysStr(date, days) {
  return new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10);
}

/**
 * 计算两个日期（UTC 零点）相差的天数：b - a。
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// 当前 CST 日期的 'YYYY-MM-DD'（nowCST 返回带 +08:00 的 ISO，取前 10 位即 CST 日期）
function todayStrCST() {
  return nowCST().slice(0, 10);
}

// 'YYYY-MM-DD' 合法性校验（供 express-validator 使用）
function isValidDateStr(value) {
  if (value == null || value === '') return true; // 空值由 optional 放行，这里只校验非空的格式
  return toDateOnly(value) !== null;
}

// 取全局过期提醒提前期（默认 90）
function getExpiryAlertDays(db) {
  return db.settings && db.settings.expiry_alert_days != null
    ? Number(db.settings.expiry_alert_days)
    : 90;
}

// ============ 列表（模糊搜索） ============
router.get('/safety-supplies', authenticate, (req, res) => {
  const db = readDB();
  db.safety_supplies = db.safety_supplies || [];
  db.settings = db.settings || {};
  const keyword = (req.query.keyword || '').toString().toLowerCase();
  let list = db.safety_supplies;
  if (keyword) {
    list = list.filter((s) =>
      [s.name, s.model, s.brand, s.manager, s.user_name]
        .some((f) => f && String(f).toLowerCase().includes(keyword))
    );
  }
  res.json(list);
});

// ============ 提醒数据（过期 + 定期检查） ============
// 注意：必须在 '/safety-supplies/:id' 之前注册，避免被参数路由捕获
router.get('/safety-supplies/alerts', authenticate, (req, res) => {
  const db = readDB();
  db.safety_supplies = db.safety_supplies || [];
  db.settings = db.settings || {};
  const expiryAlertDays = getExpiryAlertDays(db);
  const today = todayStrCST();
  const todayDate = toDateOnly(today);

  const expiring = [];
  const checkDue = [];

  for (const s of db.safety_supplies) {
    // —— 过期提醒 ——
    if (s.expiry_date) {
      const expDate = toDateOnly(s.expiry_date);
      if (expDate) {
        const daysToExpiry = daysBetween(todayDate, expDate);
        const expired = daysToExpiry < 0;
        const expiringSoon = daysToExpiry >= 0 && daysToExpiry <= expiryAlertDays;
        if (expired || expiringSoon) {
          expiring.push({ ...s, days_to_expiry: daysToExpiry });
        }
      }
    }

    // —— 定期检查提醒 ——
    const cycle = s.check_cycle_days != null ? Number(s.check_cycle_days) : 90;
    let nextCheckDate = null;
    if (s.last_check_date) {
      const lc = toDateOnly(s.last_check_date);
      if (lc) nextCheckDate = addDaysStr(lc, cycle);
    }
    const checkDueFlag = nextCheckDate == null ? true : nextCheckDate <= today;
    if (checkDueFlag) {
      checkDue.push({ ...s, next_check_date: nextCheckDate });
    }
  }

  res.json({ expiry_alert_days: expiryAlertDays, expiring, check_due: checkDue });
});

// ============ 全局设置（读取） ============
router.get('/safety-supplies/settings', authenticate, (req, res) => {
  const db = readDB();
  db.settings = db.settings || {};
  res.json({ expiry_alert_days: getExpiryAlertDays(db) });
});

// ============ 全局设置（更新） ============
router.put('/safety-supplies/settings', authenticate, requireMaterialManager, [
  body('expiry_alert_days').isInt({ min: 1 }).withMessage('过期提醒提前期必须为正整数'),
  validate
], (req, res) => {
  const { expiry_alert_days } = req.body;
  const db = readDB();
  db.settings = db.settings || {};
  db.settings.expiry_alert_days = Number(expiry_alert_days);
  writeDB(db);
  res.json({ expiry_alert_days: db.settings.expiry_alert_days });
});

// 共用写操作校验：name/expiry_date/manager 非空；三个日期字段若存在须合法
const writeValidators = [
  body('name').notEmpty().withMessage('物品名不能为空'),
  body('expiry_date').notEmpty().withMessage('到期日期不能为空'),
  body('manager').notEmpty().withMessage('管理人不能为空'),
  body('production_date').optional({ values: 'falsy' }).custom(isValidDateStr).withMessage('生产日期格式不合法(YYYY-MM-DD)'),
  body('expiry_date').optional({ values: 'falsy' }).custom(isValidDateStr).withMessage('到期日期格式不合法(YYYY-MM-DD)'),
  body('last_check_date').optional({ values: 'falsy' }).custom(isValidDateStr).withMessage('上次检查日期格式不合法(YYYY-MM-DD)'),
  validate
];

// ============ 新增 ============
router.post('/safety-supplies', authenticate, requireMaterialManager, writeValidators, (req, res) => {
  const {
    name, model, brand, production_date, expiry_date, manager,
    user_name, check_cycle_days, last_check_date, remark
  } = req.body;
  const db = readDB();
  db.safety_supplies = db.safety_supplies || [];
  db.settings = db.settings || {};

  const newSupply = {
    supply_id: nextId(db.safety_supplies, 'supply_id'),
    name,
    model: model || '',
    brand: brand || '',
    production_date: production_date || '',
    expiry_date,
    manager,
    user_name: user_name || '',
    check_cycle_days: check_cycle_days != null && check_cycle_days !== '' ? Number(check_cycle_days) : 90,
    last_check_date: last_check_date || null,
    remark: remark || '',
    created_at: nowCST(),
    updated_at: nowCST()
  };
  db.safety_supplies.push(newSupply);
  writeDB(db);
  res.json(newSupply);
});

// ============ 修改（:id 必须在 /alerts、/settings 之后） ============
router.put('/safety-supplies/:id', authenticate, requireMaterialManager, writeValidators, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  db.safety_supplies = db.safety_supplies || [];
  const idx = db.safety_supplies.findIndex((s) => s.supply_id === id);
  if (idx === -1) return res.status(404).json({ message: '用品不存在' });
  const cur = db.safety_supplies[idx];
  const {
    name, model, brand, production_date, expiry_date, manager,
    user_name, check_cycle_days, last_check_date, remark
  } = req.body;

  db.safety_supplies[idx] = {
    ...cur,
    name: name != null && name !== '' ? name : cur.name,
    model: model !== undefined ? (model || '') : cur.model,
    brand: brand !== undefined ? (brand || '') : cur.brand,
    production_date: production_date !== undefined ? (production_date || '') : cur.production_date,
    expiry_date: expiry_date != null && expiry_date !== '' ? expiry_date : cur.expiry_date,
    manager: manager != null && manager !== '' ? manager : cur.manager,
    user_name: user_name !== undefined ? (user_name || '') : cur.user_name,
    check_cycle_days: check_cycle_days != null && check_cycle_days !== '' ? Number(check_cycle_days) : cur.check_cycle_days,
    last_check_date: last_check_date !== undefined ? (last_check_date || null) : cur.last_check_date,
    remark: remark !== undefined ? (remark || '') : cur.remark,
    updated_at: nowCST()
  };
  writeDB(db);
  res.json(db.safety_supplies[idx]);
});

// ============ 删除 ============
router.delete('/safety-supplies/:id', authenticate, requireMaterialManager, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  db.safety_supplies = db.safety_supplies || [];
  const idx = db.safety_supplies.findIndex((s) => s.supply_id === id);
  if (idx === -1) return res.status(404).json({ message: '用品不存在' });
  db.safety_supplies.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

module.exports = router;

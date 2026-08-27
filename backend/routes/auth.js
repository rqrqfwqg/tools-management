// 认证路由
const https = require('https');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, requireAdmin, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ---------- 登录审计（记录 IP/时间/账号/方式，供安全追溯） ----------
// 真实客户端 IP：trust proxy=1 下 req.ip 已是公网 IP；再兼容手动解析 X-Forwarded-For
function getClientIp(req) {
  const xff = (req.headers && req.headers['x-forwarded-for'] || '').split(',');
  const first = xff[0] && xff[0].trim();
  return first || req.ip || '';
}

function recordLogin({ user_id, username, role, login_ip, login_method, user_agent, success, fail_reason }) {
  try {
    const db = readDB();
    if (!Array.isArray(db.admin_login_logs)) db.admin_login_logs = [];
    const log_id = nextId(db.admin_login_logs);
    db.admin_login_logs.push({
      log_id,
      user_id: user_id != null ? user_id : null,
      username: username || '',
      role: role || '',
      login_ip: login_ip || '',
      login_method: login_method || '',
      user_agent: String(user_agent || '').slice(0, 300),
      success: !!success,
      fail_reason: fail_reason || '',
      login_at: new Date().toISOString()
    });
    writeDB(db);
  } catch (e) {
    console.error('[LoginAudit] 写入登录日志失败:', e.message);
  }
}

// 登录速率限制
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { message: '登录尝试次数过多，请 5 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: '参数校验失败', errors: errors.array() });
  }
  next();
};

// 登录（账号免密直登：手机号或用户名匹配即签发，兼容 identifier/phone/username）
// 个人主体小程序无法使用 getPhoneNumber，故改为手动输入账号绑定本机；
// 可选 wx_code：微信一键登录场景下携带，登录成功且该用户 wx_openid 为空时自动绑定当前微信，
// 绑定后下次可直接「微信一键登录」进正式账号（不再进游客模式）。
// token 30 天有效 + 前端本地持久化，避免频繁重复绑定。
router.post('/auth/login', loginLimiter, [validate], async (req, res) => {
  const identifier = String(req.body.identifier || req.body.phone || req.body.username || '').trim();
  const wxCode = String(req.body.wx_code || '').trim(); // 可选：uni.login 的 code

  if (!identifier) {
    return res.status(400).json({ message: '请填写手机号或用户名' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === identifier || u.username === identifier);

  if (!user) {
    recordLogin({ username: identifier, role: '', login_ip: getClientIp(req), login_method: 'password', user_agent: req.headers['user-agent'], success: false, fail_reason: '账号不存在' });
    return res.status(401).json({ message: '账号不存在，请检查手机号或用户名' });
  }

  if (!user.is_active) {
    recordLogin({ user_id: user.user_id, username: user.username, role: user.role, login_ip: getClientIp(req), login_method: 'password', user_agent: req.headers['user-agent'], success: false, fail_reason: '用户已被禁用' });
    return res.status(403).json({ message: '用户已被禁用' });
  }

  // 可选：wx_code → openid，绑定到该账号（首次微信一键登录绑定；wx 凭证无效/未配置时静默跳过，不阻断登录）
  // 一一对应约束：微信 openid 与账号互斥——该 openid 已被其他账号绑定时拒绝，防止一个微信绑多个账号
  let bound_openid = false;
  if (wxCode) {
    try {
      const appid = process.env.WX_APPID;
      const secret = process.env.WX_SECRET;
      if (appid && secret) {
        const session = await wxCode2Session(wxCode, appid, secret);
        const openid = session && session.openid ? session.openid : null;
        if (openid && !user.wx_openid) {
          const occupied = db.users.find(u => u.user_id !== user.user_id && u.wx_openid === openid);
          if (occupied) {
            return res.status(409).json({
              message: `该微信已绑定系统账号「${occupied.username}」，请先在该账号解绑微信后再绑定当前账号`
            });
          }
          user.wx_openid = openid;
          writeDB(db);
          bound_openid = true;
        }
      }
    } catch (err) {
      console.error('[AuthLogin] wx_code 换取 openid 失败（忽略绑定）:', err.message);
    }
  }

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const { password: _, ...userWithoutPassword } = user;
  recordLogin({ user_id: user.user_id, username: user.username, role: user.role, login_ip: getClientIp(req), login_method: 'password', user_agent: req.headers['user-agent'], success: true });
  res.json({ access_token: token, user: userWithoutPassword, bound_openid });
});

// 获取当前用户信息
router.get('/auth/me', authenticate, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// 修改密码
router.post('/auth/change-password', authenticate, (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ message: '旧密码和新密码不能为空' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: '新密码长度不能小于6位' });
  }

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.user_id === req.user.user_id);

  if (userIndex === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  if (!bcrypt.compareSync(old_password, db.users[userIndex].password)) {
    return res.status(400).json({ message: '旧密码错误' });
  }

  db.users[userIndex].password = bcrypt.hashSync(new_password, 10);
  writeDB(db);

  res.json({ message: '密码修改成功' });
});

// ============ 微信小程序登录 ============

// 调用微信 jscode2session 接口换取 openid/session_key（仅服务端使用，session_key 绝不外泄）
function wxCode2Session(code, appid, secret) {
  return new Promise((resolve, reject) => {
    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;
    const req = https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error(`微信接口返回非 JSON: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('微信接口请求超时')));
  });
}

// ---------- 微信 access_token 与手机号解析 ----------

// access_token 缓存（微信 7200s 有效期，提前 300s 刷新）
let wxAccessToken = null;
let wxAccessTokenExpireAt = 0;

function getWxAccessToken() {
  return new Promise((resolve, reject) => {
    if (wxAccessToken && Date.now() < wxAccessTokenExpireAt) return resolve(wxAccessToken);
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) return reject(new Error('WX_APPID/WX_SECRET 未配置'));
    const url =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential` +
      `&appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}`;
    const req = https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.errcode) return reject(new Error(`微信 token 获取失败 errcode=${data.errcode} ${data.errmsg || ''}`));
          wxAccessToken = data.access_token;
          wxAccessTokenExpireAt = Date.now() + (Number(data.expires_in) - 300) * 1000;
          resolve(wxAccessToken);
        } catch (err) {
          reject(new Error(`微信 token 接口返回非 JSON: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('微信 token 接口请求超时')));
  });
}

// 用 getPhoneNumber 按钮的 code 换手机号（新 API，凭 access_token 调用，无需 session_key）
function wxPhoneCode2Number(phoneCode, accessToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ code: phoneCode });
    const url =
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber` +
      `?access_token=${encodeURIComponent(accessToken)}`;
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.errcode) return reject(new Error(`手机号解析失败 errcode=${data.errcode} ${data.errmsg || ''}`));
            resolve(data.phone_info || {});
          } catch (err) {
            reject(new Error(`手机号接口返回非 JSON: ${raw.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('微信手机号接口请求超时')));
    req.write(body);
    req.end();
  });
}

/** 游客身份（只读：可查看数据，禁止一切写操作，server.js 全局守卫） */
function guestUser() {
  return {
    user_id: 0,
    username: 'guest',
    real_name: '游客',
    role: 'guest',
    role_name: '游客',
    is_active: true
  };
}

/** 统一签发 JWT（30 天，配合前端本地持久化减少重复登录） */
function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// 微信小程序登录：code2session 换取 openid → 仅允许已绑定手机号的账号登录；
// 未匹配一律游客模式（只读），不再自动注册员工账号
router.post('/auth/wx-login', loginLimiter, async (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({ message: 'code is required' });
  }

  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appid || !secret) {
    console.error('[WXLogin] WX_APPID/WX_SECRET 未配置，无法登录');
    return res.status(500).json({ message: '微信登录未配置，请联系管理员' });
  }

  let session;
  try {
    session = await wxCode2Session(code, appid, secret);
  } catch (err) {
    console.error('[WXLogin] 调用微信接口失败:', err.message);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx', user_agent: req.headers['user-agent'], success: false, fail_reason: '微信服务调用失败' });
    return res.status(502).json({ message: '微信服务暂不可用，请稍后再试' });
  }

  // 微信业务错误：如 code 无效/过期、appid 与 secret 不匹配等
  if (session.errcode) {
    console.error(`[WXLogin] 微信返回错误 errcode=${session.errcode} errmsg=${session.errmsg}`);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx', user_agent: req.headers['user-agent'], success: false, fail_reason: `微信返回错误 errcode=${session.errcode}` });
    return res.status(401).json({ message: 'wx login failed' });
  }

  const openid = session.openid;
  // 防御微信异常返回（未返回 openid 一律视为登录失败）
  if (!openid) {
    console.error('[WXLogin] 微信未返回 openid，raw=', JSON.stringify(session));
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx', user_agent: req.headers['user-agent'], success: false, fail_reason: '微信未返回 openid' });
    return res.status(401).json({ message: 'wx login failed' });
  }

  const db = readDB();
  // 仅允许「已通过手机号匹配且绑定 wx_openid」的真实账号登录
  const user = db.users.find(u => u.wx_openid === openid && (u.phone || '').trim());
  if (user && user.is_active !== false) {
    const token = signToken(user);
    const { password: _, ...userWithoutPassword } = user;
    recordLogin({ user_id: user.user_id, username: user.username, role: user.role, login_ip: getClientIp(req), login_method: 'wx', user_agent: req.headers['user-agent'], success: true });
    return res.json({ access_token: token, user: userWithoutPassword, is_new_user: false, guest: false });
  }

  // 未匹配 → 游客模式（只读）
  const guest = guestUser();
  const token = signToken(guest);
  recordLogin({ user_id: 0, username: 'guest', role: 'guest', login_ip: getClientIp(req), login_method: 'wx', user_agent: req.headers['user-agent'], success: true });
  return res.json({
    access_token: token,
    user: guest,
    is_new_user: false,
    guest: true,
    message: '未匹配到系统账号，已进入游客模式（只读）'
  });
});

// 微信手机号登录：getPhoneNumber 的 code → 解析手机号 → 匹配系统账号 → 签发对应权限 token
// 未匹配 → 游客模式（只读）。游客只能查看数据，写操作由 server.js 全局守卫拒绝。
router.post('/auth/wx-phone-login', loginLimiter, async (req, res) => {
  const { code, phoneCode } = req.body || {};
  if (!phoneCode) {
    return res.status(400).json({ message: 'phoneCode is required' });
  }

  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appid || !secret) {
    console.error('[WXPhoneLogin] WX_APPID/WX_SECRET 未配置，无法登录');
    return res.status(500).json({ message: '微信登录未配置，请联系管理员' });
  }

  // 1) 微信登录 code → openid（用于给匹配账号绑定 wx_openid）
  let session;
  try {
    session = await wxCode2Session(code, appid, secret);
  } catch (err) {
    console.error('[WXPhoneLogin] 调用微信接口失败:', err.message);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '微信服务调用失败' });
    return res.status(502).json({ message: '微信服务暂不可用，请稍后再试' });
  }
  if (session.errcode || !session.openid) {
    console.error(`[WXPhoneLogin] 微信返回错误 errcode=${session.errcode} errmsg=${session.errmsg}`);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: `微信返回错误 errcode=${session.errcode}` });
    return res.status(401).json({ message: 'wx login failed' });
  }
  const openid = session.openid;

  // 2) getPhoneNumber code → 手机号（新 API，服务端凭 access_token 调用）
  let accessToken;
  try {
    accessToken = await getWxAccessToken();
  } catch (err) {
    console.error('[WXPhoneLogin] 获取 access_token 失败:', err.message);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '获取微信 access_token 失败' });
    return res.status(502).json({ message: err.message });
  }
  let phoneInfo;
  try {
    phoneInfo = await wxPhoneCode2Number(phoneCode, accessToken);
  } catch (err) {
    console.error('[WXPhoneLogin] 解析手机号失败:', err.message);
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '解析手机号失败' });
    return res.status(502).json({ message: err.message });
  }
  const phone = (phoneInfo.purePhoneNumber || phoneInfo.phoneNumber || '').trim();
  if (!/^1\d{10}$/.test(phone)) {
    recordLogin({ username: '', role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '手机号格式不正确' });
    return res.status(400).json({ message: '未能获取有效手机号' });
  }

  // 3) 手机号匹配系统账号（同号多账户防护）
  const db = readDB();
  const matched = db.users.filter(u => (u.phone || '').trim() === phone);
  if (matched.length > 1) {
    recordLogin({ username: phone, role: '', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '手机号关联多个账户' });
    return res.status(403).json({ message: '该手机号关联多个账户，请联系管理员' });
  }
  const target = matched[0];
  if (target && target.is_active === false) {
    recordLogin({ user_id: target.user_id, username: target.username, role: target.role, login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: false, fail_reason: '用户已被禁用' });
    return res.status(403).json({ message: '用户已被禁用' });
  }

  if (target) {
    // 绑定 wx_openid：下次微信一键登录可直接进入该账号
    if (openid && !target.wx_openid) {
      target.wx_openid = openid;
      writeDB(db);
    }
    const token = signToken(target);
    const { password: _, ...userWithoutPassword } = target;
    recordLogin({ user_id: target.user_id, username: target.username, role: target.role, login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: true });
    return res.json({ access_token: token, user: userWithoutPassword, is_new_user: false, guest: false });
  }

  // 4) 未匹配 → 游客模式（只读）
  const guest = guestUser();
  const token = signToken(guest);
  recordLogin({ user_id: 0, username: 'guest', role: 'guest', login_ip: getClientIp(req), login_method: 'wx_phone', user_agent: req.headers['user-agent'], success: true });
  return res.json({
    access_token: token,
    user: guest,
    is_new_user: false,
    guest: true,
    message: '手机号未匹配到系统账号，已进入游客模式（只读）'
  });
});

// 微信绑定手机号：把当前微信账户的 wx_openid 关联到已有手机号账户
router.post('/auth/wx-bind-phone', authenticate, (req, res) => {
  const phone = (req.body || {}).phone;
  if (!phone) {
    return res.status(400).json({ message: '手机号不能为空' });
  }
  const phoneTrim = String(phone).trim();
  if (!/^1\d{10}$/.test(phoneTrim)) {
    return res.status(400).json({ message: '手机号格式不正确' });
  }

  const db = readDB();
  const current = db.users.find(u => u.user_id === req.user.user_id);
  if (!current) {
    return res.status(404).json({ message: '用户不存在' });
  }

  // 优先合并：查找手机号匹配的既有账户（排除自身），把当前微信账户的 wx_openid 合并过去
  const target = db.users.find(u => u.user_id !== current.user_id && (u.phone || '').trim() === phoneTrim);
  if (target) {
    if (!current.wx_openid) {
      return res.status(400).json({ message: '当前账户未绑定微信' });
    }
    if (target.wx_openid && target.wx_openid !== current.wx_openid) {
      return res.status(409).json({ message: '该手机号已绑定其他微信账户' });
    }
    target.wx_openid = current.wx_openid || target.wx_openid;
    target.wx_nickname = current.wx_nickname || target.wx_nickname;
    target.wx_avatar = current.wx_avatar || target.wx_avatar;
    // 合并后移除临时微信账户（其历史工单/领用记录仍可通过 user_id 追溯）
    db.users = db.users.filter(u => u.user_id !== current.user_id);
    writeDB(db);
    const { password: _, ...userWithoutPassword } = target;
    return res.json({ message: '绑定成功', user: userWithoutPassword });
  }

  // 无匹配账户 → 给当前微信用户补手机号
  current.phone = phoneTrim;
  writeDB(db);
  const { password: _, ...userWithoutPassword } = current;
  res.json({ message: '绑定成功', user: userWithoutPassword });
});

// ============ 登录审计日志查询（仅管理员可查看） ============
// 返回按时间倒序的登录记录，支持分页与按成败/方式筛选
router.get('/auth/login-logs', authenticate, requireAdmin, (req, res) => {
  const db = readDB();
  let all = (db.admin_login_logs || []).slice();
  if (req.query.success !== undefined && req.query.success !== '') {
    const want = req.query.success === '1' || req.query.success === 'true';
    all = all.filter((l) => l.success === want);
  }
  if (req.query.method) {
    all = all.filter((l) => l.login_method === req.query.method);
  }
  all.sort((a, b) => (b.login_at || '').localeCompare(a.login_at || ''));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.page_size) || 50));
  const total = all.length;
  const list = all.slice((page - 1) * pageSize, page * pageSize);
  res.json({ total, page, page_size: pageSize, list });
});

module.exports = router;

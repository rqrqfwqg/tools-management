// 认证路由
const https = require('https');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

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

// 登录（手机号免密直登，兼容 username；支持 form-urlencoded/JSON 双格式）
router.post('/auth/login', loginLimiter, [validate], (req, res) => {
  const identifier = req.body.phone || req.body.username;

  if (!identifier) {
    return res.status(400).json({ message: '请填写手机号' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === identifier || u.username === identifier);

  // 同手机号多账户歧义防护：避免登错人
  if (db.users.filter(u => u.phone === identifier).length > 1) {
    return res.status(403).json({ message: '该手机号关联多个账户，请联系管理员' });
  }

  if (!user) {
    return res.status(401).json({ message: '用户名或手机号错误' });
  }

  if (!user.is_active) {
    return res.status(403).json({ message: '用户已被禁用' });
  }

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ access_token: token, user: userWithoutPassword });
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

// 微信小程序登录：code2session 换取 openid → 查找或自动注册用户 → 签发 JWT
router.post('/auth/wx-login', loginLimiter, async (req, res) => {
  const { code, nickname, avatar } = req.body || {};

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
    return res.status(502).json({ message: '微信服务暂不可用，请稍后再试' });
  }

  // 微信业务错误：如 code 无效/过期、appid 与 secret 不匹配等
  if (session.errcode) {
    console.error(`[WXLogin] 微信返回错误 errcode=${session.errcode} errmsg=${session.errmsg}`);
    return res.status(401).json({ message: 'wx login failed' });
  }

  const openid = session.openid;
  // 防御微信异常返回（未返回 openid 一律视为登录失败）
  if (!openid) {
    console.error('[WXLogin] 微信未返回 openid，raw=', JSON.stringify(session));
    return res.status(401).json({ message: 'wx login failed' });
  }

  const db = readDB();
  let user = db.users.find(u => u.wx_openid === openid);
  let isNewUser = false;

  if (!user) {
    // 自动注册：默认普通员工，归属默认部门（技术部 dept_id=2）
    isNewUser = true;
    const deptId = 2;
    const deptMap = (db.departments || []).reduce((m, d) => { m[d.dept_id] = d.dept_name; return m; }, {});
    const baseUsername = `wx_${openid.slice(0, 12)}`;
    let username = baseUsername;
    let suffix = 1;
    while (db.users.some(u => u.username === username)) {
      username = `${baseUsername}_${suffix++}`;
    }
    const newUser = {
      user_id: nextId(db.users, 'user_id'),
      username,
      password: bcrypt.hashSync(`wx_${openid}_${Date.now()}`, 10),
      real_name: nickname || '微信用户',
      dept_id: deptId,
      role: 'staff',
      role_id: 2,
      role_name: '普通员工',
      is_active: true,
      phone: '',
      wx_openid: openid,
      wx_nickname: nickname || '',
      wx_avatar: avatar || '',
      dept_name: deptMap[deptId] || ''
    };
    db.users.push(newUser);
    writeDB(db);
    user = newUser;
  }

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ access_token: token, user: userWithoutPassword, is_new_user: isNewUser });
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

module.exports = router;

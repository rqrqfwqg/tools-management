// 认证路由
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB } = require('./db');
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

// 登录（支持 username/phone + form-urlencoded/JSON 双格式）
router.post('/auth/login', loginLimiter, [
  body('password').notEmpty().withMessage('密码不能为空'),
  validate
], (req, res) => {
  const identifier = req.body.username || req.body.phone;
  const { password } = req.body;

  if (!identifier) {
    return res.status(400).json({ message: '请填写用户名或手机号' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === identifier || u.username === identifier);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: '用户名或密码错误' });
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

module.exports = router;

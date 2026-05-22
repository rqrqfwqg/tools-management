// 用户管理路由
const express = require('express');
const bcrypt = require('bcryptjs');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 获取用户列表
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(({ password, ...user }) => user);
  res.json(users);
});

// 创建用户
router.post('/users', authenticate, requireAdmin, (req, res) => {
  const { username, password, real_name, dept_id, role, is_active, phone } = req.body;

  if (!username?.trim()) return res.status(400).json({ message: '用户名不能为空' });
  if (!real_name?.trim()) return res.status(400).json({ message: '真实姓名不能为空' });
  if (dept_id === undefined || dept_id === null) return res.status(400).json({ message: '部门不能为空' });

  const userPassword = password || process.env.DEFAULT_USER_PASSWORD || 'User@2026!';
  const db = readDB();

  if (db.users.find(u => u.username === username.trim())) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const newUser = {
    user_id: nextId(db.users, 'user_id'),
    username: username.trim(),
    password: bcrypt.hashSync(userPassword, 10),
    real_name, dept_id,
    role: role || 'staff',
    role_id: role === 'admin' ? 1 : 2,
    role_name: role === 'admin' ? '管理员' : '普通员工',
    is_active: is_active !== false,
    phone: phone || ''
  };

  db.users.push(newUser);
  writeDB(db);

  const { password: _, ...userWO } = newUser;
  res.json(userWO);
});

// 更新用户
router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { real_name, dept_id, role, is_active, phone } = req.body;
  const db = readDB();
  const idx = db.users.findIndex(u => u.user_id === userId);
  if (idx === -1) return res.status(404).json({ message: '用户不存在' });

  db.users[idx] = {
    ...db.users[idx],
    real_name: real_name || db.users[idx].real_name,
    dept_id: dept_id || db.users[idx].dept_id,
    role: role || db.users[idx].role,
    role_name: role === 'admin' ? '管理员' : role === 'staff' ? '普通员工' : db.users[idx].role_name,
    is_active: is_active !== undefined ? is_active : db.users[idx].is_active,
    phone: phone || db.users[idx].phone
  };
  writeDB(db);

  const { password, ...userWO } = db.users[idx];
  res.json(userWO);
});

// 重置密码
router.post('/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ message: '新密码长度不能小于6位' });
  }

  const db = readDB();
  const idx = db.users.findIndex(u => u.user_id === userId);
  if (idx === -1) return res.status(404).json({ message: '用户不存在' });

  db.users[idx].password = bcrypt.hashSync(new_password, 10);
  writeDB(db);
  res.json({ message: '密码重置成功' });
});

// 删除用户
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.users.findIndex(u => u.user_id === userId);
  if (idx === -1) return res.status(404).json({ message: '用户不存在' });
  if (db.users[idx].role === 'admin') return res.status(400).json({ message: '不能删除管理员' });
  db.users.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

module.exports = router;

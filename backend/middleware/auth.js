// 认证中间件
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tools-mgmt-fallback-2026-secure';

// 认证中间件 - 验证 JWT token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'token无效或已过期' });
  }
};

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

// 审批权限中间件（管理员 + 分队长）
const requireApprover = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'team_leader') {
    return res.status(403).json({ message: '需要审批权限（管理员或分队长）' });
  }
  next();
};

// 物料管理权限中间件（管理员 + 物料管理员）
const requireMaterialManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'material_manager') {
    return res.status(403).json({ message: '需要物料管理权限（管理员或物料管理员）' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireApprover, requireMaterialManager, JWT_SECRET };

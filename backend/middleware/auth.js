// 统一身份鉴权中间件（P3：信任统一鉴权中心签发的 JWT）
//
// 设计要点：
// 1. 删除旧版弱密钥兜底 —— JWT_SECRET 必须来自环境变量，缺失即启动失败（合并 P0 第一刀）。
// 2. 同时信任两类 token（同一 JWT_SECRET，HS256）：
//      a) 统一鉴权服务 /auth/login 签发（claims: sub/username/role/role_id/role_name/is_active/tv）
//      b) 工具库本地 /api/auth/login 签发（claims: user_id/username/role）
// 3. 无论来源，均回查工具库 db.json（按 username）补全 user_id/real_name/dept_id，
//    使现有路由（消费 req.user.user_id/role/real_name）零改动。
// 4. is_active 即时拦截，闭环旧系统"禁用用户 token 仍有效"的半截拦截(F-005)。

const jwt = require('jsonwebtoken');
const { readDB } = require('../routes/db');

// 强密钥：缺失即启动失败，杜绝弱兜底
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[auth] JWT_SECRET 未配置：请在环境变量中设置与统一鉴权服务一致的强密钥'
  );
}

// 回查工具库，补全身份资料（幂等：本地 token 已带字段则保留）
function enrich(decoded) {
  const username = decoded.username || null;
  const db = readDB();
  const local = username ? (db.users || []).find((u) => u.username === username) : null;
  return {
    user_id: local ? local.user_id : decoded.user_id != null ? decoded.user_id : decoded.sub,
    username: username || decoded.sub,
    role: decoded.role || (local && local.role),
    real_name: (local && local.real_name) || decoded.username || decoded.sub,
    dept_id: local ? local.dept_id : undefined,
    role_id: decoded.role_id,
    role_name: decoded.role_name || decoded.role,
    is_active:
      decoded.is_active != null
        ? decoded.is_active
        : local
        ? local.is_active
        : true,
    tv: decoded.tv,
  };
}

// 认证中间件 - 验证 JWT token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = enrich(decoded);
    // is_active 即时拦截（闭环旧 F-005 半截拦截）
    if (user.is_active === false) {
      return res.status(403).json({ message: '用户已被禁用' });
    }
    req.user = user;
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

module.exports = {
  authenticate,
  requireAdmin,
  requireApprover,
  requireMaterialManager,
  JWT_SECRET,
};

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB } = require('./routes/db');

const app = express();
app.set('trust proxy', 1);  // nginx 反向代理，express-rate-limit 需要此配置
const PORT = process.env.PORT || 3000;

// ============ 中间件 ============

// 安全头
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body 解析
// 通过 wrapper 确保 body-parser 不拦截 multipart 请求（留给 multer 处理）
// 不使用 body-parser 的 type 选项（body-parser v2.2.2 兼容性问题）
const bodyLimit = process.env.BODY_LIMIT || '50mb';
const jsonParser = bodyParser.json({ limit: bodyLimit });
const urlencodedParser = bodyParser.urlencoded({ extended: true, limit: bodyLimit });

app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) return next();
  // 尝试 JSON 解析；解析失败不中断（留给 urlencoded 或下游处理）
  jsonParser(req, res, (err) => {
    if (err && err.status !== 400) return next(err);
    if (!err) return next();
    // JSON 解析失败 → 尝试 urlencoded
    urlencodedParser(req, res, next);
  });
});

// 静态文件 - 上传文件
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// 静态文件 - 前端构建产物
const frontendDistPath = path.join(__dirname, '..', 'vue-frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// ============ API 路由 ============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    node_env: process.env.NODE_ENV || 'development'
  });
});

// 仪表盘
app.get('/api/dashboard', require('./middleware/auth').authenticate, (req, res) => {
  const { readDB } = require('./routes/db');
  const db = readDB();
  const tools = db.tools || [];
  const orders = db.orders || [];
  res.json({
    tools_total: tools.length,
    tools_available: tools.filter(t => t.status === 'available').length,
    tools_borrowed: tools.filter(t => t.status === 'borrowed').length,
    tools_maintenance: tools.filter(t => t.status === 'maintenance').length,
    orders_total: orders.length,
    orders_pending: orders.filter(o => o.status === 'pending').length,
    orders_approved: orders.filter(o => o.status === 'approved').length,
    orders_returned: orders.filter(o => o.status === 'returned').length,
    users_total: (db.users || []).length
  });
});

// 模块化路由
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/users'));
app.use('/api', require('./routes/tools'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/admin'));

// ============ Multer 错误处理（必须在全局错误处理之前） ============
app.use((err, req, res, next) => {
  console.error('[MulterError] code=%s message=%s', err.code || '(none)', err.message || '(none)');
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: '文件过大，最大支持 10MB' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ message: '上传字段名不正确，请使用 file 字段' });
  }
  if (err.message && err.message.includes('只支持')) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// ============ 全局错误处理 ============
app.use((err, req, res, next) => {
  console.error('[ServerError] %s %s — %s', req.method, req.path, err.message);
  console.error('[ServerError] stack:', err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({
    message: '服务器内部错误',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 / SPA fallback
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: '接口不存在' });
  }
  const indexPath = path.join(__dirname, '..', 'vue-frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ message: '前端资源未构建，请先运行 npm run build' });
  }
});

// ============ 启动 ============
initDB();
app.listen(PORT, () => {
  console.log(`✅ 工器具管理系统后端运行在 http://localhost:${PORT}`);
  console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API 文档: http://localhost:${PORT}/api/health`);
});

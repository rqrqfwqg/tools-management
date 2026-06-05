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
const bodyLimit = process.env.BODY_LIMIT || '10mb';
app.use(bodyParser.json({ limit: bodyLimit }));
app.use(bodyParser.urlencoded({ extended: true, limit: bodyLimit }));

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

// ============ 全局错误处理 ============
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
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

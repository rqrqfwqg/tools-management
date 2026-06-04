// ============================================
// 工器具管理系统 - PM2 生产配置
// 只用 PM2 管理后端进程，前端由 Nginx 托管
// ============================================

module.exports = {
  apps: [
    {
      name: 'tools-backend',
      script: './server.js',
      cwd: '/opt/tools-management/backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CORS_ORIGIN: '*'
      },
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/tools-management/logs/backend-error.log',
      out_file: '/opt/tools-management/logs/backend-out.log',
      merge_logs: true,
      // 崩溃自动重启
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
}

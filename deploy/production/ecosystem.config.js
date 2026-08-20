// ============================================
// 工器具管理系统 - PM2 生产配置
// 只用 PM2 管理后端进程，前端由 Nginx 托管
// ============================================

module.exports = {
  apps: [
    {
      // 唯一后端实例（3300 单实例，与 nginx /api/ → 3300 对齐，避免双实例并发写 db.json）
      // 进程名 tools-backend-miniapp 与服务器实际 PM2 进程 / scripts/auto-deploy.sh 一致（2026-08-18 统一）
      name: 'tools-backend-miniapp',
      script: './server.js',
      cwd: '/opt/tools-management/backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3300,
        CORS_ORIGIN: '*',
        // 微信小程序 AppID（公开，与 project.config.json 一致；wx-login / 订阅消息需要）
        WX_APPID: 'wxd3f79993e8a43ac2',
        // ⚠️ WX_SECRET 为敏感凭证，禁止提交到仓库。生产服务器请通过以下任一方式提供
        // （缺省时小程序 wx-login 与订阅消息推送均会失败）：
        //   1) 服务器 backend/.env 中填写（该文件已被 .gitignore 忽略，不会进仓库）
        //   2) 部署前在 shell 导出：export WX_SECRET=xxxx，本配置会透传 process.env.WX_SECRET
        //   3) 或：pm2 set tools-backend-miniapp WX_SECRET=xxxx && pm2 restart tools-backend-miniapp
        WX_SECRET: process.env.WX_SECRET || ''
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

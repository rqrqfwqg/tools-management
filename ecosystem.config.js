module.exports = {
  apps: [
    {
      name: 'tools-backend',
      script: 'backend/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      // 微信小程序专用 API 网关（独立端口 3300，不与 3000/3100/3200 冲突）
      // 监听 0.0.0.0 供小程序真机预览/体验版访问（真机不能访问 127.0.0.1）
      // 同一份 server.js + db.json，与 tools-backend 共享数据
      name: 'tools-backend-miniapp',
      script: 'backend/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3300,
        HOST: '0.0.0.0'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3300,
        HOST: '0.0.0.0'
      },
      error_file: './logs/pm2-miniapp-error.log',
      out_file: './logs/pm2-miniapp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'tools-frontend',
      script: 'node_modules/vite/bin/vite.js',
      cwd: __dirname + '/vue-frontend',
      args: '--host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
        PORT: 3100
      },
      error_file: '../logs/pm2-frontend-error.log',
      out_file: '../logs/pm2-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'tools-mobile',
      script: 'node_modules/vite/bin/vite.js',
      cwd: __dirname + '/mobile-frontend',
      args: '--host 0.0.0.0 --port 3200',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
        PORT: 3200
      },
      error_file: '../logs/pm2-mobile-error.log',
      out_file: '../logs/pm2-mobile-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};

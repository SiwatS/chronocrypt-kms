/**
 * PM2 Ecosystem Configuration
 *
 * Manages both backend and frontend services in a single container
 */

module.exports = {
  apps: [
    {
      name: 'chronocrypt-backend',
      cwd: '/app/apps/backend',
      script: 'bun',
      args: 'run src/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/chronocrypt_kms',
        KMS_ID: process.env.KMS_ID || 'kms-main',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'chronocrypt-frontend',
      cwd: '/app/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://localhost/api',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/pm2/frontend-error.log',
      out_file: '/var/log/pm2/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

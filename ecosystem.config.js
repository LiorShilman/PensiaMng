module.exports = {
  apps: [
    {
      name: 'pensiamng-server',
      script: './dist/main.js',
      cwd: './server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production', PORT: 31500 },
      env_production: { NODE_ENV: 'production', PORT: 31500 },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

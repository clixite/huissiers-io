module.exports = {
  apps: [
    {
      name: "huissiers-io-api",
      script: "server.js",
      cwd: "/opt/huissiers-io/api",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: 3050,
      },
      env_file: ".env",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/pm2/huissiers-io-api-error.log",
      out_file: "/var/log/pm2/huissiers-io-api-out.log",
      merge_logs: true,
    },
  ],
};

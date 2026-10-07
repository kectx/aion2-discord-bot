/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "aion2-discord-bot",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "300M",
      // Loads .env via dotenv in src/index.ts — keep NODE_ENV here for production
      env: {
        NODE_ENV: "production",
      },
      // Optional: absolute path if you run pm2 from elsewhere
      // env_file is not native PM2 — use dotenv in app (already done)
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      time: true,
    },
  ],
};

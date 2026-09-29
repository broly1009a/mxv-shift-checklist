module.exports = {
  apps: [
    {
      name: 'mxv-account-opening-reconciler',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '4096M',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        UV_THREADPOOL_SIZE: '64',
        PYTHONUNBUFFERED: '1',
      },
      out_file: './logs/reconciler_out.log',
      error_file: './logs/reconciler_error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'mxv-account-opening-reconciler-ui',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3006',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        NEXT_PUBLIC_API_URL: 'http://localhost:3005',
      },
    },
  ],
};

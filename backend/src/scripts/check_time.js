const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. CHECK REMOTE CODE TIMESTAMP ==="
    ls -la --time-style=full-iso /opt/mxv-checklist/backend/src/modules/bot-engine/helpers/bot-path.helper.ts
    echo "=== 2. CHECK DIST TIMESTAMP ==="
    ls -la --time-style=full-iso /opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/bot-path.helper.js
    echo "=== 3. CHECK PM2 START TIME ==="
    pm2 status
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. CHECK REMOTE ccp-ce/page.tsx lines 50-80 ==="
    sed -n '50,80p' /opt/mxv-checklist/frontend/src/app/trading-manager/ccp-ce/page.tsx
    echo "=== 2. CHECK REMOTE trading-manager/page.tsx lines 40-70 ==="
    sed -n '40,70p' /opt/mxv-checklist/frontend/src/app/trading-manager/page.tsx
    echo "=== 3. CHECK REMOTE tradingDateUtils.ts ==="
    cat /opt/mxv-checklist/frontend/src/app/trading-manager/utils/tradingDateUtils.ts 2>/dev/null || echo "tradingDateUtils not found"
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

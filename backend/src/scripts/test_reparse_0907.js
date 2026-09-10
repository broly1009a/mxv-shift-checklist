const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  console.log('Testing reparse on 2026-09-07 for 003C1311117...');
  const cmd = `curl -s -X POST http://localhost:3001/api/v1/tkgd/reparse-account -H "Content-Type: application/json" -d '{"accountCode": "003C1311117", "batchDate": "2026-09-07"}'`;
  const res = await run(cmd);
  try {
    const json = JSON.parse(res);
    console.log('Reparse 003C1311117 (2026-09-07):', json.record?.ketLuan?.trangThai, json.record?.ketLuan?.danhSachLoi);
  } catch {
    console.log('Raw:', res);
  }
  conn.end();
});

function run(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      let out = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
      stream.on('close', () => resolve(out));
    });
  });
}

conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

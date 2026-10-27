const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected to Ubuntu 10.0.0.26');
  
  const cmd = `
    echo "=== 1. CAP NHAT FULL RAM CHO BACKEND (3GB V8 + 3.5GB RESTART) ==="
    pm2 restart mxv-backend --node-args="--max-old-space-size=3072 --expose-gc" --max-memory-restart 3500M

    echo "=== 2. CAP NHAT FULL RAM CHO FRONTEND (2GB V8 + 2.5GB RESTART) ==="
    pm2 restart mxv-frontend --node-args="--max-old-space-size=2048" --max-memory-restart 2500M

    echo "=== 3. LUU CAU HINH PM2 ==="
    pm2 save

    echo "=== 4. KIEM TRA KET QUA ==="
    pm2 status
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log(`\n=== HOAN TAT VOI CODE: ${code} ===`);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

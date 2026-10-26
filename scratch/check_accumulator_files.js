const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    echo "=== 1. FIND ACCUMULATOR FILES ON UBUNTU ==="
    find /mnt -iname "*Thong ke so lot giao dich*" 2>/dev/null || true
    echo "=== 2. FIND IN OPT OR LOCAL ==="
    find /opt/mxv-checklist -iname "*Thong ke so lot giao dich*" 2>/dev/null || true
    echo "=== 3. CHECK CE SETTINGS IN MONGO ==="
    node -e "
      const mongoose = require('mongoose');
      async function run() {
        await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
        const db = mongoose.connection.db;
        const s = await db.collection('system_settings').find({ key: { \\$regex: 'ce_|path|backup|macro', \\$options: 'i' } }).toArray();
        console.log('Settings found:');
        s.forEach(x => console.log('  ', x.key, '=', typeof x.value === 'string' && x.value.length < 150 ? x.value : (x.value || '').slice(0, 100) + '...'));
        await mongoose.disconnect();
      }
      run();
    "
  `;

  conn.exec(remoteCmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

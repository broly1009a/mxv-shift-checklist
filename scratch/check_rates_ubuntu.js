const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("mongosh mxv_shift_checklist --eval 'db.system_configs.find({ key: /exchange_rate/ }).toArray()'", (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.on('close', () => { conn.end(); });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

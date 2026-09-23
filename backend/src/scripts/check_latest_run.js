const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `db.ccp_lot_run_histories.find({}, { sessionDate: 1, action: 1, 'result.totalSoLot': 1, 'result.totalGiaTri': 1, 'result.tyGiaUsed': 1, jsonBackupPath: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(5)`;
  conn.exec(`mongosh mxv_shift_checklist --eval "${query}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.on('close', () => {
      console.log('LATEST RUNS:');
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

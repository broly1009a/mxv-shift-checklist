const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `printjson(db.shift_logs.find({}, { _id: 1, shiftDate: 1, status: 1, templateTitleSnapshot: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(5).toArray())`;
  conn.exec(`mongosh mxv_shift_checklist --eval "${query}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.stderr.on('data', (d) => out += '[STDERR] ' + d.toString());
    stream.on('close', () => {
      console.log('ACTIVE SHIFT LOGS:');
      console.log(out.substring(0, 4000));
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

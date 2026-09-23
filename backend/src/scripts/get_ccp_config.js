const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `printjson(db.system_settings.findOne({ key: "ccp_lot_statistics_config" }))`;
  conn.exec(`mongosh mxv_shift_checklist --eval '${query}'`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log('CCP LOT STATISTICS CONFIG:');
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

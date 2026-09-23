const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('mongosh mxv_shift_checklist --eval "db.system_settings.find({key: /rate/})"', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.on('close', () => {
      console.log('RATES IN MONGO mxv_shift_checklist:');
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

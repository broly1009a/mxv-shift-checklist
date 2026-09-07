const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();

conn.on('ready', () => {
  const mongoCmd = `mongosh mxv_shift_checklist --eval 'const r = db.raw_account_mails.findOne({bodyRawText: /003C2795169/}); if (r) { const idx = r.bodyRawText.indexOf("003C2795169"); print(r.bodyRawText.substring(Math.max(0, idx - 200), idx + 600)); }'`;
  conn.exec(mongoCmd, (err, stream) => {
    let out = '';
    stream.on('data', (d) => out += d.toString())
          .on('close', () => {
            console.log('--- SNIPPET AROUND CODE ---');
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

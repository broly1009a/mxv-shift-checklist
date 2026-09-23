const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/mxv-checklist/backend && node -e '
    require("dotenv").config();
    console.log("GEMINI_KEY:", process.env.GEMINI_API_KEY ? "CO SAN (length: " + process.env.GEMINI_API_KEY.length + ")" : "KHONG CO");
  '`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

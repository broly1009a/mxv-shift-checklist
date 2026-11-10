const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeCmd = `node -e '
    const fs = require("fs");
    const base9 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/30.09/";
    console.log("Files in 30.09:", fs.existsSync(base9) ? fs.readdirSync(base9) : "NO");
  '`;
  conn.exec(nodeCmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

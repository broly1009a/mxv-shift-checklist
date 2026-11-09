const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const code = `
    const fs = require('fs');
    const p1_2026 = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026';
    const p2_2026 = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026';
    console.log('p1_2026 subdirs:', fs.readdirSync(p1_2026));
    console.log('p2_2026 subdirs:', fs.readdirSync(p2_2026));
  `;
  conn.exec(`node -e "${code.replace(/\n/g, ' ')}"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

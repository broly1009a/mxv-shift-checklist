const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026/05.11';
    const filePath = path.join(dir, 'DSGD.xlsx');
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      process.exit(1);
    }
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log('Parsed rows:', rows.length, 'Sample:', rows[0]);
  "`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

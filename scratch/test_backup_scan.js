const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    console.time('parse 1 day');
    const msPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026/05.11/DSGD.xlsx';
    const acmPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T11.2026/05.11/Fill.xls';

    const wbMs = XLSX.readFile(msPath);
    const msRows = XLSX.utils.sheet_to_json(wbMs.Sheets[wbMs.SheetNames[0]]);

    const wbAcm = XLSX.readFile(acmPath);
    const acmRows = XLSX.utils.sheet_to_json(wbAcm.Sheets[wbAcm.SheetNames[0]]);

    console.timeEnd('parse 1 day');
    console.log('MS Rows:', msRows.length, 'ACM Rows:', acmRows.length);
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


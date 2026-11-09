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
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    let acmCount = 0;
    let cqgCount = 0;
    const acmAccs = new Set();
    const acmSymbols = new Set();
    for (const r of rows) {
      const acc = String(r['Mã TKGD'] || '').trim();
      if (/-A[^-]*$/i.test(acc) || /-A$/i.test(acc)) {
        acmCount += Number(r['KL giao dịch']) || 0;
        acmAccs.add(acc);
        acmSymbols.add(r['Mã HĐ']);
      } else {
        cqgCount += Number(r['KL giao dịch']) || 0;
      }
    }
    console.log({
      totalRows: rows.length,
      acmCount,
      cqgCount,
      acmAccsSample: Array.from(acmAccs).slice(0, 5),
      acmSymbols: Array.from(acmSymbols)
    });
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


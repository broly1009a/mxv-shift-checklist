const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    const { BGS_RAW_TO_STD_MAP } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/constants/bgs-commodity-catalog.constant');

    const filePath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026/05.11/DSGD.xlsx';
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const unmapped = new Set();
    const mapped = new Map();

    for (const r of rows) {
      const hd = String(r['Mã HĐ'] || '').trim().toUpperCase();
      if (!hd) continue;
      
      let root = hd;
      const optMatch = hd.match(/^([CP]\\.[A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
      const futMatch = hd.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
      if (optMatch) {
        root = optMatch[1];
      } else if (futMatch) {
        root = futMatch[1];
      }

      const info = BGS_RAW_TO_STD_MAP[root] || BGS_RAW_TO_STD_MAP[hd];
      if (info) {
        mapped.set(info.nameVn, (mapped.get(info.nameVn) || 0) + (Number(r['KL giao dịch']) || 0));
      } else {
        unmapped.add(hd + ' (root: ' + root + ')');
      }
    }

    console.log('Mapped distinct commodities count:', mapped.size);
    console.log('Sample mapped:', Array.from(mapped.entries()).slice(0, 10));
    console.log('Unmapped count:', unmapped.size, 'Samples:', Array.from(unmapped).slice(0, 10));
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


const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    const filePath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T11.2026/05.11/Fill.xls';
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const acmMap = {
      'NSI': { stdCode: 'SI5CO', nameVn: 'Bạc Nano ACM' },
      'NPT': { stdCode: 'PL1NY', nameVn: 'Bạch kim Nano ACM' },
      'NPL': { stdCode: 'PL1NY', nameVn: 'Bạch kim Nano ACM' },
      'NCP': { stdCode: 'CP2CO', nameVn: 'Đồng Nano ACM' }
    };

    const stats = new Map();
    const unmapped = new Set();

    for (const r of rows) {
      const inst = String(r['Instrument Id'] || '').trim().toUpperCase();
      let matched = null;
      for (const [key, val] of Object.entries(acmMap)) {
        if (inst.includes(key)) {
          matched = val;
          break;
        }
      }
      if (matched) {
        stats.set(matched.nameVn, (stats.get(matched.nameVn) || 0) + (Number(r['Volume']) || 0));
      } else {
        unmapped.add(inst);
      }
    }

    console.log('ACM Mapped Stats:', Array.from(stats.entries()));
    console.log('ACM Unmapped count:', unmapped.size, Array.from(unmapped));
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

const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    const msT11Dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026';
    const acmT11Dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T11.2026';

    const msDays = fs.readdirSync(msT11Dir).filter(d => fs.statSync(path.join(msT11Dir, d)).isDirectory() && /^\\d{2}\\.\\d{2}$/.test(d));
    let totalCqgTrades = 0;
    let totalCqgLot = 0;
    const tvkdSet = new Set();

    for (const d of msDays) {
      const p = path.join(msT11Dir, d, 'DSGD.xlsx');
      if (!fs.existsSync(p)) continue;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      totalCqgTrades += rows.length;
      for (const r of rows) {
        totalCqgLot += Number(r['KL giao dịch']) || 0;
        if (r['Mã TVKD']) tvkdSet.add(r['Mã TVKD']);
      }
    }

    let totalAcmTrades = 0;
    let totalAcmLot = 0;
    const acmDays = fs.existsSync(acmT11Dir) ? fs.readdirSync(acmT11Dir).filter(d => fs.statSync(path.join(acmT11Dir, d)).isDirectory() && /^\\d{2}\\.\\d{2}$/.test(d)) : [];
    for (const d of acmDays) {
      const p = path.join(acmT11Dir, d, 'Fill.xls');
      if (!fs.existsSync(p)) continue;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      totalAcmTrades += rows.length;
      for (const r of rows) {
        totalAcmLot += Number(r['Volume']) || 0;
      }
    }

    console.log('T11 CQG Summary:', {
      days: msDays.length,
      daysList: msDays.sort(),
      totalTrades: totalCqgTrades,
      totalLot: totalCqgLot,
      totalTvkd: tvkdSet.size
    });

    console.log('T11 ACM Summary:', {
      days: acmDays.length,
      daysList: acmDays.sort(),
      totalTrades: totalAcmTrades,
      totalLot: totalAcmLot
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


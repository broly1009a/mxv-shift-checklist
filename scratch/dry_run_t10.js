const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    // Test scanning all days in T10.2026
    const msT10Dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026';
    const acmT10Dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026';

    const msDays = fs.readdirSync(msT10Dir).filter(d => fs.statSync(path.join(msT10Dir, d)).isDirectory() && /^\\d{2}\\.\\d{2}$/.test(d));
    console.log('MS T10 days count:', msDays.length, msDays.sort());

    let totalCqgTrades = 0;
    let totalCqgLot = 0;
    const tvkdSet = new Set();

    for (const d of msDays) {
      const p = path.join(msT10Dir, d, 'DSGD.xlsx');
      if (!fs.existsSync(p)) continue;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      totalCqgTrades += rows.length;
      for (const r of rows) {
        const lot = Number(r['KL giao dịch']) || 0;
        totalCqgLot += lot;
        if (r['Mã TVKD']) tvkdSet.add(r['Mã TVKD']);
      }
    }

    console.log('T10 CQG Summary:', {
      days: msDays.length,
      totalTrades: totalCqgTrades,
      totalLot: totalCqgLot,
      totalTvkd: tvkdSet.size
    });

    // Test ACM T10
    let totalAcmTrades = 0;
    let totalAcmLot = 0;
    const acmDays = fs.existsSync(acmT10Dir) ? fs.readdirSync(acmT10Dir).filter(d => fs.statSync(path.join(acmT10Dir, d)).isDirectory() && /^\\d{2}\\.\\d{2}$/.test(d)) : [];
    for (const d of acmDays) {
      const p = path.join(acmT10Dir, d, 'Fill.xls');
      if (!fs.existsSync(p)) continue;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      totalAcmTrades += rows.length;
      for (const r of rows) {
        totalAcmLot += Number(r['Volume']) || 0;
      }
    }
    console.log('T10 ACM Summary:', {
      days: acmDays.length,
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


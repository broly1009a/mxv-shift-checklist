const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const path = require('path');
    const fs = require('fs');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    const files = fs.readdirSync(dir);

    files.forEach(f => {
      if (!f.endsWith('.xlsx')) return;
      try {
        const full = path.join(dir, f);
        const wb = XLSX.readFile(full);
        wb.SheetNames.forEach(sName => {
          const ws = wb.Sheets[sName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          rows.forEach((r, rIdx) => {
            if (!r) return;
            r.forEach((cell, cIdx) => {
              const val = String(cell);
              if (val.includes('408950001') || val.includes('127980917')) {
                console.log('FOUND IN', f, 'sheet:', sName, 'row:', rIdx, 'col:', cIdx, 'header:', rows[0]?.[cIdx], 'val:', cell);
              }
            });
          });
        });
      } catch (e) {}
    });
  `;

  conn.exec(`cd /opt/mxv-checklist/backend && node -e "${script.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

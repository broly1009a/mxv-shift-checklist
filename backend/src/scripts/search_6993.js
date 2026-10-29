const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const path = require('path');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    const files = ['QL TT TKGD.xlsx', 'TTTT_28.10.2026.xlsx', 'EOD_28.10.2026.xlsx'];

    files.forEach(f => {
      const full = path.join(dir, f);
      if (!require('fs').existsSync(full)) return;
      const wb = XLSX.readFile(full);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log('Searching in', f, 'rows:', rows.length);
      rows.forEach((r, idx) => {
        if (!r) return;
        r.forEach((cell, cIdx) => {
          const val = String(cell);
          if (val.includes('6993') || val.includes('0.27') || val === '6993' || val === '0.27') {
            console.log('Found 6993 or 0.27 in', f, 'row', idx, 'col', cIdx, 'header:', rows[0][cIdx], 'acc:', r[1] || r[2] || r[3], 'val:', cell);
          }
        });
      });
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

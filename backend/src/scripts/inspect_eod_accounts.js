const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    console.log('Dir exists:', fs.existsSync(dir));
    if (!fs.existsSync(dir)) process.exit(1);

    const files = fs.readdirSync(dir);
    console.log('Files in dir:', files);

    const qlFile = files.find(f => /ql.*tt.*tkgd/i.test(f));
    const eodFile = files.find(f => /eod/i.test(f));
    const ttttFile = files.find(f => /tttt/i.test(f));

    console.log('qlFile:', qlFile);
    console.log('eodFile:', eodFile);
    console.log('ttttFile:', ttttFile);

    const targetAccs = ['012C2207413-A', '046C0001679-A'];

    if (qlFile) {
      const wb = XLSX.readFile(path.join(dir, qlFile));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = rows[0] || [];
      console.log('\\n--- QLTKGD HEADER ---');
      header.forEach((h, idx) => console.log(idx, ':', h));

      targetAccs.forEach(acc => {
        const row = rows.find(r => r && r.some(c => String(c).trim() === acc));
        console.log('\\n--- QLTKGD ROW for', acc, '---');
        if (row) {
          header.forEach((h, idx) => {
            if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
              console.log('  ', h, '=', row[idx]);
            }
          });
        } else {
          console.log('Not found in QLTKGD');
        }
      });
    }

    if (eodFile) {
      const wb = XLSX.readFile(path.join(dir, eodFile));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = rows[0] || [];
      console.log('\\n--- EOD HEADER ---');
      header.forEach((h, idx) => console.log(idx, ':', h));

      targetAccs.forEach(acc => {
        const row = rows.find(r => r && r.some(c => String(c).trim() === acc));
        console.log('\\n--- EOD ROW for', acc, '---');
        if (row) {
          header.forEach((h, idx) => {
            if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
              console.log('  ', h, '=', row[idx]);
            }
          });
        } else {
          console.log('Not found in EOD');
        }
      });
    }

    if (ttttFile) {
      const wb = XLSX.readFile(path.join(dir, ttttFile));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = rows[0] || [];
      targetAccs.forEach(acc => {
        const row = rows.find(r => r && r.some(c => String(c).trim() === acc));
        console.log('\\n--- TTTT ROW for', acc, '---');
        if (row) {
          header.forEach((h, idx) => {
            if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
              console.log('  ', h, '=', row[idx]);
            }
          });
        } else {
          console.log('Not found in TTTT');
        }
      });
    }
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

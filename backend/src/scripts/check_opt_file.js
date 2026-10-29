const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const XLSX = require('xlsx');

    const file = '/opt/mxv-checklist/backend/data/backup/CCP/QL TT TKGD.xlsx';
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const header = rows[0] || [];

    const targetAccs = ['012C2207413-A', '046C0001679-A'];
    targetAccs.forEach(acc => {
      const row = rows.find(r => r && r.some(c => String(c).trim() === acc));
      console.log('Account in /opt/mxv-checklist/backend/data/backup/CCP/QL TT TKGD.xlsx:', acc);
      if (row) {
        header.forEach((h, idx) => {
          if (['Số dư đầu ngày', 'Nộp rút trong phiên', 'Phí giao dịch', 'Số dư cuối ngày', 'Số dư TKKQ', 'Phí dịch vụ thanh toán', 'Lãi lỗ thực tế Future (VND)', 'Lãi lỗ thực tế Future (USD)'].includes(h)) {
            console.log('  ', h, '=', row[idx]);
          }
        });
      } else {
        console.log('Not found');
      }
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

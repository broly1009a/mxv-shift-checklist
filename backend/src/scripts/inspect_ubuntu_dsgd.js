const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Ket noi toi Ubuntu 10.0.0.26 thanh cong.');

  const nodeScript = `
    const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');
    const path = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/DSGD T09.2026.xlsx';
    console.log('Dang doc file:', path);
    const wb = XLSX.readFile(path, { sheetRows: 20 });
    console.log('Sheet Names:', wb.SheetNames);
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    console.log('Row 1 (Header):', data[0]);
    console.log('Row 2 (Sample):', data[1]);
  `;

  conn.exec(`node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

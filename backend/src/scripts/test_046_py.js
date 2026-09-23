const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const pdfPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936/CCCD PHAN SƠN HƯNG.pdf';
  const cmd = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py extract_cccd "${pdfPath}"`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log('Exit code:', code);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

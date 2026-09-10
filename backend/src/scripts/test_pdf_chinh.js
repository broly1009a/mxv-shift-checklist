const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08/003C1311117';
  const cmd = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C1311117 --phuluc "${dir}/LE-XUAN-CHINH-PL01.pdf"`;
  console.log('Running PDF test:', cmd);
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

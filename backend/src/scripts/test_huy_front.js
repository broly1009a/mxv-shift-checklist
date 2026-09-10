const { Client } = require('ssh2');
const conn = new Client();

function run(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      let out = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
      stream.on('close', () => resolve(out));
    });
  });
}

conn.on('ready', async () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/003C3393939';
  const cmd = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C3393939 --front "${dir}/LE-TRONG-HUY-CCCD-truoc.jpg" --name "LÊ TRỌNG HUY"`;
  console.log(await run(cmd));
  conn.end();
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

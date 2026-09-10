const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08/003C2886699';
  
  console.log('=== TEST 3: OCR on customer image ===');
  const cmd3 = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C2886699 --front "${dir}/HOANG-THANH-TUNG-CCCD-truoc.jpg" --back "${dir}/HOANG-THANH-TUNG-CCCD-sau.jpg"`;
  console.log(await run(cmd3));

  conn.end();
});

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

conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

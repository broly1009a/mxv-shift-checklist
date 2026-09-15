const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08/003C2886699';
  
  console.log('=== TEST 1: OCR on 270px MS thumbnail ===');
  const cmd1 = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C2886699 --front "${dir}/003C2886699_MS_CCCD_truoc.jpg" --back "${dir}/003C2886699_MS_CCCD_sau.jpg"`;
  console.log(await run(cmd1));

  console.log('=== TEST 2: PDF extraction on PL01 ===');
  const cmd2 = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C2886699 --phuluc "${dir}/HOANG-THANH-TUNG-PL01.pdf"`;
  console.log(await run(cmd2));

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

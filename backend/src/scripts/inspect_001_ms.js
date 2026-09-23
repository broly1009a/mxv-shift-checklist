const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    python3 -c "
import sys
sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import ocr_image, extract_can_cuoc_info

text = ocr_image('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/001C6332468/001C6332468_MS_CCCD_truoc.jpg')
print('MS CCCD TRUOC TEXT:', text)
"
  `;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', (d) => (out += d.toString()));
    stream.stderr.on('data', (d) => (out += d.toString()));
    stream.on('close', () => {
      console.log('MS THUMBNAIL OCR:\n' + out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

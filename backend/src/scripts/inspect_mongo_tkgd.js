const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c "
import sys, os
sys.path.append('/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import extract_cccd_ocr_details
front = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08/003C6615616/MAI-DUC-DUONG-CCCD-truoc.jpg'
back = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08/003C6615616/MAI-DUC-DUONG-CCCD-sau.jpg'
res = extract_cccd_ocr_details(front, back)
print('OCR DETAILS:', res)
"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += '[ERR] ' + d.toString());
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

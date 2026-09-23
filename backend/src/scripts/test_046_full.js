const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c '
import sys, json
sys.path.append("/opt/mxv-checklist/backend/src/scripts/python")
from tkgd_extractor_worker import process_account_files

front = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/046C0002936/CCCD PHAN SƠN HƯNG.pdf"
hd = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/046C0002936/HĐ + PL01 046C0002936.pdf"
res = process_account_files(hopdong=hd, phuluc=None, front=front, back=None, code="046C0002936", name="PHAN SƠN HƯNG")
print(json.dumps(res, indent=2, ensure_ascii=False))
'`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += '[ERR] ' + d);
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

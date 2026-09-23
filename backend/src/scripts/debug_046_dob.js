const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c '
import sys
sys.path.append("/opt/mxv-checklist/backend/src/scripts/python")
from tkgd_extractor_worker import rasterize_cccd_pdf, try_decode_mrz, parse_mrz_lines
import cv2, pytesseract, re

front, back = rasterize_cccd_pdf("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/046C0002936/CCCD PHAN SƠN HƯNG.pdf")
print("FRONT:", front, "BACK:", back)

# Read raw OCR text
im = cv2.imread(back)
cfg = r"--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"
txt = pytesseract.image_to_string(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), config=cfg)
print("--- RAW BACK OCR ---")
print(txt)

lines = [l.strip() for l in txt.split("\\n") if len(l.strip()) >= 10]
print("--- LINES ---")
for l in lines:
    print(repr(l))

parsed = parse_mrz_lines(lines, expected_name="PHAN SƠN HƯNG")
print("--- PARSED ---")
print(parsed)
'`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += '[ERR] ' + d);
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

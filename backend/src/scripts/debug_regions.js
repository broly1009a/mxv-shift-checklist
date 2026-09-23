const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c '
import sys, cv2, pytesseract, re
sys.path.append("/opt/mxv-checklist/backend/src/scripts/python")
from tkgd_extractor_worker import parse_mrz_lines

back = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/046C0002936/CCCD PHAN SƠN HƯNG_AUTO_TEMP_AUTO_BACK.jpg"
img = cv2.imread(back)
cfg = r"--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"

for angle in [0, 90, 180, 270]:
    if angle == 0: rot = img
    elif angle == 90: rot = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180: rot = cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270: rot = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

    h, w = rot.shape[:2]
    regions = [
        ("35%", rot[int(h * 0.35):, :]),
        ("100%", rot),
        ("50%", rot[int(h * 0.50):, :])
    ]
    for rname, reg in regions:
        txt = pytesseract.image_to_string(cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY), config=cfg)
        lines = [l.strip() for l in txt.split("\\n") if len(l.strip()) >= 10]
        parsed = parse_mrz_lines(lines, expected_name="PHAN SƠN HƯNG")
        if parsed.get("ngaySinh"):
            print(f"angle={angle} region={rname} -> DOB: {parsed.get(\"ngaySinh\")}, CCCD: {parsed.get(\"soCCCD\")}")
'`;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += '[ERR] ' + d);
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

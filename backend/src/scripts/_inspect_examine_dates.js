const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, pytesseract, re
from PIL import Image

def examine(name, img_path):
    print("--------------------------------------------------")
    print("CHECK:", name, img_path)
    if not os.path.exists(img_path):
        print("  FILE NOT FOUND")
        return
    img = Image.open(img_path)
    print("  Size:", img.size)
    txt = pytesseract.image_to_string(img, lang="vie")
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    for l in lines:
        if any(w in l.lower() for w in ["ngày", "tháng", "năm", "cấp", "giá trị", "đến", "hạn", "date"]):
            print("  ->", l)

base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09"
examine("045C4844668 - Trang 2 (mat sau)", os.path.join(base, "045C4844668", "Duong Van Trang 668 2.png"))
examine("086C2657701 - CCCD 1", os.path.join(base, "086C2657701", "CCCD NGUYỄN QUANG LUYỆN 1.jpg"))
examine("086C2657701 - CCCD 2", os.path.join(base, "086C2657701", "CCCD NGUYỄN QUANG LUYỆN.jpg"))
examine("003C1402455 - MS CCCD sau", os.path.join(base, "003C1402455", "003C1402455_MS_CCCD_sau.jpg"))
examine("003C1402455 - MS CCCD truoc", os.path.join(base, "003C1402455", "003C1402455_MS_CCCD_truoc.jpg"))
examine("003C1684184 - MS CCCD sau", os.path.join(base, "003C1684184", "003C1684184_MS_CCCD_sau.jpg"))
'`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

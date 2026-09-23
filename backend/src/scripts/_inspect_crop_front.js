const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, pytesseract
from PIL import Image

def inspect_exact(code, batch, fname):
    fp = f"/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/{batch}/{code}/{fname}"
    if not os.path.exists(fp):
        print("NOT FOUND:", fp)
        return
    img = Image.open(fp)
    w, h = img.size
    print(f"=== {code} - {fname} ({w}x{h}) ===")
    
    # Crop vùng trên (Số CCCD, Họ tên, Ngày sinh)
    crop_info = img.crop((int(w * 0.3), int(h * 0.2), w, int(h * 0.7)))
    txt = pytesseract.image_to_string(crop_info, lang="vie")
    print("--- CROPPED OCR ---")
    for l in txt.splitlines():
        if l.strip():
            print("  ", l.strip())

inspect_exact("003C1193751", "2026-09-09", "003C1193751_MS_CCCD_truoc.jpg")
inspect_exact("003C1719053", "2026-09-09", "003C1719053_MS_CCCD_truoc.jpg")
inspect_exact("003C1731326", "2026-09-09", "003C1731326_MS_CCCD_truoc.jpg")
inspect_exact("003C1669379", "2026-09-09", "003C1669379_MS_CCCD_truoc.jpg")
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

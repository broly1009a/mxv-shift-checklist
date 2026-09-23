const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, sys, fitz, pytesseract
from PIL import Image

base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

cases = [
    ("2026-09-09", "081C2698439", "Trần Đặng Đăng Phong"),
    ("2026-09-09", "003C1731326", "TRƯƠNG NGỌC THUẬN"),
    ("2026-09-09", "003C1719053", "LÊ THỊ THU HÒA"),
    ("2026-09-09", "003C1193751", "NGUYỄN THU HÀ"),
    ("2026-09-09", "003C1669379", "TRƯƠNG HUY HOÀNG"),
]

for batch, code, name in cases:
    d = os.path.join(base, batch, code)
    print("=" * 60)
    print(f"[{code}] {name} - DIR: {d}")
    if not os.path.exists(d):
        print("  DIR NOT FOUND")
        continue
    for f in sorted(os.listdir(d)):
        fp = os.path.join(d, f)
        print(f"  FILE: {f} ({os.path.getsize(fp)//1024} KB)")
        if f.lower().endswith((".jpg", ".png", ".jpeg")) and not "chuky" in f.lower():
            try:
                img = Image.open(fp)
                txt = pytesseract.image_to_string(img, lang="vie")
                for l in txt.splitlines():
                    if any(k in l.lower() for k in ["số", "so", "sinh", "birth", "họ và tên", "ngày", "cấp"]):
                        print("    [IMG]:", l.strip())
            except Exception as e:
                print("    [IMG-ERR]:", e)
        elif f.lower().endswith(".pdf"):
            try:
                doc = fitz.open(fp)
                for idx, p in enumerate(doc):
                    t = p.get_text() or ""
                    for l in t.splitlines():
                        if any(k in l.lower() for k in ["cccd", "cmnd", "ngày sinh", "cấp ngày"]):
                            print(f"    [PDF-p{idx+1}]:", l.strip())
            except Exception as e:
                pass
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

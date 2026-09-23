const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, sys, fitz, pytesseract
from PIL import Image

base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

test_cases = [
    ("2026-09-09", "003C4865788", "NGUYỄN BẢO NGỌC"),
    ("2026-09-11", "003C1025249", "NGUYỄN XUÂN HIẾU"),
    ("2026-09-15", "045C2429580", "TRẦN THỊ THÚY DUYÊN"),
    ("2026-09-15", "085C2853696", "085C2853696"),
]

for batch, code, name in test_cases:
    d = os.path.join(base, batch, code)
    print("=" * 60)
    print(f"[{code}] {name} - DIR: {d}")
    if not os.path.exists(d):
        print("  DIR NOT FOUND")
        continue
    for f in sorted(os.listdir(d)):
        fp = os.path.join(d, f)
        if "chuky" in f.lower(): continue
        print(f"  FILE: {f} ({os.path.getsize(fp)//1024} KB)")
        if f.lower().endswith((".jpg", ".png", ".jpeg")):
            try:
                img = Image.open(fp)
                txt = pytesseract.image_to_string(img, lang="vie")
                for l in txt.splitlines():
                    if any(k in l.lower() for k in ["sinh", "birth", "họ và tên", "ngày cấp"]):
                        print("    [IMG]:", l.strip())
            except Exception as e:
                pass
        elif f.lower().endswith(".pdf"):
            try:
                doc = fitz.open(fp)
                for idx, p in enumerate(doc):
                    t = p.get_text() or ""
                    for l in t.splitlines():
                        if any(k in l.lower() for k in ["ngày sinh", "ngaysinh", "sinh ngày", "dob"]):
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

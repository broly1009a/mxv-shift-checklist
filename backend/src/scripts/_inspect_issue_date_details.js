const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, sys, fitz
from PIL import Image

base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

targets = [
    ("2026-09-09", "003C1684184", "NGUYỄN TRIỆU HƯNG"),
    ("2026-09-09", "003C1402455", "NGUYỄN ĐĂNG KHOA"),
    ("2026-09-09", "045C4844668", "DƯƠNG VĂN TRÁNG"),
    ("2026-09-09", "003C9284748", "NGUYỄN THÁI HOÀN"),
    ("2026-09-09", "086C2657701", "NGUYỄN QUANG LUYỆN"),
]

for batch, code, name in targets:
    d = os.path.join(base, batch, code)
    print("=" * 60)
    print(f"[{code}] {name} - DIR: {d}")
    if not os.path.exists(d):
        print("  DIR NOT FOUND!")
        continue
    files = sorted(os.listdir(d))
    for f in files:
        fp = os.path.join(d, f)
        print(f"  FILE: {f} ({os.path.getsize(fp)//1024} KB)")

    # Kiểm tra OCR hoặc đọc nội dung các file ảnh/PDF
    import pytesseract
    for f in files:
        if f.startswith(".") or "chuky" in f.lower():
            continue
        fp = os.path.join(d, f)
        print(f"  --- Inspecting {f} ---")
        if f.lower().endswith((".jpg", ".png", ".jpeg")):
            try:
                img = Image.open(fp)
                txt = pytesseract.image_to_string(img, lang="vie")
                for l in txt.splitlines():
                    l_low = l.lower()
                    if any(k in l_low for k in ["ngày", "tháng", "năm", "cấp", "giá trị", "hạn", "expiry", "date", "sinh"]):
                        print("     [IMG-OCR]:", l.strip())
            except Exception as e:
                print("     [IMG-ERR]:", e)
        elif f.lower().endswith(".pdf"):
            try:
                doc = fitz.open(fp)
                for idx, p in enumerate(doc):
                    txt = p.get_text() or ""
                    for l in txt.splitlines():
                        l_low = l.lower()
                        if any(k in l_low for k in ["ngày cấp", "ngay cap", "cấp ngày", "giá trị đến", "cccd", "cmnd"]):
                            print(f"     [PDF-p{idx+1}]:", l.strip())
            except Exception as e:
                print("     [PDF-ERR]:", e)
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

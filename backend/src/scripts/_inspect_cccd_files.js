const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c '
import os, fitz
base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

test_cases = [
    ("2026-09-16", "012C9092196", "Võ Thị Hồng Đào"),
    ("2026-09-16", "003C1982014", "ĐÀO THỊ HOÀI"),
    ("2026-09-16", "046C0002957", "BÙI THỊ MINH TRÂM"),
    ("2026-09-15", "045C2429580", "TRẦN THỊ THÚY DUYÊN"),
]

for batch, code, name in test_cases:
    d = os.path.join(base, batch, code)
    print("=" * 60)
    print(f"[{code}] {name}")
    if not os.path.exists(d):
        print("  DIR NOT FOUND")
        continue
    for f in sorted(os.listdir(d)):
        fp = os.path.join(d, f)
        print(" ", f, f"({os.path.getsize(fp)//1024} KB)")
        if f.lower().endswith(".pdf"):
            try:
                doc = fitz.open(fp)
                for i, p in enumerate(doc):
                    txt = p.get_text() or ""
                    for l in txt.splitlines():
                        if any(k in l.lower() for k in ["cccd", "cmnd", "số:", "họ và tên"]):
                            print(f"    [PDF-p{i+1}]:", l.strip())
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

const { Client } = require('ssh2');
const conn = new Client();

const pyScript = `
import fitz

print("=== 1. CCCD NGUYEN THI THANH HANG.pdf ===")
doc1 = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960/CCCD NGUYỄN THỊ THANH HẰNG.pdf')
print("Pages:", len(doc1))
for i in range(len(doc1)):
    print(f"Page {i+1} images:", len(doc1[i].get_images()))
    t = doc1[i].get_text().strip()
    if t:
        print(f"Page {i+1} text:", t[:200])

print("\\n=== 2. HD+PL01 046C0002960.pdf ===")
doc2 = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960/HĐ+PL01 046C0002960.pdf')
print("Pages:", len(doc2))
for i in range(min(2, len(doc2))):
    for line in doc2[i].get_text().splitlines():
        if any(k in line.lower() for k in ['họ và tên', 'cmnd', 'cccd', 'ngày sinh', 'hằng']):
            print(f"P{i+1}:", line.strip())

print("\\n=== 3. 088C6174213.pdf ===")
doc3 = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/088C6174213/088C6174213.pdf')
print("Pages:", len(doc3))
for i in range(min(2, len(doc3))):
    for line in doc3[i].get_text().splitlines():
        if any(k in line.lower() for k in ['họ và tên', 'cmnd', 'cccd', 'ngày sinh', 'sơn', 'nguyễn']):
            print(f"P{i+1}:", line.strip())
`;

const b64 = Buffer.from(pyScript).toString('base64');
conn.on('ready', () => {
  const cmd = `echo "${b64}" | base64 -d > /tmp/_test_pdfs.py && python3 /tmp/_test_pdfs.py && rm -f /tmp/_test_pdfs.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

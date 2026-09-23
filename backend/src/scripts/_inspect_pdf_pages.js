const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const pyCode = `
import fitz
import os

base_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

test_cases = [
    ("2026-09-09", "003C7663035", "hop-dong-003C7663035.pdf"),
    ("2026-09-09", "003C0879444", "hop-dong-003C0879444.pdf"),
    ("2026-09-09", "046C0002904", "CCCD LÊ NGỌC HẢI.pdf"),
    ("2026-09-10", "046C0002915", "CCCD HUỲNH KIM NGÀ.pdf"),
    ("2026-09-10", "046C0002881", "HD + PL01 046C0002881.pdf"),
    ("2026-09-10", "003C8780568", "hop-dong-003C8780568.pdf"),
]

for batch, code, fname in test_cases:
    fp = os.path.join(base_dir, batch, code, fname)
    if not os.path.exists(fp):
        print("NOT FOUND: " + fp)
        continue
    doc = fitz.open(fp)
    print("==================================================")
    print("FILE: " + code + " / " + fname + " (Pages: " + str(len(doc)) + ", Size: " + str(os.path.getsize(fp)//1024) + "KB)")
    for i, page in enumerate(doc):
        text = page.get_text().strip()
        imgs = page.get_images()
        line = "  Page " + str(i+1) + ": TextLen=" + str(len(text)) + ", EmbeddedImages=" + str(len(imgs))
        print(line)
        lower = text.lower()
        if "cccd" in lower or "căn cước" in lower or "định danh" in lower or "cmnd" in lower:
            # In dòng chứa từ khóa
            for l in text.split("\\n"):
                ll = l.lower()
                if "cccd" in ll or "căn cước" in ll or "cmnd" in ll or "định danh" in ll or "số:" in ll or "số :" in ll:
                    print("    -> " + l.strip())
`;

    sftp.writeFile('/opt/mxv-checklist/backend/_inspect_py.py', pyCode, (err2) => {
      if (err2) throw err2;
      conn.exec('python3 /opt/mxv-checklist/backend/_inspect_py.py && rm -f /opt/mxv-checklist/backend/_inspect_py.py', (err3, stream) => {
        if (err3) throw err3;
        let out = '';
        let errOut = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => errOut += d.toString());
        stream.on('close', (code) => {
          console.log('EXIT CODE:', code);
          console.log(out);
          if (errOut) console.error(errOut);
          conn.end();
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

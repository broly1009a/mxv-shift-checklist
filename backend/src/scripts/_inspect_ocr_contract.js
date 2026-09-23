const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c '
import fitz, os
fp = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/003C7663035/hop-dong-003C7663035.pdf"
doc = fitz.open(fp)
for i, p in enumerate(doc):
    pix = p.get_pixmap(dpi=150)
    print(f"Page {i+1}: {pix.width}x{pix.height}")
    # OCR trang bằng pytesseract hoặc kiểm tra
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        ocr_text = pytesseract.image_to_string(img, lang="vie")
        print(f"  OCR sample: {ocr_text[:200].replace(chr(10), \" \")}")
        for l in ocr_text.splitlines():
            if any(k in l.lower() for k in ["cccd", "căn cước", "cmnd", "số:", "họ và tên", "ngày sinh"]):
                print("    ->", l.strip())
    except Exception as e:
        print("  OCR error:", e)
'`;
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

const { Client } = require('ssh2');
const conn = new Client();

const pyScript = `
import fitz, io
from PIL import Image

doc = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960/CCCD NGUYỄN THỊ THANH HẰNG.pdf')
page = doc[0]
for idx, img_info in enumerate(page.get_images()):
    xref = img_info[0]
    base_image = doc.extract_image(xref)
    image_bytes = base_image["image"]
    img = Image.open(io.BytesIO(image_bytes))
    print(f"Image {idx+1}: size={img.size}, format={base_image['ext']}")

pix = page.get_pixmap(dpi=200)
print(f"Render page pixmap: size={pix.width}x{pix.height}")
`;

const b64 = Buffer.from(pyScript).toString('base64');
conn.on('ready', () => {
  const cmd = `echo "${b64}" | base64 -d > /tmp/_test_hang.py && python3 /tmp/_test_hang.py && rm -f /tmp/_test_hang.py`;
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

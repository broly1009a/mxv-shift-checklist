const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002961';
  const cmd = `python3 -c "
import fitz, os
from PIL import Image

d = '${dir}'
for f in sorted(os.listdir(d)):
    fp = os.path.join(d, f)
    if f.endswith('.pdf'):
        try:
            doc = fitz.open(fp)
            print(f, 'PDF pages:', len(doc))
            for idx, p in enumerate(doc):
                txt = p.get_text() or ''
                print('  page', idx, 'text len:', len(txt), 'preview:', txt[:100].replace(chr(10), ' '))
                imgs = p.get_images()
                print('  page', idx, 'images count:', len(imgs))
        except Exception as e:
            print(f, 'ERR:', e)
    elif f.endswith('.png') or f.endswith('.jpg'):
        try:
            im = Image.open(fp)
            print(f, 'IMG size:', im.size, im.format)
        except Exception as e:
            print(f, 'ERR:', e)
"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', (d) => (out += d.toString()));
    stream.stderr.on('data', (d) => (errOut += d.toString()));
    stream.on('close', (code) => {
      console.log(out);
      if (errOut) console.log('ERR:', errOut);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

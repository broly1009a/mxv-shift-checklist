const { Client } = require('ssh2');
const conn = new Client();

const scriptContent = `
const fitz = require('pdfjs-dist') || null;
const fs = require('fs');

async function testExtract() {
  const { execSync } = require('child_process');
  
  console.log('=== TEST EXTRACT PDF CCCD ===');
  const pyCmd1 = \`python3 -c "
import fitz
doc = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960/CCCD NGUYỄN THỊ THANH HẰNG.pdf')
print('Total pages:', len(doc))
for i, page in enumerate(doc):
    print(f'--- PAGE {i+1} ---')
    print(page.get_text()[:300])
"\`;
  console.log(execSync(pyCmd1).toString());

  console.log('=== TEST EXTRACT HD+PL01 ===');
  const pyCmd2 = \`python3 -c "
import fitz
doc = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960/HĐ+PL01 046C0002960.pdf')
print('Total pages:', len(doc))
for i in range(min(2, len(doc))):
    print(f'--- PAGE {i+1} ---')
    for line in doc[i].get_text().splitlines():
        if any(k in line.lower() for k in ['họ và tên', 'cmnd', 'cccd', 'ngày sinh', 'định danh']):
            print('  ', line.strip())
"\`;
  console.log(execSync(pyCmd2).toString());

  console.log('=== TEST CASE 1: 088C6174213 HOP DONG ===');
  const pyCmd3 = \`python3 -c "
import fitz
doc = fitz.open('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/088C6174213/088C6174213.pdf')
print('Total pages:', len(doc))
for i in range(min(2, len(doc))):
    print(f'--- PAGE {i+1} ---')
    for line in doc[i].get_text().splitlines():
        if any(k in line.lower() for k in ['họ và tên', 'cmnd', 'cccd', 'ngày sinh', 'sơn', 'nguyễn']):
            print('  ', line.strip())
"\`;
  console.log(execSync(pyCmd3).toString());
}

testExtract().catch(console.error);
`;

const b64 = Buffer.from(scriptContent).toString('base64');
conn.on('ready', () => {
  const cmd = `echo "${b64}" | base64 -d > /tmp/_test_2_pdfs.js && node /tmp/_test_2_pdfs.js && rm -f /tmp/_test_2_pdfs.js`;
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

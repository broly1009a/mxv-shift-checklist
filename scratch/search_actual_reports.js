const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl
import os
import glob

# Tim trong sandbox hoac tren /mnt/qlgd-it
search_files = [
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich 2026.xlsx',
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx',
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/Thong ke so lot giao dich 2026.xlsx',
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/Thong ke so lot giao dich ACM 2026 2.xlsx',
]

for f in search_files:
    if os.path.exists(f):
        wb = openpyxl.load_workbook(f, data_only=True)
        print(f'\\n=== TIM TRONG FILE: {f} ===')
        for sname in wb.sheetnames:
            ws = wb[sname]
            for r in ws.iter_rows(values_only=True):
                for c in r:
                    if c in [159794, 67246, 144962, 54911, 23794, 12061]:
                        print(f'Found {c} in sheet {sname} | row: {[x for x in r[:10] if x is not None]}')
`;

  const cmd = `cat << 'EOF' > /tmp/search_magic_nums.py\n${remotePython}\nEOF\npython3 /tmp/search_magic_nums.py\nrm -f /tmp/search_magic_nums.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

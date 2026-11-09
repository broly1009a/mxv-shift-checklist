const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl
import os

files = [
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich 2026.xlsx',
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx'
]

for f in files:
    if os.path.exists(f):
        wb = openpyxl.load_workbook(f, data_only=True)
        print(f'\\n====================================')
        print(f'FILE: {os.path.basename(f)}')
        print(f'Sheets: {wb.sheetnames}')
        
        # In TONGHOP
        if 'TONGHOP' in wb.sheetnames:
            ws = wb['TONGHOP']
            print('\\n--- SHEET TONGHOP ---')
            for r in ws.iter_rows(values_only=True):
                # Loc cac dong co du lieu
                vals = [x for x in r if x is not None]
                if vals and (any(isinstance(x, (int, float)) for x in vals) or 'Tháng' in str(vals)):
                    print(r[:8])
                    
        # In cac sheet T10 neu co
        for sname in wb.sheetnames:
            if '10' in sname or '11' in sname:
                ws = wb[sname]
                print(f'\\n--- SHEET {sname} (first 10 rows) ---')
                count = 0
                for r in ws.iter_rows(values_only=True):
                    vals = [x for x in r if x is not None]
                    if vals:
                        print(r[:8])
                        count += 1
                        if count > 15:
                            break
`;

  const cmd = `cat << 'EOF' > /tmp/read_official.py\n${remotePython}\nEOF\npython3 /tmp/read_official.py\nrm -f /tmp/read_official.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


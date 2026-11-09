const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=True)

for sname in ['T08.2026', 'T09.2026', 'T10.2026']:
    if sname in wb.sheetnames:
        ws = wb[sname]
        print(f"\\n=== SHEET {sname} ===")
        for r in list(ws.iter_rows(values_only=True))[:10]:
            print([str(x)[:25] if x is not None else '' for x in r[:12]])
`;

  const cmd = `cat << 'EOF' > /tmp/check_acm_sheet_structure.py\n${remotePython}\nEOF\npython3 /tmp/check_acm_sheet_structure.py\nrm -f /tmp/check_acm_sheet_structure.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


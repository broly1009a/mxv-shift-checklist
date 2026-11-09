const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=True)
ws = wb['T10.2026']

print("=== ALL ROWS IN T10.2026 of Thong ke so lot giao dich ACM 2026.xlsx ===")
headers = [c for c in next(ws.iter_rows(min_row=4, max_row=4, values_only=True))]
for idx, h in enumerate(headers):
    if h:
        print(f"Col {idx}: {repr(h)}")

for r in ws.iter_rows(min_row=5, values_only=True):
    if any(r):
        print(f"Row: {r[0]} | Date: {r[1]} | MS_Lot: {r[2]} | CQG_Lot: {r[5]} | Note: {r[8]}")
`;

  const cmd = `cat << 'EOF' > /tmp/check_acm_t10_all.py\n${remotePython}\nEOF\npython3 /tmp/check_acm_t10_all.py\nrm -f /tmp/check_acm_t10_all.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


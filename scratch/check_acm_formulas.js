const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=False) # Lay ca cong thuc

for sname in ['T08.2026', 'T09.2026']:
    ws = wb[sname]
    print(f"\\n=== FORMULAS IN {sname} ===")
    for r in list(ws.iter_rows(min_row=1, max_row=8, values_only=False)):
        row_vals = [f"{c.coordinate}={c.value}" for c in r[:10] if c.value is not None]
        if row_vals:
            print("  ", row_vals)
`;

  const cmd = `cat << 'EOF' > /tmp/check_acm_formulas.py\n${remotePython}\nEOF\npython3 /tmp/check_acm_formulas.py\nrm -f /tmp/check_acm_formulas.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


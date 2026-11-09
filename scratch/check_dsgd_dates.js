const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl
from collections import Counter

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/DSGD T10.2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=True)
ws = wb.active

date_counter = Counter()
for r in ws.iter_rows(min_row=2, values_only=True):
    val = r[21]
    if val:
        # Lay dd-MM-yyyy
        date_str = str(val)[:10]
        date_counter[date_str] += 1

print(f"Total rows: {sum(date_counter.values())}")
print("Dates in DSGD T10.2026.xlsx:")
for d, c in sorted(date_counter.items()):
    print(f"  {d}: {c} rows")
`;

  const cmd = `cat << 'EOF' > /tmp/check_dsgd_dates.py\n${remotePython}\nEOF\npython3 /tmp/check_dsgd_dates.py\nrm -f /tmp/check_dsgd_dates.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


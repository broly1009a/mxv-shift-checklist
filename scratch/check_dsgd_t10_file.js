const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/DSGD T10.2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=True)
ws = wb.active

dates = set()
count = 0
for r in ws.iter_rows(min_row=2, values_only=True):
    count += 1
    # Ngay giao dich ở col nào?
    if len(r) > 13 and r[13]:
        dates.add(str(r[13])[:10])

print(f"File DSGD T10.2026.xlsx: {count} rows")
print(f"Dates in file ({len(dates)}): {sorted(list(dates))}")
`;

  const cmd = `cat << 'EOF' > /tmp/check_dsgd_t10_agg.py\n${remotePython}\nEOF\npython3 /tmp/check_dsgd_t10_agg.py\nrm -f /tmp/check_dsgd_t10_agg.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich/DSGD T10.2026.xlsx'
wb = openpyxl.load_workbook(f, data_only=True)
ws = wb.active

headers = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
print("Headers:", headers)

for r in list(ws.iter_rows(min_row=2, max_row=5, values_only=True)):
    print("Row:", r)
`;

  const cmd = `cat << 'EOF' > /tmp/check_dsgd_headers.py\n${remotePython}\nEOF\npython3 /tmp/check_dsgd_headers.py\nrm -f /tmp/check_dsgd_headers.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });


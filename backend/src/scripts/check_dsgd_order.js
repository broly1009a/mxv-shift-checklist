const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const pyScript = `
import openpyxl
import os

dsgd_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/22.10/DSGD.xlsx"
print("Checking:", dsgd_path)
wb = openpyxl.load_workbook(dsgd_path, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
header = [str(c).strip() if c else '' for c in rows[0]]
print("DSGD Header:", header)

matched = []
for idx, r in enumerate(rows[1:], start=2):
    r_str = " ".join([str(c) for c in r if c])
    if "080C0310183" in r_str:
        matched.append((idx, r))

print(f"Total rows for 080C0310183: {len(matched)}")
for idx, r in matched:
    print(f"Row {idx}: {r}")
`;

  conn.exec(`cat << 'EOF' > /tmp/check_dsgd_order.py\n${pyScript}\nEOF\npython3 /tmp/check_dsgd_order.py`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

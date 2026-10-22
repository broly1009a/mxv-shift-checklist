const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const pyScript = `
import openpyxl

dsgd_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/22.10/DSGD.xlsx"
wb = openpyxl.load_workbook(dsgd_path, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))

print("Search for Ord # 164383058 in DSGD:")
found_ord = [r for r in rows if "164383058" in " ".join([str(c) for c in r if c])]
print("Found ord #:", len(found_ord))
for r in found_ord:
    print(" ", r[:15])

print("\\nSearch for SBEH27 with Price 20.52 in DSGD:")
found_sbeh27 = [r for r in rows if r[5] == "SBEH27" and r[13] == 20.52]
print("Found SBEH27 20.52:", len(found_sbeh27))
for r in found_sbeh27:
    print(" ", r[1], r[3], r[5], r[10], r[12], r[13], r[21])

print("\\nTotal rows in DSGD.xlsx:", len(rows) - 1)
`;

  conn.exec(`cat << 'EOF' > /tmp/check_sbeh27.py\n${pyScript}\nEOF\npython3 /tmp/check_sbeh27.py`, (err, stream) => {
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

const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const pyScript = `
import openpyxl

for fname in ["FR1.xlsx", "FR2.xlsx"]:
    path = f"/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/22.10/{fname}"
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    found = [r for r in rows if "164383058" in " ".join([str(c) for c in r if c])]
    print(f"{fname} has 164383058:", len(found))
    for r in found:
        print(" ", r)
`;

  conn.exec(`cat << 'EOF' > /tmp/check_fr1_fr2.py\n${pyScript}\nEOF\npython3 /tmp/check_fr1_fr2.py`, (err, stream) => {
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

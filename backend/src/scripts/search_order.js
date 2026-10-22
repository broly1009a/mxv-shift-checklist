const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const pyScript = `
import openpyxl
import os

fr_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/22.10/FR.xlsx"
dsgd_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/MS/2026/T10.2026/22.10/DSGD.xlsx"

print("=== CHECK ORDER IN FR.xlsx ===")
if os.path.exists(fr_path):
    wb = openpyxl.load_workbook(fr_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = [str(c).strip() if c else '' for c in rows[0]]
    print("FR Header:", header[:10])
    matched_fr = []
    for idx, r in enumerate(rows[1:], start=2):
        r_str = " ".join([str(c) for c in r if c])
        if "080C0310183" in r_str or "SBEH27" in r_str:
            matched_fr.append((idx, r))
    print(f"Found {len(matched_fr)} matching rows in FR.xlsx:")
    for idx, r in matched_fr:
        print(f"  Row {idx}: {r[:12]}")
else:
    print("FR file not found:", fr_path)

print("\\n=== CHECK ORDER IN DSGD.xlsx ===")
if os.path.exists(dsgd_path):
    wb = openpyxl.load_workbook(dsgd_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = [str(c).strip() if c else '' for c in rows[0]]
    print("DSGD Header:", header[:10])
    matched_dsgd = []
    for idx, r in enumerate(rows[1:], start=2):
        r_str = " ".join([str(c) for c in r if c])
        if "080C0310183" in r_str:
            matched_dsgd.append((idx, r))
    print(f"Found {len(matched_dsgd)} matching rows for 080C0310183 in DSGD.xlsx:")
    for idx, r in matched_dsgd:
        print(f"  Row {idx}: {r[:15]}")
else:
    print("DSGD file not found:", dsgd_path)
`;

  conn.exec(`cat << 'EOF' > /tmp/check_order_detail.py\n${pyScript}\nEOF\npython3 /tmp/check_order_detail.py`, (err, stream) => {
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

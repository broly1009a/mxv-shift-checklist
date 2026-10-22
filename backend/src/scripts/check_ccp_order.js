const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const pyScript = `
import openpyxl

ccp_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/22.10/DSGD CCP.xlsx"
wb = openpyxl.load_workbook(ccp_path, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))

print("Search for Ord # 164383058 in DSGD CCP:")
found_ccp = [r for r in rows if "164383058" in " ".join([str(c) for c in r if c])]
print("Found ord # in CCP:", len(found_ccp))
for r in found_ccp:
    print(" ", r[:15])

found_acc = [r for r in rows if "080C0310183" in " ".join([str(c) for c in r if c])]
print("Found acc 080C0310183 in CCP:", len(found_acc))
for r in found_acc:
    print(" ", r[:15])
`;

  conn.exec(`cat << 'EOF' > /tmp/check_ccp_order.py\n${pyScript}\nEOF\npython3 /tmp/check_ccp_order.py`, (err, stream) => {
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

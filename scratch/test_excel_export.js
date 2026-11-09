const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = 'curl -s -w "%{http_code}" -o /tmp/test_export_10.xlsx http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10/export-excel';
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let buf = '';
    stream.on('data', d => buf += d.toString());
    stream.on('close', () => {
      console.log('HTTP STATUS:', buf);
      conn.exec('ls -lh /tmp/test_export_10.xlsx', (err2, stream2) => {
        if (err2) throw err2;
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.on('close', () => {
          // Check formulas in exported Excel using python
          const pyCheck = `
import openpyxl

wb = openpyxl.load_workbook('/tmp/test_export_10.xlsx', data_only=False)
ws = wb['Sheet1']
print("=== VERIFYING FORMULAS IN EXPORTED EXCEL ===")
print("Row 5 (First TVKD):")
print("  D5 (Lot Cur):", ws['D5'].value)
print("  E5 (Formula):", ws['E5'].value)

print("\\nRow 35 (Total CQG):")
print("  A35 (Title):", ws['A35'].value)
print("  C35 (Formula):", ws['C35'].value)
print("  D35 (Formula):", ws['D35'].value)
print("  E35 (Formula):", ws['E35'].value)

# Let's inspect formulas across the sheet
formulas_count = 0
for row in ws.iter_rows(values_only=False):
    for cell in row:
        if isinstance(cell.value, str) and cell.value.startswith('='):
            formulas_count += 1
print(f"\\nTotal Excel formulas found in generated workbook: {formulas_count}")
`;
          const runPy = `cat << 'EOF' > /tmp/check_formulas.py\n${pyCheck}\nEOF\npython3 /tmp/check_formulas.py\nrm -f /tmp/check_formulas.py`;
          conn.exec(runPy, (err3, stream3) => {
            if (err3) throw err3;
            stream3.on('data', d => process.stdout.write(d.toString()));
            stream3.on('close', () => conn.end());
          });
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

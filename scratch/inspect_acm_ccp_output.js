const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();

const pythonScript = `
import os
import openpyxl

acm_lot = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output/Thong ke so lot giao dich ACM 2026.xlsx"
acm_val = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output/Thong ke gia tri giao dich ACM 2026.xlsx"

for title, fpath in [("ACM LOT", acm_lot), ("ACM VALUE", acm_val)]:
    print("=" * 80)
    print(f"=== {title}: {fpath} ===")
    wb = openpyxl.load_workbook(fpath, data_only=False)
    print("Sheets:", wb.sheetnames)
    for sname in wb.sheetnames:
        ws = wb[sname]
        print(f"\\n--- Sheet: '{sname}' (max_row={ws.max_row}, max_col={ws.max_column}) ---")
        for r_idx in range(1, min(ws.max_row + 1, 8)):
            row_vals = [ws.cell(r_idx, c_idx).value for c_idx in range(1, min(ws.max_column + 1, 20))]
            row_str = [str(v) if v is not None else "" for v in row_vals]
            if any(row_str):
                print(f"  Row {r_idx}: {row_str[:10]}")
    wb.close()
`;

conn.on('ready', () => {
  const cmd = `python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => {
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();

const pythonScript = `
import os
import openpyxl

ms_lot_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
ms_val_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich"

files = [
    ("LOT", "Thong ke so lot giao dich 2026 2.xlsx", ms_lot_dir),
    ("LOT", "Thong ke so lot giao dich 2026.xlsx", ms_lot_dir),
    ("LOT", "Thong ke so lot giao dich LME 2026.xlsx", ms_lot_dir),
    ("LOT", "Thong ke so lot giao dich Options 2026.xlsx", ms_lot_dir),
    ("LOT", "Thong ke so lot giao dich Spread 2026.xlsx", ms_lot_dir),
    ("VAL", "Thong ke gia tri giao dich 2026 1.xlsx", ms_val_dir),
    ("VAL", "Thong ke gia tri giao dich LME 2026.xlsx", ms_val_dir),
    ("VAL", "Thong ke gia tri giao dich Options 2026.xlsx", ms_val_dir),
    ("VAL", "Thong ke gia tri giao dich Spread 2026.xlsx", ms_val_dir),
]

for cat, fname, fdir in files:
    fpath = os.path.join(fdir, fname)
    if not os.path.exists(fpath):
        continue
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheets = wb.sheetnames
    # Tìm sheet tháng gần nhất (vd T08.2026 hoặc T8.2026)
    month_sheets = [s for s in sheets if 'T' in s and '2026' in s]
    target_month_sheet = month_sheets[-1] if month_sheets else sheets[0]
    
    ws = wb[target_month_sheet]
    rows = []
    for r in ws.iter_rows(min_row=1, max_row=5, values_only=True):
        row_vals = [str(c) if c is not None else "" for c in r]
        # cắt bớt các ô rỗng ở đuôi
        while row_vals and row_vals[-1] == "":
            row_vals.pop()
        rows.append(row_vals)
    wb.close()
    
    print("=" * 80)
    print(f"[{cat}] {fname}")
    print(f"Sheets: {sheets}")
    print(f"Examined Month Sheet: '{target_month_sheet}' (Total cols={len(rows[3]) if len(rows)>=4 else 0})")
    for idx, r in enumerate(rows, 1):
        non_empty = [(i+1, v) for i, v in enumerate(r) if v]
        print(f"  Row {idx} ({len(non_empty)} cells): {non_empty[:12]}...")
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

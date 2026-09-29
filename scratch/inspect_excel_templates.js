const { Client } = require('../backend/node_modules/ssh2');
const fs = require('fs');

const conn = new Client();

const pythonScript = `
import os
import glob
from datetime import datetime
import openpyxl

dirs = {
    "ccp_output": "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output",
    "ms_lot": "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich",
    "ms_val": "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich"
}

print("=== 1. DANH SÁCH FILE TRONG TỪNG THƯ MỤC ===")
for key, dpath in dirs.items():
    print(f"\\n--- {key} ({dpath}) ---")
    if not os.path.exists(dpath):
        print(f"Directory not found: {dpath}")
        continue
    files = sorted(os.listdir(dpath))
    for f in files:
        full_p = os.path.join(dpath, f)
        if os.path.isfile(full_p) and f.endswith(('.xlsx', '.xlsm', '.xls')):
            stat = os.stat(full_p)
            mtime = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            size_kb = stat.st_size / 1024
            print(f"  {f:45} | Size: {size_kb:8.1f} KB | MTime: {mtime}")

print("\\n=== 2. SOI CẤU TRÚC SHEET & HEADER TỪNG FILE ===")
def inspect_file(fpath):
    try:
        wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
        sheets = wb.sheetnames
        res = f"Sheets ({len(sheets)}): {sheets[:6]}"
        wb.close()
        return res
    except Exception as e:
        return f"Error: {e}"

ccp_dir = dirs["ccp_output"]
if os.path.exists(ccp_dir):
    for f in sorted(os.listdir(ccp_dir)):
        if f.endswith('.xlsx') and not f.startswith('~'):
            p = os.path.join(ccp_dir, f)
            print(f"\\n[CCP OUTPUT] {f}:")
            print("  ", inspect_file(p))

print("\\n=== 3. TEMPLATE CHUẨN MS (DATE MODIFIED 17/9 HOẶC 18/9) ===")
for dname, dpath in [("MS LOT", dirs["ms_lot"]), ("MS VALUE", dirs["ms_val"])]:
    print(f"\\n--- {dname} ---")
    if os.path.exists(dpath):
        for f in sorted(os.listdir(dpath)):
            if f.endswith(('.xlsx', '.xlsm')) and not f.startswith('~'):
                p = os.path.join(dpath, f)
                stat = os.stat(p)
                mtime = datetime.fromtimestamp(stat.st_mtime)
                # In thông tin tất cả các file
                print(f"[{dname}] {f} (MTime: {mtime.strftime('%Y-%m-%d %H:%M:%S')})")
                print("  ", inspect_file(p))
`;

conn.on('ready', () => {
  console.log('SSH connection established');
  // Chạy python script trên remote
  const cmd = `python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => {
      console.log(`\nScript exited with code ${code}`);
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

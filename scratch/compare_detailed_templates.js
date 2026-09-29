const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();

const pythonScript = `
import os
import openpyxl

ccp_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output"
ms_lot_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
ms_val_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich"

def get_file_info(fpath):
    if not os.path.exists(fpath):
        return {"exists": False}
    try:
        wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
        sheets = wb.sheetnames
        sheet_details = {}
        for sname in sheets[:3]: # Lấy 3 sheet đầu
            ws = wb[sname]
            rows = []
            for r in ws.iter_rows(min_row=1, max_row=6, values_only=True):
                # lấy các ô không rỗng
                compact_r = [str(c) if c is not None else "" for c in r[:30]]
                if any(compact_r):
                    rows.append(compact_r[:15])
            sheet_details[sname] = {
                "max_row": ws.max_row,
                "max_column": ws.max_column,
                "sample_rows": rows
            }
        wb.close()
        return {"exists": True, "sheets": sheets, "sheet_details": sheet_details, "size": os.path.getsize(fpath)}
    except Exception as e:
        return {"exists": True, "error": str(e)}

pairs = [
    # LOT
    ("Thong ke so lot giao dich 2026.xlsx", ccp_dir, "Thong ke so lot giao dich 2026 2.xlsx", ms_lot_dir),
    ("Thong ke so lot giao dich LME 2026.xlsx", ccp_dir, "Thong ke so lot giao dich LME 2026.xlsx", ms_lot_dir),
    ("Thong ke so lot giao dich Options 2026.xlsx", ccp_dir, "Thong ke so lot giao dich Options 2026.xlsx", ms_lot_dir),
    ("Thong ke so lot giao dich Spread 2026.xlsx", ccp_dir, "Thong ke so lot giao dich Spread 2026.xlsx", ms_lot_dir),
    ("Thong ke so lot giao dich ACM 2026.xlsx", ccp_dir, "Thong ke so lot giao dich ACM 2026 2.xlsx", ms_lot_dir),
    # VALUE
    ("Thong ke gia tri giao dich 2026.xlsx", ccp_dir, "Thong ke gia tri giao dich 2026 1.xlsx", ms_val_dir),
    ("Thong ke gia tri giao dich LME 2026.xlsx", ccp_dir, "Thong ke gia tri giao dich LME 2026.xlsx", ms_val_dir),
    ("Thong ke gia tri giao dich Options 2026.xlsx", ccp_dir, "Thong ke gia tri giao dich Options 2026.xlsx", ms_val_dir),
    ("Thong ke gia tri giao dich Spread 2026.xlsx", ccp_dir, "Thong ke gia tri giao dich Spread 2026.xlsx", ms_val_dir),
    ("Thong ke gia tri giao dich ACM 2026.xlsx", ccp_dir, "Thong ke gia tri giao dich ACM 2026 1.xlsx", ms_val_dir),
]

for ccp_name, ccp_d, ms_name, ms_d in pairs:
    ccp_p = os.path.join(ccp_d, ccp_name)
    ms_p = os.path.join(ms_d, ms_name)
    print("=" * 80)
    print(f"SO SÁNH: CCP [{ccp_name}] VS MS [{ms_name}]")
    print("=" * 80)
    
    info_ccp = get_file_info(ccp_p)
    info_ms = get_file_info(ms_p)
    
    print(f"CCP Size: {info_ccp.get('size', 0)} bytes | Sheets: {info_ccp.get('sheets', [])}")
    print(f"MS  Size: {info_ms.get('size', 0)} bytes | Sheets: {info_ms.get('sheets', [])}")
    
    # So sánh các sheet
    if info_ms.get("exists") and info_ccp.get("exists"):
        ms_sheets = info_ms.get("sheets", [])
        ccp_sheets = info_ccp.get("sheets", [])
        diff_sheets = set(ms_sheets) - set(ccp_sheets)
        if diff_sheets:
            print(f"==> CCP THIẾU CÁC SHEET TỪ MS: {sorted(list(diff_sheets))}")
        
        # So sánh cấu trúc sheet tháng ví dụ T09.2026 hoặc sheet đầu
        common_sheets = [s for s in ccp_sheets if s in ms_sheets]
        print(f"Sheet chung: {common_sheets}")
        for s in common_sheets[:2]:
            print(f"\\n--- Chi tiết Sheet '{s}' ---")
            dt_ccp = info_ccp.get("sheet_details", {}).get(s, {})
            dt_ms = info_ms.get("sheet_details", {}).get(s, {})
            print(f"  CCP: Rows={dt_ccp.get('max_row')}, Cols={dt_ccp.get('max_column')}")
            print(f"  MS : Rows={dt_ms.get('max_row')}, Cols={dt_ms.get('max_column')}")
            print("  [Sample Row 4 (Header) CCP]:", dt_ccp.get("sample_rows", [[]])[-1] if len(dt_ccp.get("sample_rows", []))>=4 else "N/A")
            print("  [Sample Row 4 (Header) MS ]:", dt_ms.get("sample_rows", [[]])[-1] if len(dt_ms.get("sample_rows", []))>=4 else "N/A")
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

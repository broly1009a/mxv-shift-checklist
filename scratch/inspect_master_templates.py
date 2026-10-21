# -*- coding: utf-8 -*-
import openpyxl
import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

output_dir = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke ccp\output"
files = [f for f in os.listdir(output_dir) if f.endswith('.xlsx') and not f.startswith('~$') and not f.startswith('DSGD')]

print(f"Tổng số {len(files)} file Master:")

for fname in sorted(files):
    fpath = os.path.join(output_dir, fname)
    wb = openpyxl.load_workbook(fpath, data_only=True)
    sheets = wb.sheetnames
    
    # Lấy sheet tháng gần nhất hoặc sheet đầu tiên không phải TONGHOP
    month_sheets = [s for s in sheets if any(m in s.upper() for m in ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'])]
    target_sheet = month_sheets[-1] if month_sheets else sheets[-1]
    ws = wb[target_sheet]
    
    print(f"\n=======================================================")
    print(f"FILE: {fname}")
    print(f"Sheets: {sheets}")
    print(f"Target Sheet kiểm tra: {target_sheet} (Max row: {ws.max_row}, Max col: {ws.max_column})")
    
    # In row 1 -> 6 (5 cột đầu và 5 cột cuối)
    for r in range(1, 8):
        row_vals = [str(ws.cell(r, c).value or '') for c in range(1, min(ws.max_column + 1, 15))]
        print(f"  Row {r}: {row_vals[:10]}")
    
    # Tìm dòng TỔNG
    for r in range(5, min(ws.max_row + 1, 60)):
        c1 = str(ws.cell(r, 1).value or '').strip().upper()
        c2 = str(ws.cell(r, 2).value or '').strip().upper()
        if 'TỔNG' in c1 or 'TONG' in c1 or 'TỔNG' in c2 or 'TONG' in c2:
            print(f"  -> DÒNG TỔNG TẠI ROW {r}: Col 1='{c1}', Col 2='{c2}'")
            # In công thức dòng tổng
            wb_formula = openpyxl.load_workbook(fpath, data_only=False)
            ws_formula = wb_formula[target_sheet]
            f_vals = [str(ws_formula.cell(r, c).value or '') for c in range(1, min(ws.max_column + 1, 10))]
            print(f"     Công thức dòng tổng: {f_vals[:8]}")
            wb_formula.close()
            break
    wb.close()

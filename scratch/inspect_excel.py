import openpyxl
import os

print("=== 1. Inspecting 'Bao cao thang 09.2026 - Final.xlsx' ===")
p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
if os.path.exists(p1):
    wb = openpyxl.load_workbook(p1, data_only=True)
    print("Sheets:", wb.sheetnames)
    ws = wb.active
    print(f"Active sheet: {ws.title}, max_row: {ws.max_row}, max_column: {ws.max_column}")
    
    print("\n--- Rows 1-30 in Final.xlsx (Section I headers & first few rows) ---")
    for r in range(1, 20):
        row_vals = [ws.cell(r, c).value for c in range(1, 15)]
        if any(row_vals):
            print(f"R{r}: {row_vals}")
            
    print("\n--- Searching for Section II & III in Final.xlsx ---")
    for r in range(20, ws.max_row + 1):
        c1 = ws.cell(r, 1).value
        c2 = ws.cell(r, 2).value
        if c1 or c2:
            txt = f"{c1} {c2}"
            if any(k in str(txt) for k in ["II.", "III.", "Spread", "LME", "Options", "Tổng"]):
                row_vals = [ws.cell(r, c).value for c in range(1, 12)]
                print(f"R{r}: {row_vals}")

print("\n=== 2. Inspecting 'Thong ke so lot giao dich 2026.xlsx' ===")
p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
if os.path.exists(p2):
    wb2 = openpyxl.load_workbook(p2, read_only=True)
    print("Sheets in Thong ke so lot giao dich 2026.xlsx:", wb2.sheetnames)
else:
    print(f"File not found: {p2}")

import openpyxl
import os

mo_tkgd_folder = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD"
files = [f for f in os.listdir(mo_tkgd_folder) if f.endswith('.xlsx')]
print("Files in Mo TKGD:", files)

for fname in files[:3]:
    fpath = os.path.join(mo_tkgd_folder, fname)
    wb = openpyxl.load_workbook(fpath, data_only=True)
    print(f"\nFile: {fname}, sheets: {wb.sheetnames}")
    ws = wb.active
    print(f"Active sheet: {ws.title}, max_row: {ws.max_row}, max_column: {ws.max_column}")
    for r in range(1, min(ws.max_row + 1, 10)):
        vals = [ws.cell(r, c).value for c in range(1, min(ws.max_column + 1, 10))]
        if any(vals):
            print(f"  R{r:2d}: {vals}")



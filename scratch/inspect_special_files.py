import openpyxl
import os

folder = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke"
files = [
    "Thong ke so lot giao dich Spread 2026.xlsx",
    "Thong ke so lot giao dich LME 2026.xlsx",
    "Thong ke so lot giao dich Options 2026.xlsx"
]

for fname in files:
    fpath = os.path.join(folder, fname)
    print(f"\n=======================================================")
    print(f"=== File: {fname} ===")
    if os.path.exists(fpath):
        wb = openpyxl.load_workbook(fpath, data_only=True)
        print("Sheets:", wb.sheetnames)
        # Check sheet T10.2026 or active sheet
        target_sheet = 'T10.2026' if 'T10.2026' in wb.sheetnames else ('T09.2026' if 'T09.2026' in wb.sheetnames else wb.sheetnames[0])
        ws = wb[target_sheet]
        print(f"Sheet {target_sheet}: max_row={ws.max_row}, max_col={ws.max_column}")
        for r in range(1, min(ws.max_row + 1, 25)):
            vals = [ws.cell(r, c).value for c in range(1, min(ws.max_column + 1, 15))]
            if any(vals):
                print(f"  R{r:2d}: {vals}")
    else:
        print(f"File not found: {fpath}")

print("\n=======================================================")
print("=== CHECKING Mo TKGD folder ===")
mo_tkgd_folder = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD"
if os.path.exists(mo_tkgd_folder):
    for f in os.listdir(mo_tkgd_folder):
        print("Mo TKGD item:", f)


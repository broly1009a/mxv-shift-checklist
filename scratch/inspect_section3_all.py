import openpyxl

p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
wb = openpyxl.load_workbook(p1, data_only=True)
ws = wb.active

print("=== SECTION III ALL ROWS IN Final.xlsx ===")
for r in range(130, 180):
    vals = [ws.cell(r, c).value for c in range(1, 10)]
    if any(vals):
        print(f"R{r:3d}: {vals}")



import openpyxl

p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
wb = openpyxl.load_workbook(p1, data_only=True)
ws = wb.active

print("=== SECTION II IN Bao cao thang 09.2026 - Final.xlsx ===")
for r in range(70, 131):
    vals = [ws.cell(r, c).value for c in range(1, 12)]
    if any(vals):
        print(f"R{r:3d}: {vals}")


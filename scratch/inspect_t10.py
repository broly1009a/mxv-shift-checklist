import openpyxl

p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
wb = openpyxl.load_workbook(p2, data_only=True)

print("=== INSPECTING T10.2026 in Thong ke so lot giao dich 2026.xlsx ===")
ws10 = wb['T10.2026']
print(f"T10.2026 max_row: {ws10.max_row}, max_column: {ws10.max_column}")

print("\n--- Rows 1-15 in T10.2026 ---")
for r in range(1, 15):
    vals = [ws10.cell(r, c).value for c in range(1, 20)]
    if any(vals):
        print(f"R{r}: {vals[:10]}")

print("\n--- Rows with company names or commodities in T10.2026 ---")
# let's scan column 1, 2, 3
for r in range(1, 60):
    c1 = ws10.cell(r, 1).value
    c2 = ws10.cell(r, 2).value
    c3 = ws10.cell(r, 3).value
    c4 = ws10.cell(r, 4).value
    if c1 or c2 or c3:
        print(f"R{r}: c1={c1} | c2={c2} | c3={c3} | c4={c4}")



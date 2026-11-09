import openpyxl

p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
wb = openpyxl.load_workbook(p2, data_only=True)
ws10 = wb['T10.2026']

print("=== COMMODITY DATA IN T10.2026 ===")
# Row 4 has commodity codes
# Row 27 is usually 'Tổng'
commodities = []
for c in range(99, 167):
    code = ws10.cell(4, c).value
    # Let's find sum or values in column c
    total_val = ws10.cell(27, c).value
    # also check if any daily rows have values
    daily_vals = [ws10.cell(r, c).value for r in range(5, 27) if ws10.cell(r, c).value not in (None, 0, '')]
    if code or total_val or daily_vals:
        commodities.append((c, code, total_val, len(daily_vals)))

print(f"Total commodities in T10.2026 header: {len(commodities)}")
for c, code, tot, cnt in commodities:
    print(f"Col {c:3d}: Code={code} | TotalRow27={tot} | ActiveDays={cnt}")



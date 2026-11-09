import openpyxl

p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
wb = openpyxl.load_workbook(p2, data_only=True)
ws9 = wb['T09.2026']

print("=== ALL COLUMNS IN T09.2026 ===")
# row 2, 3, 4
headers = []
for c in range(1, ws9.max_column + 1):
    v2 = ws9.cell(2, c).value
    v3 = ws9.cell(3, c).value
    v4 = ws9.cell(4, c).value
    if v2 or v3 or v4:
        headers.append((c, v2, v3, v4))

print(f"Total columns with headers: {len(headers)}")
for c, v2, v3, v4 in headers:
    v2_str = str(v2).replace('\n', ' ') if v2 else ''
    v3_str = str(v3).replace('\n', ' ') if v3 else ''
    v4_str = str(v4).replace('\n', ' ') if v4 else ''
    print(f"Col {c:3d}: [{v2_str}] [{v3_str}] [{v4_str}]")



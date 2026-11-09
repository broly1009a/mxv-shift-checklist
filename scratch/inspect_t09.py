import openpyxl
import os

print("=== CHECKING T09.2026 in Thong ke so lot giao dich 2026.xlsx ===")
p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
wb = openpyxl.load_workbook(p2, data_only=True)
ws9 = wb['T09.2026']

print("Scanning for tables, headers, and company names in T09.2026...")
for r in range(1, ws9.max_row + 1):
    c1 = ws9.cell(r, 1).value
    c2 = ws9.cell(r, 2).value
    c3 = ws9.cell(r, 3).value
    # if line has text
    if any([c1, c2, c3]):
        # check if it looks like a section header or company or total
        s = f"{c1} | {c2} | {c3}"
        if any(w in str(s) for w in ["THỐNG KÊ", "TVKD", "Thành viên", "Mặt hàng", "Tổng", "CQG", "Spread", "LME", "Options", "012", "080"]):
            print(f"R{r}: {s}")

print("\n=== CHECKING OTHER SHEETS OR STRUCTURE in T09.2026 ===")
# Where are the TVKDs in T09.2026? Let's check columns across row 2, 3, 4
for c in range(1, min(ws9.max_column + 1, 60)):
    v2 = ws9.cell(2, c).value
    v3 = ws9.cell(3, c).value
    v4 = ws9.cell(4, c).value
    if v2 or v3 or v4:
        print(f"Col {c}: r2={v2} | r3={v3} | r4={v4}")


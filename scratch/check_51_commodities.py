import openpyxl

p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
wb1 = openpyxl.load_workbook(p1, data_only=True)
ws1 = wb1.active

print("=== 51 CQG COMMODITIES IN Final.xlsx ===")
for r in range(73, 124):
    stt = ws1.cell(r, 1).value
    name = ws1.cell(r, 2).value
    prev_t8 = ws1.cell(r, 3).value
    cur_t9 = ws1.cell(r, 4).value
    print(f"R{r:3d}: STT={stt} | Name='{name}' | prev={prev_t8} | cur={cur_t9}")


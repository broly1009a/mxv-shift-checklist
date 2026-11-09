import openpyxl
import json

# 1. From Final.xlsx
p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
wb1 = openpyxl.load_workbook(p1, data_only=True)
ws1 = wb1.active

names_map = {}
# Section I CQG (r5 to 39)
for r in range(5, 40):
    val = ws1.cell(r, 2).value
    if val and ' - ' in str(val):
        parts = str(val).split(' - ')
        code = parts[-1].strip().zfill(3)
        name = parts[0].strip()
        names_map[code] = name

# Section I ACM (r42 to 66)
for r in range(42, 67):
    val = ws1.cell(r, 2).value
    if val and ' - ' in str(val):
        parts = str(val).split(' - ')
        code = parts[-1].strip().zfill(3)
        name = parts[0].strip()
        if code not in names_map:
            names_map[code] = name

# Section III (Spread, LME, Options)
for r in range(135, 179):
    val = ws1.cell(r, 2).value
    if val and ' - ' in str(val):
        parts = str(val).split(' - ')
        code = parts[-1].strip().zfill(3)
        name = parts[0].strip()
        if code not in names_map:
            names_map[code] = name

print(f"Total TVKDs from Final.xlsx: {len(names_map)}")
print(json.dumps(names_map, ensure_ascii=False, indent=2))


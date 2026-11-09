import openpyxl

p1 = r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx"
wb = openpyxl.load_workbook(p1, data_only=True)
ws = wb.active

final_items = []
for r in range(73, 124):
    stt = ws.cell(r, 1).value
    name = ws.cell(r, 2).value
    lot_prev = ws.cell(r, 3).value
    lot_cur = ws.cell(r, 4).value
    if name:
        final_items.append((stt, str(name).strip(), lot_prev, lot_cur))

print(f"Total items in Final.xlsx Section II CQG: {len(final_items)}")
for it in final_items:
    print(f"{it[0]:2d} | {it[1]:25s} | prev(T8)={it[2]} | cur(T9)={it[3]}")


import openpyxl

wb = openpyxl.load_workbook(r"6thang11nam2026.TinhNangMoi\Bao cao thang 09.2026 - Final.xlsx", data_only=True)
ws = wb['Sheet1']

for r in range(25, 140):
    val = ws.cell(r, 1).value
    val2 = ws.cell(r, 2).value
    if val or val2:
        if any(keyword in str(val or '') or keyword in str(val2 or '') for keyword in ['II', 'III', 'Tổng', 'Hàng', 'Mặt', 'Nông']):
            print(f"Row {r}: c1={repr(val)}, c2={repr(val2)}, c3={repr(ws.cell(r, 3).value)}, c4={repr(ws.cell(r, 4).value)}")


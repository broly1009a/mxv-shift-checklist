import os
import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

dir_path = os.path.dirname(os.path.abspath(__file__))

import io

for fname in ['DSGD.csv', 'TTM.csv', 'TTTT.csv', 'HH.csv']:
    p = os.path.join(dir_path, fname)
    if not os.path.exists(p):
        continue
    with open(p, 'rb') as f:
        file_bytes = io.BytesIO(f.read())
    wb = openpyxl.load_workbook(file_bytes, data_only=True)
    sheet = wb.active
    print(f"\n==================== {fname} (Sheet: {sheet.title}, Max rows: {sheet.max_row}, Max cols: {sheet.max_column}) ====================")
    for r in range(1, min(6, sheet.max_row + 1)):
        row_vals = [sheet.cell(r, c).value for c in range(1, min(25, sheet.max_column + 1))]
        # print non-empty or formatted
        print(f"Row {r}: {row_vals}")

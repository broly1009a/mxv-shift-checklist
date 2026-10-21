import openpyxl
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

folder = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\20.10'
f1 = os.path.join(folder, 'QL TT TKGD truoc 4h20.xlsx')
f2 = os.path.join(folder, 'QL TT TKGD.xlsx')

def get_headers(fpath):
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheetname = wb.sheetnames[0]
    ws = wb[sheetname]
    rows = []
    for r in ws.iter_rows(max_row=5, values_only=True):
        rows.append(r)
    wb.close()
    return sheetname, rows

print("Dang doc file 1: QL TT TKGD truoc 4h20.xlsx...")
s1, r1 = get_headers(f1)
print("Dang doc file 2: QL TT TKGD.xlsx...")
s2, r2 = get_headers(f2)

headers1 = [str(x).strip() if x is not None else '' for x in r1[0]]
headers2 = [str(x).strip() if x is not None else '' for x in r2[0]]

print(f'\n--- KẾT QUẢ PHÂN TÍCH ---')
print(f'FILE 1 (truoc 4h20): Sheet="{s1}", Tổng số cột = {len(headers1)}')
print(f'FILE 2 (chot ngay) : Sheet="{s2}", Tổng số cột = {len(headers2)}')

print('\n=== SO SÁNH TỪNG CỘT ===')
mismatches = []
max_len = max(len(headers1), len(headers2))
for i in range(max_len):
    col1 = headers1[i] if i < len(headers1) else '<KHÔNG CÓ CỘT NÀY>'
    col2 = headers2[i] if i < len(headers2) else '<KHÔNG CÓ CỘT NÀY>'
    if col1 != col2:
        mismatches.append((i + 1, col1, col2))

if not mismatches:
    print('=> 100% TRÙNG KHỚP HOÀN TOÀN TẤT CẢ TÊN CỘT VÀ THỨ TỰ CỘT!')
else:
    print(f'=> CÓ {len(mismatches)} CỘT KHÁC NHAU:')
    for idx, c1, c2 in mismatches:
        print(f'  Cột {idx:02d}: "{c1}" != "{c2}"')

print('\n=== TOÀN BỘ DANH SÁCH 53 CỘT ===')
for i in range(max_len):
    c1 = headers1[i] if i < len(headers1) else ''
    c2 = headers2[i] if i < len(headers2) else ''
    match_str = "KHỚP" if c1 == c2 else "LỆCH"
    print(f'[{i+1:02d}] {c1} ({match_str})')

# Kiểm tra số dòng dữ liệu
def count_rows(fpath):
    wb = openpyxl.load_workbook(fpath, read_only=True)
    ws = wb.active
    count = 0
    for _ in ws.iter_rows(values_only=True):
        count += 1
    wb.close()
    return count

print("\nDang dem so dong...")
c1_rows = count_rows(f1)
c2_rows = count_rows(f2)
print(f'File 1 có {c1_rows} dòng (kể cả header)')
print(f'File 2 có {c2_rows} dòng (kể cả header)')

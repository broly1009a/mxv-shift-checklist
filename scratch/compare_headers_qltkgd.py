import openpyxl
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

folder = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\20.10'
f1 = os.path.join(folder, 'QL TT TKGD truoc 4h20.xlsx')
f2 = os.path.join(folder, 'QL TT TKGD.xlsx')

def check_file(fpath):
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(max_row=3, values_only=True))
    header = [str(x).strip() if x is not None else '' for x in rows[0]]
    wb.close()
    
    keys = [
        'Mã TKGD',
        'Tên TKGD',
        'Mã TVKD',
        'Trạng thái',
        'Tỷ lệ ký quỹ',
        'Số dư TKKQ',
        'Số dư đầu ngày',
        'Số dư cuối ngày',
        'KQ ban đầu yêu cầu',
        'Lãi lỗ thực tế Future (VND)',
        'Lãi lỗ dự kiến Future (VND)',
        'Nộp rút trong phiên',
        'Phí giao dịch',
        'Phí dịch vụ thanh toán',
        'Lãi lỗ chờ đáo hạn'
    ]
    found = {}
    for k in keys:
        found[k] = [(i + 1, header[i]) for i in range(len(header)) if k.lower() in header[i].lower()]
    return os.path.basename(fpath), len(header), found

for f in [f1, f2]:
    name, col_count, found = check_file(f)
    print(f'\n=== FILE: {name} ({col_count} cột) ===')
    for k, matches in found.items():
        if matches:
            cols_str = ', '.join([f'Cột {idx} ("{title}")' for idx, title in matches])
            print(f'  ✓ {k:28}: {cols_str}')
        else:
            print(f'  ✗ {k:28}: KHÔNG TÌM THẤY')

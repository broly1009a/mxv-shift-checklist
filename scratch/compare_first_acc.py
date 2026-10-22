import openpyxl, os, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

folder = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\20.10'
f1 = os.path.join(folder, 'QL TT TKGD truoc 4h20.xlsx')
f2 = os.path.join(folder, 'QL TT TKGD.xlsx')

def get_first_acc(fpath):
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(max_row=3, values_only=True))
    wb.close()
    header = [str(x).strip() if x is not None else '' for x in rows[0]]
    row1 = rows[1]
    
    # Tìm index
    acc_idx = header.index('Mã TKGD')
    bal_idx = [i for i, h in enumerate(header) if h == 'Số dư TKKQ'][0]
    imr_idx = [i for i, h in enumerate(header) if 'KQ ban đầu yêu cầu' == h][0]
    
    return {
        'file': os.path.basename(fpath),
        'maTKGD': row1[acc_idx],
        'soDuTKKQ': row1[bal_idx],
        'imr': row1[imr_idx]
    }

print("Dữ liệu dòng 1 mẫu của cả 2 file:")
print("File 1:", get_first_acc(f1))
print("File 2:", get_first_acc(f2))

import os
import shutil
import openpyxl
from copy import copy

ccp_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output"
ms_lot_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
ms_val_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich"

backup_dir = os.path.join(ccp_dir, "Backup_Templates_20260925")
os.makedirs(backup_dir, exist_ok=True)

# 8 cặp template chuẩn từ MS sang CCP
tasks = [
    {
        "name": "Lot Thường",
        "ms_path": os.path.join(ms_lot_dir, "Thong ke so lot giao dich 2026 2.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke so lot giao dich 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": True
    },
    {
        "name": "Lot LME",
        "ms_path": os.path.join(ms_lot_dir, "Thong ke so lot giao dich LME 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke so lot giao dich LME 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": True
    },
    {
        "name": "Lot Options",
        "ms_path": os.path.join(ms_lot_dir, "Thong ke so lot giao dich Options 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke so lot giao dich Options 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": True
    },
    {
        "name": "Lot Spread",
        "ms_path": os.path.join(ms_lot_dir, "Thong ke so lot giao dich Spread 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke so lot giao dich Spread 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": True
    },
    {
        "name": "Giá Trị Thường",
        "ms_path": os.path.join(ms_val_dir, "Thong ke gia tri giao dich 2026 1.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke gia tri giao dich 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": False
    },
    {
        "name": "Giá Trị LME",
        "ms_path": os.path.join(ms_val_dir, "Thong ke gia tri giao dich LME 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke gia tri giao dich LME 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": False
    },
    {
        "name": "Giá Trị Options",
        "ms_path": os.path.join(ms_val_dir, "Thong ke gia tri giao dich Options 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke gia tri giao dich Options 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": False
    },
    {
        "name": "Giá Trị Spread",
        "ms_path": os.path.join(ms_val_dir, "Thong ke gia tri giao dich Spread 2026.xlsx"),
        "dest_path": os.path.join(ccp_dir, "Thong ke gia tri giao dich Spread 2026.xlsx"),
        "target_month": "T09.2026",
        "start_date": "2026-09-01",
        "is_lot": False
    },
]

print("=== 1. SAO LƯU 8 FILE CŨ TRONG CCP OUTPUT ===")
for t in tasks:
    dest_p = t["dest_path"]
    fname = os.path.basename(dest_p)
    if os.path.exists(dest_p):
        bk_p = os.path.join(backup_dir, fname)
        shutil.copyfile(dest_p, bk_p)
        print(f"  Backup OK: {fname} -> {bk_p}")

def process_template(task):
    ms_p = task["ms_path"]
    dest_p = task["dest_path"]
    target_m = task["target_month"]
    print(f"\\n--- Đang xử lý: {task['name']} ({os.path.basename(dest_p)}) ---")
    
    wb = openpyxl.load_workbook(ms_p)
    sheetnames = wb.sheetnames
    
    # 1. Tìm sheet Tổng hợp (TONGHOP hoặc Tổng hợp)
    tonghop_sheet = None
    for s in sheetnames:
        norm = s.strip().lower()
        if "tong" in norm or "tổng" in norm:
            tonghop_sheet = s
            break
    
    # 2. Tìm sheet tháng mẫu gần nhất
    month_sheets = [s for s in sheetnames if s != tonghop_sheet and ('T' in s or 't' in s)]
    if not month_sheets:
        print(f"  LỖI: Không tìm thấy sheet tháng mẫu trong {ms_p}")
        return
    
    # Ưu tiên tìm T09.2026 nếu có sẵn, không thì lấy sheet tháng cuối cùng (T08.2026 / T8.2026)
    source_month_sheet = None
    if target_m in month_sheets:
        source_month_sheet = target_m
    else:
        source_month_sheet = month_sheets[-1]
    
    print(f"  Sheet Tổng hợp: '{tonghop_sheet}' | Sheet tháng mẫu: '{source_month_sheet}'")
    
    # Nếu source_month_sheet != target_m thì đổi tên hoặc copy
    if source_month_sheet != target_m:
        ws_source = wb[source_month_sheet]
        ws_source.title = target_m
        target_ws = ws_source
    else:
        target_ws = wb[target_m]
    
    # Cập nhật tiêu đề tháng tại dòng 1 (nếu có)
    cell_a1 = target_ws.cell(1, 1).value
    if cell_a1 and isinstance(cell_a1, str):
        # thay thế tháng cũ bằng tháng 09/2026
        import re
        new_title = re.sub(r'\(tháng \d+/\d+\)', '(tháng 09/2026)', cell_a1)
        target_ws.cell(1, 1).value = new_title
    
    # Làm sạch các ô dữ liệu giao dịch trong target_ws:
    # Header chiếm từ Row 1 đến Row 4 (hoặc Row 5 với Giá trị). Dữ liệu giao dịch từ Row 5 (hoặc 6) trở đi
    data_start_row = 6 if "gia tri" in os.path.basename(dest_p).lower() else 5
    
    # Đặt lại ngày bắt đầu tháng 9: 2026-09-01
    date_col = 1 if "gia tri" in os.path.basename(dest_p).lower() else 2
    stt_col = None if "gia tri" in os.path.basename(dest_p).lower() else 1
    
    # Xoá số liệu giao dịch cũ, giữ lại cột Ngày và cột Công thức (chỉ trong phạm vi các ngày của tháng: tối đa 40 dòng)
    max_check_row = min(target_ws.max_row, 40)
    for r in range(data_start_row, max_check_row + 1):
        for c in range(1, target_ws.max_column + 1):
            cell = target_ws.cell(r, c)
            if isinstance(cell, openpyxl.cell.cell.MergedCell):
                continue
            if c == date_col:
                # Cột Ngày
                if r == data_start_row:
                    cell.value = "2026-09-01 00:00:00"
                else:
                    prev_cell = f"{openpyxl.utils.get_column_letter(date_col)}{r-1}"
                    cell.value = f"=WORKDAY({prev_cell},1)"
            elif stt_col and c == stt_col:
                # Cột STT
                cell.value = r - data_start_row + 1
            else:
                # Kiểm tra nếu là công thức tính tổng thì giữ lại
                val = cell.value
                if val is not None:
                    str_val = str(val).strip()
                    if str_val.startswith('='):
                        # Giữ nguyên công thức SUM / TỔNG
                        pass
                    else:
                        # Xóa giá trị cũ để sạch cho CCP
                        cell.value = None
    
    # Xoá các sheet tháng cũ khác, chỉ giữ tonghop_sheet và target_m
    sheets_to_remove = [s for s in wb.sheetnames if s != tonghop_sheet and s != target_m]
    for s in sheets_to_remove:
        del wb[s]
    
    wb.save(dest_p)
    wb.close()
    
    # Kiểm tra lại file vừa tạo
    check_wb = openpyxl.load_workbook(dest_p, read_only=True)
    print(f"  => THÀNH CÔNG: Đã tạo {os.path.basename(dest_p)} với các sheet: {check_wb.sheetnames}")
    check_wb.close()

print("\\n=== 2. THỰC HIỆN CHUYỂN ĐỔI TEMPLATE TỪNG FILE ===")
for t in tasks:
    process_template(t)

print("\\n=== HOÀN TẤT TẤT CẢ 8 FILE TEMPLATE! ===")

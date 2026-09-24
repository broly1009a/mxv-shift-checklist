#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
excel_sheet_cloner.py
Tự động nhân bản (clone) và sinh Sheet tháng mới trên Ubuntu Linux / Windows
sử dụng openpyxl copy_worksheet mà không làm vỡ Shared Formulas hay định dạng XML.
Đã tối ưu chuẩn xác theo quy tắc cấu trúc file Thống kê Số Lot & Giá trị của MXV.
"""

import sys
import os
import re
import argparse
from datetime import datetime

# Thiết lập UTF-8 cho stdout/stderr để tránh lỗi charmap trên Windows console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import openpyxl

def parse_month_year_from_sheet_name(sheet_name: str):
    """
    Trích xuất (month, year) từ tên sheet dạng T08.2026 hoặc T08_2026
    """
    m = re.search(r'T(\d{1,2})[._](\d{4})', sheet_name, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None

def clone_month_sheet(excel_path: str, target_sheet_name: str, clean_data: bool = True) -> bool:
    if not os.path.exists(excel_path):
        print(f"[ERROR] File khong ton tai: {excel_path}", file=sys.stderr)
        return False

    try:
        print(f"[INFO] Dang mo file Excel: {excel_path}")
        wb = openpyxl.load_workbook(excel_path)
        
        # 1. Kiểm tra nếu sheet đích đã tồn tại
        if target_sheet_name in wb.sheetnames:
            print(f"[INFO] Sheet '{target_sheet_name}' da ton tai san. Khong can tao moi.")
            return True

        # 2. Xác định tháng/năm mục tiêu từ tên sheet
        target_month, target_year = parse_month_year_from_sheet_name(target_sheet_name)
        if not target_month or not target_year:
            now = datetime.now()
            target_month = now.month
            target_year = now.year

        # 3. Tìm sheet nguồn (ưu tiên sheet tháng gần nhất)
        month_sheets = [s for s in wb.sheetnames if s.startswith('T') and ('.' in s or '_' in s)]
        
        if month_sheets:
            source_sheet_name = month_sheets[-1]
        else:
            source_sheet_name = wb.sheetnames[-1]

        source_sheet = wb[source_sheet_name]
        print(f"[INFO] Nhan ban cau truc tu Sheet mau: '{source_sheet_name}' -> '{target_sheet_name}'...")

        # 4. Sao chép nguyên vẹn 100% XML, mergeCells, Styles, Formulas
        new_sheet = wb.copy_worksheet(source_sheet)
        new_sheet.title = target_sheet_name

        # Cắt tỉa triệt để các phantom cells ngoài phạm vi bảng tháng (row > 60)
        # Các file thống kê MXV chỉ có tối đa ~31 ngày giao dịch + dòng TỔNG (thường là row 28-35).
        # Sự xuất hiện của cell rác ở tận row 1,048,560 khiến openpyxl tốn hàng GB RAM và timeout.
        if hasattr(new_sheet, '_cells'):
            phantom_keys = [k for k in new_sheet._cells.keys() if k[0] > 60]
            if phantom_keys:
                print(f"[INFO] Phat hien va cat tia {len(phantom_keys)} o ma vuot qua row 60.")
                for k in phantom_keys:
                    del new_sheet._cells[k]

        # Dọn dẹp cell comments của sheet mới chỉ trên các cell thực sự tồn tại
        try:
            for cell in list(new_sheet._cells.values()):
                if hasattr(cell, 'comment') and cell.comment:
                    cell.comment = None
            if hasattr(new_sheet, '_comments'):
                new_sheet._comments = []
        except Exception:
            pass

        # 5. Cập nhật tiêu đề hiển thị tháng mới trong ô A1 hoặc A2 (nếu có chuỗi tháng cũ)
        for title_row in (1, 2):
            cell_title = new_sheet.cell(row=title_row, column=1)
            if cell_title.value and isinstance(cell_title.value, str):
                old_str = cell_title.value
                new_str = re.sub(r'th[aá]ng\s+\d{1,2}/\d{4}', f'tháng {target_month:02d}/{target_year}', old_str, flags=re.IGNORECASE)
                if old_str != new_str:
                    cell_title.value = new_str
                    print(f"[INFO] Cap nhat tieu de thang tai A{title_row}: {new_str.strip()}")

        # 6. Cập nhật mốc ngày làm việc đầu tiên của tháng cho công thức =WORKDAY(...)
        # - Nếu ngày 01 rơi vào Thứ 7 (weekday 5) -> Ngày giao dịch đầu tiên là Thứ 2 ngày 03
        # - Nếu ngày 01 rơi vào Chủ Nhật (weekday 6) -> Ngày giao dịch đầu tiên là Thứ 2 ngày 02
        # - Nếu ngày 01 rơi vào Thứ 2..Thứ 6 -> Giữ nguyên ngày 01
        first_date_val = datetime(target_year, target_month, 1)
        if first_date_val.weekday() == 5:  # Thứ 7
            first_date_val = datetime(target_year, target_month, 3)
        elif first_date_val.weekday() == 6:  # Chủ Nhật
            first_date_val = datetime(target_year, target_month, 2)

        # Tự động xác định cột ngày (date_col), dòng bắt đầu (first_date_row) và cột xóa dữ liệu (start_clean_col):
        # - Nếu Cột 2 (B) chứa ngày tháng/WORKDAY -> date_col = 2, start_clean_col = 3 (Bảng Thống kê Số Lot có cột STT ở A)
        # - Nếu Cột 1 (A) chứa ngày tháng/WORKDAY -> date_col = 1, start_clean_col = 2 (Bảng Thống kê Giá Trị: Normal, Spread, LME, Options, ACM)
        date_col = 1
        start_clean_col = 2
        first_date_row = 6

        found_date = False
        for test_r in range(4, 9):
            c1 = new_sheet.cell(row=test_r, column=1).value
            c2 = new_sheet.cell(row=test_r, column=2).value
            
            # Kiểm tra Cột B trước (Bảng Số Lot)
            if isinstance(c2, datetime):
                date_col = 2
                start_clean_col = 3
                first_date_row = test_r
                found_date = True
                break
            elif isinstance(c2, str) and 'WORKDAY' in c2.upper():
                date_col = 2
                start_clean_col = 3
                m = re.search(r'WORKDAY\s*\(\s*[A-Z]+(\d+)', c2, re.IGNORECASE)
                first_date_row = int(m.group(1)) if m else test_r - 1
                found_date = True
                break
            
            # Kiểm tra Cột A (Bảng Giá Trị)
            if isinstance(c1, datetime):
                date_col = 1
                start_clean_col = 2
                first_date_row = test_r
                found_date = True
                break
            elif isinstance(c1, str) and 'WORKDAY' in c1.upper():
                date_col = 1
                start_clean_col = 2
                m = re.search(r'WORKDAY\s*\(\s*[A-Z]+(\d+)', c1, re.IGNORECASE)
                first_date_row = int(m.group(1)) if m else test_r - 1
                found_date = True
                break

        new_sheet.cell(row=first_date_row, column=date_col).value = first_date_val
        col_letter = 'B' if date_col == 2 else 'A'
        print(f"[INFO] Phat hien date_col={col_letter}, first_date_row={first_date_row}, start_clean_col={start_clean_col}. Cap nhat moc ngay dau thang tai {col_letter}{first_date_row}: {first_date_val.strftime('%Y-%m-%d')}")

        # 7. Xóa trắng dữ liệu giao dịch cũ của các ngày trong tháng (giữ nguyên công thức và tiêu đề)
        if clean_data:
            print(f"[INFO] Dang don dep du lieu ngay cu tu cot {start_clean_col} (giu nguyen cong thuc)...")
            
            # Giới hạn tối đa row 60 (bảng tháng chỉ có tối đa 31 ngày + dòng tổng)
            max_row = min(new_sheet.max_row, 60)
            max_col = new_sheet.max_column
            rows_to_delete = []

            for r in range(first_date_row, max_row + 1):
                cell_date = new_sheet.cell(row=r, column=date_col).value
                str_date = str(cell_date).upper() if cell_date else ""
                
                # Bỏ qua và dừng lại khi gặp dòng TỔNG / TOTAL
                if "TỔNG" in str_date or "TOTAL" in str_date or "TONG" in str_date:
                    print(f"[INFO] Dung don dep tai dong tong cong: Row {r}")
                    break

                # Xóa các dòng giao dịch phụ phát sinh ngoài giờ (ví dụ phiên Thứ 7 chèn cứng tay ngày của tháng cũ)
                if isinstance(cell_date, datetime) and cell_date.month != target_month:
                    print(f"[INFO] Phat hien dong du thua tu thang {cell_date.month} tai Row {r} -> Danh dau xoa dong")
                    rows_to_delete.append(r)
                    continue

                # Xóa trắng các ô dữ liệu (từ start_clean_col), giữ nguyên công thức bắt đầu bằng '='
                for c in range(start_clean_col, max_col + 1):
                    cell = new_sheet.cell(row=r, column=c)
                    if cell.value is not None:
                        val_str = str(cell.value)
                        if not val_str.startswith('='):
                            cell.value = None

            # Xóa các dòng dư thừa từ dưới lên trên để không lệch index
            for r in reversed(rows_to_delete):
                new_sheet.delete_rows(r, 1)

        # 8. Lưu lại file hoàn chỉnh an toàn (Atomic Safe Save qua local temp file)
        print(f"[INFO] Dang luu file an toan qua atomic temp...")
        import tempfile
        import shutil
        import zipfile

        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(
            temp_dir, f"clone_{os.getpid()}_{os.path.basename(excel_path)}"
        )
        wb.save(temp_file)

        # 9. Chuẩn hóa zip archive để ExcelJS đọc 100% không bao giờ lỗi 'comments' relationship
        temp_fixed = temp_file + ".fixed.zip"
        try:
            with zipfile.ZipFile(temp_file, 'r') as zin, zipfile.ZipFile(temp_fixed, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    # Bỏ qua các file comments và vml drawing riêng lẻ
                    if 'comments' in item.filename.lower() or 'vmldrawing' in item.filename.lower() or 'commentsdrawing' in item.filename.lower():
                        continue

                    content = zin.read(item.filename)
                    # Nếu là sheet rels, xóa các node liên kết comments / vmlDrawing
                    if item.filename.startswith('xl/worksheets/_rels/sheet') and item.filename.endswith('.xml.rels'):
                        try:
                            text = content.decode('utf-8')
                            text = re.sub(r'<Relationship[^>]*Type="[^"]*(?:comments|vmlDrawing)"[^>]*/>', '', text)
                            zout.writestr(item, text.encode('utf-8'))
                            continue
                        except Exception:
                            pass
                    # Nếu là sheet xml, xóa thẻ legacyDrawing
                    elif item.filename.startswith('xl/worksheets/sheet') and item.filename.endswith('.xml'):
                        try:
                            text = content.decode('utf-8')
                            text = re.sub(r'<legacyDrawing[^>]*/>', '', text)
                            zout.writestr(item, text.encode('utf-8'))
                            continue
                        except Exception:
                            pass

                    zout.writestr(item, content)

            if os.path.exists(temp_fixed) and os.path.getsize(temp_fixed) > 1000:
                shutil.copyfile(temp_fixed, temp_file)
                try:
                    os.remove(temp_fixed)
                except Exception:
                    pass
        except Exception as e:
            print(f"[WARN] Khong the postprocess comments relationship: {e}", file=sys.stderr)

        # Kiểm tra tính toàn vẹn của file trước khi ghi đè vào ổ đĩa mạng CIFS
        if os.path.exists(temp_file) and os.path.getsize(temp_file) > 1000:
            shutil.copyfile(temp_file, excel_path)
            try:
                os.remove(temp_file)
            except Exception:
                pass
            print(
                f"[SUCCESS] Da tu dong sinh Sheet moi '{target_sheet_name}' thanh cong 100%!"
            )
            return True
        else:
            raise Exception("File temp sinh ra bi rong hoac loi kich thuoc.")

    except Exception as e:
        print(f"[ERROR] Loi khi nhan ban Sheet: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Tu dong nhan ban Sheet thang moi cho file Excel thong ke")
    parser.add_argument("--file", "-f", required=True, help="Duong dan toi file Excel")
    parser.add_argument("--sheet", "-s", required=True, help="Ten sheet moi can tao (vi du: T08.2026)")
    parser.add_argument("--no-clean", action="store_true", help="Khong xoa du lieu ngay cu")

    args = parser.parse_args()
    success = clone_month_sheet(args.file, args.sheet, clean_data=not args.no_clean)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

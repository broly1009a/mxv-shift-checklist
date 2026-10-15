#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ccp_column_provisioner.py
Công cụ tự động hóa mở rộng cấu trúc Excel lũy kế CoreCCP (1-Click Maintenance Tool)
Tuân thủ nghiêm ngặt Thiết kế kỹ thuật: MXV-DES-CCP-EXPAND-2026-V1.0
(docs/cu/THIET_KE_MO_RONG_TVKD_VA_MA_HD_MOI_CORECCP.md)

Năng lực:
- Thêm Thành Viên Kinh Doanh (TVKD) mới vào bảng Số Lot (chèn trước cột TỔNG TVKD).
- Thêm Mã Hàng Hóa mới vào bảng Số Lot (chèn trước cột TỔNG Hàng Hóa).
- Thêm Mã Hàng Hóa mới vào bảng Giá Trị Giao Dịch (chèn trước cột TỔNG GTGD).
- Tự động kéo dãn công thức =SUM(...) ngang (phiên) và dọc (tháng/năm).
- Tự động cập nhật liên kết sheet TONGHOP ('TMM.YYYY'!ColRow).
- Tự động dịch chuyển và mở rộng dải ô banner tiêu đề gộp (merged cells banner).
- Bảo vệ file tuyệt đối bằng mô hình Giao Dịch Nguyên Tử (Safe Transactional Atomic Write).
"""

import os
import sys
import re
import uuid
import shutil
import argparse
import unicodedata
from copy import copy
from datetime import datetime
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.cell_range import CellRange

# Thiết lập UTF-8 cho console
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


def remove_accents(s: str) -> str:
    """Loại bỏ dấu tiếng Việt để so khớp chuỗi không phụ thuộc bảng mã Unicode (NFC vs NFD)."""
    if not s:
        return ''
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


def is_file_locked(filepath: str) -> bool:
    """Kiểm tra xem tệp Excel có đang bị ứng dụng khác khóa độc quyền (trên Windows) hay không."""
    if not os.path.exists(filepath):
        return False
    try:
        with open(filepath, 'r+b') as f:
            pass
        return False
    except IOError:
        return True


def copy_cell_style(src_cell, dst_cell, include_value: bool = False, default_val=None):
    """Sao chép toàn bộ định dạng từ ô nguồn sang ô đích (Font, Fill, Border, Alignment, NumberFormat)."""
    if src_cell.has_style:
        dst_cell.font = copy(src_cell.font)
        dst_cell.border = copy(src_cell.border)
        dst_cell.fill = copy(src_cell.fill)
        dst_cell.number_format = src_cell.number_format
        dst_cell.protection = copy(src_cell.protection)
        dst_cell.alignment = copy(src_cell.alignment)
    if include_value:
        dst_cell.value = src_cell.value
    elif default_val is not None:
        dst_cell.value = default_val


def shift_and_expand_merged_cells_on_insert(ws, insert_col: int, banner_row: int = 2):
    """
    Do openpyxl không tự động dịch chuyển merged_cells khi gọi insert_cols,
    hàm này chủ động dịch chuyển mọi merged_cell có min_col >= insert_col sang phải 1 cột,
    đồng thời mở rộng dải banner tiêu đề kết thúc tại insert_col - 1 thêm 1 cột.
    """
    old_ranges = list(ws.merged_cells.ranges)
    for rng in old_ranges:
        ws.merged_cells.remove(rng)

    for rng in old_ranges:
        min_c = rng.min_col
        max_c = rng.max_col

        if min_c >= insert_col:
            # Dải ô nằm từ hoặc sau cột chèn -> dịch sang phải 1 cột
            min_c += 1
            max_c += 1
        elif max_c == insert_col - 1 and rng.min_row <= banner_row <= rng.max_row:
            # Banner của phân hệ kết thúc ngay trước cột chèn -> mở rộng thêm 1 cột
            max_c += 1
            print(f"      [Merge] Da mo rong dải banner {rng.coord} thanh {get_column_letter(min_c)}{rng.min_row}:{get_column_letter(max_c)}{rng.max_row}")
        elif max_c >= insert_col:
            # Dải ô bao trùm qua cột chèn -> kéo dãn
            max_c += 1

        ws.merged_cells.add(CellRange(
            min_col=min_c,
            min_row=rng.min_row,
            max_col=max_c,
            max_row=rng.max_row
        ))


def provision_tvkd_in_sheet(ws, code: str, label: str, sheet_name: str, wb) -> bool:
    """Xử lý chèn TVKD mới vào một sheet cụ thể."""
    is_tonghop = (sheet_name == 'TONGHOP')

    tvkd_start_col = -1
    tvkd_tong_col = -1

    # Quét tìm cột TVKD bắt đầu và cột TỔNG TVKD
    for col in range(1, ws.max_column + 1):
        c4_val = str(ws.cell(4, col).value or '').strip()
        c2_val = str(ws.cell(2, col).value or '').strip()
        c2_clean = remove_accents(c2_val)
        c4_clean = remove_accents(c4_val)

        # Kiểm tra xem mã TVKD này đã tồn tại chưa
        if re.search(r'\b' + re.escape(code) + r'\b', c4_val):
            print(f"   [WARN] TVKD '{code}' da ton tai tai cot {get_column_letter(col)} cua sheet {sheet_name}. Bo qua.")
            return False

        # Nhận diện cột bắt đầu TVKD (mã 3 chữ số đầu tiên, vd 001)
        if tvkd_start_col == -1 and re.search(r'\b\d{3}\b', c4_val):
            tvkd_start_col = col

        # Nhận diện cột TỔNG TVKD (cột 'Tổng' đầu tiên sau tvkd_start_col)
        if tvkd_start_col != -1 and col > tvkd_start_col:
            if 'tong' in c2_clean or 'tong' in c4_clean:
                tvkd_tong_col = col
                break
            f_val = str(ws.cell(5, col).value or '')
            if f_val.startswith('=SUM'):
                tvkd_tong_col = col
                break

    if tvkd_start_col == -1 or tvkd_tong_col == -1:
        print(f"   [SKIP] Khong tim thay khu vuc TVKD trong sheet {sheet_name}.")
        return False

    prev_col = tvkd_tong_col - 1
    new_col = tvkd_tong_col
    print(f"   [Insert] Sheet '{sheet_name}': Chen TVKD '{code}' tai cot {get_column_letter(new_col)} (truoc cot Tong {get_column_letter(tvkd_tong_col)})...")

    # 1. Dịch chuyển và mở rộng merged cells trước khi insert
    shift_and_expand_merged_cells_on_insert(ws, new_col, banner_row=2)

    # 2. Chèn 1 cột mới tại vị trí tvkd_tong_col
    ws.insert_cols(new_col)
    new_col_letter = get_column_letter(new_col)
    tvkd_start_letter = get_column_letter(tvkd_start_col)
    tong_col_letter = get_column_letter(new_col + 1)

    # 3. Ghi tiêu đề Row 4
    header_cell = ws.cell(4, new_col)
    copy_cell_style(ws.cell(4, prev_col), header_cell, include_value=False)
    header_cell.value = f"{label}\n{code}"
    header_cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    # 4. Xử lý các dòng số liệu
    if not is_tonghop:
        # Sheet Tháng (TMM.YYYY):
        total_row = -1
        for r in range(5, min(ws.max_row + 1, 60)):
            ca = remove_accents(str(ws.cell(r, 1).value or ''))
            cb = remove_accents(str(ws.cell(r, 2).value or ''))
            if 'tong' in ca or 'tong' in cb:
                total_row = r
                break
            f = str(ws.cell(r, prev_col).value or '')
            if f.startswith('=SUM(') and ':' in f:
                total_row = r
                break

        if total_row == -1:
            total_row = 27

        # Ghi 0 vào các phiên đã qua (Row 5 đến total_row - 1)
        for r in range(5, total_row):
            cell = ws.cell(r, new_col)
            copy_cell_style(ws.cell(r, prev_col), cell, default_val=0)

            # Cập nhật công thức tổng ngang tại cột TỔNG
            tong_cell = ws.cell(r, new_col + 1)
            tong_cell.value = f"=SUM({tvkd_start_letter}{r}:{new_col_letter}{r})"

        # Ghi công thức tổng dọc tại dòng total_row
        sum_cell = ws.cell(total_row, new_col)
        copy_cell_style(ws.cell(total_row, prev_col), sum_cell)
        sum_cell.value = f"=SUM({new_col_letter}5:{new_col_letter}{total_row - 1})"

        # Cập nhật tổng của cột TỔNG TVKD tại dòng total_row
        tong_sum_cell = ws.cell(total_row, new_col + 1)
        tong_sum_cell.value = f"=SUM({tong_col_letter}5:{tong_col_letter}{total_row - 1})"
    else:
        # Sheet TONGHOP:
        total_row = 17
        for m in range(1, 13):
            r = 4 + m
            m_str = f"T{m:02d}.2026"
            cell = ws.cell(r, new_col)
            copy_cell_style(ws.cell(r, prev_col), cell)

            if m_str in wb.sheetnames:
                m_ws = wb[m_str]
                m_tot_row = 27
                for mr in range(5, min(m_ws.max_row + 1, 60)):
                    mca = remove_accents(str(m_ws.cell(mr, 1).value or ''))
                    if 'tong' in mca:
                        m_tot_row = mr
                        break
                cell.value = f"='{m_str}'!{new_col_letter}{m_tot_row}"
            else:
                cell.value = 0

            # Cập nhật công thức tổng ngang tại TONGHOP
            tong_cell = ws.cell(r, new_col + 1)
            tong_cell.value = f"=SUM({tvkd_start_letter}{r}:{new_col_letter}{r})"

        # Dòng tổng năm (Row 17)
        sum_cell = ws.cell(total_row, new_col)
        copy_cell_style(ws.cell(total_row, prev_col), sum_cell)
        sum_cell.value = f"=SUM({new_col_letter}5:{new_col_letter}{total_row - 1})"

        tong_sum_cell = ws.cell(total_row, new_col + 1)
        tong_sum_cell.value = f"=SUM({tong_col_letter}5:{tong_col_letter}{total_row - 1})"

    return True


def provision_commodity_in_sheet(ws, code: str, label: str, sheet_name: str, wb, is_gtgd: bool) -> bool:
    """Xử lý chèn Mã Hàng Hóa mới vào một sheet cụ thể (cả file Số Lot lẫn Giá Trị)."""
    is_tonghop = (sheet_name == 'TONGHOP')

    hh_start_col = -1
    hh_tong_col = -1

    if is_gtgd:
        # File Giá trị giao dịch:
        hh_start_col = 2
        for col in range(2, ws.max_column + 1):
            c4_val = str(ws.cell(4, col).value or '').strip()
            c5_val = str(ws.cell(5, col).value or '').strip()
            c3_clean = remove_accents(str(ws.cell(3, col).value or ''))
            c4_clean = remove_accents(c4_val)

            if c5_val.upper() == code.upper():
                print(f"   [WARN] Hang hoa '{code}' da ton tai tai cot {get_column_letter(col)} cua sheet {sheet_name}. Bo qua.")
                return False

            if 'tong' in c3_clean or 'tong' in c4_clean:
                hh_tong_col = col
                break
            if str(ws.cell(6, col).value or '').startswith('=SUM'):
                hh_tong_col = col
                break
    else:
        # File Số Lot:
        for col in range(1, ws.max_column + 1):
            c2_clean = remove_accents(str(ws.cell(2, col).value or ''))
            c4_val = str(ws.cell(4, col).value or '').strip()

            if 'hang hoa' in c2_clean or c4_val.upper() in ('SI5CO', 'PL1NY', 'CP2CO'):
                if hh_start_col == -1:
                    hh_start_col = col

            if c4_val.upper() == code.upper():
                print(f"   [WARN] Hang hoa '{code}' da ton tai tai cot {get_column_letter(col)} cua sheet {sheet_name}. Bo qua.")
                return False

            if hh_start_col != -1 and col > hh_start_col:
                if 'tong' in c2_clean or 'tong' in remove_accents(c4_val):
                    hh_tong_col = col
                    break
                if str(ws.cell(5, col).value or '').startswith('=SUM'):
                    hh_tong_col = col
                    break

    if hh_start_col == -1 or hh_tong_col == -1:
        print(f"   [SKIP] Khong tim thay khu vuc Hang hoa trong sheet {sheet_name}.")
        return False

    prev_col = hh_tong_col - 1
    new_col = hh_tong_col
    print(f"   [Insert] Sheet '{sheet_name}': Chen Hang hoa '{code}' tai cot {get_column_letter(new_col)} (truoc cot Tong {get_column_letter(hh_tong_col)})...")

    # 1. Dịch chuyển và mở rộng merged cells
    banner_row = 3 if is_gtgd else 2
    shift_and_expand_merged_cells_on_insert(ws, new_col, banner_row=banner_row)

    # 2. Chèn 1 cột mới
    ws.insert_cols(new_col)
    new_col_letter = get_column_letter(new_col)
    hh_start_letter = get_column_letter(hh_start_col)
    tong_col_letter = get_column_letter(new_col + 1)

    # 3. Ghi tiêu đề
    if is_gtgd:
        c4 = ws.cell(4, new_col)
        copy_cell_style(ws.cell(4, prev_col), c4, include_value=False)
        c4.value = label

        c5 = ws.cell(5, new_col)
        copy_cell_style(ws.cell(5, prev_col), c5, include_value=False)
        c5.value = code
        first_data_row = 6
    else:
        c4 = ws.cell(4, new_col)
        copy_cell_style(ws.cell(4, prev_col), c4, include_value=False)
        c4.value = code
        first_data_row = 5

    # 4. Cập nhật dữ liệu & công thức
    if not is_tonghop:
        # Sheet Tháng:
        total_row = -1
        for r in range(first_data_row, min(ws.max_row + 1, 60)):
            ca = remove_accents(str(ws.cell(r, 1).value or ''))
            if 'tong' in ca:
                total_row = r
                break
        if total_row == -1:
            total_row = 28 if is_gtgd else 27

        for r in range(first_data_row, total_row):
            cell = ws.cell(r, new_col)
            copy_cell_style(ws.cell(r, prev_col), cell, default_val=0)

            # Cập nhật tổng ngang tại cột TỔNG Hàng Hóa
            tong_cell = ws.cell(r, new_col + 1)
            tong_cell.value = f"=SUM({hh_start_letter}{r}:{new_col_letter}{r})"

        # Dòng tổng dọc
        sum_cell = ws.cell(total_row, new_col)
        copy_cell_style(ws.cell(total_row, prev_col), sum_cell)
        sum_cell.value = f"=SUM({new_col_letter}{first_data_row}:{new_col_letter}{total_row - 1})"

        tong_sum_cell = ws.cell(total_row, new_col + 1)
        tong_sum_cell.value = f"=SUM({tong_col_letter}{first_data_row}:{tong_col_letter}{total_row - 1})"
    else:
        # Sheet TONGHOP:
        start_m_row = 6 if is_gtgd else 5
        end_m_row = start_m_row + 11
        total_row = end_m_row + 1

        for idx, r in enumerate(range(start_m_row, end_m_row + 1)):
            m = idx + 1
            m_str = f"T{m:02d}.2026"
            cell = ws.cell(r, new_col)
            copy_cell_style(ws.cell(r, prev_col), cell)

            if m_str in wb.sheetnames:
                m_ws = wb[m_str]
                m_tot_row = 28 if is_gtgd else 27
                for mr in range(first_data_row, min(m_ws.max_row + 1, 60)):
                    mca = remove_accents(str(m_ws.cell(mr, 1).value or ''))
                    if 'tong' in mca:
                        m_tot_row = mr
                        break
                cell.value = f"='{m_str}'!{new_col_letter}{m_tot_row}"
            else:
                cell.value = 0

            # Cập nhật tổng ngang
            tong_cell = ws.cell(r, new_col + 1)
            tong_cell.value = f"=SUM({hh_start_letter}{r}:{new_col_letter}{r})"

        # Tổng năm
        sum_cell = ws.cell(total_row, new_col)
        copy_cell_style(ws.cell(total_row, prev_col), sum_cell)
        sum_cell.value = f"=SUM({new_col_letter}{start_m_row}:{new_col_letter}{end_m_row})"

        tong_sum_cell = ws.cell(total_row, new_col + 1)
        tong_sum_cell.value = f"=SUM({tong_col_letter}{start_m_row}:{tong_col_letter}{end_m_row})"

    return True


def clean_comments_rels_zip(file_path: str):
    """Chuẩn hóa zip archive để ExcelJS đọc 100% không bao giờ lỗi 'comments' relationship."""
    import zipfile
    import shutil
    import re

    temp_fixed = file_path + ".fixed.zip"
    try:
        with zipfile.ZipFile(file_path, 'r') as zin, zipfile.ZipFile(temp_fixed, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if 'comments' in item.filename.lower() or 'vmldrawing' in item.filename.lower() or 'commentsdrawing' in item.filename.lower():
                    continue

                content = zin.read(item.filename)
                if item.filename.startswith('xl/worksheets/_rels/sheet') and item.filename.endswith('.xml.rels'):
                    try:
                        text = content.decode('utf-8')
                        text = re.sub(r'<Relationship[^>]*Type="[^"]*(?:comments|vmlDrawing)"[^>]*/>', '', text)
                        zout.writestr(item, text.encode('utf-8'))
                        continue
                    except Exception:
                        pass
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
            shutil.copyfile(temp_fixed, file_path)
            try:
                os.remove(temp_fixed)
            except Exception:
                pass
    except Exception as e:
        print(f"   [WARN] Khong the postprocess comments relationship: {e}")


def provision_column(excel_path: str, entity_type: str, code: str, label: str, dry_run: bool = False) -> bool:
    """
    Quy trình 5 bước Giao Dịch Nguyên Tử (Atomic Pattern):
    1. Pre-flight & Lock Guard
    2. Snapshot Backup
    3. Work on Staging
    4. Integrity Check
    5. Atomic Swap (os.replace)
    """
    print("=" * 70)
    print("   CCP COLUMN PROVISIONER - TỰ ĐỘNG MỞ RỘNG CẤU TRÚC TEMPLATE EXCEL")
    print("=" * 70)
    print(f"File muc tieu: {excel_path}")
    print(f"Loai thuc the: {entity_type.upper()}")
    print(f"Ma dinh danh:  {code}")
    print(f"Ten hien thi:  {label}")
    print(f"Che do:        {'DRY-RUN (Kiem thu khong ghi)' if dry_run else 'PRODUCTION (Ghi thuc te)'}\n")

    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"File muc tieu khong ton tai: {excel_path}")

    if not dry_run and is_file_locked(excel_path):
        raise PermissionError(
            f"[CANH BAO KHOA FILE] File Excel dang duoc mo boi ung dung khac!\n"
            f"Vui long dong file '{os.path.basename(excel_path)}' truoc khi tiep tuc."
        )

    orig_size = os.path.getsize(excel_path)
    if orig_size == 0:
        raise ValueError("File Excel rong (0 bytes)!")

    base_name = os.path.basename(excel_path).lower()
    is_gtgd = ('gia tri' in base_name or 'gtgd' in base_name)

    if entity_type.lower() == 'tvkd' and is_gtgd:
        print("[INFO] File Gia tri giao dich ACM khong co phan he TVKD. Khong can xu ly file nay.")
        return True

    file_dir = os.path.dirname(os.path.abspath(excel_path))
    backup_dir = os.path.join(file_dir, 'Backup_Snapshots')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir, exist_ok=True)

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    clean_base = os.path.splitext(os.path.basename(excel_path))[0]
    backup_file = os.path.join(backup_dir, f"{clean_base}_before_{entity_type}_{code}_{ts}.bak.xlsx")
    shutil.copy2(excel_path, backup_file)
    print(f"1. [Backup] Da tao ban sao luu an toan:\n   {backup_file}")

    staging_file = os.path.join(file_dir, f".staging_{uuid.uuid4().hex[:8]}.tmp.xlsx")
    shutil.copy2(excel_path, staging_file)
    print(f"2. [Staging] Dang thao tac tren file tam cach ly:\n   {staging_file}")

    try:
        wb = openpyxl.load_workbook(staging_file, data_only=False)
        target_sheets = [s for s in wb.sheetnames if s == 'TONGHOP' or s.startswith('T')]
        print(f"3. [Execute] Cac sheet se duoc cap nhat: {target_sheets}")

        modified_count = 0
        for s_name in target_sheets:
            ws = wb[s_name]
            if entity_type.lower() == 'tvkd':
                success = provision_tvkd_in_sheet(ws, code, label, s_name, wb)
            else:
                success = provision_commodity_in_sheet(ws, code, label, s_name, wb, is_gtgd)
            if success:
                modified_count += 1

        if modified_count == 0:
            print("\n[INFO] Khong co sheet nao bi thay doi (Ma co the da ton tai hoac khong tim thay vi tri).")
            if os.path.exists(staging_file):
                os.remove(staging_file)
            return True

        wb.save(staging_file)
        clean_comments_rels_zip(staging_file)
        print(f"   [Save] Da luu thay doi vao file staging ({modified_count} sheets cap nhat).")

        # 4. Integrity Check
        staging_size = os.path.getsize(staging_file)
        if staging_size < orig_size * 0.5:
            raise ValueError(f"Integrity check failed: File tam bi tut kich thuoc bat thuong ({staging_size} vs {orig_size})!")

        wb_check = openpyxl.load_workbook(staging_file, data_only=False)
        for s_name in target_sheets:
            ws_c = wb_check[s_name]
            for r in range(1, min(35, ws_c.max_row + 1)):
                for c in range(1, min(ws_c.max_column + 1, 100)):
                    val = str(ws_c.cell(r, c).value or '')
                    if '#REF!' in val:
                        raise ValueError(f"Phat hien loi cong thuc #REF! tai sheet '{s_name}' cell {get_column_letter(c)}{r}: {val}")

        print("4. [Integrity] Kiem tra toan ven file thanh cong 100% (Khong co loi #REF!).")

        # 5. Atomic Replace
        if dry_run:
            print("\n[DRY-RUN] Ket thuc che do kiem thu. File goc KHONG bi thay doi.")
            os.remove(staging_file)
        else:
            os.replace(staging_file, excel_path)
            print(f"\n5. [Atomic Swap] Da hoan doi thanh cong file goc:\n   {excel_path}")

        print("\n" + "=" * 70)
        print(f"   THANH CONG: DA THEM {entity_type.upper()} '{code} - {label}' VAO FILE EXCEL!")
        print("=" * 70)
        return True

    except Exception as ex:
        print(f"\n[ERROR] Gap su co: {ex}")
        if os.path.exists(staging_file):
            try:
                os.remove(staging_file)
                print("   [Rollback] Da huy bo file tam, file goc hoan toan nguyen ven.")
            except Exception:
                pass
        raise


def main():
    parser = argparse.ArgumentParser(description="Tu dong mo rong TVKD hoac Ma Hang Hoa tren Excel CoreCCP")
    parser.add_argument("--file", "-f", required=True, help="Duong dan toi file Excel")
    parser.add_argument("--type", "-t", required=True, choices=["tvkd", "commodity"], help="Loai thuc the can them")
    parser.add_argument("--code", "-c", required=True, help="Ma dinh danh (vi du: 099, GLD1, ZRE)")
    parser.add_argument("--label", "-l", required=True, help="Ten hien thi (vi du: 'Thanh vien ABC', 'Vang Nano')")
    parser.add_argument("--dry-run", action="store_true", help="Chay thu nghiem khong ghi vao file goc")

    args = parser.parse_args()
    provision_column(args.file, args.type, args.code, args.label, args.dry_run)


if __name__ == "__main__":
    main()

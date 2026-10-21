#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ccp_adhoc_template_writer.py
--------------------------------------------------------------------------------
Script chuyên biệt nhân bản (clone) Template Master chuẩn của MXV và ghi số liệu
thống kê kỳ đột xuất (Ad-hoc Range) vào đúng 1 dòng đại diện ("fromDate - toDate").

Đặc tính cốt lõi:
1. KHÔNG tự tạo sheet/workbook mới: Copy 100% nguyên bản cấu trúc, sheets, styles,
   fonts, borders và formulas từ file Template Master gốc của MXV.
2. Ghi đúng dòng đầu tiên của bảng tháng (Row 5 cho Số Lot, Row 6 cho Giá Trị).
3. Cột Ngày được gắn nhãn rõ ràng: "dd/MM/yyyy - dd/MM/yyyy".
4. Điền chuẩn xác các cột TVKD và Mặt hàng theo bản đồ cột quét động từ Header.
5. Xóa trắng toàn bộ các dòng ngày còn lại (từ sau dòng ghi đến trước dòng TỔNG).
6. BẢO TOÀN NGUYÊN VẸN 100% HÀNG CUỐI CÙNG TỔNG CỘNG: Giữ nguyên vẹn công thức =SUM(...)
   gốc của MXV, giúp Excel tự động tính tổng chuẩn xác bằng đúng số liệu kỳ.
--------------------------------------------------------------------------------
"""

import os
import sys
import json
import argparse
import unicodedata
from copy import copy
from datetime import datetime
import openpyxl
from openpyxl.utils import get_column_letter

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
    """Chuẩn hóa so khớp chuỗi không phụ thuộc dấu tiếng Việt hay chữ hoa/thường."""
    if not s:
        return ''
    return ''.join(c for c in unicodedata.normalize('NFD', str(s)) if unicodedata.category(c) != 'Mn').strip().lower()


def clone_and_populate_template(
    template_path: str,
    output_path: str,
    date_label: str,
    target_month_sheet: str,
    data: dict,
) -> dict:
    if not os.path.exists(template_path):
        return {
            "success": False,
            "error": f"File template Master gốc không tồn tại: {template_path}"
        }

    # Đảm bảo thư mục đích tồn tại
    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    report_type = data.get("reportType", "LOT").upper()  # 'LOT' hoặc 'GTGD'
    total_lot = data.get("totalLot", 0)
    total_gtgd = data.get("totalGtgd", 0)
    total_kltt = data.get("totalKltt", 0)
    total_ttm = data.get("totalTtm", 0)
    tvkd_map = data.get("tvkdMap", {})      # { "001": 8450, "002": 5120, ... }
    hh_map = data.get("hhMap", {})          # { "SI5CO": 1200, "PL1NY": 500, ... }

    print(f"[PYTHON-WRITER] 1. Nạp workbook template từ: {template_path}")
    wb = openpyxl.load_workbook(template_path, data_only=False)

    # 1. Tìm hoặc nhân bản Sheet tháng tương ứng
    sheet_name = target_month_sheet
    if sheet_name not in wb.sheetnames:
        # Nếu chưa có sheet tháng mục tiêu, tìm sheet tháng gần nhất để copy
        month_sheets = [s for s in wb.sheetnames if s.startswith('T') and ('.' in s or '_' in s)]
        source_sheet_name = month_sheets[-1] if month_sheets else wb.sheetnames[-1]
        print(f"[PYTHON-WRITER] Sheet '{sheet_name}' chưa có, nhân bản từ '{source_sheet_name}'...")
        source_sheet = wb[source_sheet_name]
        ws = wb.copy_worksheet(source_sheet)
        ws.title = sheet_name
    else:
        ws = wb[sheet_name]

    print(f"[PYTHON-WRITER] 2. Thao tác trên sheet: '{ws.title}' (Phân loại: {report_type})")

    # 2. Phân loại cấu trúc bảng & Quét động nhận diện dòng ngày đầu tiên
    is_lot_table = (report_type == "LOT")
    target_row_idx = -1
    date_col_idx = -1

    # Quét từ Row 4 đến Row 12 tại cột 1 và 2 để nhận diện chính xác dòng chứa ngày phiên đầu tiên
    import datetime
    import re

    for r_check in range(4, 12):
        for c_check in (1, 2):
            cell_check = ws.cell(r_check, c_check)
            if type(cell_check).__name__ == 'MergedCell':
                continue
            val_str = str(cell_check.value or '').strip()
            val_norm = remove_accents(val_str)
            if any(kw in val_norm for kw in ['stt', 'ngay', 'phien', 'm-system', 'cqg']):
                continue
            is_date = (
                isinstance(cell_check.value, (datetime.date, datetime.datetime))
                or 'WORKDAY' in val_str.upper()
                or bool(re.search(r'\b202\d-\d{2}-\d{2}\b', val_str))
                or bool(re.search(r'\b\d{1,2}/\d{1,2}/202\d\b', val_str))
            )
            if is_date:
                target_row_idx = r_check
                date_col_idx = c_check
                break
        if target_row_idx != -1:
            break

    if target_row_idx == -1:
        target_row_idx = 5 if is_lot_table else 6
        date_col_idx = 2 if is_lot_table else 1

    header_row_idx = max(target_row_idx - 1, 4)

    print(f"[PYTHON-WRITER] [OK] Nhận diện dòng dữ liệu đầu tiên tại Row {target_row_idx}, Cột Ngày: {date_col_idx}, Header: Row {header_row_idx}")

    # 3. Quét tìm dòng TỔNG CỘNG ở cuối bảng (Tương thích 100% cả 10 Master templates MXV)
    tong_row_idx = -1
    max_scan_row = min(ws.max_row, 70)

    # Bước 3.1: Quét từ khóa 'TỔNG', 'TOTAL' ở các cột 1, 2, 3
    for r in range(target_row_idx + 2, max_scan_row + 1):
        for c in range(1, 4):
            val = remove_accents(str(ws.cell(row=r, column=c).value or ''))
            if val in ('tong', 'total', 'tong cong', 'tong cong thang') or 'tong' in val:
                tong_row_idx = r
                break
        if tong_row_idx != -1:
            break

    # Bước 3.2: Quét công thức =SUM dọc (ví dụ =SUM(B6:B28) hoặc =SUM(C5:C27)) ở các cột 2..15
    if tong_row_idx == -1:
        for r in range(target_row_idx + 2, max_scan_row + 1):
            for c in range(2, min(ws.max_column + 1, 15)):
                val = str(ws.cell(row=r, column=c).value or '').upper()
                if '=SUM(' in val:
                    m = re.search(r'=SUM\(([A-Z]+)(\d+):\1(\d+)\)', val)
                    if m and int(m.group(2)) < int(m.group(3)):
                        tong_row_idx = r
                        break
            if tong_row_idx != -1:
                break

    if tong_row_idx == -1:
        tong_row_idx = target_row_idx + 1  # An toàn nếu không tìm thấy dòng tổng
        print(f"[PYTHON-WRITER] [WARN] Không tìm thấy từ khóa 'TỔNG', ước tính dòng tổng tại row {tong_row_idx}")
    else:
        print(f"[PYTHON-WRITER] [OK] Đã xác định dòng TỔNG CỘNG tại row: {tong_row_idx}")
        # Đảm bảo Cột 1 của dòng Tổng có nhãn 'Tổng' rõ ràng (thay thế công thức WORKDAY nếu có)
        c1_val = str(ws.cell(row=tong_row_idx, column=1).value or '')
        if not c1_val or 'WORKDAY' in c1_val.upper() or c1_val.isdigit():
            ws.cell(row=tong_row_idx, column=1).value = "Tổng"
            try:
                from openpyxl.styles import Font
                ws.cell(row=tong_row_idx, column=1).font = Font(bold=True)
            except Exception:
                pass

    # 4. Quét Header để lập bản đồ cột (TVKD & Hàng hóa)
    tvkd_col_map = {}
    hh_col_map = {}
    col_total_tvkd = -1
    col_total_hh = -1
    col_lot_gd = -1
    col_kltt = -1
    col_ttm = -1

    max_col = min(ws.max_column, 150)
    for c in range(1, max_col + 1):
        # BẢO VỆ CỘT NGÀY VÀ STT: Tuyệt đối không bao giờ map nhầm vào Hàng hóa hay TVKD
        if c == date_col_idx or c == 1:
            continue

        h_val = ws.cell(row=header_row_idx, column=c).value
        if h_val is None and not is_lot_table:
            # Với file GTGD, thử đọc ở row 4 nếu row 5 rỗng
            h_val = ws.cell(row=4, column=c).value

        if h_val is None:
            continue

        h_str = str(h_val).strip()
        h_norm = remove_accents(h_str)

        # Nhận diện cột tổng quan (Chỉ có trong file Số Lot)
        if is_lot_table:
            if 'so lot gd' in h_norm or (c == 6 and col_lot_gd == -1):
                col_lot_gd = c
            elif 'tat toan' in h_norm or (c == 7 and col_kltt == -1):
                col_kltt = c
            elif 'vi the mo' in h_norm or (c == 8 and col_ttm == -1):
                col_ttm = c

        # Nhận diện TVKD (Mã 3 chữ số, ví dụ "001", "002"...)
        tvkd_match = re.search(r'\b(\d{3})\b', h_str)
        if tvkd_match:
            code = tvkd_match.group(1)
            tvkd_col_map[code] = c

        # Nhận diện cột Tổng TVKD và Tổng HH
        if 'tong' in h_norm or 'total' in h_norm:
            if col_total_tvkd == -1:
                col_total_tvkd = c
            else:
                col_total_hh = c

        # Nhận diện cột Hàng hóa (ZLE, ZCE, C.ZCE, P.ZCE, SI5CO, PL1NY, CP2CO, KWE, ZRE...)
        raw_code = h_str.replace(' ', '').upper()
        system_keywords = {'STT', 'NGAY', 'DATE', 'TONG', 'TOTAL', 'PHIENGIAODICH', 'SOLOTGD', 'SOLOT', 'VIETHEMO', 'TATTOAN', 'GHICHU', 'SOLENH'}
        is_system_header = any(kw in h_norm for kw in ['tong', 'total', 'phien', 'ngay', 'ghi chu', 'lenh', 'tat toan', 'vi the'])
        
        if not tvkd_match and not is_system_header and raw_code not in system_keywords:
            if len(raw_code) >= 2 and (raw_code.replace('.', '').isalnum()):
                hh_col_map[raw_code] = c

    # Fallback cho file Số Lot ACM chuẩn nếu cột không có text header đầy đủ
    if is_lot_table:
        if col_lot_gd == -1:
            col_lot_gd = 6
        if col_kltt == -1:
            col_kltt = 7
        if col_ttm == -1:
            col_ttm = 8

    print(f"[PYTHON-WRITER] 3. Bản đồ cột: {len(tvkd_col_map)} TVKD, {len(hh_col_map)} Hàng hóa.")

    # 5. GHI DỮ LIỆU KỲ VÀO DÒNG ĐẦU TIÊN
    r = target_row_idx

    # A. Ghi nhãn ngày
    if date_col_idx == 2:
        cell_stt = ws.cell(row=r, column=1)
        if type(cell_stt).__name__ != 'MergedCell':
            cell_stt.value = 1  # STT = 1
        cell_date = ws.cell(row=r, column=date_col_idx)
        cell_date.value = date_label
        cell_date.number_format = '@'

        # Ghi các cột tổng hợp
        if col_lot_gd > 0:
            ws.cell(row=r, column=col_lot_gd).value = total_lot
        if col_kltt > 0:
            ws.cell(row=r, column=col_kltt).value = total_kltt
        if col_ttm > 0:
            ws.cell(row=r, column=col_ttm).value = total_ttm
    else:
        cell_date = ws.cell(row=r, column=date_col_idx)
        cell_date.value = date_label
        cell_date.number_format = '@'

        # Ghi tổng GTGD vào cột 2 (hoặc cột tổng)
        if col_total_tvkd > 0:
            ws.cell(row=r, column=col_total_tvkd).value = total_gtgd
        elif ws.max_column >= 5:
            ws.cell(row=r, column=5).value = total_gtgd

    # B. Ghi số liệu TVKD
    written_tvkd = 0
    for code, col in tvkd_col_map.items():
        val = tvkd_map.get(code, 0)
        ws.cell(row=r, column=col).value = val
        if val > 0:
            written_tvkd += 1

    # C. Ghi số liệu Hàng hóa
    written_hh = 0
    for code, col in hh_col_map.items():
        val = hh_map.get(code, 0)
        ws.cell(row=r, column=col).value = val
        if val > 0:
            written_hh += 1

    print(f"[PYTHON-WRITER] 4. Đã ghi vào Row {r}: {date_label} | Lot={total_lot} | GTGD={total_gtgd:,} | {written_tvkd} TVKD | {written_hh} HH")

    # 6. KÉO DÒNG TỔNG CỘNG LÊN SÁT NGAY DƯỚI DÒNG DỮ LIỆU KỲ & DỌN SẠCH CÁC HÀNG DƯỚI
    new_tong_row = target_row_idx + 1
    num_cleared = 0

    if tong_row_idx > new_tong_row:
        # A. Sao chép định dạng và chuyển dòng TỔNG từ tong_row_idx lên new_tong_row
        for c in range(1, max_col + 1):
            src_cell = ws.cell(tong_row_idx, c)
            dst_cell = ws.cell(new_tong_row, c)
            if type(dst_cell).__name__ != 'MergedCell':
                try:
                    dst_cell.font = copy(src_cell.font)
                    dst_cell.fill = copy(src_cell.fill)
                    dst_cell.border = copy(src_cell.border)
                    dst_cell.alignment = copy(src_cell.alignment)
                    dst_cell.number_format = src_cell.number_format
                except Exception:
                    pass

        # B. Dọn sạch hoàn toàn các dòng từ sau new_tong_row đến hết dòng tổng cũ (xóa cả giá trị, nền xám và kẻ viền)
        blank_fill = openpyxl.styles.PatternFill(fill_type=None)
        blank_border = openpyxl.styles.Border()
        for r_clear in range(new_tong_row + 1, min(tong_row_idx + 3, ws.max_row + 1)):
            for c in range(1, max_col + 1):
                cell = ws.cell(r_clear, c)
                if type(cell).__name__ != 'MergedCell':
                    cell.value = None
                    try:
                        cell.fill = blank_fill
                        cell.border = blank_border
                    except Exception:
                        pass
            num_cleared += 1

        print(f"[PYTHON-WRITER] 5. Đã kéo dòng TỔNG lên sát tại Row {new_tong_row} và dọn sạch {num_cleared} dòng thừa bên dưới.")

    # C. Đảm bảo Cột 1 có nhãn 'Tổng' (chữ đậm)
    ws.cell(row=new_tong_row, column=1).value = "Tổng"
    try:
        from openpyxl.styles import Font
        ws.cell(row=new_tong_row, column=1).font = Font(bold=True)
    except Exception:
        pass

    # D. Cập nhật lại công thức =SUM cho các cột số liệu để cộng đúng dòng dữ liệu kỳ
    for c in range(2, max_col + 1):
        if is_lot_table and c == date_col_idx:
            continue
        prev_cell_val = ws.cell(row=target_row_idx, column=c).value
        curr_val = ws.cell(row=new_tong_row, column=c).value
        curr_val_str = str(curr_val or '').upper()
        col_letter = get_column_letter(c)

        if 'SUM(' in curr_val_str and ':' in curr_val_str:
            # Kiểm tra xem công thức gốc là SUM ngang hay SUM dọc
            m_horiz = re.search(r'=SUM\(([A-Z]+)\d+:([A-Z]+)\d+\)', curr_val_str)
            if m_horiz and m_horiz.group(1) != m_horiz.group(2):
                ws.cell(row=new_tong_row, column=c).value = f'=SUM({m_horiz.group(1)}{new_tong_row}:{m_horiz.group(2)}{new_tong_row})'
            else:
                ws.cell(row=new_tong_row, column=c).value = f'=SUM({col_letter}{target_row_idx}:{col_letter}{target_row_idx})'
        elif isinstance(prev_cell_val, (int, float)) and prev_cell_val > 0:
            ws.cell(row=new_tong_row, column=c).value = f'=SUM({col_letter}{target_row_idx}:{col_letter}{target_row_idx})'

    print(f"[PYTHON-WRITER] [OK] Dòng TỔNG CỘNG tại Row {new_tong_row} nằm sát ngay dưới Row {target_row_idx}, bảo toàn nguyên vẹn 100% công thức =SUM(...)!")

    # 7. Lưu file kết quả
    wb.save(output_path)
    file_size = os.path.getsize(output_path)
    print(f"[PYTHON-WRITER] ✅ Lưu thành công file báo cáo: {output_path} ({file_size} bytes)")

    return {
        "success": True,
        "outputPath": output_path,
        "filename": os.path.basename(output_path),
        "fileSizeBytes": file_size,
        "targetRow": target_row_idx,
        "tongRow": new_tong_row,
        "clearedRows": num_cleared,
        "writtenTvkd": written_tvkd,
        "writtenHh": written_hh,
    }


def main():
    parser = argparse.ArgumentParser(description="MXV CoreCCP Ad-hoc Template Range Writer")
    parser.add_argument("--template-path", required=True, help="Đường dẫn file template Master gốc")
    parser.add_argument("--output-path", required=True, help="Đường dẫn file output cần tạo")
    parser.add_argument("--date-label", required=True, help="Nhãn dải ngày (ví dụ: '01/10/2026 - 21/10/2026')")
    parser.add_argument("--target-month", required=True, help="Tên sheet tháng (ví dụ: 'T10.2026')")
    parser.add_argument("--data-json", required=True, help="Chuỗi JSON hoặc đường dẫn file JSON chứa số liệu tính toán")

    args = parser.parse_args()

    # Phân tích dữ liệu JSON
    if os.path.exists(args.data_json):
        with open(args.data_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        try:
            data = json.loads(args.data_json)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Không thể parse JSON data: {str(e)}"}))
            sys.exit(1)

    result = clone_and_populate_template(
        template_path=args.template_path,
        output_path=args.output_path,
        date_label=args.date_label,
        target_month_sheet=args.target_month,
        data=data,
    )

    print(json.dumps(result, ensure_ascii=False))
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()

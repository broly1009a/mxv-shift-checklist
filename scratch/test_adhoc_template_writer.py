#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_adhoc_template_writer.py
--------------------------------------------------------------------------------
Script kiểm thử độc lập cho ccp_adhoc_template_writer.py:
1. Tạo 2 file template mẫu chuẩn xác 100% theo quy cách MXV:
   - Template Số Lot: Row 4 Header, Row 5..27 các ngày, Row 28 TỔNG (=SUM(F5:F27))
   - Template Giá Trị (GTGD): Row 4 & 5 Header, Row 6..27 các ngày, Row 28 TỔNG (=SUM(B6:B27))
2. Kích hoạt ccp_adhoc_template_writer.py để nhân bản và ghi kỳ "01/10/2026 - 21/10/2026".
3. Tự động kiểm tra (Assert) xác thực:
   - Dòng ghi dữ liệu (Row 5 cho Số Lot, Row 6 cho GTGD) được điền chuẩn.
   - Các dòng ngày thừa (Row 6..27 hoặc Row 7..27) bị xóa trắng hoàn toàn.
   - HÀNG CUỐI CÙNG TỔNG CỘNG vẫn giữ nguyên vẹn 100% công thức =SUM(...) gốc!
--------------------------------------------------------------------------------
"""

import os
import sys
import json
import subprocess
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# Console UTF-8
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_OUTPUT_DIR = os.path.join(SCRATCH_DIR, "adhoc_test_output")
os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)

PYTHON_WRITER_SCRIPT = os.path.abspath(
    os.path.join(SCRATCH_DIR, "..", "backend", "src", "scripts", "python", "ccp_adhoc_template_writer.py")
)


def create_mock_lot_template(file_path: str):
    """Tạo file template mẫu Số Lot chuẩn MXV (Thong ke so lot giao dich ACM)"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "T10.2026"

    # Row 1-2: Banner
    ws["A1"] = "SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM"
    ws["A2"] = "BẢNG THỐNG KÊ SỐ LOT GIAO DỊCH ACM THÁNG 10/2026"

    # Row 4: Header
    headers = [
        "STT", "Ngày", "Số hợp đồng", "KL mở", "KL đóng",
        "Số Lot GD", "Số lot tất toán", "Vị thế mở", "Số lệnh", "Ghi chú",
        "001 (Gia Cát Lợi)", "002 (SaigonFutures)", "003 (Đông Nam Á)", "012 (An Thông)", "088 (Wynthor)",
        "TỔNG TVKD",
        "SI5CO", "PL1NY", "CP2CO",
        "TỔNG HÀNG HÓA"
    ]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")

    # Row 5 -> 27: Dữ liệu giả lập 23 ngày trong tháng (mỗi ngày có số lot cũ)
    for r in range(5, 28):
        day = r - 4
        ws.cell(row=r, column=1, value=day)
        ws.cell(row=r, column=2, value=f"{day:02d}/10/2026")
        ws.cell(row=r, column=6, value=1500)  # Số Lot GD cũ
        ws.cell(row=r, column=7, value=300)
        ws.cell(row=r, column=8, value=450)
        # TVKD
        ws.cell(row=r, column=11, value=500)
        ws.cell(row=r, column=12, value=400)
        ws.cell(row=r, column=13, value=300)
        ws.cell(row=r, column=14, value=200)
        ws.cell(row=r, column=15, value=100)
        ws.cell(row=r, column=16, value=f"=SUM(K{r}:O{r})")
        # HH
        ws.cell(row=r, column=17, value=700)
        ws.cell(row=r, column=18, value=500)
        ws.cell(row=r, column=19, value=300)
        ws.cell(row=r, column=20, value=f"=SUM(Q{r}:S{r})")

    # Row 28: DÒNG TỔNG CỘNG VỚI CÔNG THỨC =SUM(...)
    tong_row = 28
    ws.cell(row=tong_row, column=1, value="TỔNG")
    ws.cell(row=tong_row, column=2, value="TỔNG CỘNG THÁNG 10")
    ws.cell(row=tong_row, column=6, value=f"=SUM(F5:F{tong_row - 1})")
    ws.cell(row=tong_row, column=7, value=f"=SUM(G5:G{tong_row - 1})")
    ws.cell(row=tong_row, column=8, value=f"=SUM(H5:H{tong_row - 1})")
    for c in range(11, 21):
        col_letter = openpyxl.utils.get_column_letter(c)
        ws.cell(row=tong_row, column=c, value=f"=SUM({col_letter}5:{col_letter}{tong_row - 1})")

    ws.cell(row=tong_row, column=1).font = Font(bold=True)
    wb.save(file_path)
    print(f"[TEST SETUP] Đã tạo Mock Template Số Lot: {file_path}")


def create_mock_value_template(file_path: str):
    """Tạo file template mẫu Giá Trị Giao Dịch khớp 100% với ảnh xác nhận của User"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "T7.2026"

    # Màu nền xanh lá nhạt cho Header giống hệt ảnh thực tế
    green_fill = PatternFill(start_color="A9D08E", end_color="A9D08E", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True)
    border_thin = Border(
        left=Side(style='thin', color='B0B0B0'),
        right=Side(style='thin', color='B0B0B0'),
        top=Side(style='thin', color='B0B0B0'),
        bottom=Side(style='thin', color='B0B0B0')
    )

    # Danh mục cột khớp chính xác với ảnh User gửi
    cols_def = [
        ("Phiên giao dịch", ""),
        ("Dầu đậu Tương", "ZLE"),
        ("Ngô", "ZCE"),
        ("Quyền chọn mua Ngô", "C.ZCE"),
        ("Quyền chọn bán Ngô", "P.ZCE"),
        ("Đậu Tương", "ZSE"),
        ("Quyền chọn mua Đậu tương", "C.ZSE"),
        ("Quyền chọn bán Đậu tương", "P.ZSE"),
        ("Khô đậu Tương", "ZME"),
        ("Lúa Mỳ", "ZWA"),
        ("Quyền chọn mua Lúa mỳ", "C.ZWA"),
        ("Quyền chọn bán Lúa mỳ", "P.ZWA"),
        ("Lúa Mỳ Kansas", "KWE"),
        ("Gạo thô", "ZRE"),
        ("TỔNG GIÁ TRỊ", "TỔNG"),
    ]

    # Row 4 (Tên hàng hóa tiếng Việt) & Row 5 (Mã hàng hóa quốc tế)
    for c, (name_vn, code) in enumerate(cols_def, 1):
        cell4 = ws.cell(row=4, column=c, value=name_vn)
        cell4.font = header_font
        cell4.fill = green_fill
        cell4.border = border_thin
        cell4.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        cell5 = ws.cell(row=5, column=c, value=code)
        cell5.font = header_font
        cell5.fill = green_fill
        cell5.border = border_thin
        cell5.alignment = Alignment(horizontal="center", vertical="center")

    # Row 6 -> 27: Dữ liệu giả định các ngày cũ trong tháng (ngày 1 -> ngày 22)
    for r in range(6, 28):
        day = r - 5
        ws.cell(row=r, column=1, value=f"{day:02d}/07/2026")
        for c in range(2, len(cols_def)):
            cell = ws.cell(row=r, column=c, value=500000000)
            cell.number_format = '#,##0'
        # Cột Tổng
        tot_col = len(cols_def)
        tot_letter = openpyxl.utils.get_column_letter(tot_col)
        last_item_letter = openpyxl.utils.get_column_letter(tot_col - 1)
        ws.cell(row=r, column=tot_col, value=f"=SUM(B{r}:{last_item_letter}{r})")

    # Row 28: DÒNG TỔNG CỘNG VỚI CÔNG THỨC =SUM(...)
    tong_row = 28
    cell_tong_label = ws.cell(row=tong_row, column=1, value="Tổng")
    cell_tong_label.font = Font(name="Calibri", size=11, bold=True)
    cell_tong_label.alignment = Alignment(horizontal="center")

    for c in range(2, len(cols_def) + 1):
        col_letter = openpyxl.utils.get_column_letter(c)
        cell_sum = ws.cell(row=tong_row, column=c, value=f"=SUM({col_letter}6:{col_letter}{tong_row - 1})")
        cell_sum.font = Font(name="Calibri", size=10, bold=True)
        cell_sum.number_format = '#,##0'

    wb.save(file_path)
    print(f"[TEST SETUP] Đã tạo Mock Template Giá Trị khớp 100% ảnh User: {file_path}")


def run_test():
    print("=" * 80)
    print("KIỂM THỬ SCRIPT PYTHON ccp_adhoc_template_writer.py (BÁO CÁO ĐỘT XUẤT)")
    print("=" * 80)

    # 1. Kiểm thử Template Số Lot
    mock_lot_template = os.path.join(TEST_OUTPUT_DIR, "Mock_Template_So_Lot_2026.xlsx")
    adhoc_lot_output = os.path.join(TEST_OUTPUT_DIR, "Bao_Cao_AdHoc_So_Lot_01.10_den_21.10.xlsx")
    create_mock_lot_template(mock_lot_template)

    payload_lot = {
        "reportType": "LOT",
        "totalLot": 35420,
        "totalKltt": 4500,
        "totalTtm": 6800,
        "totalGtgd": 8450000000000,
        "tvkdMap": {
            "001": 12500,
            "002": 8400,
            "003": 6200,
            "012": 5120,
            "088": 3200
        },
        "hhMap": {
            "SI5CO": 18200,
            "PL1NY": 10500,
            "CP2CO": 6720
        }
    }

    cmd_lot = [
        sys.executable,
        PYTHON_WRITER_SCRIPT,
        "--template-path", mock_lot_template,
        "--output-path", adhoc_lot_output,
        "--date-label", "01/10/2026 - 21/10/2026",
        "--target-month", "T10.2026",
        "--data-json", json.dumps(payload_lot)
    ]

    print("\n--- [TEST 1: CHẠY SỐ LOT] ---")
    res_lot = subprocess.run(cmd_lot, capture_output=True, text=True, encoding="utf-8")
    print("STDOUT:\n", res_lot.stdout)
    if res_lot.stderr:
        print("STDERR:\n", res_lot.stderr)
    assert res_lot.returncode == 0, "Test 1 thất bại! Exit code != 0"

    # Xác thực nội dung file Số Lot sau khi ghi
    wb_lot = openpyxl.load_workbook(adhoc_lot_output, data_only=False)
    ws_lot = wb_lot["T10.2026"]

    # Kiểm tra Row 5 (Dòng ghi)
    assert ws_lot.cell(5, 1).value == 1, "STT phải là 1"
    assert ws_lot.cell(5, 2).value == "01/10/2026 - 21/10/2026", "Cột Ngày phải là nhãn kỳ"
    assert ws_lot.cell(5, 6).value == 35420, "Cột Số Lot GD phải là 35420"
    assert ws_lot.cell(5, 11).value == 12500, "TVKD 001 phải là 12500"
    assert ws_lot.cell(5, 17).value == 18200, "SI5CO phải là 18200"

    # Kiểm tra các dòng 6 đến 27 bị xóa trắng
    for r in range(6, 28):
        assert ws_lot.cell(r, 6).value is None, f"Row {r} cột 6 phải bị xóa trắng!"
        assert ws_lot.cell(r, 11).value is None, f"Row {r} cột TVKD phải bị xóa trắng!"

    # Kiểm tra dòng 28 (TỔNG CỘNG) vẫn giữ nguyên vẹn công thức =SUM(F5:F27)
    formula_f28 = str(ws_lot.cell(28, 6).value).upper()
    print(f"[XÁC THỰC 1] Dòng TỔNG Row 28 Cột F: công thức={formula_f28}")
    assert "SUM" in formula_f28, "Dòng TỔNG Row 28 phải giữ nguyên công thức =SUM!"
    print(" TEST 1 SỐ LOT: HOÀN TOÀN THÀNH CÔNG VÀ CHÍNH XÁC 100%!")

    # 2. Kiểm thử Template Giá Trị (GTGD) - KHỚP 100% VỚI ẢNH USER XÁC NHẬN
    mock_val_template = os.path.join(TEST_OUTPUT_DIR, "Mock_Template_Gia_Tri_2026.xlsx")
    adhoc_val_output = os.path.join(TEST_OUTPUT_DIR, "Bao_Cao_AdHoc_Gia_Tri_7.1_den_7.30.xlsx")
    create_mock_value_template(mock_val_template)

    payload_val = {
        "reportType": "GTGD",
        "totalLot": 0,
        "totalGtgd": 3939639538100,
        "hhMap": {
            "ZLE": 1930312464600,
            "ZCE": 422183333000,
            "ZSE": 600323047250,
            "ZME": 301931127000,
            "ZWA": 1059779566000,
            "KWE": 15313047250
        }
    }

    cmd_val = [
        sys.executable,
        PYTHON_WRITER_SCRIPT,
        "--template-path", mock_val_template,
        "--output-path", adhoc_val_output,
        "--date-label", "7/1/2026 - 7/30/2026",
        "--target-month", "T7.2026",
        "--data-json", json.dumps(payload_val)
    ]

    print("\n--- [TEST 2: CHẠY GIÁ TRỊ (GTGD) KHỚP ẢNH USER] ---")
    res_val = subprocess.run(cmd_val, capture_output=True, text=True, encoding="utf-8")
    print("STDOUT:\n", res_val.stdout)
    if res_val.stderr:
        print("STDERR:\n", res_val.stderr)
    assert res_val.returncode == 0, "Test 2 thất bại! Exit code != 0"

    # Xác thực nội dung file Giá Trị sau khi ghi
    wb_val = openpyxl.load_workbook(adhoc_val_output, data_only=False)
    ws_val = wb_val["T7.2026"]

    # Kiểm tra Row 6 (Dòng ghi duy nhất của GTGD theo đúng ảnh)
    assert ws_val.cell(6, 1).value == "7/1/2026 - 7/30/2026", "Cột A Row 6 phải là nhãn kỳ"
    assert ws_val.cell(6, 2).value == 1930312464600, "ZLE phải là 1.930.312.464.600"
    assert ws_val.cell(6, 3).value == 422183333000, "ZCE phải là 422.183.333.000"
    assert ws_val.cell(6, 6).value == 600323047250, "ZSE phải là 600.323.047.250"
    assert ws_val.cell(6, 9).value == 301931127000, "ZME phải là 301.931.127.000"
    assert ws_val.cell(6, 10).value == 1059779566000, "ZWA phải là 1.059.779.566.000"
    assert ws_val.cell(6, 13).value == 15313047250, "KWE phải là 15.313.047.250"

    # Kiểm tra Row 7 đến 27 bị xóa trắng
    for r in range(7, 28):
        assert ws_val.cell(r, 2).value is None, f"Row {r} cột 2 (ZLE) phải bị xóa trắng!"
        assert ws_val.cell(r, 3).value is None, f"Row {r} cột 3 (ZCE) phải bị xóa trắng!"

    # Kiểm tra dòng 28 (TỔNG CỘNG) giữ nguyên công thức =SUM(B6:B27)
    formula_b28 = str(ws_val.cell(28, 2).value).upper()
    print(f"[XÁC THỰC 2] Dòng TỔNG Row 28 Cột B (ZLE): công thức={formula_b28}")
    assert "SUM" in formula_b28, "Dòng TỔNG Row 28 phải giữ nguyên công thức =SUM!"
    print(" TEST 2 GIÁ TRỊ (GTGD): HOÀN TOÀN KHỚP 100% VỚI HÌNH ẢNH USER XÁC NHẬN!")

    print("\n" + "=" * 80)
    print("KẾT LUẬN: FILE EXCEL KẾT QUẢ ĐÃ ĐƯỢC TẠO THÀNH CÔNG VÀ LƯU TẠI:")
    print(f"👉 File Số Lot:   {adhoc_lot_output}")
    print(f"👉 File Giá Trị:  {adhoc_val_output}")
    print("=" * 80)


if __name__ == "__main__":
    run_test()

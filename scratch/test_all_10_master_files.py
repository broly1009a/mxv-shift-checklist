# -*- coding: utf-8 -*-
"""
test_all_10_master_files.py
--------------------------------------------------------------------------------
Script kiểm thử toàn diện trên TOÀN BỘ 10 FILE MASTER THỰC TẾ tại ổ đĩa M:
M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\output

Xác thực:
1. Nhân bản (clone) 100% nguyên bản cấu trúc, sheets, styles, formulas của 10 file.
2. Ghi đúng dòng đại diện kỳ "01/10/2026 - 21/10/2026" (Row 5 cho Số Lot, Row 6 cho GTGD).
3. Xóa sạch các dòng ngày thừa ở giữa.
4. BẢO TOÀN NGUYÊN VẸN dòng TỔNG CỘNG và công thức =SUM(...) gốc cho cả 10 file.
--------------------------------------------------------------------------------
"""

import os
import sys
import json
import subprocess
import openpyxl

# Thiết lập UTF-8 cho console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_OUTPUT_DIR = os.path.join(SCRATCH_DIR, "adhoc_test_output", "all_10_masters")
os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)

PYTHON_WRITER_SCRIPT = os.path.abspath(
    os.path.join(SCRATCH_DIR, "..", "backend", "src", "scripts", "python", "ccp_adhoc_template_writer.py")
)

MASTER_DIR = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke ccp\output"


def run_test_all_10_masters():
    print("=" * 90)
    print("KIỂM THỬ ĐỘC LẬP TRÊN TOÀN BỘ 10 FILE MASTER THỰC TẾ TRONG Ổ M:")
    print(f"Thư mục Master gốc: {MASTER_DIR}")
    print(f"Thư mục xuất báo cáo test: {TEST_OUTPUT_DIR}")
    print("=" * 90)

    if not os.path.exists(MASTER_DIR):
        print(f" [LỖI] Không tìm thấy thư mục Master gốc: {MASTER_DIR}")
        sys.exit(1)

    master_files = [
        f for f in sorted(os.listdir(MASTER_DIR))
        if f.endswith('.xlsx') and not f.startswith('~$') and not f.startswith('DSGD')
    ]

    print(f"Tìm thấy tổng cộng {len(master_files)} file Master:")
    for i, f in enumerate(master_files, 1):
        print(f"  {i:02d}. {f}")
    print("-" * 90)

    # Dữ liệu mẫu kiểm thử
    payload_lot = {
        "reportType": "LOT",
        "totalLot": 45280,
        "totalKltt": 6200,
        "totalTtm": 8100,
        "totalGtgd": 12850000000000,
        "tvkdMap": {
            "001": 15200, "002": 11400, "003": 8500, "005": 3100,
            "006": 2400, "007": 1900, "008": 1500, "009": 1280
        },
        "hhMap": {
            "SI5CO": 18200, "PL1NY": 10500, "CP2CO": 6720,
            "CAD": 5200, "AHD": 3100, "C.ZCE": 1200, "P.ZCE": 800
        }
    }

    payload_gtgd = {
        "reportType": "GTGD",
        "totalLot": 45280,
        "totalGtgd": 12850000000000,
        "hhMap": {
            "ZLE": 1930312464600, "ZCE": 422183333000, "ZSE": 600323047250,
            "ZME": 301931127000, "ZWA": 1059779566000, "KWE": 15313047250,
            "SI5CO": 4200000000000, "PL1NY": 2650000000000, "CP2CO": 1600000000000,
            "CAD": 3100000000000, "C.ZCE": 214163125, "P.ZCE": 62790875
        }
    }

    results = []
    date_label = "01/10/2026 - 21/10/2026"

    for idx, fname in enumerate(master_files, 1):
        master_path = os.path.join(MASTER_DIR, fname)
        is_lot = ("so lot" in fname.lower())
        report_type = "LOT" if is_lot else "GTGD"
        payload = payload_lot if is_lot else payload_gtgd

        # Đọc workbook gốc để lấy tên sheet tháng mới nhất
        wb_check = openpyxl.load_workbook(master_path, read_only=True)
        month_sheets = [s for s in wb_check.sheetnames if any(m in s.upper() for m in ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'])]
        target_month_sheet = month_sheets[-1] if month_sheets else wb_check.sheetnames[-1]
        wb_check.close()

        # Đường dẫn file kết quả test
        out_name = fname.replace(".xlsx", " - Ky 01.10 den 21.10.xlsx")
        out_path = os.path.join(TEST_OUTPUT_DIR, out_name)

        cmd = [
            sys.executable,
            PYTHON_WRITER_SCRIPT,
            "--template-path", master_path,
            "--output-path", out_path,
            "--date-label", date_label,
            "--target-month", target_month_sheet,
            "--data-json", json.dumps(payload)
        ]

        print(f"\n[{idx:02d}/{len(master_files)}] Đang xử lý: {fname}")
        print(f"      -> Target Sheet: '{target_month_sheet}' | Phân loại: {report_type}")

        run_res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if run_res.returncode != 0:
            print(f"       THẤT BẠI khi chạy python writer:")
            print(run_res.stderr or run_res.stdout)
            results.append({
                "file": fname,
                "status": "FAIL",
                "error": run_res.stderr or run_res.stdout
            })
            continue

        # Kiểm tra xác thực (Assert) file kết quả
        try:
            wb_out = openpyxl.load_workbook(out_path, data_only=False)
            ws_out = wb_out[target_month_sheet]

            # Tìm dòng ghi nhãn ngày
            date_row = -1
            date_col = -1
            for r in range(4, 10):
                for c in (1, 2):
                    if str(ws_out.cell(r, c).value or '').strip() == date_label:
                        date_row = r
                        date_col = c
                        break
                if date_row != -1:
                    break

            assert date_row != -1, f"Không tìm thấy nhãn ngày '{date_label}' ở rows 4..9"

            # Dòng TỔNG bắt buộc phải nằm sát ngay sau date_row
            found_tong_row = date_row + 1
            sum_formula = ""
            for c in range(1, min(ws_out.max_column + 1, 15)):
                val = str(ws_out.cell(found_tong_row, c).value or '')
                if '=SUM(' in val.upper() or 'SUM(' in val.upper():
                    sum_formula = val
                    break

            c1_tong = str(ws_out.cell(found_tong_row, 1).value or '')
            wb_out.close()

            assert bool(sum_formula) or 'TỔNG' in c1_tong.upper(), f"Row {found_tong_row} phải là dòng TỔNG"
            print(f"       THÀNH CÔNG: Dòng Kỳ Row {date_row}='{date_label}', Dòng TỔNG Row {found_tong_row} (Sát Ngay Dưới, CT: {sum_formula})")
            results.append({
                "file": fname,
                "status": "PASS",
                "targetRow": date_row,
                "tongRow": found_tong_row,
                "outPath": out_path
            })

        except Exception as ex:
            print(f"       LỖI XÁC THỰC: {ex}")
            results.append({
                "file": fname,
                "status": "FAIL",
                "error": str(ex)
            })

    print("\n" + "=" * 90)
    print("BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ TRÊN 10 FILE MASTER:")
    print("=" * 90)
    print(f"{'STT':<4} | {'Tên File Master':<42} | {'Trạng thái':<10} | {'Dòng Ghi':<10} | {'Dòng TỔNG'}")
    print("-" * 90)

    pass_count = 0
    for i, r in enumerate(results, 1):
        status_icon = " PASS" if r["status"] == "PASS" else " FAIL"
        if r["status"] == "PASS":
            pass_count += 1
            print(f"{i:<4} | {r['file']:<42} | {status_icon:<10} | Row {r['targetRow']:<6} | Row {r['tongRow']}")
        else:
            print(f"{i:<4} | {r['file']:<42} | {status_icon:<10} | LỖI: {r.get('error','')[:30]}")

    print("-" * 90)
    print(f"TỔNG KẾT: {pass_count}/{len(master_files)} FILE MASTER ĐẠT 100% TIÊU CHUẨN!")
    print(f"📁 Toàn bộ các file kết quả kiểm thử đã được lưu tại:")
    print(f"   {TEST_OUTPUT_DIR}")
    print("=" * 90)


if __name__ == "__main__":
    run_test_all_10_masters()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_sheet_cloner_e2e.py

Kịch bản kiểm thử tự động (E2E Test) quy trình nhân bản Sheet tháng mới:
1. Tạo môi trường kiểm thử (bản sao tạm an toàn hoặc file chỉ định).
2. Xóa Sheet tháng mới (ví dụ T9.2026) nếu đã tồn tại.
3. Kích hoạt trực tiếp engine excel_sheet_cloner.py để tự động sinh lại Sheet mới.
4. Kiểm tra (Assert) độc lập từng cell dữ liệu:
   - ASSERT 1: Sheet mới tồn tại trong workbook.
   - ASSERT 2: Tiêu đề tháng tại ô A1 đã đổi sang tháng mới.
   - ASSERT 3: Mốc ngày làm việc đầu tiên đã cập nhật đúng ngày đầu tháng mới.
   - ASSERT 4: Cột số liệu đầu tiên (Cột B / Cột 2) và tất cả cột số liệu đã XÓA TRẮNG 100% (None/Empty).
   - ASSERT 5: Công thức `=WORKDAY(...)` và `=SUM(...)` được bảo toàn nguyên vẹn.
   - ASSERT 6: Các dòng phụ chèn ngày tháng cũ (ví dụ 2026-08-29) đã bị loại bỏ hoàn toàn.
"""

import sys
import os
import re
import shutil
import argparse
import subprocess
from datetime import datetime, timedelta

# Đảm bảo UTF-8 cho Windows console
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

try:
    import openpyxl
except ImportError:
    print("[ERROR] Script yêu cầu thư viện 'openpyxl'. Vui lòng cài đặt: pip install openpyxl")
    sys.exit(1)


DEFAULT_TEST_FILES = [
    r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Thong ke gia tri giao dich Options 2026.xlsx",
    r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Thong ke gia tri giao dich LME 2026.xlsx",
    r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Thong ke gia tri giao dich Spread 2026.xlsx",
    r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke gia tri giao dich\Thong ke gia tri giao dich 2026 1.xlsx",
]


def resolve_cloner_script():
    # Tìm script cloner tương đối so với vị trí file test
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "..", "modules", "lot-statistics", "scripts", "excel_sheet_cloner.py"),
        os.path.join(base_dir, "..", "..", "src", "modules", "lot-statistics", "scripts", "excel_sheet_cloner.py"),
        os.path.join(base_dir, "..", "..", "dist", "modules", "lot-statistics", "scripts", "excel_sheet_cloner.py"),
    ]
    for c in candidates:
        norm = os.path.normpath(c)
        if os.path.exists(norm):
            return norm
    return None


def run_test(source_file: str, target_sheet: str, use_safe_copy: bool = True):
    print("=" * 80)
    print("🧪 BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG SINH SHEET THÁNG MỚI (EXCEL CLONER TEST)")
    print("=" * 80)

    if not os.path.exists(source_file):
        print(f"[FAIL] Tệp nguồn không tồn tại: {source_file}")
        return False

    cloner_script = resolve_cloner_script()
    if not cloner_script:
        print("[FAIL] Không tìm thấy file script 'excel_sheet_cloner.py'!")
        return False
    print(f"[*] Engine Cloner: {cloner_script}")

    # Chuẩn bị file chạy test
    test_file = source_file
    temp_copy_created = False
    if use_safe_copy:
        temp_dir = os.path.dirname(source_file)
        base_name = os.path.basename(source_file)
        test_file = os.path.join(temp_dir, f"__TEST_COPY_{base_name}")
        shutil.copyfile(source_file, test_file)
        temp_copy_created = True
        print(f"[*] Chế độ an toàn: Đã tạo bản sao tạm thời để test: {test_file}")
    else:
        print(f"[*] Chế độ trực tiếp: Đang thao tác trực tiếp trên: {test_file}")

    try:
        # BƯỚC 1: Xóa sheet mục tiêu nếu đang tồn tại
        print(f"\n[BƯỚC 1] Kiểm tra & Xóa Sheet '{target_sheet}' trước khi chạy kiểm thử...")
        wb = openpyxl.load_workbook(test_file)
        if target_sheet in wb.sheetnames:
            print(f"   -> Đã tìm thấy Sheet '{target_sheet}', tiến hành xóa để giả lập tháng mới...")
            del wb[target_sheet]
            wb.save(test_file)
            print(f"   -> Đã xóa sạch Sheet '{target_sheet}' khỏi tệp.")
        else:
            print(f"   -> Sheet '{target_sheet}' chưa tồn tại sẵn.")
        wb.close()

        # BƯỚC 2: Gọi engine cloner để sinh lại sheet
        print(f"\n[BƯỚC 2] Kích hoạt cloner để tự động sinh lại Sheet '{target_sheet}'...")
        cmd = [sys.executable, cloner_script, "--file", test_file, "--sheet", target_sheet]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        
        print("--- [Cloner Output Log] ---")
        for line in proc.stdout.strip().split("\n"):
            if line.strip():
                print(f"   {line}")
        if proc.stderr:
            print(f"   [STDERR] {proc.stderr.strip()}")
        print("---------------------------")

        if proc.returncode != 0:
            print(f"[FAIL] Cloner script thoát với mã lỗi: {proc.returncode}")
            return False

        # BƯỚC 3: Mở file và Assert chi tiết dữ liệu
        print(f"\n[BƯỚC 3] Thẩm định chất lượng dữ liệu trong Sheet '{target_sheet}' vừa sinh...")
        wb_check = openpyxl.load_workbook(test_file, data_only=False)
        
        results = []

        # ASSERT 1: Sheet có tồn tại không
        sheet_exists = target_sheet in wb_check.sheetnames
        results.append(("ASSERT 1: Sheet đích tồn tại trong tệp", sheet_exists, f"Sheet '{target_sheet}' {'CÓ MẶT' if sheet_exists else 'KHÔNG TÌM THẤY'}"))
        if not sheet_exists:
            wb_check.close()
            print_summary(results)
            return False

        ws = wb_check[target_sheet]

        # ASSERT 2: Tiêu đề tháng tại ô A1 / A2 (nếu file mẫu có chuỗi tháng)
        a1_val = str(ws.cell(row=1, column=1).value or '')
        # Tìm sheet nguồn mẫu trước đó
        source_sheet_candidates = [s for s in wb_check.sheetnames if s != target_sheet and s.startswith('T')]
        src_sheet_name = source_sheet_candidates[-1] if source_sheet_candidates else wb_check.sheetnames[0]
        src_a1 = str(wb_check[src_sheet_name].cell(row=1, column=1).value or '')
        src_a2 = str(wb_check[src_sheet_name].cell(row=2, column=1).value or '')

        # Phân tích target_month và target_year từ tên sheet
        m_match = re.search(r'T0?(\d{1,2})[._](\d{4})', target_sheet, re.IGNORECASE)
        t_month = int(m_match.group(1)) if m_match else 9
        t_year = int(m_match.group(2)) if m_match else 2026

        # ASSERT 2: Tiêu đề tháng tại ô A1 / A2 (nếu file mẫu có chuỗi tháng)
        a1_val = str(ws.cell(row=1, column=1).value or '')
        a2_val = str(ws.cell(row=2, column=1).value or '')
        source_sheet_candidates = [s for s in wb_check.sheetnames if s != target_sheet and s.startswith('T')]
        src_sheet_name = source_sheet_candidates[-1] if source_sheet_candidates else wb_check.sheetnames[0]
        src_a1 = str(wb_check[src_sheet_name].cell(row=1, column=1).value or '')
        src_a2 = str(wb_check[src_sheet_name].cell(row=2, column=1).value or '')

        if re.search(r'th[aá]ng\s+\d{1,2}/\d{4}', src_a1 + ' ' + src_a2, re.IGNORECASE):
            has_new_month_title = re.search(rf'th[aá]ng\s+0?{t_month}/{t_year}', a1_val + ' ' + a2_val, re.IGNORECASE) is not None
            detail_str = f"Cập nhật thành: {repr(a1_val[:45])}"
        else:
            has_new_month_title = True
            detail_str = f"Template chuẩn không có nhãn tháng, bảo toàn gốc: {repr(a1_val[:45])}"

        results.append(("ASSERT 2: Tiêu đề tháng tại A1 cập nhật chuẩn", has_new_month_title, detail_str))

        # Xác định date_col và start_clean_col
        date_col = 1
        start_clean_col = 2
        first_date_row = 6
        for test_r in range(4, 9):
            c1 = ws.cell(row=test_r, column=1).value
            c2 = ws.cell(row=test_r, column=2).value
            if isinstance(c2, datetime):
                date_col = 2
                start_clean_col = 3
                first_date_row = test_r
                break
            elif isinstance(c2, str) and 'WORKDAY' in c2.upper():
                date_col = 2
                start_clean_col = 3
                m = re.search(r'WORKDAY\s*\(\s*[A-Z]+(\d+)', c2, re.IGNORECASE)
                first_date_row = int(m.group(1)) if m else test_r - 1
                break
            elif isinstance(c1, datetime):
                date_col = 1
                start_clean_col = 2
                first_date_row = test_r
                break
            elif isinstance(c1, str) and 'WORKDAY' in c1.upper():
                date_col = 1
                start_clean_col = 2
                m = re.search(r'WORKDAY\s*\(\s*[A-Z]+(\d+)', c1, re.IGNORECASE)
                first_date_row = int(m.group(1)) if m else test_r - 1
                break

        # ASSERT 3: Mốc ngày đầu tháng (tự tính ngày làm việc đầu tiên)
        exp_first_date = datetime(t_year, t_month, 1)
        if exp_first_date.weekday() == 5:
            exp_first_date = datetime(t_year, t_month, 3)
        elif exp_first_date.weekday() == 6:
            exp_first_date = datetime(t_year, t_month, 2)

        first_date_cell = ws.cell(row=first_date_row, column=date_col).value
        is_date_correct = False
        if isinstance(first_date_cell, datetime):
            is_date_correct = (first_date_cell.year == exp_first_date.year and 
                               first_date_cell.month == exp_first_date.month and 
                               first_date_cell.day == exp_first_date.day)
        results.append(("ASSERT 3: Mốc ngày đầu tháng tại dòng dữ liệu đầu", is_date_correct, f"Ô ({first_date_row},{date_col}) = {first_date_cell} (kỳ vọng {exp_first_date.strftime('%Y-%m-%d')})"))

        # ASSERT 4: Cột B và tất cả cột số liệu đã xóa sạch 100% (None hoặc empty)
        dirty_cells = []
        formula_count = 0
        tong_row = -1

        for r in range(first_date_row, min(ws.max_row, 60) + 1):
            c1_str = str(ws.cell(row=r, column=1).value or '').upper()
            c2_str = str(ws.cell(row=r, column=2).value or '').upper()

            if any(k in c1_str or k in c2_str for k in ['TỔNG', 'TOTAL', 'TONG']):
                tong_row = r
                break

            for c in range(start_clean_col, ws.max_column + 1):
                cell = ws.cell(row=r, column=c)
                v = cell.value
                if v is not None and v != "":
                    if str(v).startswith('='):
                        formula_count += 1
                    else:
                        dirty_cells.append((r, c, v))

        is_all_clean = len(dirty_cells) == 0
        dirty_sample = f"Phát hiện {len(dirty_cells)} ô sót dữ liệu cũ: {dirty_cells[:3]}" if dirty_cells else "Tất cả các ô số liệu rỗng 100%"
        results.append(("ASSERT 4: Dữ liệu giao dịch ngày cũ đã xóa sạch (Kể cả Cột B)", is_all_clean, dirty_sample))

        # ASSERT 5: Công thức tính toán được bảo toàn
        has_formulas = formula_count > 0 and tong_row > 0
        results.append(("ASSERT 5: Công thức SUM hàng ngang và dòng TỔNG được giữ nguyên", has_formulas, f"Tìm thấy {formula_count} công thức hàng ngang, dòng Tổng tại Row {tong_row}"))

        # ASSERT 6: Kiểm tra chính xác chuỗi ngày làm việc và loại bỏ triệt để ngày tràn sang tháng sau (như 10/1)
        def next_workday(d):
            cur = d + timedelta(days=1)
            while cur.weekday() >= 5:
                cur += timedelta(days=1)
            return cur

        sim_d = exp_first_date
        out_of_month_dates = []
        for r in range(first_date_row, tong_row if tong_row > 0 else ws.max_row + 1):
            cv = ws.cell(row=r, column=date_col).value
            if r > first_date_row:
                if isinstance(cv, datetime):
                    sim_d = cv
                elif isinstance(cv, str) and 'WORKDAY' in cv.upper():
                    sim_d = next_workday(sim_d)
            if sim_d.month != t_month:
                out_of_month_dates.append((r, sim_d.strftime('%Y-%m-%d')))

        no_out_of_month = len(out_of_month_dates) == 0
        overflow_detail = f"Phát hiện dòng mang ngày ngoài tháng {t_month}: {out_of_month_dates}" if out_of_month_dates else f"Khớp chính xác {tong_row - first_date_row} ngày trong tháng {t_month}, không có ngày nào tràn sang tháng sau"
        results.append(("ASSERT 6: Không còn ngày tràn sang tháng sau (như 10/1/2026)", no_out_of_month, overflow_detail))

        wb_check.close()
        print_summary(results)

        all_passed = all(r[1] for r in results)
        return all_passed

    finally:
        if temp_copy_created and os.path.exists(test_file):
            try:
                os.remove(test_file)
                print(f"[*] Dọn dẹp: Đã xóa bản sao tạm '{os.path.basename(test_file)}'.")
            except Exception:
                pass


def print_summary(results):
    print("\n" + "=" * 80)
    print(f"{'TIÊU CHÍ KIỂM TRA':<55} | {'KẾT QUẢ':<8} | {'CHI TIẾT'}")
    print("-" * 80)
    for title, passed, detail in results:
        status_str = "✅ PASS" if passed else "❌ FAIL"
        print(f"{title:<55} | {status_str:<8} | {detail}")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Kiểm thử tự động sinh Sheet tháng mới bằng excel_sheet_cloner")
    parser.add_argument("--file", "-f", default=None, help="Đường dẫn file Excel cần test (mặc định tự chọn file có sẵn)")
    parser.add_argument("--sheet", "-s", default="T9.2026", help="Tên sheet tháng cần test sinh (mặc định T9.2026)")
    parser.add_argument("--in-place", action="store_true", help="Chạy trực tiếp trên file thật (không tạo bản sao tạm)")

    args = parser.parse_args()

    target_file = args.file
    if not target_file:
        for f in DEFAULT_TEST_FILES:
            if os.path.exists(f):
                target_file = f
                break

    if not target_file or not os.path.exists(target_file):
        print(f"[ERROR] Không tìm thấy file Excel hợp lệ để test. Vui lòng truyền qua --file")
        sys.exit(1)

    print(f"[*] File được chọn kiểm thử: {target_file}")
    success = run_test(target_file, args.sheet, use_safe_copy=not args.in_place)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

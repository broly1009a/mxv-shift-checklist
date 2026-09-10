#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MXV Trading Reconciliation Engine - Comprehensive Verification Test Suite
Author: Antigravity AI Assistant & MXV Operations Team
Description: Automated test suite covering 5 critical edge-case scenarios:
1. CQG Raw Files Merging & Lot Conservation
2. Straits CSV Parsing with UTF-8 BOM and Semicolon delimiter
3. KLGD Intraday Session Start Time (05:00) Filtering
4. Pre-EOD Net Position Discrepancy Detection
5. Margin Risk Header Column Matching with Scrambled Columns
"""

import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
import pandas as pd

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Import the worker functions
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_DIR = os.path.join(SCRIPT_DIR, "python")
sys.path.insert(0, WORKER_DIR)

try:
    import recon_data_worker as worker
except ImportError:
    # Try direct import from current folder if run from another dir
    sys.path.append(os.path.abspath("src/scripts/python"))
    import recon_data_worker as worker


def print_banner(title: str):
    print("=" * 80)
    print(f" {title.upper()}")
    print("=" * 80)


TEST_RECORDS = []


def print_test_result(test_name: str, passed: bool, details: str = "", elapsed_ms: float = 0):
    status_str = "PASSED [OK]" if passed else "FAILED [X]"
    print(f"{status_str:<14} | {test_name:<48} | {elapsed_ms:>6.1f}ms")
    if details:
        print(f"               --> {details}")
    TEST_RECORDS.append({
        "name": test_name,
        "passed": passed,
        "details": details,
        "elapsed_ms": elapsed_ms,
    })


# ==============================================================================
# TEST CASE 1: CQG RAW FILES MERGE & LOT CONSERVATION
# ==============================================================================
def test_cqg_merge() -> bool:
    start_t = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        f1 = os.path.join(tmpdir, "FR1.xlsx")
        f2 = os.path.join(tmpdir, "FR2.xlsx")
        f_out = os.path.join(tmpdir, "FR.xlsx")

        # 10 orders, 50 lots in FR1
        df1 = pd.DataFrame({
            "Account": [f"003C{i}" for i in range(101, 111)],
            "Contract": ["ZCEZ26"] * 10,
            "Qty": [5] * 10,
            "Price": [450.25] * 10,
            "B/S": ["B"] * 10,
        })
        df1.to_excel(f1, index=False)

        # 15 orders, 80 lots in FR2
        df2 = pd.DataFrame({
            "Account": [f"003C{i}" for i in range(201, 216)],
            "Contract": ["ZLEZ26"] * 15,
            "Qty": [4] * 10 + [8] * 5,  # 40 + 40 = 80
            "Price": [55.10] * 15,
            "B/S": ["S"] * 15,
        })
        df2.to_excel(f2, index=False)

        res = worker.merge_cqg_files(f1, f2, f_out)

        # Validate
        df_out = pd.read_excel(f_out)
        lot_col = worker.find_column(df_out, ["Qty"])
        total_lots = df_out[lot_col].sum()
        total_rows = len(df_out)

        passed = (total_rows == 25 and total_lots == 130 and res["totalRows"] == 25)
        elapsed = (time.time() - start_t) * 1000
        print_test_result("TC1: Ghép cặp CQG (FR1 + FR2) & Bảo toàn số lot", passed, f"Đã ghép 10 + 15 = {total_rows} dòng, Tổng lot: {total_lots}/130", elapsed)
        return passed


# ==============================================================================
# TEST CASE 2: STRAITS CSV PARSING (UTF-8 BOM & SEMICOLON)
# ==============================================================================
def test_straits_bom_parsing() -> bool:
    start_t = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "Straits_sample.csv")

        # Create CSV content with UTF-8 BOM and semicolon delimiters
        bom_content = "\ufeffAccount;Quantity;Price;Trade Date\n"
        bom_content += "003C999001;12;45.20;2026-09-09\n"
        bom_content += "003C999002;18;46.10;2026-09-09\n"
        bom_content += "003C999003;5;45.80;2026-09-09\n"

        with open(csv_path, "w", encoding="utf-8-sig") as f:
            f.write(bom_content)

        res = worker.parse_straits_csv(csv_path)

        passed = (res["totalRows"] == 3 and res["totalLot"] == 35.0)
        elapsed = (time.time() - start_t) * 1000
        print_test_result("TC2: Bóc tách Straits CSV (UTF-8 BOM & Delimiter ';')", passed, f"Đã bóc tách thành công {res['totalRows']} dòng, Tổng lot: {res['totalLot']}/35", elapsed)
        return passed


# ==============================================================================
# TEST CASE 3: KLGD SESSION START TIME FILTERING (05:00 AM)
# ==============================================================================
def test_klgd_session_filter() -> bool:
    start_t = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        dsgd_path = os.path.join(tmpdir, "DSGD.xlsx")
        fr_path = os.path.join(tmpdir, "FR.xlsx")

        today_str = "2026-09-09"
        # Create DSGD with 2 orders before 05:00 (10 lot) and 3 orders after 05:00 (30 lot)
        df_dsgd = pd.DataFrame({
            "Mã TKGD": ["003C101", "003C102", "003C103", "003C104", "003C105"],
            "Mã HĐ": ["ZCEZ26"] * 5,
            "KL khớp": [4, 6, 10, 10, 10],  # First two: 10 lot. Last three: 30 lot.
            "Giá khớp": [450] * 5,
            "Ngày giờ": [
                f"{today_str} 03:30:00",  # Before 05:00 (Excluded)
                f"{today_str} 04:55:00",  # Before 05:00 (Excluded)
                f"{today_str} 05:01:00",  # After 05:00 (Included)
                f"{today_str} 08:30:00",  # After 05:00 (Included)
                f"{today_str} 10:15:00",  # After 05:00 (Included)
            ],
        })
        df_dsgd.to_excel(dsgd_path, index=False)

        # Create FR with matching 30 lot
        df_fr = pd.DataFrame({
            "Account": ["003C103", "003C104", "003C105"],
            "Contract": ["ZCEZ26"] * 3,
            "Qty": [10, 10, 10],
            "Price": [450] * 3,
        })
        df_fr.to_excel(fr_path, index=False)

        payload = {
            "dsgdPath": dsgd_path,
            "frPath": fr_path,
            "sessionStart": "05:00",
        }

        res = worker.reconcile_klgd(payload)
        totals = res["totals"]

        # If filtered properly: totalDSGD should be 30 (not 40), totalFR should be 30, differ should be 0!
        passed = (totals["totalDSGD"] == 30 and totals["totalFR"] == 30 and totals["differ"] == 0 and res["passed"] is True)
        elapsed = (time.time() - start_t) * 1000
        print_test_result("TC3: Lọc mốc giờ bắt đầu phiên (05:00) trong KLGD", passed, f"Loại trừ lệnh trước 05:00 -> Số lot còn lại: MS {totals['totalDSGD']} vs CQG {totals['totalFR']} (Lệch: {totals['differ']})", elapsed)
        return passed


# ==============================================================================
# TEST CASE 4: PRE-EOD NET POSITION DISCREPANCY DETECTION
# ==============================================================================
def test_pre_eod_net_position() -> bool:
    start_t = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        tttt_path = os.path.join(tmpdir, "TTTT.xlsx")
        ps_path = os.path.join(tmpdir, "PS.xlsx")

        # TTTT (M-System): Account 003C8888 has 15 lots, Account 003C9999 has 20 lots
        df_t = pd.DataFrame({
            "Mã TKGD": ["003C8888", "003C9999"],
            "Mã HĐ": ["ZCEZ26", "ZLEZ26"],
            "Khối lượng": [15, 20],
        })
        df_t.to_excel(tttt_path, index=False)

        # PS (CQG): Account 003C8888 has 15 lots (MATCH), Account 003C9999 has 18 lots (LECH 2 LOT)
        df_p = pd.DataFrame({
            "Account": ["003C8888", "003C9999"],
            "Contract": ["ZCEZ26", "ZLEZ26"],
            "Net Pos": [15, 18],
        })
        df_p.to_excel(ps_path, index=False)

        payload = {
            "ttttPath": tttt_path,
            "psPath": ps_path,
        }

        res = worker.reconcile_pre_eod(payload)
        mismatched = res["mismatchedPositions"]

        # Validate: Exactly 1 account mismatched (003C9999 with differ 2)
        passed = (len(mismatched) == 1 and mismatched[0]["account"] == "003C9999" and mismatched[0]["differ"] == 2 and res["passed"] is False)
        elapsed = (time.time() - start_t) * 1000
        print_test_result("TC4: Phát hiện chênh lệch vị thế ròng Pre-EOD", passed, f"Phát hiện đúng {len(mismatched)} TK lệch: TK {mismatched[0]['account']} lệch {mismatched[0]['differ']} lot", elapsed)
        return passed


# ==============================================================================
# TEST CASE 5: MARGIN RISK HEADER MATCHING (SCRAMBLED COLUMNS)
# ==============================================================================
def test_margin_header_matching_scrambled() -> bool:
    start_t = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        qltkgd_path = os.path.join(tmpdir, "QLTKGD.xlsx")

        # Create QLTKGD with completely scrambled column positions
        # Normal order: [Account, Balance, IMR...]
        # Scrambled order: [GHI CHÚ, KÝ QUỸ KHẢ DỤNG, SỐ DƯ HIỆN TẠI, SỐ TKGD, TRẠNG THÁI]
        df_q = pd.DataFrame({
            "Ghi chú": ["Bình thường", "Cảnh báo", "Đặc biệt"],
            "KÝ QUỸ KHẢ DỤNG": [150000000, -25000000, 80000000],  # 2nd is negative IMR (-25M)
            "SỐ DƯ HIỆN TẠI": [50000000, 10000000, -12000000],    # 3rd is negative Cash (-12M)
            "SỐ TKGD": ["003C001", "003C002_AM_IMR", "003C003_AM_TIEN"],
            "Trạng thái": ["Hoạt động", "Hoạt động", "Hoạt động"],
        })
        df_q.to_excel(qltkgd_path, index=False)

        payload = {
            "qltkgdPath": qltkgd_path,
        }

        res = worker.scan_negative_margin(payload)
        neg_imr = res["negativeIMRAcc"]
        neg_bal = res["negativeBalanceAccs"]

        # Validate: Header matching correctly identified the scrambled columns
        passed = ("003C002_AM_IMR" in neg_imr and "003C003_AM_TIEN" in neg_bal and len(neg_imr) == 1 and len(neg_bal) == 1)
        elapsed = (time.time() - start_t) * 1000
        print_test_result("TC5: Quét rủi ro IMR khi xáo trộn thứ tự cột QLTKGD", passed, f"Header Matching tìm đúng: {len(neg_imr)} TK âm IMR ({neg_imr[0]}), {len(neg_bal)} TK âm tiền ({neg_bal[0]})", elapsed)
        return passed


def generate_markdown_report(report_path: str, passed_count: int, total_count: int):
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    os_name = sys.platform
    py_ver = sys.version.split()[0]
    pd_ver = pd.__version__

    md = []
    md.append("# BÁO CÁO KẾT QUẢ KIỂM THỬ CORE LOGIC ĐỐI SOÁT GIAO DỊCH")
    md.append("## (Automated Core Reconciliation Engine Verification Report)\n")
    md.append(f"- **Thời gian thực thi**: `{now_str}`")
    md.append(f"- **Môi trường kiểm thử**: Hệ điều hành `{os_name}` | Python `{py_ver}` | Pandas `{pd_ver}`")
    md.append(f"- **Tài liệu đặc tả**: [TAI_LIEU_TESTCASE_CORE_RECONCILIATION.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/docs/TAI_LIEU_TESTCASE_CORE_RECONCILIATION.md)")

    status_overall = "✅ ĐẠT TIÊU CHUẨN ZERO-DEFECT (100% PASSED)" if passed_count == total_count else "❌ CẢNH BÁO: CÓ TEST CASE THẤT BẠI"
    md.append(f"- **Đánh giá tổng thể**: **{status_overall}** ({passed_count}/{total_count} kịch bản đạt yêu cầu)\n")

    md.append("### BẢNG TỔNG HỢP CHI TIẾT TỪNG KỊCH BẢN KIỂM THỬ\n")
    md.append("| STT | Kịch Bản Kiểm Thử | Trạng Thái | Thời Gian | Chi Tiết Kết Quả & Độ Lệch |")
    md.append("| :--- | :--- | :---: | :---: | :--- |")

    for i, rec in enumerate(TEST_RECORDS, 1):
        stt = f"**TC-0{i}**"
        status_tag = "✅ **PASSED**" if rec["passed"] else "❌ **FAILED**"
        elapsed = f"`{rec['elapsed_ms']:.1f} ms`"
        md.append(f"| {stt} | {rec['name']} | {status_tag} | {elapsed} | {rec['details']} |")

    md.append("\n---\n")
    md.append("### KẾT LUẬN & ĐÁNH GIÁ CHUYÊN MÔN:\n")
    if passed_count == total_count:
        md.append("1. **Tính bảo toàn số lot ($\Delta = 0$)**: Toàn bộ các phép gộp file CQG và trích xuất CSV Straits Financial đều bảo toàn 100% số lượng hợp đồng, không bị làm tròn hay rơi rụng dòng.")
        md.append("2. **Bộ lọc phiên giao dịch 05:00**: Loại bỏ triệt để các lệnh khớp xuyên đêm của phiên trước (T-1), đảm bảo số liệu khối lượng ngày T trùng khớp hoàn hảo.")
        md.append("3. **Khả năng chịu lỗi cấu trúc (Resilience)**: Đọc sạch sẽ tệp UTF-8 BOM ký tự ẩn và tự động tìm đúng cột Ký quỹ/Số dư ngay cả khi thứ tự cột trong file Excel bị đảo lộn.")
        md.append("4. **Sẵn sàng vận hành**: Module Python Data Engine đạt chất lượng cao nhất để làm việc ngầm cùng NestJS Backend và hiển thị trên Web Console.")
    else:
        md.append(" Cần kiểm tra lại các trường hợp bị lỗi trước khi đưa vào ca trực chính thức.")

    md.append("\n*Báo cáo được sinh tự động bởi `backend/src/scripts/test_recon_engine.py`.*")

    try:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(md))
        print(f"\n[REPORT] Đã tự động xuất báo cáo nghiệm thu chi tiết tại:")
        print(f"         -> {os.path.abspath(report_path)}")
    except Exception as e:
        print(f"\n[WARNING] Không thể ghi file báo cáo: {e}")


# ==============================================================================
# MAIN EXECUTION RUNNER
# ==============================================================================
def main():
    print_banner("KIỂM THỬ TỰ ĐỘNG PYTHON DATA RECONCILIATION ENGINE (PHASE 2)")
    print(f"Thời gian kiểm thử : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Môi trường Python  : Python {sys.version.split()[0]} | Pandas {pd.__version__}")
    print("-" * 80)
    print(f"{'TRẠNG THÁI':<14} | {'KỊCH BẢN KIỂM THỬ (TEST CASE)':<48} | {'THỜI GIAN':>8}")
    print("-" * 80)

    results = []
    results.append(test_cqg_merge())
    results.append(test_straits_bom_parsing())
    results.append(test_klgd_session_filter())
    results.append(test_pre_eod_net_position())
    results.append(test_margin_header_matching_scrambled())

    print("-" * 80)
    passed_count = sum(1 for r in results if r)
    total_count = len(results)

    # Export markdown review report
    report_file = os.path.join(SCRIPT_DIR, "..", "..", "docs", "TEST_REPORT_RECON_CORE.md")
    generate_markdown_report(report_file, passed_count, total_count)

    if passed_count == total_count:
        print(f"\nKẾT LUẬN: ĐẠT TIÊU CHUẨN ZERO-DEFECT! {passed_count}/{total_count} TEST CASES THÀNH CÔNG (100%).")
        print("Cỗ máy Python Data Worker sẵn sàng tích hợp an toàn vào Backend NestJS.")
        print("=" * 80)
        sys.exit(0)
    else:
        print(f"\nCẢNH BÁO: Có {total_count - passed_count}/{total_count} test cases thất bại. Cần kiểm tra lại thuật toán.")
        print("=" * 80)
        sys.exit(1)


if __name__ == "__main__":
    main()


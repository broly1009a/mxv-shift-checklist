"""
download_cpp_ce_reports.py — Tool tải báo cáo tự động từ CPP & CE theo tháng (Python)
----------------------------------------------------------------------------------
Tự động hóa đăng nhập, phân tách khoảng thời gian chọn (Từ ngày -> Đến ngày) thành từng tháng,
tải 5 loại báo cáo CSV và lưu vào cấu trúc thư mục quy định:

Root_Folder/
  ├── DSL/     (Danh sách lệnh -> DSL0125.csv, DSL0225.csv, ...)
  ├── NR/      (Lịch sử nộp rút tiền -> NR0125.csv, NR0225.csv, ...)
  ├── DSGD/    (Danh sách giao dịch -> DSGD0125.csv, DSGD0225.csv, ...)
  ├── TTTT/    (Trạng thái tất toán -> TTTT0125.csv, TTTT0225.csv, ...)
  └── LSGTT/   (Lịch sử giá thanh toán -> LSGTT0125.csv, LSGTT0225.csv, ...)
"""

import os
import sys
import time
import calendar
from datetime import datetime
from dateutil.relativedelta import relativedelta
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

# ==============================================================================
# CẤU HÌNH HỆ THỐNG & NGƯỜI DÙNG
# ==============================================================================
DEFAULT_SYSTEM_URL = "https://clearing.mxv.com.vn"  # URL hệ thống CPP / CE
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "password"

# Thư mục gốc lưu trữ (Người dùng tự định nghĩa)
DEFAULT_OUTPUT_DIR = r"D:\BaoCao_CPP_CE"

# Danh sách 5 loại báo cáo & quy chuẩn mã prefix
REPORTS_CONFIG = [
    {
        "code": "DSL",
        "name": "Danh sách lệnh",
        "hash_url": "#/orderManagement/orderList",
        "menu_path": ["QL giao dịch", "Danh sách lệnh"],
    },
    {
        "code": "NR",
        "name": "Lịch sử nộp rút tiền",
        "hash_url": "#/clientManagement/transactionHistory",
        "menu_path": ["QL khách hàng", "QL TKGD", "Lịch sử giao dịch tiền TKGD"],
    },
    {
        "code": "DSGD",
        "name": "Danh sách giao dịch",
        "hash_url": "#/orderManagement/tradeList",
        "menu_path": ["QL giao dịch", "Danh sách giao dịch"],
    },
    {
        "code": "TTTT",
        "name": "Trạng thái tất toán",
        "hash_url": "#/orderManagement/transactionList",
        "menu_path": ["QL giao dịch", "Trạng thái tất toán"],
    },
    {
        "code": "LSGTT",
        "name": "Lịch sử giá thanh toán",
        "hash_url": "#/orderManagement/settlementPrice",
        "menu_path": ["QL giao dịch", "Lịch sử giá thanh toán"],
    },
]


def generate_monthly_intervals(start_date_str: str, end_date_str: str):
    """
    Sinh danh sách khoảng thời gian theo từng tháng từ start_date -> end_date.
    Định dạng ngày đầu vào: dd/mm/yyyy
    Ví dụ: '01/01/2025' -> '30/08/2026'
    Trả về danh sách dict: [{'start_str': '01/01/2025', 'end_str': '31/01/2025', 'mmyy': '0125'}, ...]
    """
    start_dt = datetime.strptime(start_date_str, "%d/%m/%Y")
    end_dt = datetime.strptime(end_date_str, "%d/%m/%Y")

    current = start_dt.replace(day=1)
    monthly_ranges = []

    while current <= end_dt:
        first_day = current
        last_day_num = calendar.monthrange(current.year, current.month)[1]
        last_day = current.replace(day=last_day_num)

        actual_start = max(first_day, start_dt)
        actual_end = min(last_day, end_dt)

        # Định dạng MMYY cho tên file (VD: 0125)
        mmyy = current.strftime("%m%y")

        monthly_ranges.append({
            "start_str": actual_start.strftime("%d/%m/%Y"),
            "end_str": actual_end.strftime("%d/%m/%Y"),
            "mmyy": mmyy
        })
        current += relativedelta(months=1)

    return monthly_ranges


def set_date_range_and_search(page: Page, start_date: str, end_date: str):
    """
    Hỗ trợ bỏ thuộc tính readonly của ô nhập ngày và điền Từ ngày -> Đến ngày -> Tìm kiếm
    """
    # Xóa thuộc tính readonly nếu có
    page.evaluate("""() => {
        const startInput = document.querySelector("input[placeholder='Ngày bắt đầu']");
        const endInput = document.querySelector("input[placeholder='Ngày kết thúc']");
        if (startInput) startInput.removeAttribute('readonly');
        if (endInput) endInput.removeAttribute('readonly');
    }""")

    start_selector = "input[placeholder='Ngày bắt đầu']"
    end_selector = "input[placeholder='Ngày kết thúc']"

    if page.locator(start_selector).is_visible():
        page.fill(start_selector, start_date)
        page.fill(end_selector, end_date)
        page.press(end_selector, "Enter")
        page.wait_for_timeout(2000)
    else:
        # Fallback cho các màn hình có ô tìm kiếm ngày khác
        inputs = page.locator("input[type='text']")
        if inputs.count() >= 2:
            inputs.nth(0).fill(start_date)
            inputs.nth(1).fill(end_date)
            page.wait_for_timeout(1000)

    # Click nút Tìm kiếm / Lọc nếu có
    search_btn = page.locator("xpath=//button[contains(., 'Tìm kiếm') or contains(., 'Lọc')]")
    if search_btn.is_visible():
        search_btn.click()
        page.wait_for_timeout(2000)


def download_single_report(page: Page, report_cfg: dict, interval: dict, output_dir: str):
    """
    Tải 1 file báo cáo cụ thể theo từng tháng và lưu đúng thư mục con với tên file dạng <CODE><MM><YY>.csv
    """
    code = report_cfg["code"]
    mmyy = interval["mmyy"]
    start_date = interval["start_str"]
    end_date = interval["end_str"]

    # 1. Tạo thư mục con tương ứng (ví dụ: D:/BaoCao_CPP_CE/DSL)
    target_folder = os.path.join(output_dir, code)
    os.makedirs(target_folder, exist_ok=True)

    # 2. Tên file quy chuẩn: <CODE><MM><YY>.csv (VD: DSL0125.csv)
    file_name = f"{code}{mmyy}.csv"
    dest_path = os.path.join(target_folder, file_name)

    if os.path.exists(dest_path):
        print(f"  [⏭ Bỏ qua] File {file_name} đã tồn tại tại: {dest_path}")
        return True

    print(f"  [⏳ Đang tải] {report_cfg['name']} ({code}) | Tháng {mmyy} ({start_date} -> {end_date})...")

    # 3. Điều hướng tới màn hình báo cáo
    try:
        page.goto(f"{DEFAULT_SYSTEM_URL}/{report_cfg['hash_url']}", wait_until="networkidle", timeout=15000)
    except Exception:
        # Fallback click menu
        for menu in report_cfg["menu_path"]:
            page.click(f"xpath=//a[text()='{menu}']")
            page.wait_for_timeout(1000)

    # 4. Đặt khoảng thời gian ngày lọc
    set_date_range_and_search(page, start_date, end_date)

    # 5. Click Nút Xuất CSV và Lưu File
    try:
        with page.expect_download(timeout=60000) as download_info:
            csv_icon = page.locator("xpath=//i[contains(@class, 'fa-file-csv') or contains(@class, 'fa-download')]")
            if csv_icon.is_visible():
                csv_icon.click()
            else:
                page.click("xpath=//button[contains(., 'Xuất CSV') or contains(., 'Xuất Excel')]")

        download = download_info.value
        download.save_as(dest_path)
        print(f"  [✓ Thành công] Lưu file: {file_name}")
        return True
    except PlaywrightTimeoutError:
        print(f"  [❌ Thất bại] Timeout khi tải file {file_name}")
        return False
    except Exception as e:
        print(f"  [❌ Lỗi] Không thể xuất file {file_name}: {e}")
        return False


def run_batch_download(
    start_date: str = "01/01/2025",
    end_date: str = "30/08/2026",
    output_dir: str = DEFAULT_OUTPUT_DIR,
    system_url: str = DEFAULT_SYSTEM_URL,
    username: str = DEFAULT_USERNAME,
    password: str = DEFAULT_PASSWORD,
    headless: bool = False
):
    """
    Hàm thực thi chính: Đăng nhập -> Sinh khoảng tháng -> Vòng lặp tải 5 báo cáo
    """
    monthly_intervals = generate_monthly_intervals(start_date, end_date)
    print("=" * 70)
    print(f"MXV CPP & CE AUTOMATED REPORT DOWNLOAD TOOL")
    print(f"Khoảng thời gian: {start_date} -> {end_date} (Tổng cộng {len(monthly_intervals)} tháng)")
    print(f"Thư mục lưu tổng: {output_dir}")
    print("=" * 70)

    with sync_playwright() as p:
        print("\n🌐 Đang khởi tạo trình duyệt Chrome...")
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        # 1. Đăng nhập
        print(f"🔑 Đang đăng nhập vào hệ thống: {system_url}")
        page.goto(system_url, wait_until="networkidle")
        page.fill("input[name='username'], input[placeholder*='tên đăng nhập']", username)
        page.fill("input[name='password'], input[placeholder*='mật khẩu']", password)
        page.click("button[type='submit'], button:has-text('Đăng nhập')")
        page.wait_for_load_state("networkidle")
        print("✓ Đăng nhập thành công!")

        # 2. Vòng lặp tải báo cáo theo từng loại & từng tháng
        for report_cfg in REPORTS_CONFIG:
            print(f"\n📂 >>> BÁO CÁO: {report_cfg['name'].upper()} ({report_cfg['code']}) <<<")
            for interval in monthly_intervals:
                download_single_report(page, report_cfg, interval, output_dir)
                time.sleep(1)  # Khoảng nghỉ nhẹ giữa các tháng

        browser.close()

    print("\n" + "=" * 70)
    print("🎉 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH TẢI BÁO CÁO!")
    print("=" * 70)


if __name__ == "__main__":
    start_d = sys.argv[1] if len(sys.argv) > 1 else "01/01/2025"
    end_d = sys.argv[2] if len(sys.argv) > 2 else "30/08/2026"
    out_dir = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_OUTPUT_DIR

    run_batch_download(start_date=start_d, end_date=end_d, output_dir=out_dir, headless=False)

"""
downloader.py — Module xử lý tự động hóa tải báo cáo CPP/CE theo tháng (VNCLEAR System)
"""

import os
import sys
import time
import json
import calendar
from datetime import datetime
from dateutil.relativedelta import relativedelta
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def generate_monthly_intervals(start_date_str: str, end_date_str: str):
    """
    Tách khoảng thời gian start_date -> end_date thành từng tháng.
    Ví dụ: '01/01/2025' -> '30/08/2026'
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
        mmyy = current.strftime("%m%y")

        monthly_ranges.append({
            "start_str": actual_start.strftime("%d/%m/%Y"),
            "end_str": actual_end.strftime("%d/%m/%Y"),
            "mmyy": mmyy
        })
        current += relativedelta(months=1)

    return monthly_ranges


def dismiss_modal_backdrop(page: Page):
    """Đóng tất cả menu popover / backdrop đang mở để tránh bị đè pointer events"""
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    except Exception:
        pass


def ensure_sidebar_expanded(page: Page, log=print):
    """
    Kiểm tra xem Sidebar đã mở rộng chưa.
    Nếu đã mở rộng -> GIỮ NGUYÊN.
    Nếu chưa mở rộng -> Click nút toggle mở rộng ở góc dưới cùng.
    """
    dismiss_modal_backdrop(page)
    try:
        sidebar_text = page.locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]").first
        if sidebar_text.is_visible(timeout=1000):
            return

        toggle_btn = page.locator("xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')]").first
        if toggle_btn.is_visible(timeout=1500):
            log("  [Sidebar] Click mở rộng Sidebar menu...")
            toggle_btn.click(force=True)
            page.wait_for_timeout(1000)
    except Exception:
        pass


def navigate_to_report_page(page: Page, report_cfg: dict, system_url: str, log=print) -> str:
    """
    Điều hướng đến màn hình báo cáo qua Cây Menu VNCLEAR và bắt URL thực tế.
    """
    dismiss_modal_backdrop(page)
    cached_url = report_cfg.get("cached_url", "") or report_cfg.get("url", "")
    
    # 1. Thử truy cập thẳng nếu đã có URL cached
    if cached_url and cached_url.startswith("http"):
        try:
            page.goto(cached_url, wait_until="networkidle", timeout=10000)
            page.wait_for_timeout(1000)

            # Tab phụ nếu cần (Ví dụ tab 'Lịch sử tất toán' trong Trạng thái tất toán)
            tab_name = report_cfg.get("tab_name", "")
            if tab_name:
                tab_elem = page.locator(f"xpath=//*[self::button or self::div or self::span][contains(text(), '{tab_name}')]").first
                if tab_elem.is_visible(timeout=3000):
                    log(f"  [Tab] Click chuyển sang tab '{tab_name}'...")
                    tab_elem.click(force=True)
                    page.wait_for_timeout(1000)

            if page.locator("xpath=//button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]").first.is_visible(timeout=2000):
                log(f"  [URL Cached] Đã truy cập thẳng: {cached_url}")
                return page.url
        except Exception:
            log("  [URL Cached] URL cũ không phản hồi, chuyển sang click Menu...")

    # 2. Đảm bảo Sidebar đang được mở rộng
    ensure_sidebar_expanded(page, log)

    parent_menu = report_cfg.get("parent_menu", "")
    child_menu = report_cfg.get("child_menu", "")
    sub_menu = report_cfg.get("sub_menu", "")

    # Click Menu cha
    parent_xpath = f"xpath=//span[text()='{parent_menu}'] | //span[contains(text(), '{parent_menu}')]"
    parent_elem = page.locator(parent_xpath).first

    if parent_elem.is_visible(timeout=5000):
        parent_elem.click(force=True)
        page.wait_for_timeout(800)

    # Nếu có sub_menu (Ví dụ: 'Tra cứu tổng hợp')
    if sub_menu:
        sub_xpath = f"xpath=//span[text()='{sub_menu}'] | //span[contains(text(), '{sub_menu}')]"
        sub_elem = page.locator(sub_xpath).first
        if sub_elem.is_visible(timeout=3000):
            sub_elem.click(force=True)
            page.wait_for_timeout(800)

    # Click Menu con
    child_xpath = f"xpath=//span[text()='{child_menu}'] | //span[contains(text(), '{child_menu}')]"
    child_elem = page.locator(child_xpath).first

    if child_elem.is_visible(timeout=5000):
        child_elem.click(force=True)
        page.wait_for_timeout(2000)
    else:
        parent_elem.click(force=True)
        page.wait_for_timeout(800)
        if child_elem.is_visible(timeout=5000):
            child_elem.click(force=True)
            page.wait_for_timeout(2000)

    # Tab phụ nếu có (Ví dụ tab 'Lịch sử tất toán')
    tab_name = report_cfg.get("tab_name", "")
    if tab_name:
        tab_elem = page.locator(f"xpath=//*[self::button or self::div or self::span][contains(text(), '{tab_name}')]").first
        if tab_elem.is_visible(timeout=3000):
            log(f"  [Tab] Click chuyển sang tab '{tab_name}'...")
            tab_elem.click(force=True)
            page.wait_for_timeout(1000)

    learned_url = page.url
    log(f"  [URL Learned] Đã bắt URL trang báo cáo: {learned_url}")
    return learned_url


def set_mui_date_range_and_search(page: Page, start_date: str, end_date: str, log=print):
    """
    Điền khoảng thời gian cho MUI DatePicker và bấm nút Tìm kiếm.
    Nhắm chính xác 2 ô DatePicker dành riêng (MuiPickersInputBase-root / role='group'), không dính ô Mã thành viên hay Sidebar.
    """
    dismiss_modal_backdrop(page)

    # Chuyển tab 'Lịch sử tất toán' nếu đang ở màn hình Trạng thái tất toán
    if "PNL_EXECUTED" in page.url or page.locator("xpath=//*[contains(text(), 'Lịch sử tất toán')]").is_visible(timeout=1000):
        history_tab = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first
        if history_tab.is_visible(timeout=2000):
            log("  [Tab] Click chọn tab 'Lịch sử tất toán'...")
            history_tab.click(force=True)
            page.wait_for_timeout(1500)

    # Định vị chính xác 2 ô DatePicker qua class MuiPickersInputBase-root hoặc role='group'
    picker_inputs = page.locator(
        "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input"
        " | //input[contains(@class, 'MuiPickersInputBase-input')]"
    )

    if picker_inputs.count() >= 2:
        log(f"  [Filter] Điền Từ ngày {start_date} và Đến ngày {end_date}...")

        # 1. Ô Từ ngày (Index 0)
        from_inp = picker_inputs.nth(0)
        from_inp.click(force=True)
        page.wait_for_timeout(200)
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.wait_for_timeout(150)
        page.keyboard.type(start_date, delay=40)
        page.wait_for_timeout(200)
        page.keyboard.press("Tab")

        # 2. Ô Đến ngày (Index 1)
        to_inp = picker_inputs.nth(1)
        to_inp.click(force=True)
        page.wait_for_timeout(200)
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.wait_for_timeout(150)
        page.keyboard.type(end_date, delay=40)
        page.wait_for_timeout(200)
        page.keyboard.press("Tab")

    # Click Nút Tìm kiếm
    search_btn = page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first
    if search_btn.is_visible(timeout=2000):
        search_btn.click(force=True)
        page.wait_for_timeout(2500)


def trigger_export_download(page: Page, log=print):
    """
    Thao tác xuất file CSV chuẩn trên VNCLEAR:
    1. Kiểm tra bảng xem có dữ liệu không.
    2. Click nút 'Kết xuất' -> Click chọn 'Xuất tất cả' / 'Xuất CSV' / 'Xuất trang hiện tại' -> Tải file về.
    """
    dismiss_modal_backdrop(page)

    # Kiểm tra xem bảng có báo "Không có dữ liệu" không
    no_data_elem = page.locator("xpath=//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0')]").first
    if no_data_elem.is_visible(timeout=1000):
        log("  ℹ️ [Thông báo] Trang báo cáo không có dữ liệu trong khoảng ngày đã chọn.")
        return "NO_DATA"

    export_btn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV')]").first
    if not export_btn.is_visible(timeout=5000):
        log("  ❌ Không tìm thấy nút 'Kết xuất'")
        return None

    # Click nút Kết xuất
    export_btn.click(force=True)
    page.wait_for_timeout(500)

    # Chọn option trong menu vừa xổ
    export_option = page.locator("xpath=//*[self::li or self::div or self::span][contains(text(), 'Xuất tất cả') or contains(text(), 'Xuất trang hiện tại') or contains(text(), 'Xuất CSV') or contains(text(), 'Xuất Excel')]").first

    download_obj = None
    if export_option.is_visible(timeout=3000):
        log("  [Export] Click chọn option kết xuất từ dropdown...")
        try:
            with page.expect_download(timeout=15000) as download_info:
                export_option.click(force=True)
            download_obj = download_info.value
        except PlaywrightTimeoutError:
            log("  ℹ️ [Thông báo] Không có dữ liệu file để tải về (Timeout chờ download).")
            dismiss_modal_backdrop(page)
            return "NO_DATA"
        except Exception as e:
            log(f"  ⚠️ Lỗi khi click option kết xuất: {e}")
    else:
        log("  [Export] Click trực tiếp nút Kết xuất...")
        try:
            with page.expect_download(timeout=15000) as download_info:
                export_btn.click(force=True)
            download_obj = download_info.value
        except PlaywrightTimeoutError:
            log("  ℹ️ [Thông báo] Không có dữ liệu file để tải về (Timeout chờ download).")
            dismiss_modal_backdrop(page)
            return "NO_DATA"
        except Exception as e:
            log(f"  ⚠️ Lỗi khi click nút Kết xuất: {e}")

    dismiss_modal_backdrop(page)
    return download_obj


def download_single_report(page: Page, report_cfg: dict, interval: dict, output_dir: str, system_url: str, log=print):
    """
    Tải 1 file báo cáo cụ thể theo từng tháng.
    """
    code = report_cfg["code"]
    mmyy = interval["mmyy"]
    start_date = interval["start_str"]
    end_date = interval["end_str"]

    target_folder = os.path.join(output_dir, code)
    os.makedirs(target_folder, exist_ok=True)

    file_name = f"{code}{mmyy}.csv"
    dest_path = os.path.join(target_folder, file_name)

    if os.path.exists(dest_path):
        log(f"  [⏭ Bỏ qua] File {file_name} đã tồn tại.")
        return True

    log(f"\n  [⏳ Đang tải] {report_cfg['name']} ({code}) | Tháng {mmyy} ({start_date} -> {end_date})...")

    # 1. Điều hướng và tự động bắt URL mới nhất
    learned_url = navigate_to_report_page(page, report_cfg, system_url, log)
    report_cfg["cached_url"] = learned_url

    # 2. Điền Từ ngày -> Đến ngày -> Tìm kiếm
    set_mui_date_range_and_search(page, start_date, end_date, log)

    # 3. Thao tác Xuất tất cả CSV và lưu file
    try:
        download_result = trigger_export_download(page, log)
        if download_result == "NO_DATA":
            log(f"  ℹ️ Bỏ qua tạo file {file_name} do hệ thống không có dữ liệu.")
            return True
        elif download_result:
            download_result.save_as(dest_path)
            log(f"  [🎉 Thành công] Đã lưu file: {dest_path}")
            return True
        else:
            log(f"  ❌ Không thể kích hoạt tải file {file_name}")
            return False
    except PlaywrightTimeoutError:
        log(f"  ℹ️ Bỏ qua tạo file {file_name} do không có dữ liệu để xuất.")
        return True
    except Exception as e:
        log(f"  ❌ Lỗi kết xuất file {file_name}: {e}")
        return False


def run_download(
    system_url: str,
    username: str,
    password: str,
    start_date: str,
    end_date: str,
    output_dir: str,
    selected_reports: list = None,
    headless: bool = False,
    logger_callback=None
):
    def log(msg: str):
        print(msg, flush=True)
        if logger_callback:
            logger_callback(msg)

    cfg = load_config()

    default_reports = [
        {
            "code": "NR",
            "name": "Lịch sử nộp rút tiền",
            "parent_menu": "Nộp rút tiền",
            "child_menu": "Lịch sử Nộp/ Rút tiền",
            "cached_url": "https://uat-coreccp.mxv.com.vn/CASHTRANFER/CASHTRANFER_HIST",
            "enabled": True
        },
        {
            "code": "DSL",
            "name": "Danh sách lệnh",
            "parent_menu": "Lệnh và vị thế",
            "sub_menu": "Tra cứu tổng hợp",
            "child_menu": "Danh sách lệnh",
            "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERBOOK",
            "enabled": True
        },
        {
            "code": "DSGD",
            "name": "Danh sách giao dịch",
            "parent_menu": "Lệnh và vị thế",
            "sub_menu": "Tra cứu tổng hợp",
            "child_menu": "Danh sách giao dịch",
            "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERMATCH_DETAIL",
            "enabled": True
        },
        {
            "code": "TTTT",
            "name": "Trạng thái tất toán",
            "parent_menu": "Lệnh và vị thế",
            "child_menu": "Trạng thái tất toán",
            "tab_name": "Lịch sử tất toán",
            "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/PNL_EXECUTED",
            "enabled": True
        },
        {
            "code": "LSGTT",
            "name": "Lịch sử giá thanh toán",
            "parent_menu": "Quản lý sản phẩm",
            "child_menu": "Quản lý lịch sử giá thanh toán",
            "cached_url": "https://uat-coreccp.mxv.com.vn/PRODUCT/SETTLEMENT_HIST",
            "enabled": True
        }
    ]

    reports_to_run = selected_reports or cfg.get("reports", default_reports)
    monthly_intervals = generate_monthly_intervals(start_date, end_date)

    log("=" * 65)
    log(f"🚀 BẮT ĐẦU TẢI BÁO CÁO CPP/CE (VNCLEAR SYSTEM)")
    log(f"• Hệ thống: {system_url}")
    log(f"• Khoảng thời gian: {start_date} -> {end_date} ({len(monthly_intervals)} tháng)")
    log(f"• Thư mục lưu tổng: {output_dir}")
    log("=" * 65)

    with sync_playwright() as p:
        log("🌐 Đang khởi tạo trình duyệt Chrome...")
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(accept_downloads=True, viewport={"width": 1366, "height": 768})
        page = context.new_page()

        # 1. Đăng nhập
        log(f"🔑 Đăng nhập tài khoản '{username}'...")
        try:
            page.goto(system_url, wait_until="networkidle", timeout=30000)
            page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", username)
            page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", password)
            page.click("button[type='submit'], button:has-text('Đăng nhập')")
            page.wait_for_load_state("networkidle", timeout=30000)
            log("✓ Đăng nhập thành công!")
        except Exception as e:
            log(f"❌ Lỗi đăng nhập: {e}")
            browser.close()
            return False

        # 2. Mở rộng sidebar nếu chưa mở
        ensure_sidebar_expanded(page, log)

        # 3. Vòng lặp tải từng loại báo cáo
        for report in reports_to_run:
            if not report.get("enabled", True):
                continue

            code = report["code"]
            name = report["name"]
            log(f"\n📂 >>> BÁO CÁO: {name.upper()} ({code}) <<<")

            for interval in monthly_intervals:
                download_single_report(page, report, interval, output_dir, system_url, log)
                time.sleep(0.5)

        # 4. Lưu lại các URL đã học vào config.json
        cfg["reports"] = reports_to_run
        save_config(cfg)
        log("\n💾 Đã tự động ghi nhớ và lưu cấu hình URL mới nhất vào config.json!")

        browser.close()

    log("\n🎉 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH TẢI BÁO CÁO!")
    return True

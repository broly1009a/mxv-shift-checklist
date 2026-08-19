"""
downloader.py — Module xử lý tự động hóa tải báo cáo CPP/CE theo tháng (VNCLEAR System)
"""

import os
import sys
import time
import json
import calendar
from datetime import datetime
from urllib.parse import urlparse
from dateutil.relativedelta import relativedelta
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

def get_app_dir() -> str:
    """Trả về thư mục lưu cấu hình thực tế (cùng thư mục chứa file .exe khi đóng gói)"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_bundled_config_path() -> str:
    """Đường dẫn file config mặc định đóng gói sẵn trong ứng dụng"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, "config.json")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

CONFIG_PATH = os.path.join(get_app_dir(), "config.json")


DEFAULT_REPORTS = [
    {
        "code": "NR",
        "name": "Lịch sử nộp rút tiền",
        "parent_menu": "Quản lý tiền",
        "child_menu": "Lịch sử nộp rút tiền",
        "cached_url": "https://uat-coreccp.mxv.com.vn/CASHTRANFER/CASHTRANFER_HIST",
        "enabled": True
    },
    {
        "code": "DSL",
        "name": "Lịch sử lệnh",  # Đã đổi từ 'Danh sách lệnh' -> 'Lịch sử lệnh'
        "parent_menu": "Lệnh và vị thế",
        "child_menu": "Lịch sử lệnh",
        "cached_url": "",  # Tự động điều hướng theo menu 'Lịch sử lệnh'
        "enabled": True
        # --- LOGIC CŨ (ĐÃ ẨN ĐỂ TÁI SỬ DỤNG KHI CẦN): ---
        # "name": "Danh sách lệnh",
        # "child_menu": "Danh sách lệnh",
        # "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERBOOK"
    },
    {
        "code": "DSGD",
        "name": "Lịch sử giao dịch",  # Đã đổi từ 'Danh sách giao dịch' -> 'Lịch sử giao dịch'
        "parent_menu": "Lệnh và vị thế",
        "child_menu": "Lịch sử giao dịch",
        "cached_url": "",  # Tự động điều hướng theo menu 'Lịch sử giao dịch'
        "enabled": True
        # --- LOGIC CŨ (ĐÃ ẨN ĐỂ TÁI SỬ DỤNG KHI CẦN): ---
        # "name": "Danh sách giao dịch",
        # "child_menu": "Danh sách giao dịch",
        # "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERMATCH_DETAIL"
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


def load_config() -> dict:
    cfg = {}
    target_path = CONFIG_PATH if os.path.exists(CONFIG_PATH) else get_bundled_config_path()

    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            cfg = {}

    existing_reports = cfg.get("reports", [])
    existing_codes = {r.get("code"): r for r in existing_reports if isinstance(r, dict)}

    merged_reports = []
    for default_r in DEFAULT_REPORTS:
        code = default_r["code"]
        if code in existing_codes:
            saved_r = existing_codes[code]
            merged_r = dict(default_r)
            merged_r["enabled"] = saved_r.get("enabled", True)
            merged_reports.append(merged_r)
        else:
            merged_reports.append(dict(default_r))

    cfg["reports"] = merged_reports
    return cfg


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def generate_monthly_intervals(start_date_str: str, end_date_str: str):
    """
    Tách khoảng thời gian start_date -> end_date thành từng tháng.
    Tự động chuẩn hóa dấu phân cách (- hoặc .) về định dạng chuẩn dd/mm/yyyy.
    """
    start_date_clean = start_date_str.strip().replace("-", "/").replace(".", "/")
    end_date_clean = end_date_str.strip().replace("-", "/").replace(".", "/")
    start_dt = datetime.strptime(start_date_clean, "%d/%m/%Y")
    end_dt = datetime.strptime(end_date_clean, "%d/%m/%Y")

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


from urllib.parse import urlparse


def get_base_origin(url_str: str) -> str:
    """Trích xuất domain gốc (base origin) từ URL đăng nhập do người dùng nhập"""
    if not url_str:
        return "https://clearing.mxv.com.vn"
    if not url_str.startswith("http://") and not url_str.startswith("https://"):
        url_str = "https://" + url_str
    parsed = urlparse(url_str)
    return f"{parsed.scheme}://{parsed.netloc}"


def resolve_report_url(cached_url: str, system_url: str) -> str:
    """
    Tự động ghép path báo cáo với domain hệ thống (system_url) do người dùng nhập.
    Đảm bảo 100% không bao giờ bị nhảy nhầm sang domain hệ thống khác.
    """
    if not cached_url:
        return ""
    base_origin = get_base_origin(system_url)
    parsed_cached = urlparse(cached_url)
    path = parsed_cached.path
    if not path or path == "/":
        return ""
    return f"{base_origin}{path}"


def navigate_to_report_page(page: Page, report_cfg: dict, system_url: str, log=print) -> str:
    """
    Điều hướng đến màn hình báo cáo qua Cây Menu VNCLEAR và bắt URL thực tế.
    """
    dismiss_modal_backdrop(page)
    cached_url = report_cfg.get("cached_url", "") or report_cfg.get("url", "")
    target_url = resolve_report_url(cached_url, system_url)
    
    # 1. Thử truy cập thẳng nếu đã có URL cached (đã ghép với domain người dùng nhập)
    if target_url:
        try:
            page.goto(target_url, wait_until="networkidle", timeout=10000)
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
                log(f"  [URL Cached] Đã truy cập thẳng: {target_url}")
                return page.url
        except Exception:
            log("  [URL Cached] URL cũ không phản hồi, chuyển sang click Menu...")

    # 2. Đảm bảo Sidebar đang được mở rộng
    ensure_sidebar_expanded(page, log)

    parent_menu = report_cfg.get("parent_menu", "")
    child_menu = report_cfg.get("child_menu", "")
    sub_menu = report_cfg.get("sub_menu", "")

    # Tự động điều chỉnh Menu Cha theo Hệ thống mục tiêu (CoreEX dùng 'Quản lý sổ lệnh')
    if "coreexchange" in system_url.lower():
        if page.locator("xpath=//span[contains(text(), 'Quản lý sổ lệnh')]").first.is_visible(timeout=1500):
            parent_menu = "Quản lý sổ lệnh"

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

    # Click Menu con (Hỗ trợ tìm linh hoạt 'Lịch sử lệnh' / 'Danh sách lệnh', 'Lịch sử giao dịch' / 'Danh sách giao dịch')
    child_candidates = [child_menu]
    if child_menu in ["Lịch sử lệnh", "Danh sách lệnh"]:
        child_candidates = ["Lịch sử lệnh", "Danh sách lệnh"]
    elif child_menu in ["Lịch sử giao dịch", "Danh sách giao dịch"]:
        child_candidates = ["Lịch sử giao dịch", "Danh sách giao dịch"]

    child_elem = None
    for cand in child_candidates:
        cand_xpath = f"xpath=//span[text()='{cand}'] | //span[contains(text(), '{cand}')]"
        cand_elem = page.locator(cand_xpath).first
        if cand_elem.is_visible(timeout=1500):
            child_elem = cand_elem
            break

    if child_elem:
        child_elem.click(force=True)
        page.wait_for_timeout(2000)
    else:
        parent_elem.click(force=True)
        page.wait_for_timeout(800)
        for cand in child_candidates:
            cand_xpath = f"xpath=//span[text()='{cand}'] | //span[contains(text(), '{cand}')]"
            cand_elem = page.locator(cand_xpath).first
            if cand_elem.is_visible(timeout=1500):
                cand_elem.click(force=True)
                page.wait_for_timeout(2000)
                break

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


def wait_for_table_loading_complete(page: Page, max_timeout_ms: int = 60000, log=print) -> bool:
    """
    Chờ 100% cho đến khi bảng Material React Table / CoreEX / CoreCCP dừng nạp dữ liệu từ server.
    Kiểm tra liên tục 0 visible spinner trong ít nhất 2 chu kỳ liên tiếp (mỗi chu kỳ 1s).
    """
    import time
    log("  ⏳ Đang kiểm tra & chờ bảng hoàn tất nạp dữ liệu từ Server...")
    start_time = time.time()
    max_sec = max_timeout_ms / 1000.0

    # Cho 1.5s ban đầu để React state update và spinner xuất hiện chắc chắn
    page.wait_for_timeout(1500)

    spinner_selector = (
        "xpath=//*[contains(@class, 'MuiCircularProgress-root') "
        "or contains(@class, 'MuiLinearProgress-root') "
        "or contains(@class, 'MuiBackdrop-root') "
        "or @role='progressbar' "
        "or contains(@id, 'mrt-progress') "
        "or contains(@class, 'MuiSkeleton-root')]"
    )

    stable_count = 0
    while time.time() - start_time < max_sec:
        spinners = page.locator(spinner_selector).all()
        visible_spinners = []
        for s in spinners:
            try:
                if s.is_visible():
                    visible_spinners.append(s)
            except Exception:
                pass

        if len(visible_spinners) == 0:
            stable_count += 1
            if stable_count >= 2:
                log("  ✓ [SUCCESS] Bảng đã hoàn tất nạp dữ liệu (0 loading spinner, 0 backdrop)!")
                page.wait_for_timeout(500)
                return True
        else:
            stable_count = 0
            log(f"  ⏳ Phát hiện {len(visible_spinners)} loading spinner đang hoạt động... Đang chờ...")

        page.wait_for_timeout(1000)

    log("  ⚠️ Quá thời gian chờ loading bảng, tiếp tục tiến trình...")
    return False


def set_date_range_and_search(page: Page, start_date: str, end_date: str, exchange: str = "", member_code: str = "", acct_no: str = "", log=print):
    """
    Tối ưu hóa thao tác lọc ngày và lọc cột (Mã thành viên / Mã TKGD) trên bảng MRT của CoreEX & CoreCCP.
    """
    dismiss_modal_backdrop(page)

    # Chuyển tab 'Lịch sử tất toán' nếu đang ở màn hình Trạng thái tất toán
    if "PNL_EXECUTED" in page.url or page.locator("xpath=//*[contains(text(), 'Lịch sử tất toán')]").is_visible(timeout=1000):
        history_tab = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first
        if history_tab.is_visible(timeout=2000):
            log("  [Tab] Click chọn tab 'Lịch sử tất toán'...")
            history_tab.click(force=True)
            page.wait_for_timeout(1500)

    # 1. Nếu có ô 'Ngày hệ thống' (trên màn hình Lịch sử giao dịch DSGD), XÓA SẠCH để chỉ lọc theo Ngày phiên
    sys_date_inp = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Ngày hệ thống')]]//input"
        " | //label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input"
    ).first
    if sys_date_inp.is_visible(timeout=800):
        log("  [Filter] Xóa trắng 'Ngày hệ thống' để lọc chính xác theo '(Từ) Ngày phiên -> (Đến) Ngày phiên'...")
        sys_date_inp.click(force=True)
        page.wait_for_timeout(150)
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.wait_for_timeout(150)
        page.keyboard.press("Tab")

    # 2. Định vị chính xác 2 ô '(Từ) Ngày phiên' và '(Đến) Ngày phiên'
    picker_inputs = page.locator(
        "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input"
        " | //input[contains(@class, 'MuiPickersInputBase-input')]"
    )

    count = picker_inputs.count()
    from_inp = None
    to_inp = None

    from_by_label = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Từ') or contains(text(), '(Từ)')]]//input"
        " | //label[contains(text(), 'Từ') or contains(text(), '(Từ)')]/following-sibling::div//input"
    ).first
    to_by_label = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Đến') or contains(text(), '(Đến)')]]//input"
        " | //label[contains(text(), 'Đến') or contains(text(), '(Đến)')]/following-sibling::div//input"
    ).first

    if from_by_label.is_visible(timeout=800) and to_by_label.is_visible(timeout=800):
        from_inp = from_by_label
        to_inp = to_by_label
    elif count >= 2:
        from_inp = picker_inputs.nth(0)
        to_inp = picker_inputs.nth(1)

    if from_inp and to_inp:
        log(f"  [Filter] Điền ngày phiên: {start_date} -> {end_date}...")
        from_inp.click(force=True)
        page.wait_for_timeout(200)
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.wait_for_timeout(150)
        page.keyboard.type(start_date, delay=40)
        page.wait_for_timeout(200)
        page.keyboard.press("Tab")

        to_inp.click(force=True)
        page.wait_for_timeout(200)
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.wait_for_timeout(150)
        page.keyboard.type(end_date, delay=40)
        page.wait_for_timeout(200)
        page.keyboard.press("Tab")

    # 3. Sàn giao dịch
    if exchange and exchange.strip() and exchange.strip().lower() not in ["tất cả", "all", ""]:
        ex_val = exchange.strip()
        ex_inp = page.locator(
            "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiAutocomplete-root')][.//label[contains(text(), 'Sàn giao dịch')]]//input"
            " | //label[contains(text(), 'Sàn giao dịch')]/following-sibling::div//input"
        ).first

        if ex_inp.is_visible(timeout=1500):
            log(f"  [Filter] Chọn Sàn giao dịch: '{ex_val}'...")
            ex_inp.click(force=True)
            page.wait_for_timeout(200)
            page.keyboard.press("Control+A")
            page.keyboard.press("Backspace")
            page.wait_for_timeout(150)
            page.keyboard.type(ex_val, delay=40)
            page.wait_for_timeout(350)

            option_elem = page.locator(
                f"xpath=//*[self::li or self::div or self::span][@role='option' or contains(@class, 'MuiAutocomplete-option')][text()='{ex_val}']"
                f" | //li[contains(text(), '{ex_val}')]"
            ).first
            if option_elem.is_visible(timeout=1500):
                option_elem.click(force=True)
            else:
                page.keyboard.press("ArrowDown")
                page.keyboard.press("Enter")
            page.wait_for_timeout(300)

    # Click Nút Tìm kiếm
    search_btn = page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first
    if search_btn.is_visible(timeout=2000):
        search_btn.click(force=True)
        log("  ⏳ Đã bấm Tìm kiếm. Đang chờ API & bảng nạp xong dữ liệu...")
        wait_for_table_loading_complete(page, 60000, log=log)
        dismiss_modal_backdrop(page)

    # 4. Điền lọc 'Mã thành viên'
    if member_code and member_code.strip():
        mb_code = member_code.strip()
        wait_for_table_loading_complete(page, 30000, log=log)
        log(f"  [Filter Column] Lọc Mã thành viên: '{mb_code}'...")
        try:
            header_inputs = page.locator("xpath=//thead//th//input")
            if header_inputs.count() == 0:
                toolbar_filter_btn = page.locator(
                    "xpath=//button[contains(@aria-label, 'Ẩn/hiện bộ lọc') or contains(@aria-label, 'bộ lọc') or contains(@aria-label, 'Filter')]"
                ).first
                if toolbar_filter_btn.is_visible(timeout=1000):
                    toolbar_filter_btn.click(force=True)
                    page.wait_for_timeout(800)

            member_inp = page.locator(
                "xpath=//th[@data-column-id='MEMBERCODE' or @data-column-id='MEMBER_CODE']//input"
                " | //th[contains(., 'Mã thành viên')]//input"
            ).first

            if member_inp.count() > 0:
                log(f"  [Filter Column] ✓ Đã mở ô bộ lọc 'Mã thành viên', đang điền '{mb_code}'...")
                member_inp.focus()
                member_inp.fill(mb_code)
                page.wait_for_timeout(300)
                member_inp.press("Enter")
                wait_for_table_loading_complete(page, 30000, log=log)
            else:
                log(f"  ⚠️ Không tìm thấy ô lọc Mã thành viên trên bảng.")
        except Exception as e:
            log(f"  ⚠️ Lỗi khi lọc Mã thành viên '{mb_code}': {e}")

    # 5. Điền lọc 'Mã TKGD / Số tiểu khoản'
    if acct_no and acct_no.strip():
        acc_val = acct_no.strip()
        wait_for_table_loading_complete(page, 30000, log=log)
        log(f"  [Filter Column] Lọc Mã TKGD / Số tiểu khoản: '{acc_val}'...")
        try:
            header_inputs = page.locator("xpath=//thead//th//input")
            if header_inputs.count() == 0:
                toolbar_filter_btn = page.locator(
                    "xpath=//button[contains(@aria-label, 'Ẩn/hiện bộ lọc') or contains(@aria-label, 'bộ lọc') or contains(@aria-label, 'Filter')]"
                ).first
                if toolbar_filter_btn.is_visible(timeout=1000):
                    toolbar_filter_btn.click(force=True)
                    page.wait_for_timeout(800)

            acct_inp = page.locator(
                "xpath=//th[@data-column-id='AFACCTNO' or @data-column-id='ACCTNO_BUY' or @data-column-id='ACCTNO_SELL']//input"
                " | //th[contains(., 'Số tiểu khoản') or contains(., 'Mã TKGD') or contains(., 'Số tài khoản')]//input"
            ).first

            if acct_inp.count() > 0:
                log(f"  [Filter Column] ✓ Đã mở ô bộ lọc 'Mã TKGD / Số tiểu khoản', đang điền '{acc_val}'...")
                acct_inp.focus()
                acct_inp.fill(acc_val)
                page.wait_for_timeout(300)
                acct_inp.press("Enter")
                wait_for_table_loading_complete(page, 30000, log=log)
            else:
                log("  ⚠️ Không tìm thấy ô lọc Mã TKGD / Số tiểu khoản trên bảng.")
        except Exception as e:
            log(f"  ⚠️ Lỗi khi lọc Mã TKGD / Số tiểu khoản '{acc_val}': {e}")


def trigger_export_download(page: Page, headless: bool = False, log=print):
    """
    Thao tác xuất file CSV chuẩn theo đúng chỉ đạo:
    1. Khi chạy ẩn (Headless = True): Bypass ngay nếu phát hiện bảng báo 'Không có dữ liệu' để tối ưu tốc độ tối đa.
    2. Khi mở trình duyệt (Headless = False): Không bypass sớm, thực hiện di chuột (Hover) -> Chọn 'Xuất tất cả' -> Chờ Toast 2 giây cho mắt người theo dõi.
    """
    dismiss_modal_backdrop(page)

    # Khi chạy ẩn trình duyệt (Headless Mode): Bypass ngay khi thấy bảng rỗng để tối ưu tốc độ vận hành ngầm
    if headless:
        no_data_elem = page.locator("xpath=//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0')]").first
        if no_data_elem.is_visible(timeout=800):
            log("  ℹ️ [Headless Fast-Skip] Bảng báo cáo không có dữ liệu -> Bỏ qua nhanh để tối ưu tốc độ.")
            return "NO_DATA"

    # Tìm nút 'Kết xuất'
    export_btn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV')]").first
    if not export_btn.is_visible(timeout=5000):
        log("  ❌ Không tìm thấy nút 'Kết xuất'")
        return None

    download_obj = None

    # --- PHƯƠNG ÁN 1: Di chuột (Hover) không click vào nút Kết xuất ---
    try:
        export_btn.hover(force=True)
        page.wait_for_timeout(400)
    except Exception:
        pass

    export_all_option = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả']").first

    if export_all_option.is_visible(timeout=2000):
        log("  [Export Mode: Hover] Di chuột (Hover) không click nút 'Kết xuất' -> Chọn option 'Xuất tất cả'...")
        try:
            with page.expect_download(timeout=3500) as download_info:
                export_all_option.click(force=True)
                page.wait_for_timeout(400)
                # Kiểm tra nhanh xem Toast 'Không có dữ liệu' có vừa nổ ra không để thoát tức thì trong 0.4s
                toast_elem = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message')][contains(text(), 'dữ liệu') or contains(text(), 'Không')]").first
                if toast_elem.is_visible(timeout=300):
                    toast_text = toast_elem.text_content().strip()
                    if "không có dữ liệu" in toast_text.lower():
                        log(f"  ℹ️ [Toast Notification] {toast_text}")
                        return "NO_DATA"
            download_obj = download_info.value
        except PlaywrightTimeoutError:
            log("  ℹ️ [Thông báo] Không có dữ liệu để xuất (VNCLEAR).")
            download_obj = "NO_DATA"
        except Exception as e:
            log(f"  ⚠️ Lỗi khi chọn 'Xuất tất cả': {e}")
            download_obj = "NO_DATA"
    else:
        # --- PHƯƠNG ÁN 2 (FALLBACK): Kích đúp (Double-click) 2 lần vào nút Kết xuất ---
        log("  [Export Mode: Fallback Double-click] Kích đúp (Double-click) 2 lần vào nút 'Kết xuất'...")
        try:
            with page.expect_download(timeout=3500) as download_info:
                export_btn.dblclick(force=True)
                page.wait_for_timeout(400)
                toast_elem = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message')][contains(text(), 'dữ liệu') or contains(text(), 'Không')]").first
                if toast_elem.is_visible(timeout=300):
                    toast_text = toast_elem.text_content().strip()
                    if "không có dữ liệu" in toast_text.lower():
                        log(f"  ℹ️ [Toast Notification] {toast_text}")
                        return "NO_DATA"
            download_obj = download_info.value
        except PlaywrightTimeoutError:
            log("  ℹ️ [Thông báo] Không có dữ liệu để xuất khi kích đúp.")
            download_obj = "NO_DATA"
        except Exception as e:
            log(f"  ⚠️ Lỗi khi kích đúp nút 'Kết xuất': {e}")
            download_obj = "NO_DATA"

    # --- BẮT VÀ GHI LOG TOAST THÔNG BÁO THÀNH CÔNG VNCLEAR ---
    try:
        toast_elem = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(text(), 'dữ liệu') or contains(text(), 'thành công')]").first
        if toast_elem.is_visible(timeout=500):
            toast_text = toast_elem.text_content().strip()
            log(f"  [Toast Notification] {toast_text}")
    except Exception:
        pass

    dismiss_modal_backdrop(page)
    return download_obj


def download_single_report(page: Page, report_cfg: dict, interval: dict, output_dir: str, system_url: str, headless: bool = False, overwrite_existing: bool = False, exchange: str = "", member_code: str = "", acct_no: str = "", log=print):
    """
    Tải 1 file báo cáo cụ thể theo từng tháng.
    """
    code = report_cfg["code"]
    mmyy = interval["mmyy"]
    start_date = interval["start_str"]
    end_date = interval["end_str"]

    target_folder = os.path.join(output_dir, code)
    os.makedirs(target_folder, exist_ok=True)

    extra_suffix = ""
    if exchange and exchange.strip() and exchange.strip().lower() not in ["tất cả", "all", ""]:
        extra_suffix += f"_{exchange.strip().upper()}"
    if member_code and member_code.strip():
        extra_suffix += f"_TV{member_code.strip()}"
    if acct_no and acct_no.strip():
        extra_suffix += f"_TK{acct_no.strip()}"

    file_name = f"{code}{mmyy}{extra_suffix}.csv"
    dest_path = os.path.join(target_folder, file_name)

    if not overwrite_existing and os.path.exists(dest_path):
        size = os.path.getsize(dest_path)
        if size > 100:
            log(f"  [⏭ Bỏ qua] File {file_name} đã tồn tại & hợp lệ ({size:,} bytes).")
            return True
        else:
            log(f"  ⚠️ File {file_name} bị hỏng/rỗng ({size} bytes). Đang tiến hành tải lại...")
            try:
                os.remove(dest_path)
            except Exception:
                pass
    elif overwrite_existing and os.path.exists(dest_path):
        log(f"  🔄 [Ghi đè] Tiến hành tải mới và ghi đè file {file_name}...")
        try:
            os.remove(dest_path)
        except Exception:
            pass

    log(f"\n  [⏳ Đang tải] {report_cfg['name']} ({code}) | Tháng {mmyy} ({start_date} -> {end_date})...")

    # 1. Điều hướng và tự động bắt URL mới nhất
    learned_url = navigate_to_report_page(page, report_cfg, system_url, log)
    report_cfg["cached_url"] = learned_url

    # 2. Điền Từ ngày -> Đến ngày -> Sàn giao dịch -> Tìm kiếm -> Lọc Mã thành viên & Số tiểu khoản
    set_mui_date_range_and_search(page, start_date, end_date, exchange=exchange, member_code=member_code, acct_no=acct_no, log=log)

    # 3. Thao tác Xuất tất cả CSV và lưu file
    try:
        download_result = trigger_export_download(page, headless=headless, log=log)
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


def launch_browser_resilient(p, headless: bool, log=print):
    """
    Khởi tạo trình duyệt thông minh hỗ trợ 100% chạy PyInstaller Standalone .EXE:
    1. Thử Playwright Chromium chuẩn (Gán PLAYWRIGHT_BROWSERS_PATH về AppData hệ thống).
    2. Fallback 1: Dùng Google Chrome đã cài trên Windows (channel='chrome').
    3. Fallback 2: Dùng Microsoft Edge sẵn có trên Windows (channel='msedge' - 100% máy Windows có sẵn).
    """
    user_appdata_browsers = os.path.expanduser(r"~\AppData\Local\ms-playwright")
    if os.path.exists(user_appdata_browsers) and "PLAYWRIGHT_BROWSERS_PATH" not in os.environ:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = user_appdata_browsers

    # 1. Thử Playwright Chromium chuẩn
    try:
        return p.chromium.launch(headless=headless)
    except Exception as e1:
        log(f"  ℹ️ Playwright Chromium không sẵn có. Đang chuyển sang Google Chrome hệ thống...")

    # 2. Fallback 1: Google Chrome
    try:
        return p.chromium.launch(headless=headless, channel="chrome")
    except Exception as e2:
        log(f"  ℹ️ Google Chrome không sẵn có. Đang chuyển sang Microsoft Edge hệ thống...")

    # 3. Fallback 2: Microsoft Edge (Máy Windows 10/11 luôn sẵn có 100%)
    try:
        return p.chromium.launch(headless=headless, channel="msedge")
    except Exception as e3:
        raise RuntimeError(f"Không thể khởi chạy trình duyệt (Chromium/Chrome/Edge): {e3}")


def run_download(
    system_url: str,
    username: str,
    password: str,
    start_date: str,
    end_date: str,
    output_dir: str,
    selected_reports: list = None,
    headless: bool = False,
    overwrite_existing: bool = False,
    exchange: str = "",
    member_code: str = "",
    acct_no: str = "",
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
        log("🌐 Đang khởi tạo trình duyệt...")
        browser = launch_browser_resilient(p, headless=headless, log=log)
        context = browser.new_context(accept_downloads=True, viewport={"width": 1366, "height": 768})
        page = context.new_page()

        # 1. Đăng nhập
        log(f"🔑 Đăng nhập tài khoản '{username}' vào hệ thống ({system_url})...")
        try:
            page.goto(system_url, wait_until="networkidle", timeout=30000)
            page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", username)
            page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", password)
            page.click("button[type='submit'], button:has-text('Đăng nhập')")
            page.wait_for_load_state("networkidle", timeout=30000)
            page.wait_for_timeout(1000)

            # Kiểm tra xem có bị giữ lại ở trang đăng nhập (sai pass / tài khoản bị khóa) không
            if "/login" in page.url.lower():
                err_msg = page.locator("xpath=//*[contains(@class, 'MuiAlert-message') or contains(text(), 'không chính xác') or contains(text(), 'khóa') or contains(text(), 'Lỗi')]").first
                if err_msg.is_visible(timeout=1500):
                    log(f"❌ Đăng nhập thất bại: {err_msg.text_content().strip()}")
                else:
                    log("❌ Đăng nhập thất bại: Tên đăng nhập hoặc mật khẩu không đúng (vẫn ở trang /login).")
                browser.close()
                return False

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
                download_single_report(page, report, interval, output_dir, system_url, headless=headless, overwrite_existing=overwrite_existing, exchange=exchange, member_code=member_code, acct_no=acct_no, log=log)
                time.sleep(0.5)

        # 4. Lưu lại các URL đã học vào config.json
        cfg["reports"] = reports_to_run
        save_config(cfg)
        log("\n💾 Đã tự động ghi nhớ và lưu cấu hình URL mới nhất vào config.json!")

        browser.close()

    log("\n🎉 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH TẢI BÁO CÁO!")
    return True

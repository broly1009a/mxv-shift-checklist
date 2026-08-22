"""
report_engine.py — Core Business Engine quản lý toàn bộ tiến trình đăng nhập, điều hướng và xuất file báo cáo CPP/CE.
"""

import os
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

try:
    from config.config_manager import load_config, save_config
    from core.browser_factory import launch_browser_resilient
    from core.base_page import BasePage
    from page_objects.core_ccp_page import CoreCCPPage
    from page_objects.core_ex_page import CoreEXPage
    from services.date_service import generate_monthly_intervals, split_interval, merge_csv_files
except ImportError:
    try:
        from config_manager import load_config, save_config
        from browser_factory import launch_browser_resilient
        from base_page import BasePage
        from core_ccp_page import CoreCCPPage
        from core_ex_page import CoreEXPage
        from date_service import generate_monthly_intervals, split_interval, merge_csv_files
    except ImportError:
        from config.config_manager import load_config, save_config
        from core.browser_factory import launch_browser_resilient
        from core.base_page import BasePage
        from page_objects.core_ccp_page import CoreCCPPage
        from page_objects.core_ex_page import CoreEXPage
        from services.date_service import generate_monthly_intervals, split_interval, merge_csv_files


class ReportEngine:
    def __init__(
        self,
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
        download_timeout: int = 120000,
        auto_split_on_timeout: bool = True,
        logger_callback=None
    ):
        self.system_url = system_url
        self.username = username
        self.password = password
        self.start_date = start_date
        self.end_date = end_date
        self.output_dir = output_dir
        self.selected_reports = selected_reports
        self.headless = headless
        self.overwrite_existing = overwrite_existing
        self.exchange = exchange
        self.member_code = member_code
        self.acct_no = acct_no
        self.download_timeout = download_timeout
        self.auto_split_on_timeout = auto_split_on_timeout
        self.logger_callback = logger_callback

    def log(self, msg: str):
        print(msg, flush=True)
        if self.logger_callback:
            self.logger_callback(msg)

    def is_core_ex_system(self) -> bool:
        """Nhận diện hệ thống CoreEX dựa trên URL."""
        return "coreexchange" in self.system_url.lower()

    def get_page_object(self, page: Page) -> BasePage:
        """Khởi tạo Page Object phù hợp cho CoreEX hoặc CoreCCP."""
        if self.is_core_ex_system():
            return CoreEXPage(page, log=self.log)
        else:
            return CoreCCPPage(page, log=self.log)

    def download_single_report_internal(self, page: Page, page_obj: BasePage, report_cfg: dict, interval: dict, dest_path: str) -> bool:
        """Helper tải 1 khoảng ngày cụ thể lưu trực tiếp vào dest_path."""
        start_date = interval["start_str"]
        end_date = interval["end_str"]

        page_obj.navigate_to_report(report_cfg, self.system_url)
        page_obj.set_date_range_and_search(
            start_date,
            end_date,
            exchange=self.exchange,
            member_code=self.member_code,
            acct_no=self.acct_no
        )

        try:
            download_result = page_obj.trigger_export_download(
                headless=self.headless,
                timeout_ms=self.download_timeout
            )

            if download_result == "NO_DATA":
                self.log(f"  ℹ️ Khoảng {start_date} -> {end_date} không có dữ liệu.")
                return True
            elif download_result:
                download_result.save_as(dest_path)
                return os.path.exists(dest_path) and os.path.getsize(dest_path) > 0
        except Exception as e:
            self.log(f"  ⚠️ Lỗi tải khoảng {start_date} -> {end_date}: {e}")
            return False

        return False

    def download_with_adaptive_split(self, page: Page, page_obj: BasePage, report_cfg: dict, interval: dict, depth: int = 1, final_dest_path: str = None) -> bool:
        """
        Safety Net: Tự động chia đôi khoảng ngày bị Timeout đệ quy và hợp nhất file CSV.
        """
        start_date = interval["start_str"]
        end_date = interval["end_str"]
        code = report_cfg["code"]
        target_folder = os.path.join(self.output_dir, code)
        os.makedirs(target_folder, exist_ok=True)

        extra_suffix = ""
        if self.exchange and self.exchange.strip() and self.exchange.strip().lower() not in ["tất cả", "all", ""]:
            extra_suffix += f"_{self.exchange.strip().upper()}"
        if self.member_code and self.member_code.strip():
            extra_suffix += f"_TV{self.member_code.strip()}"
        if self.acct_no and self.acct_no.strip():
            extra_suffix += f"_TK{self.acct_no.strip()}"

        parts = split_interval(start_date, end_date)
        if not parts:
            # Đây là 1 ngày đơn lẻ (Single Day)! Tiến hành vòng lặp thử lại kiên trì với Smart Backoff Delay
            sub_file_name = f"temp_{code}_{start_date.replace('/', '')}_{end_date.replace('/', '')}{extra_suffix}.csv"
            sub_dest_path = os.path.join(target_folder, sub_file_name)

            self.log(f"\n  🔥 [Single Day Persistent Retry] Khoảng ngày {start_date} là 1 ngày đơn lẻ. Kích hoạt thử lại kiên trì với Smart Backoff Delay...")
            max_day_retries = 5
            for attempt in range(1, max_day_retries + 1):
                backoff_sec = min(15 * attempt, 45)
                if attempt > 1:
                    self.log(f"  ⏳ [Thử lại Ngày {start_date} - Lần {attempt}/{max_day_retries}] Tạm nghỉ {backoff_sec}s để Server SQL giải phóng RAM/CPU...")
                    time.sleep(backoff_sec)

                res = self.download_single_report_internal(page, page_obj, report_cfg, interval, sub_dest_path)
                if res and os.path.exists(sub_dest_path) and os.path.getsize(sub_dest_path) > 0:
                    self.log(f"  [🎉 Thành công Ngày {start_date}] Đã lưu file ngày thành công!")
                    return True
                elif res:
                    # Ngày không có dữ liệu
                    return True

            # Ghi vết ngày bị thiếu ra file MISSING_DATES.txt
            missing_log_path = os.path.join(target_folder, "MISSING_DATES.txt")
            try:
                with open(missing_log_path, "a", encoding="utf-8") as f:
                    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Báo cáo {code} | Ngày {start_date}: Thử {max_day_retries} lần bị Server 504 Timeout.\n")
                self.log(f"  ⚠️ [Ghi vết Ngày Thiếu] Đã ghi nhận ngày {start_date} vào file log: {missing_log_path}")
            except Exception:
                pass
            return False

        part1, part2 = parts
        self.log(f"\n  🔥 [Safety Net Level {depth}] Tách khoảng ngày {start_date} -> {end_date} thành 2 nửa:")
        self.log(f"     └─ Nửa 1: {part1['start_str']} -> {part1['end_str']}")
        self.log(f"     └─ Nửa 2: {part2['start_str']} -> {part2['end_str']}")

        s_tag_parent = start_date.replace("/", "")
        e_tag_parent = end_date.replace("/", "")

        if final_dest_path is None:
            if depth == 1:
                final_dest_path = os.path.join(target_folder, f"{code}{interval['mmyy']}{extra_suffix}.csv")
            else:
                final_dest_path = os.path.join(target_folder, f"temp_merged_{code}_{s_tag_parent}_{e_tag_parent}{extra_suffix}.csv")

        sub_files = []
        for idx, sub_interval in enumerate([part1, part2], start=1):
            s_tag = sub_interval["start_str"].replace("/", "")
            e_tag = sub_interval["end_str"].replace("/", "")
            sub_file_name = f"temp_{code}_{s_tag}_{e_tag}{extra_suffix}.csv"
            sub_dest_path = os.path.join(target_folder, sub_file_name)

            self.log(f"\n  [⏳ Safety Net Step {depth}.{idx}] Tải khoảng nhỏ: {sub_interval['start_str']} -> {sub_interval['end_str']}...")
            res = self.download_single_report_internal(page, page_obj, report_cfg, sub_interval, sub_dest_path)

            if not res and depth < 4:
                temp_sub_merged = os.path.join(target_folder, f"temp_merged_{code}_{s_tag}_{e_tag}{extra_suffix}.csv")
                res = self.download_with_adaptive_split(page, page_obj, report_cfg, sub_interval, depth=depth + 1, final_dest_path=temp_sub_merged)
                sub_dest_path = temp_sub_merged

            if os.path.exists(sub_dest_path) and os.path.getsize(sub_dest_path) > 0:
                sub_files.append(sub_dest_path)

        if sub_files:
            self.log(f"\n  🧩 [Safety Net Merge Level {depth}] Đang hợp nhất {len(sub_files)} file nhỏ vào: {final_dest_path}...")
            ok = merge_csv_files(sub_files, final_dest_path)
            if ok:
                size_bytes = os.path.getsize(final_dest_path)
                self.log(f"  [🎉 Thành công Safety Net Level {depth}] Đã hợp nhất file thành công: {final_dest_path} ({size_bytes:,} bytes)")
                return True

        return False

    def download_single_report(self, page: Page, page_obj: BasePage, report_cfg: dict, interval: dict) -> bool:
        """
        Tải 1 file báo cáo cụ thể theo từng tháng với cơ chế Retry & kiểm tra đĩa thực tế.
        """
        code = report_cfg["code"]
        mmyy = interval["mmyy"]
        start_date = interval["start_str"]
        end_date = interval["end_str"]

        target_folder = os.path.join(self.output_dir, code)
        os.makedirs(target_folder, exist_ok=True)

        extra_suffix = ""
        if self.exchange and self.exchange.strip() and self.exchange.strip().lower() not in ["tất cả", "all", ""]:
            extra_suffix += f"_{self.exchange.strip().upper()}"
        if self.member_code and self.member_code.strip():
            extra_suffix += f"_TV{self.member_code.strip()}"
        if self.acct_no and self.acct_no.strip():
            extra_suffix += f"_TK{self.acct_no.strip()}"

        file_name = f"{code}{mmyy}{extra_suffix}.csv"
        dest_path = os.path.join(target_folder, file_name)

        if not self.overwrite_existing and os.path.exists(dest_path):
            size = os.path.getsize(dest_path)
            if size > 100:
                self.log(f"  [⏭ Bỏ qua] File {file_name} đã tồn tại & hợp lệ ({size:,} bytes).")
                return True
            else:
                self.log(f"  ⚠️ File {file_name} bị hỏng/rỗng ({size} bytes). Đang tiến hành tải lại...")
                try:
                    os.remove(dest_path)
                except Exception:
                    pass
        elif self.overwrite_existing and os.path.exists(dest_path):
            self.log(f"  🔄 [Ghi đè] Tiến hành tải mới và ghi đè file {file_name}...")
            try:
                os.remove(dest_path)
            except Exception:
                pass

        self.log(f"\n  [⏳ Đang tải] {report_cfg['name']} ({code}) | Tháng {mmyy} ({start_date} -> {end_date})...")

        # 1. Điều hướng trang báo cáo
        learned_url = page_obj.navigate_to_report(report_cfg, self.system_url)
        report_cfg["cached_url"] = learned_url

        # 2. Lọc thời gian, Mã TV, Số TKGD
        page_obj.set_date_range_and_search(
            start_date,
            end_date,
            exchange=self.exchange,
            member_code=self.member_code,
            acct_no=self.acct_no
        )

        # 3. Kích hoạt kết xuất và lưu file với cơ chế Retry & Tăng dần thời gian chờ (Progressive Timeout)
        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            current_timeout = self.download_timeout * attempt  # Lần 1: 120s, Lần 2: 240s
            if attempt > 1:
                self.log(f"  🔄 [Thử lại lần {attempt}/{max_attempts}] Kích hoạt lại nút xuất file {file_name} (Tăng thời gian chờ lên {current_timeout // 1000}s)...")
                time.sleep(2.0)

            try:
                download_result = page_obj.trigger_export_download(
                    headless=self.headless,
                    timeout_ms=current_timeout
                )

                if download_result == "NO_DATA":
                    self.log(f"  ℹ️ Bỏ qua tạo file {file_name} do hệ thống xác nhận không có dữ liệu.")
                    return True
                elif download_result:
                    download_result.save_as(dest_path)
                    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                        size_bytes = os.path.getsize(dest_path)
                        self.log(f"  [🎉 Thành công] Đã lưu & xác minh file trên đĩa: {dest_path} ({size_bytes:,} bytes)")
                        return True
                    else:
                        self.log(f"  ⚠️ File {file_name} sau khi lưu bị rỗng (0 bytes).")
                else:
                    self.log(f"  ⚠️ Lần {attempt}: Chưa hoàn tất tạo file {file_name} trong {current_timeout // 1000}s.")
            except Exception as e:
                self.log(f"  ⚠️ Lỗi kết xuất file {file_name} (Lần {attempt}): {e}")

        # NẾU TẤT CẢ CÁC LẦN TẢI THƯỜNG BỊ TIMEOUT
        if self.auto_split_on_timeout:
            self.log(f"\n  🔄 [Safety Net] Tải nguyên khoảng {start_date} -> {end_date} bị Timeout -> Kích hoạt tự động chia nhỏ khoảng ngày...")
            return self.download_with_adaptive_split(page, page_obj, report_cfg, interval)
        else:
            self.log(f"\n  🔄 [Persistent Monthly Retry] Tắt chia nhỏ: Kích hoạt thử lại kiên trì nguyên tháng {mmyy} với thời gian chờ gia tăng...")
            max_monthly_retries = 5
            for m_attempt in range(2, max_monthly_retries + 1):
                m_timeout = min(self.download_timeout * m_attempt, 600000)  # Nâng dần lên 300s, 480s, 600s (10 phút)
                self.log(f"  ⏳ [Thử lại Tháng {mmyy} - Lần {m_attempt}/{max_monthly_retries}] Tạm nghỉ 15s, tăng thời gian chờ lên {m_timeout // 1000}s...")
                time.sleep(15)
                try:
                    download_result = page_obj.trigger_export_download(
                        headless=self.headless,
                        timeout_ms=m_timeout
                    )
                    if download_result == "NO_DATA":
                        self.log(f"  ℹ️ Bỏ qua tạo file {file_name} do hệ thống xác nhận không có dữ liệu.")
                        return True
                    elif download_result:
                        download_result.save_as(dest_path)
                        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                            size_bytes = os.path.getsize(dest_path)
                            self.log(f"  [🎉 Thành công Nguyên Tháng] Đã lưu file nguyên tháng thành công: {dest_path} ({size_bytes:,} bytes)")
                            return True
                except Exception as e:
                    self.log(f"  ⚠️ Lần thử {m_attempt} nguyên tháng thất bại: {e}")

            self.log(f"  ❌ Thử {max_monthly_retries} lần nguyên tháng thất bại cho file {file_name}.")
            return False

    def run(self) -> bool:
        """Thực thi toàn bộ tiến trình tải báo cáo."""
        cfg = load_config()

        default_reports = [
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
                "name": "Lịch sử lệnh",
                "parent_menu": "Lệnh và vị thế",
                "child_menu": "Lịch sử lệnh",
                "cached_url": "",
                "enabled": True
            },
            {
                "code": "DSGD",
                "name": "Lịch sử giao dịch",
                "parent_menu": "Lệnh và vị thế",
                "child_menu": "Lịch sử giao dịch",
                "cached_url": "",
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

        reports_to_run = self.selected_reports or cfg.get("reports", default_reports)
        monthly_intervals = generate_monthly_intervals(self.start_date, self.end_date)

        self.log("=" * 65)
        self.log(f"🚀 BẮT ĐẦU TẢI BÁO CÁO CPP/CE (VNCLEAR SYSTEM)")
        self.log(f"• Hệ thống: {self.system_url}")
        self.log(f"• Khoảng thời gian: {self.start_date} -> {self.end_date} ({len(monthly_intervals)} tháng)")
        self.log(f"• Thư mục lưu tổng: {self.output_dir}")
        self.log("=" * 65)

        with sync_playwright() as p:
            self.log("🌐 Đang khởi tạo trình duyệt...")
            browser = launch_browser_resilient(p, headless=self.headless, log=self.log)
            context = browser.new_context(accept_downloads=True, viewport={"width": 1366, "height": 768})
            page = context.new_page()

            page_obj = self.get_page_object(page)

            # 1. Đăng nhập
            self.log(f"🔑 Đăng nhập tài khoản '{self.username}' vào hệ thống ({self.system_url})...")
            try:
                page.goto(self.system_url, wait_until="networkidle", timeout=30000)
                page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", self.username)
                page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", self.password)
                page.click("button[type='submit'], button:has-text('Đăng nhập')")
                page.wait_for_load_state("networkidle", timeout=30000)
                page.wait_for_timeout(1000)

                if "/login" in page.url.lower():
                    err_msg = page.locator("xpath=//*[contains(@class, 'MuiAlert-message') or contains(text(), 'không chính xác') or contains(text(), 'khóa') or contains(text(), 'Lỗi')]").first
                    if err_msg.is_visible(timeout=1500):
                        self.log(f"❌ Đăng nhập thất bại: {err_msg.text_content().strip()}")
                    else:
                        self.log("❌ Đăng nhập thất bại: Tên đăng nhập hoặc mật khẩu không đúng (vẫn ở trang /login).")
                    browser.close()
                    return False

                self.log("✓ Đăng nhập thành công!")
            except Exception as e:
                self.log(f"❌ Lỗi đăng nhập: {e}")
                browser.close()
                return False

            # 2. Mở rộng Sidebar menu nếu chưa mở
            page_obj.ensure_sidebar_expanded()

            # 3. Vòng lặp tải từng loại báo cáo
            for report in reports_to_run:
                if not report.get("enabled", True):
                    continue

                code = report["code"]
                name = report["name"]
                self.log(f"\n📂 >>> BÁO CÁO: {name.upper()} ({code}) <<<")

                for interval in monthly_intervals:
                    self.download_single_report(page, page_obj, report, interval)
                    time.sleep(0.5)

            # 4. Lưu lại các URL đã học vào config.json
            cfg["reports"] = reports_to_run
            save_config(cfg)
            self.log("\n💾 Đã tự động ghi nhớ và lưu cấu hình URL mới nhất vào config.json!")

            browser.close()

        self.log("\n🎉 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH TẢI BÁO CÁO!")
        return True


def run_download(*args, **kwargs) -> bool:
    """Wrapper tương thích ngược nhận các tham số cũ và khởi chạy ReportEngine."""
    engine = ReportEngine(*args, **kwargs)
    return engine.run()

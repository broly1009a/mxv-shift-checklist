"""
base_report_page.py — Page Object Lớp cha chứa các thao tác lọc ngày, bộ lọc cột MRT và xuất file CSV.
"""

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from core.base_page import BasePage


class BaseReportPage(BasePage):
    def wait_for_table_loading_complete(self, max_timeout_ms: int = 60000) -> bool:
        """
        Chờ bảng hoàn tất nạp dữ liệu từ Server.
        Tối ưu hóa: Sử dụng chu kỳ kiểm tra ngắn (300ms) để giảm thời gian chờ của stable check,
        đồng thời duy trì initial sleep vừa đủ (800ms) để tránh nhận diện nhầm dữ liệu cũ.
        """
        import time
        self.log("  ⏳ Đang kiểm tra & chờ bảng hoàn tất nạp dữ liệu từ Server...")
        start_time = time.time()
        max_sec = max_timeout_ms / 1000.0

        # Cho 800ms ban đầu để React update state và kích hoạt spinner
        self.page.wait_for_timeout(800)

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
            spinners = self.page.locator(spinner_selector).all()
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
                    self.log("  ✓ [SUCCESS] Bảng đã hoàn tất nạp dữ liệu (0 loading spinner, 0 backdrop)!")
                    self.page.wait_for_timeout(200)
                    return True
            else:
                stable_count = 0
                self.log(f"  ⏳ Phát hiện {len(visible_spinners)} loading spinner đang hoạt động... Đang chờ...")

            self.page.wait_for_timeout(300) # Kiểm tra liên tục mỗi 300ms thay vì 1000ms để tối ưu tốc độ phản hồi

        self.log("  ⚠️ Quá thời gian chờ loading bảng, tiếp tục tiến trình...")
        return False

    def set_date_range_and_search(self, start_date: str, end_date: str, exchange: str = "", member_code: str = "", acct_no: str = ""):
        """
        Điền khoảng thời gian cho MUI DatePicker, lọc Mã thành viên & Mã TKGD / Số tiểu khoản (nếu có) và bấm nút Tìm kiếm.
        """
        self.dismiss_modal_backdrop()

        # Chuyển tab 'Lịch sử tất toán' nếu đang ở màn hình Trạng thái tất toán
        if "PNL_EXECUTED" in self.page.url or self.page.locator("xpath=//*[contains(text(), 'Lịch sử tất toán')]").is_visible(timeout=1000):
            history_tab = self.page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first
            if history_tab.is_visible(timeout=2000):
                self.log("  [Tab] Click chọn tab 'Lịch sử tất toán'...")
                history_tab.click(force=True)
                self.page.wait_for_timeout(1500)

        # 1. Nếu có ô 'Ngày hệ thống' (trên màn hình Lịch sử giao dịch DSGD), XÓA SẠCH để chỉ lọc theo Ngày phiên
        sys_date_inp = self.page.locator(
            "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Ngày hệ thống')]]//input"
            " | //label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input"
        ).first
        if sys_date_inp.is_visible(timeout=800):
            self.log("  [Filter] Xóa trắng 'Ngày hệ thống' để lọc chính xác theo '(Từ) Ngày phiên -> (Đến) Ngày phiên'...")
            sys_date_inp.click(force=True)
            self.page.wait_for_timeout(150)
            self.page.keyboard.press("Control+A")
            self.page.keyboard.press("Backspace")
            self.page.wait_for_timeout(150)
            self.page.keyboard.press("Tab")

        # 2. Định vị chính xác 2 ô '(Từ) Ngày phiên' và '(Đến) Ngày phiên' (hoặc Từ ngày / Đến ngày)
        picker_inputs = self.page.locator(
            "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input"
            " | //input[contains(@class, 'MuiPickersInputBase-input')]"
        )

        count = picker_inputs.count()
        from_inp = None
        to_inp = None

        from_by_label = self.page.locator(
            "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Từ') or contains(text(), '(Từ)')]]//input"
            " | //label[contains(text(), 'Từ') or contains(text(), '(Từ)')]/following-sibling::div//input"
        ).first
        to_by_label = self.page.locator(
            "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Đến') or contains(text(), '(Đến)')]]//input"
            " | //label[contains(text(), 'Đến') or contains(text(), '(Đến)')]/following-sibling::div//input"
        ).first

        if from_by_label.is_visible(timeout=800):
            from_inp = from_by_label
        if to_by_label.is_visible(timeout=800):
            to_inp = to_by_label

        if count >= 3:
            if not from_inp:
                from_inp = picker_inputs.nth(1)
            if not to_inp:
                to_inp = picker_inputs.nth(2)
        elif count == 2:
            if not from_inp:
                from_inp = picker_inputs.nth(0)
            if not to_inp:
                to_inp = picker_inputs.nth(1)

        if from_inp and to_inp:
            self.log(f"  [Filter] Điền (Từ) Ngày phiên {start_date} và (Đến) Ngày phiên {end_date}...")

            from_inp.click(force=True)
            self.page.wait_for_timeout(200)
            self.page.keyboard.press("Control+A")
            self.page.keyboard.press("Backspace")
            self.page.wait_for_timeout(150)
            self.page.keyboard.type(start_date, delay=40)
            self.page.wait_for_timeout(200)
            self.page.keyboard.press("Tab")

            to_inp.click(force=True)
            self.page.wait_for_timeout(200)
            self.page.keyboard.press("Control+A")
            self.page.keyboard.press("Backspace")
            self.page.wait_for_timeout(150)
            self.page.keyboard.type(end_date, delay=40)
            self.page.wait_for_timeout(200)
            self.page.keyboard.press("Tab")

        # 3. Sàn giao dịch (Tạm thời bỏ qua nếu không dùng)
        if exchange and exchange.strip() and exchange.strip().lower() not in ["tất cả", "all", ""]:
            ex_val = exchange.strip()
            ex_inp = self.page.locator(
                "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiAutocomplete-root')][.//label[contains(text(), 'Sàn giao dịch')]]//input"
                " | //label[contains(text(), 'Sàn giao dịch')]/following-sibling::div//input"
            ).first

            if ex_inp.is_visible(timeout=1500):
                self.log(f"  [Filter] Chọn Sàn giao dịch: '{ex_val}'...")
                ex_inp.click(force=True)
                self.page.wait_for_timeout(200)
                self.page.keyboard.press("Control+A")
                self.page.keyboard.press("Backspace")
                self.page.wait_for_timeout(150)
                self.page.keyboard.type(ex_val, delay=40)
                self.page.wait_for_timeout(350)

                option_elem = self.page.locator(
                    f"xpath=//*[self::li or self::div or self::span][@role='option' or contains(@class, 'MuiAutocomplete-option')][text()='{ex_val}']"
                    f" | //li[contains(text(), '{ex_val}')]"
                ).first
                if option_elem.is_visible(timeout=1500):
                    option_elem.click(force=True)
                else:
                    self.page.keyboard.press("ArrowDown")
                    self.page.keyboard.press("Enter")
                self.page.wait_for_timeout(300)

        # Click Nút Tìm kiếm
        search_btn = self.page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first
        if search_btn.is_visible(timeout=2000):
            search_btn.click(force=True)
            self.log("  ⏳ Đã bấm Tìm kiếm. Đang chờ API & bảng nạp xong dữ liệu...")
            self.wait_for_table_loading_complete(60000)
            self.dismiss_modal_backdrop()

        # 4. Điền lọc 'Mã thành viên' (Ví dụ: 711) ở cột bộ lọc trong bảng Material React Table
        if member_code and member_code.strip():
            mb_code = member_code.strip()
            self.wait_for_table_loading_complete(30000)
            self.log(f"  [Filter Column] Lọc Mã thành viên: '{mb_code}'...")
            try:
                # Kiểm tra xem hàng bộ lọc đã hiển thị ô input nào chưa
                header_inputs = self.page.locator("xpath=//thead//th//input")
                if header_inputs.count() == 0:
                    toolbar_filter_btn = self.page.locator(
                        "xpath=//button[contains(@aria-label, 'Ẩn/hiện bộ lọc') or contains(@aria-label, 'bộ lọc') or contains(@aria-label, 'Filter')]"
                    ).first
                    if toolbar_filter_btn.is_visible(timeout=1000):
                        self.log("  [Filter Column] Click nút 'Ẩn/hiện bộ lọc' trên thanh công cụ bảng...")
                        toolbar_filter_btn.click(force=True)
                        self.page.wait_for_timeout(800)

                member_inp = self.page.locator(
                    "xpath=//th[@data-column-id='MEMBERCODE' or @data-column-id='MEMBER_CODE']//input"
                    " | //th[contains(., 'Mã thành viên')]//input"
                ).first

                th_member = self.page.locator("xpath=//th[@data-column-id='MEMBERCODE' or @data-column-id='MEMBER_CODE'] | //th[contains(., 'Mã thành viên')]").first
                if th_member.count() > 0:
                    try:
                        th_member.scroll_into_view_if_needed(timeout=1000)
                    except Exception:
                        self.page.evaluate("""() => {
                            const containers = document.querySelectorAll('.MuiTableContainer-root, div[class*="TableContainer"]');
                            containers.forEach(c => c.scrollLeft = 10000);
                        }""")
                        self.page.wait_for_timeout(300)

                if member_inp.count() > 0:
                    self.log(f"  [Filter Column] ✓ Đã tìm thấy ô bộ lọc 'Mã thành viên', đang điền '{mb_code}'...")
                    member_inp.focus()
                    member_inp.fill(mb_code)
                    self.page.wait_for_timeout(300)
                    member_inp.press("Enter")
                    self.wait_for_table_loading_complete(30000)
                else:
                    self.log("  ⚠️ Không tìm thấy ô lọc Mã thành viên trên bảng.")
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi lọc Mã thành viên '{mb_code}': {e}")

        # 5. Điền lọc 'Mã TKGD / Số tiểu khoản' (Ví dụ: 001C123456 hoặc 001C123456-M) ở cột bộ lọc trong bảng
        if acct_no and acct_no.strip():
            acc_val = acct_no.strip()
            self.wait_for_table_loading_complete(30000)
            self.log(f"  [Filter Column] Lọc Mã TKGD / Số tiểu khoản: '{acc_val}'...")
            try:
                # Kiểm tra xem hàng bộ lọc đã hiển thị ô input nào chưa
                header_inputs = self.page.locator("xpath=//thead//th//input")
                if header_inputs.count() == 0:
                    toolbar_filter_btn = self.page.locator(
                        "xpath=//button[contains(@aria-label, 'Ẩn/hiện bộ lọc') or contains(@aria-label, 'bộ lọc') or contains(@aria-label, 'Filter')]"
                    ).first
                    if toolbar_filter_btn.is_visible(timeout=1000):
                        self.log("  [Filter Column] Click nút 'Ẩn/hiện bộ lọc' trên thanh công cụ bảng...")
                        toolbar_filter_btn.click(force=True)
                        self.page.wait_for_timeout(800)

                acct_inp = self.page.locator(
                    "xpath=//th[@data-column-id='AFACCTNO' or @data-column-id='ACCTNO_BUY' or @data-column-id='ACCTNO_SELL']//input"
                    " | //th[contains(., 'Số tiểu khoản') or contains(., 'Mã TKGD') or contains(., 'Số tài khoản')]//input"
                ).first

                th_acct = self.page.locator(
                    "xpath=//th[@data-column-id='AFACCTNO' or @data-column-id='ACCTNO_BUY' or @data-column-id='ACCTNO_SELL']"
                    " | //th[contains(., 'Số tiểu khoản') or contains(., 'Mã TKGD') or contains(., 'Số tài khoản')]"
                ).first

                if th_acct.count() > 0:
                    try:
                        th_acct.scroll_into_view_if_needed(timeout=1000)
                    except Exception:
                        pass

                if acct_inp.count() > 0:
                    self.log(f"  [Filter Column] ✓ Đã tìm thấy ô bộ lọc 'Mã TKGD / Số tiểu khoản', đang điền '{acc_val}'...")
                    acct_inp.focus()
                    acct_inp.fill(acc_val)
                    self.page.wait_for_timeout(300)
                    acct_inp.press("Enter")
                    self.wait_for_table_loading_complete(30000)
                else:
                    self.log("  ⚠️ Không tìm thấy ô lọc Mã TKGD / Số tiểu khoản trên bảng.")
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi lọc Mã TKGD / Số tiểu khoản '{acc_val}': {e}")

    def trigger_export_download(self, headless: bool = False, timeout_ms: int = 30000):
        """
        Thao tác xuất file CSV chuẩn:
        1. Kiểm tra nhanh nếu bảng báo 'Không có dữ liệu' (fast-skip).
        2. Di chuột (Hover) -> Chọn 'Xuất tất cả' (hoặc Double Click nút Kết xuất).
        3. Kiểm tra Toast:
           - Nếu Toast báo 'Không có dữ liệu' -> trả về 'NO_DATA'.
           - Nếu Toast báo thành công / đang xử lý -> kiên nhẫn chờ event download từ browser trong timeout_ms (mặc định 30s).
        4. Phân biệt Timeout thực sự do API latency với trường hợp Không có dữ liệu.
        """
        self.dismiss_modal_backdrop()
        self.wait_for_table_loading_complete(30000)

        # Fast-Skip khi phát hiện bảng báo không có dữ liệu
        no_data_elem = self.page.locator(
            "xpath=//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]"
        ).first
        if no_data_elem.is_visible(timeout=800):
            self.log("  ℹ️ [Fast-Skip] Bảng báo cáo không có dữ liệu -> Bỏ qua nhanh.")
            return "NO_DATA"

        # Tìm nút 'Kết xuất'
        export_btn = self.page.locator(
            "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]"
            " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]"
        ).first

        if not export_btn.is_visible(timeout=2000):
            export_btn = self.page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first

        if not export_btn.is_visible(timeout=5000):
            self.log("  ❌ Không tìm thấy nút 'Kết xuất'")
            return None

        download_obj = None

        def check_no_data_toast():
            """Helper kiểm tra nhanh Toast thông báo không có dữ liệu."""
            try:
                toast_elem = self.page.locator(
                    "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message')][contains(text(), 'dữ liệu') or contains(text(), 'Không') or contains(text(), 'thành công') or contains(text(), 'Thành công')]"
                ).first
                if toast_elem.is_visible(timeout=400):
                    toast_text = toast_elem.text_content().strip()
                    self.log(f"  [Toast Notification] {toast_text}")
                    if "không có dữ liệu" in toast_text.lower() or "no data" in toast_text.lower():
                        return "NO_DATA"
            except Exception:
                pass
            return None

        # --- PHƯƠNG ÁN 1: Di chuột (Hover) không click vào nút Kết xuất ---
        try:
            export_btn.hover(force=True)
            self.page.wait_for_timeout(400)
        except Exception:
            pass

        export_all_option = self.page.locator(
            "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả']"
            " | //*[self::li or self::div or self::span or self::p][contains(text(), 'Export all')]"
        ).first

        if export_all_option.is_visible(timeout=2000):
            self.log(f"  [Export Mode: Hover] Chọn 'Xuất tất cả' (Chờ download tối đa {timeout_ms/1000:.0f}s cho API)...")
            try:
                with self.page.expect_download(timeout=timeout_ms) as download_info:
                    export_all_option.click(force=True)
                    self.page.wait_for_timeout(300)
                    toast_res = check_no_data_toast()
                    if toast_res == "NO_DATA":
                        return "NO_DATA"
                download_obj = download_info.value
            except PlaywrightTimeoutError:
                # Kiểm tra lại xem có Toast không có dữ liệu nổ muộn không
                if check_no_data_toast() == "NO_DATA":
                    return "NO_DATA"
                self.log(f"  ⚠️ [Timeout {timeout_ms/1000:.0f}s] API/Server phản hồi quá chậm, chưa kích hoạt luồng tải file trong {timeout_ms/1000:.0f}s.")
                download_obj = None
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi chọn 'Xuất tất cả': {e}")
                download_obj = None
        else:
            # --- PHƯƠNG ÁN 2 (FALLBACK): Kích đúp (Double-click) 2 lần vào nút Kết xuất ---
            self.log(f"  [Export Mode: Fallback Double-click] Kích đúp nút 'Kết xuất' (Chờ download tối đa {timeout_ms/1000:.0f}s)...")
            try:
                with self.page.expect_download(timeout=timeout_ms) as download_info:
                    export_btn.dblclick(force=True)
                    self.page.wait_for_timeout(300)
                    toast_res = check_no_data_toast()
                    if toast_res == "NO_DATA":
                        return "NO_DATA"
                download_obj = download_info.value
            except PlaywrightTimeoutError:
                if check_no_data_toast() == "NO_DATA":
                    return "NO_DATA"
                self.log(f"  ⚠️ [Timeout {timeout_ms/1000:.0f}s] Quá thời gian chờ tải file khi kích đúp.")
                download_obj = None
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi kích đúp nút 'Kết xuất': {e}")
                download_obj = None

        self.capture_toast_notification()
        self.dismiss_modal_backdrop()
        return download_obj

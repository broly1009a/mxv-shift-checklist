"""
base_report_page.py — Page Object Lớp cha chứa các thao tác lọc ngày, bộ lọc cột MRT và xuất file CSV.
"""

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from core.base_page import BasePage


class BaseReportPage(BasePage):
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
            self.page.wait_for_timeout(2500)

        # 4. Điền lọc 'Mã thành viên' (Ví dụ: 711) ở cột bộ lọc trong bảng Material React Table
        if member_code and member_code.strip():
            mb_code = member_code.strip()
            self.log(f"  [Filter Column] Lọc Mã thành viên: '{mb_code}'...")
            try:
                member_inp = self.page.locator(
                    "xpath=//th[@data-column-id='MEMBERCODE' or @data-column-id='MEMBER_CODE']//input"
                    " | //th[contains(., 'Mã thành viên')]//input"
                ).first

                if member_inp.count() == 0:
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
                    member_inp.click(force=True)
                    self.page.wait_for_timeout(150)
                    self.page.keyboard.press("Control+A")
                    self.page.keyboard.press("Backspace")
                    self.page.wait_for_timeout(150)
                    self.page.keyboard.type(mb_code, delay=40)
                    self.page.wait_for_timeout(200)
                    self.page.keyboard.press("Enter")
                    self.page.wait_for_timeout(1500)
                else:
                    self.log("  ⚠️ Không tìm thấy ô lọc Mã thành viên trên bảng.")
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi lọc Mã thành viên '{mb_code}': {e}")

        # 5. Điền lọc 'Mã TKGD / Số tiểu khoản' (Ví dụ: 001C123456) ở cột bộ lọc trong bảng
        if acct_no and acct_no.strip():
            acc_val = acct_no.strip()
            self.log(f"  [Filter Column] Lọc Mã TKGD / Số tiểu khoản: '{acc_val}'...")
            try:
                acct_inp = self.page.locator(
                    "xpath=//th[@data-column-id='AFACCTNO' or @data-column-id='ACCTNO_BUY' or @data-column-id='ACCTNO_SELL']//input"
                    " | //th[contains(., 'Số tiểu khoản') or contains(., 'Mã TKGD') or contains(., 'Số tài khoản')]//input"
                ).first

                if acct_inp.count() == 0:
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
                    acct_inp.click(force=True)
                    self.page.wait_for_timeout(150)
                    self.page.keyboard.press("Control+A")
                    self.page.keyboard.press("Backspace")
                    self.page.wait_for_timeout(150)
                    self.page.keyboard.type(acc_val, delay=40)
                    self.page.wait_for_timeout(200)
                    self.page.keyboard.press("Enter")
                    self.page.wait_for_timeout(1500)
                else:
                    self.log("  ⚠️ Không tìm thấy ô lọc Mã TKGD / Số tiểu khoản trên bảng.")
            except Exception as e:
                self.log(f"  ⚠️ Lỗi khi lọc Mã TKGD / Số tiểu khoản '{acc_val}': {e}")

    def trigger_export_download(self, headless: bool = False):
        """
        Thao tác xuất file CSV chuẩn và trả về download_obj.
        """
        self.dismiss_modal_backdrop()

        empty_table = self.page.locator("xpath=//*[contains(text(), 'Không có dữ liệu') or contains(text(), 'No data') or contains(text(), 'No records')]").first
        if empty_table.is_visible(timeout=1000):
            self.log("  ℹ️ Bảng không có dữ liệu cho khoảng thời gian này.")
            return "NO_DATA"

        export_btn = self.page.locator(
            "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel') or contains(., 'Export')]"
            " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]"
        ).first

        if not export_btn.is_visible(timeout=2000):
            export_btn = self.page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first

        if not export_btn.is_visible(timeout=2000):
            self.log("  ❌ Không tìm thấy nút Kết xuất/Export trên trang.")
            return None

        with self.page.expect_download(timeout=15000) as download_info:
            try:
                self.log("  [Export Mode: Hover] Di chuột (Hover) không click nút 'Kết xuất' -> Chọn option 'Xuất tất cả'...")
                export_btn.hover()
                self.page.wait_for_timeout(400)

                export_all_opt = self.page.locator(
                    "xpath=//*[self::li or self::div or self::span or self::p][contains(text(), 'Xuất tất cả') or contains(text(), 'Export all')]"
                ).first

                if export_all_opt.is_visible(timeout=1500):
                    export_all_opt.click(force=True)
                else:
                    export_btn.click(force=True)
            except Exception:
                self.log("  [Export Mode: Direct Click] Click trực tiếp nút Kết xuất...")
                export_btn.click(force=True)

        download_obj = download_info.value

        self.capture_toast_notification()
        self.dismiss_modal_backdrop()
        return download_obj

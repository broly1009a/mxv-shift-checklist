"""
core_ex_page.py — Page Object định vị và điều hướng riêng cho hệ thống CoreEX (uat-coreexchange.mxv.com.vn).
"""

from urllib.parse import urlparse
from page_objects.base_report_page import BaseReportPage


class CoreEXPage(BaseReportPage):
    def navigate_to_report(self, report_cfg: dict, system_url: str) -> str:
        """
        Điều hướng đến trang báo cáo CoreEX (Lịch sử lệnh & Lịch sử giao dịch).
        """
        code = report_cfg["code"]
        parsed = urlparse(system_url)
        domain = f"{parsed.scheme}://{parsed.netloc}"

        # Mapping URL chuẩn cho CoreEX
        target_url = ""
        parent_menu_name = "Quản lý sổ lệnh"
        child_menu_name = ""

        if code == "DSL":
            target_url = f"{domain}/ORDERS/ORDERBOOK_ALL"
            child_menu_name = "Lịch sử lệnh"
        elif code == "DSGD":
            target_url = f"{domain}/ORDERS/ORDERMATCH_ALL"
            child_menu_name = "Lịch sử giao dịch"

        if target_url:
            self.log(f"  [CoreEX Routing] Chuyển đến trang {child_menu_name} ({target_url})...")
            try:
                self.page.goto(target_url, wait_until="networkidle", timeout=15000)
                self.page.wait_for_timeout(1000)
                return target_url
            except Exception:
                self.log("  ⚠️ Chuyển URL trực tiếp không thành công, thử qua Sidebar Menu...")

        self.ensure_sidebar_expanded()

        # Click Sidebar menu Quản lý sổ lệnh -> Lịch sử lệnh / Lịch sử giao dịch
        p_elem = self.page.locator(f"xpath=//*[self::div or self::button or self::span][contains(text(), '{parent_menu_name}')]").first
        if p_elem.is_visible(timeout=2000):
            p_elem.click(force=True)
            self.page.wait_for_timeout(400)

        if child_menu_name:
            c_elem = self.page.locator(f"xpath=//*[self::div or self::button or self::a or self::span][contains(text(), '{child_menu_name}')]").first
            if c_elem.is_visible(timeout=2000):
                c_elem.click(force=True)
                self.page.wait_for_load_state("networkidle", timeout=15000)
                self.page.wait_for_timeout(1000)

        learned_url = self.page.url
        return learned_url

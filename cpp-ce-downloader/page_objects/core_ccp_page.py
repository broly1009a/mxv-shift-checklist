"""
core_ccp_page.py — Page Object định vị và điều hướng riêng cho hệ thống CoreCCP (uat-coreccp.mxv.com.vn).
"""

from page_objects.base_report_page import BaseReportPage


class CoreCCPPage(BaseReportPage):
    def navigate_to_report(self, report_cfg: dict, system_url: str) -> str:
        """
        Điều hướng đến trang báo cáo CoreCCP:
        1. Thử URL cached trong report_cfg.
        2. Nếu thất bại, mở sidebar và click theo menu path.
        """
        cached_url = report_cfg.get("cached_url", "")
        if cached_url and self.page.url.startswith(cached_url.split("#")[0]):
            self.log(f"  [URL Cached] Đã truy cập thẳng: {cached_url}")
            try:
                self.page.goto(cached_url, wait_until="networkidle", timeout=15000)
                self.page.wait_for_timeout(1000)
                return cached_url
            except Exception:
                self.log("  ⚠️ URL cached không phản hồi, chuyển sang điều hướng Menu...")

        self.ensure_sidebar_expanded()

        # Click theo Menu path
        parent = report_cfg.get("parent_menu", "")
        sub = report_cfg.get("sub_menu", "")
        child = report_cfg.get("child_menu", "")

        if parent:
            p_elem = self.page.locator(f"xpath=//*[self::div or self::button or self::span][contains(text(), '{parent}')]").first
            if p_elem.is_visible(timeout=2000):
                p_elem.click(force=True)
                self.page.wait_for_timeout(400)

        if sub:
            s_elem = self.page.locator(f"xpath=//*[self::div or self::button or self::span][contains(text(), '{sub}')]").first
            if s_elem.is_visible(timeout=2000):
                s_elem.click(force=True)
                self.page.wait_for_timeout(400)

        if child:
            c_elem = self.page.locator(f"xpath=//*[self::div or self::button or self::a or self::span][contains(text(), '{child}')]").first
            if c_elem.is_visible(timeout=2000):
                c_elem.click(force=True)
                self.page.wait_for_load_state("networkidle", timeout=15000)
                self.page.wait_for_timeout(1000)

        learned_url = self.page.url
        self.log(f"  ✓ Đã mở trang báo cáo qua menu. URL hiện tại: {learned_url}")
        return learned_url

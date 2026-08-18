"""
core_ccp_page.py — Page Object định vị và điều hướng riêng cho hệ thống CoreCCP (uat-coreccp.mxv.com.vn).
"""

from page_objects.base_report_page import BaseReportPage


class CoreCCPPage(BaseReportPage):
    def navigate_to_report(self, report_cfg: dict, system_url: str) -> str:
        """
        Điều hướng đến trang báo cáo CoreCCP:
        1. Thử URL cached trong report_cfg bằng page.goto(cached_url).
        2. Nếu không có cached_url hoặc goto bị lỗi, mở sidebar và click menu.
        """
        cached_url = report_cfg.get("cached_url", "")
        if cached_url:
            try:
                self.log(f"  [Direct Nav] Mở thẳng trang báo cáo: {cached_url}")
                self.page.goto(cached_url, wait_until="networkidle", timeout=15000)
                self.page.wait_for_timeout(1000)
                self.dismiss_modal_backdrop()
                
                # Kiểm tra xem các ô điều khiển báo cáo có thực sự xuất hiện không
                if self.page.locator("xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]").first.is_visible(timeout=3000):
                    return cached_url
                else:
                    self.log("  ⚠️ Mở URL trực tiếp chưa tải xong bảng báo cáo, chuyển sang click Menu...")
            except Exception as e:
                self.log(f"  ⚠️ URL cached không phản hồi ({e}), chuyển sang điều hướng Menu...")

        self.ensure_sidebar_expanded()

        parent = report_cfg.get("parent_menu", "")
        sub = report_cfg.get("sub_menu", "")
        child_menu = report_cfg.get("child_menu", "")

        try:
            if parent:
                p_elem = self.page.locator(
                    f"xpath=//div[contains(@class, 'MuiListItemButton-root') or contains(@class, 'MuiButtonBase-root')][.//span[contains(text(), '{parent}')] or .//div[contains(text(), '{parent}')]]"
                    f" | //*[self::div or self::button or self::span][contains(text(), '{parent}')]"
                ).first
                if p_elem.is_visible(timeout=2000):
                    p_elem.click(force=True)
                    self.page.wait_for_timeout(400)

            if sub:
                s_elem = self.page.locator(
                    f"xpath=//div[contains(@class, 'MuiListItemButton-root') or contains(@class, 'MuiButtonBase-root')][.//span[contains(text(), '{sub}')] or .//div[contains(text(), '{sub}')]]"
                    f" | //*[self::div or self::button or self::span][contains(text(), '{sub}')]"
                ).first
                if s_elem.is_visible(timeout=2000):
                    s_elem.click(force=True)
                    self.page.wait_for_timeout(400)

            child_candidates = [child_menu]
            if child_menu in ["Lịch sử lệnh", "Danh sách lệnh"]:
                child_candidates = ["Danh sách lệnh", "Lịch sử lệnh"]
            elif child_menu in ["Lịch sử giao dịch", "Danh sách giao dịch"]:
                child_candidates = ["Danh sách giao dịch", "Lịch sử giao dịch"]

            for cand in child_candidates:
                if not cand:
                    continue
                c_elem = self.page.locator(
                    f"xpath=//a[contains(@href, '/')]//span[contains(text(), '{cand}')]"
                    f" | //div[contains(@class, 'MuiListItemButton-root')][.//span[contains(text(), '{cand}')]]"
                    f" | //*[self::div or self::button or self::a or self::span][contains(text(), '{cand}')]"
                ).first
                if c_elem.is_visible(timeout=2000):
                    c_elem.click(force=True)
                    self.page.wait_for_load_state("networkidle", timeout=15000)
                    self.page.wait_for_timeout(1000)
                    break
        except Exception as ex:
            self.log(f"  ⚠️ Lỗi click menu: {ex}")

        learned_url = self.page.url
        self.log(f"  ✓ URL hiện tại: {learned_url}")
        return learned_url

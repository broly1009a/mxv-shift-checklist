"""
core_ccp_page.py — Page Object định vị và điều hướng riêng cho hệ thống CoreCCP (uat-coreccp.mxv.com.vn).
"""

try:
    from page_objects.base_report_page import BaseReportPage
except ImportError:
    try:
        from .base_report_page import BaseReportPage
    except ImportError:
        from base_report_page import BaseReportPage


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

        parent_menu = report_cfg.get("parent_menu", "")
        sub_menu = report_cfg.get("sub_menu", "")
        child_menu = report_cfg.get("child_menu", "")

        parent_candidates = [parent_menu]
        if parent_menu in ["Quản lý tiền", "Nộp rút tiền"]:
            parent_candidates = ["Quản lý tiền", "Nộp rút tiền"]

        try:
            parent_elem = None
            for p_cand in parent_candidates:
                if not p_cand:
                    continue
                parent_xpath = f"xpath=//span[text()='{p_cand}'] | //span[contains(text(), '{p_cand}')]"
                elem = self.page.locator(parent_xpath).first
                if elem.is_visible(timeout=1500):
                    parent_elem = elem
                    break

            if parent_elem:
                parent_elem.click(force=True)
                self.page.wait_for_timeout(800)

            if sub_menu:
                sub_xpath = f"xpath=//span[text()='{sub_menu}'] | //span[contains(text(), '{sub_menu}')]"
                sub_elem = self.page.locator(sub_xpath).first
                if sub_elem.is_visible(timeout=3000):
                    sub_elem.click(force=True)
                    self.page.wait_for_timeout(800)

            child_candidates = [child_menu]
            if child_menu in ["Lịch sử nộp rút tiền", "Lịch sử Nộp/ Rút tiền"]:
                child_candidates = ["Lịch sử nộp rút tiền", "Lịch sử Nộp/ Rút tiền"]
            elif child_menu in ["Lịch sử lệnh", "Danh sách lệnh"]:
                child_candidates = ["Lịch sử lệnh", "Danh sách lệnh"]
            elif child_menu in ["Lịch sử giao dịch", "Danh sách giao dịch"]:
                child_candidates = ["Lịch sử giao dịch", "Danh sách giao dịch"]

            child_elem = None
            for cand in child_candidates:
                if not cand:
                    continue
                cand_xpath = f"xpath=//span[text()='{cand}'] | //span[contains(text(), '{cand}')]"
                cand_elem = self.page.locator(cand_xpath).first
                if cand_elem.is_visible(timeout=1500):
                    child_elem = cand_elem
                    break

            if child_elem:
                child_elem.click(force=True)
                self.page.wait_for_timeout(2000)
            elif parent_elem:
                parent_elem.click(force=True)
                self.page.wait_for_timeout(800)
                for cand in child_candidates:
                    if not cand:
                        continue
                    cand_xpath = f"xpath=//span[text()='{cand}'] | //span[contains(text(), '{cand}')]"
                    cand_elem = self.page.locator(cand_xpath).first
                    if cand_elem.is_visible(timeout=1500):
                        cand_elem.click(force=True)
                        self.page.wait_for_timeout(2000)
                        break
        except Exception as ex:
            self.log(f"  ⚠️ Lỗi click menu: {ex}")

        learned_url = self.page.url
        self.log(f"  ✓ URL hiện tại: {learned_url}")
        return learned_url

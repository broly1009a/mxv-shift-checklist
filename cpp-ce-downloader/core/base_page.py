"""
base_page.py — Base Page chứa các thao tác Playwright cơ sở dùng chung.
"""

from playwright.sync_api import Page


class BasePage:
    def __init__(self, page: Page, log=print):
        self.page = page
        self.log = log

    def dismiss_modal_backdrop(self):
        """Đóng các popup backdrop MUI che phủ giao diện nếu có."""
        try:
            backdrop = self.page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first
            if backdrop.is_visible(timeout=500):
                self.page.keyboard.press("Escape")
                self.page.wait_for_timeout(300)
        except Exception:
            pass

    def ensure_sidebar_expanded(self):
        """Kiểm tra và mở rộng Sidebar menu nếu đang ở dạng thu gọn."""
        try:
            collapse_icon = self.page.locator("xpath=//svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]").first
            if collapse_icon.is_visible(timeout=1500):
                self.log("  [Sidebar] Click mở rộng Sidebar menu...")
                collapse_icon.click(force=True)
                self.page.wait_for_timeout(500)
        except Exception:
            pass

    def capture_toast_notification(self):
        """Bắt và ghi log thông báo Toast Notistack/MUI Alert nếu có."""
        try:
            toast_elem = self.page.locator(
                "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(text(), 'dữ liệu') or contains(text(), 'thành công')]"
            ).first
            if toast_elem.is_visible(timeout=500):
                toast_text = toast_elem.text_content().strip()
                self.log(f"  [Toast Notification] {toast_text}")
        except Exception:
            pass

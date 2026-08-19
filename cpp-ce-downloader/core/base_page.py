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
        self.dismiss_modal_backdrop()
        try:
            # Nếu đã hiển thị Trang chủ hoặc ô Tìm kiếm, nghĩa là sidebar đã mở rộng
            sidebar_text = self.page.locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]").first
            if sidebar_text.is_visible(timeout=1000):
                return

            # Nút toggle theo class đặc thù VNCLEAR hoặc theo icon Chevron
            toggle_btn = self.page.locator(
                "xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')]"
                " | //svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]"
            ).first
            if toggle_btn.is_visible(timeout=1500):
                self.log("  [Sidebar] Click mở rộng Sidebar menu...")
                toggle_btn.click(force=True)
                self.page.wait_for_timeout(1000)
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

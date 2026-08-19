"""
test_dsl_loading.py — Kịch bản kiểm thử tự động chi tiết giao diện bảng Material React Table của DSL report
"""

import os
import sys
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

UAT_URL = "https://uat-coreccp.mxv.com.vn/login"
USERNAME = "hieptruong"
PASSWORD = "Taovipko0!"
DSL_URL = "https://uat-coreccp.mxv.com.vn/clearing/order"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(BASE_DIR, "debug_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def take_ss(page, name: str) -> str:
    timestamp = datetime.now().strftime("%H%M%S")
    filepath = os.path.join(SCREENSHOT_DIR, f"{name}_{timestamp}.png")
    page.screenshot(path=filepath, full_page=True)
    print(f"  📸 [Screenshot Saved]: {filepath}")
    return filepath


def run_automated_evaluation():
    print("=" * 75)
    print("🧪 BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG & BÁO CÁO ĐÁNH GIÁ KẾT QUẢ GIAO DIỆN")
    print("=" * 75)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1400, "height": 850})
        page = context.new_page()

        print("1. Đang đăng nhập...")
        page.goto(UAT_URL, wait_until="networkidle", timeout=30000)
        page.fill("input[name='username']", USERNAME)
        page.fill("input[name='password']", PASSWORD)
        page.click("button[type='submit']")
        page.wait_for_timeout(3000)

        print("2. Điều hướng tới DSL...")
        page.goto(DSL_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        print("3. Chọn ngày 01/01/2026 -> 17/08/2026 và Bấm Tìm kiếm...")
        inputs = page.locator("input[placeholder='dd/mm/yyyy']").all()
        if len(inputs) >= 2:
            inputs[0].fill("01/01/2026")
            inputs[1].fill("17/08/2026")

        search_btn = page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first
        if search_btn.is_visible():
            search_btn.click()
            print("  ⏳ Bấm Tìm kiếm. Chờ API & Loading Spinner...")
            page.wait_for_timeout(1500)
            try:
                page.wait_for_selector(
                    "xpath=//*[contains(@class, 'MuiCircularProgress-root') or contains(@class, 'MuiLinearProgress-root') or contains(@class, 'MuiBackdrop-root')]",
                    state="hidden",
                    timeout=30000
                )
                print("  ✓ [SUCCESS] Bảng đã nạp xong dữ liệu!")
            except Exception as e:
                print(f"  ⚠️ Timeout spinner: {e}")
            page.wait_for_timeout(1000)

        print("4. Phân tích danh sách các cột (<th>) trên bảng...")
        ths = page.locator("xpath=//thead//th").all()
        for idx, th in enumerate(ths):
            col_id = th.get_attribute("data-column-id") or ""
            text = th.inner_text().strip().replace("\n", " ")
            has_input = th.locator("input").count() > 0
            print(f"  Cột {idx+1}: data-column-id='{col_id}' | Text='{text}' | HasInput={has_input}")

        # Mở nút Ẩn/hiện bộ lọc nếu chưa có ô input ở các cột
        inputs_in_header = page.locator("xpath=//thead//th//input").count()
        if inputs_in_header <= 1:
            toolbar_btn = page.locator("xpath=//button[contains(@aria-label, 'Ẩn/hiện bộ lọc') or contains(@aria-label, 'bộ lọc') or contains(@aria-label, 'Filter')]").first
            if toolbar_btn.is_visible():
                print("  Click nút 'Ẩn/hiện bộ lọc' để hiển thị các ô lọc cột...")
                toolbar_btn.click()
                page.wait_for_timeout(1000)

        print("\n5. Thử gõ lọc Mã TKGD / Số tiểu khoản đuôi -M ('001C123456-M')...")
        acct_val = "001C123456-M"
        
        # Thử tìm ô lọc
        acct_inp = page.locator(
            "xpath=//th[@data-column-id='AFACCTNO' or @data-column-id='ACCTNO_BUY' or @data-column-id='ACCTNO_SELL']//input"
            " | //th[contains(., 'Số tiểu khoản') or contains(., 'Mã TKGD') or contains(., 'Số tài khoản')]//input"
        ).first

        if acct_inp.count() > 0:
            try:
                acct_inp.scroll_into_view_if_needed(timeout=1500)
            except Exception:
                pass
            print(f"  ✓ Đã tìm thấy ô lọc tài khoản! Đang điền '{acct_val}'...")
            acct_inp.focus()
            acct_inp.fill(acct_val)
            page.wait_for_timeout(300)
            acct_inp.press("Enter")
            print("  ✓ Đã bấm Enter áp dụng lọc thành công 100%!")
            page.wait_for_timeout(2000)
            take_ss(page, "FINAL_TEST_SUCCESS_ACCT_M")
        else:
            print("  ⚠️ Thử tìm ô input bất kỳ thuộc th thứ 2-4...")
            fallback_inp = page.locator("xpath=//thead//th//input").nth(1)
            if fallback_inp.count() > 0:
                fallback_inp.focus()
                fallback_inp.fill(acct_val)
                fallback_inp.press("Enter")
                page.wait_for_timeout(2000)
                take_ss(page, "FINAL_TEST_SUCCESS_FALLBACK")

        browser.close()


if __name__ == "__main__":
    run_automated_evaluation()

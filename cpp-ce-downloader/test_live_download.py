"""
test_live_download.py — Kịch bản chạy test thực tế trên hệ thống UAT CPP với tài khoản test
Tự động chụp ảnh màn hình (Screenshot) từng bước và lưu vào folder debug_screenshots để debug.
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import time
from datetime import datetime
from playwright.sync_api import sync_playwright

UAT_URL = "https://uat-coreccp.mxv.com.vn/login"
USERNAME = "hieptruong"
PASSWORD = "Taovipko0!"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(BASE_DIR, "debug_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

OUTPUT_DIR = os.path.join(BASE_DIR, "test_output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def take_ss(page, name: str):
    timestamp = datetime.now().strftime("%H%M%S")
    filepath = os.path.join(SCREENSHOT_DIR, f"{name}_{timestamp}.png")
    page.screenshot(path=filepath, full_page=True)
    print(f"  📸 Đã chụp ảnh màn hình: {filepath}")
    return filepath


def run_live_test():
    print("=" * 70)
    print("🧪 BẮT ĐẦU CHẠY TEST THỰC TẾ TRÊN HỆ THỐNG UAT CPP/CE")
    print(f"URL: {UAT_URL}")
    print(f"User: {USERNAME}")
    print("=" * 70)

    from downloader import (
        ensure_sidebar_expanded,
        navigate_to_report_page,
        set_mui_date_range_and_search,
        generate_monthly_intervals
    )

    reports_to_test = [
        {
            "code": "NR",
            "name": "Lịch sử nộp rút tiền",
            "parent_menu": "Nộp rút tiền",
            "child_menu": "Lịch sử Nộp/ Rút tiền",
            "enabled": True
        },
        {
            "code": "DSL",
            "name": "Danh sách lệnh",
            "parent_menu": "Lệnh và vị thế",
            "child_menu": "Danh sách lệnh",
            "enabled": True
        },
        {
            "code": "DSGD",
            "name": "Danh sách giao dịch",
            "parent_menu": "Lệnh và vị thế",
            "child_menu": "Danh sách giao dịch",
            "enabled": True
        },
        {
            "code": "TTTT",
            "name": "Trạng thái tất toán",
            "parent_menu": "Lệnh và vị thế",
            "child_menu": "Trạng thái tất toán",
            "enabled": True
        },
        {
            "code": "LSGTT",
            "name": "Lịch sử giá thanh toán",
            "parent_menu": "Quản lý sản phẩm",
            "child_menu": "Quản lý lịch sử giá thanh toán",
            "enabled": True
        }
    ]

    intervals = generate_monthly_intervals("01/08/2026", "17/08/2026")

    with sync_playwright() as p:
        print("\n🌐 Đang mở trình duyệt Chrome...")
        browser = p.chromium.launch(headless=True) # Headless=True để chạy trong background agent
        context = browser.new_context(accept_downloads=True, viewport={"width": 1366, "height": 768})
        page = context.new_page()

        # 1. Truy cập trang login
        print("\n1. Đang mở trang Đăng nhập...")
        page.goto(UAT_URL, wait_until="networkidle", timeout=30000)
        take_ss(page, "01_login_page")

        # 2. Đăng nhập
        print("2. Đang điền tài khoản & mật khẩu...")
        user_input = page.locator("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']").first
        pass_input = page.locator("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']").first

        if user_input.is_visible():
            user_input.fill(USERNAME)
        if pass_input.is_visible():
            pass_input.fill(PASSWORD)

        take_ss(page, "02_filled_credentials")

        login_btn = page.locator("button[type='submit'], button:has-text('Đăng nhập')").first
        if login_btn.is_visible():
            login_btn.click()
            page.wait_for_load_state("networkidle", timeout=30000)

        page.wait_for_timeout(3000)
        take_ss(page, "03_after_login")

        print(f"✓ URL hiện tại sau đăng nhập: {page.url}")

        # 3. Mở rộng Sidebar
        print("\n3. Kiểm tra Sidebar...")
        ensure_sidebar_expanded(page, print)
        take_ss(page, "04_sidebar_state")

        # 4. Chạy thử 5 báo cáo
        for report in reports_to_test:
            code = report["code"]
            name = report["name"]
            print(f"\n📂 === TEST BÁO CÁO: {name} ({code}) ===")

            try:
                # Nav
                url_learned = navigate_to_report_page(page, report, UAT_URL, print)
                take_ss(page, f"05_menu_{code}")

                for item in intervals:
                    start_s = item["start_str"]
                    end_s = item["end_str"]
                    mmyy = item["mmyy"]

                    print(f"  [Filter] Điền ngày {start_s} -> {end_s}...")
                    set_mui_date_range_and_search(page, start_s, end_s, print)
                    take_ss(page, f"06_searched_{code}_{mmyy}")

                    # Click Kết xuất -> Xuất tất cả
                    from downloader import trigger_export_download
                    try:
                        download_obj = trigger_export_download(page, print)
                        if download_obj == "NO_DATA":
                            print(f"  ℹ️ Bỏ qua {code} do không có dữ liệu trong khoảng ngày đã chọn.")
                        elif download_obj:
                            dest_file = os.path.join(OUTPUT_DIR, code, f"{code}{mmyy}.csv")
                            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
                            download_obj.save_as(dest_file)
                            print(f"  🎉 [Thành công] Đã lưu file: {dest_file}")
                            take_ss(page, f"07_success_{code}")
                        else:
                            print(f"  ❌ Không thể kích hoạt nút Kết xuất cho {code}")
                            take_ss(page, f"07_error_download_{code}")
                    except Exception as ex_down:
                        print(f"  ⚠️ Thất bại khi chờ download: {ex_down}")
                        take_ss(page, f"07_error_download_{code}")

            except Exception as e:
                print(f"  ❌ Lỗi khi test báo cáo {code}: {e}")
                take_ss(page, f"99_error_{code}")

        browser.close()

    print("\n" + "=" * 70)
    print("🎉 HOÀN THÀNH CHẠY TEST THỰC TẾ!")
    print(f"Ảnh chụp màn hình debug lưu tại: {SCREENSHOT_DIR}")
    print("=" * 70)


if __name__ == "__main__":
    run_live_test()

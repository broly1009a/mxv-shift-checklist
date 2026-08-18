"""
browser_factory.py — Quản lý khởi tạo trình duyệt resilient cho PyInstaller Standalone EXE.
"""

import os
from playwright.sync_api import Playwright, Browser


def launch_browser_resilient(p: Playwright, headless: bool, log=print) -> Browser:
    """
    Khởi tạo trình duyệt thông minh hỗ trợ 100% chạy PyInstaller Standalone .EXE:
    1. Thử Playwright Chromium chuẩn (Gán PLAYWRIGHT_BROWSERS_PATH về AppData hệ thống).
    2. Fallback 1: Dùng Google Chrome đã cài trên Windows (channel='chrome').
    3. Fallback 2: Dùng Microsoft Edge sẵn có trên Windows (channel='msedge' - 100% máy Windows có sẵn).
    """
    user_appdata_browsers = os.path.expanduser(r"~\AppData\Local\ms-playwright")
    if os.path.exists(user_appdata_browsers) and "PLAYWRIGHT_BROWSERS_PATH" not in os.environ:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = user_appdata_browsers

    # 1. Thử Playwright Chromium chuẩn
    try:
        return p.chromium.launch(headless=headless)
    except Exception:
        log("  ℹ️ Playwright Chromium không sẵn có. Đang chuyển sang Google Chrome hệ thống...")

    # 2. Fallback 1: Google Chrome
    try:
        return p.chromium.launch(headless=headless, channel="chrome")
    except Exception:
        log("  ℹ️ Google Chrome không sẵn có. Đang chuyển sang Microsoft Edge hệ thống...")

    # 3. Fallback 2: Microsoft Edge (Máy Windows 10/11 luôn sẵn có 100%)
    try:
        return p.chromium.launch(headless=headless, channel="msedge")
    except Exception as e3:
        raise RuntimeError(f"Không thể khởi chạy trình duyệt (Chromium/Chrome/Edge): {e3}")

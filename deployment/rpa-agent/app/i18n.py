"""
i18n.py — Internationalization support for MXV RPA Agent
Supports Vietnamese (vi) and English (en) with runtime switching.
"""

from __future__ import annotations
from typing import Literal

Lang = Literal["vi", "en"]

_STRINGS: dict[str, dict[Lang, str]] = {
    # ── App general ──────────────────────────────────────────────────────────
    "app_name":            {"vi": "MXV RPA Agent", "en": "MXV RPA Agent"},
    "app_version":         {"vi": "v1.0.0", "en": "v1.0.0"},

    # ── Tray menu ─────────────────────────────────────────────────────────────
    "tray_start":          {"vi": "Bắt đầu Agent", "en": "Start Agent"},
    "tray_stop":           {"vi": "Dừng Agent",   "en": "Stop Agent"},
    "tray_settings":       {"vi": "Cài đặt...",   "en": "Settings..."},
    "tray_logs":           {"vi": "Xem Logs...",  "en": "View Logs..."},
    "tray_restart":        {"vi": "Khởi động lại","en": "Restart"},
    "tray_quit":           {"vi": "Thoát",         "en": "Quit"},
    "tray_tooltip_online": {"vi": "MXV RPA Agent — Đang chạy",    "en": "MXV RPA Agent — Running"},
    "tray_tooltip_offline":{"vi": "MXV RPA Agent — Mất kết nối", "en": "MXV RPA Agent — Disconnected"},
    "tray_tooltip_stopped":{"vi": "MXV RPA Agent — Đã dừng",        "en": "MXV RPA Agent — Stopped"},
    "tray_tooltip_working":{"vi": "MXV RPA Agent — Đang xử lý job", "en": "MXV RPA Agent — Processing job"},

    # ── Settings window ───────────────────────────────────────────────────────
    "settings_title":      {"vi": "MXV RPA Agent — Cài đặt", "en": "MXV RPA Agent — Settings"},
    "settings_header":     {"vi": "Cài đặt hệ thống",           "en": "System Settings"},
    "tab_connection":      {"vi": "Kết nối",   "en": "Connection"},
    "tab_paths":           {"vi": "Đường dẫn", "en": "File Paths"},
    "tab_startup":         {"vi": "Khởi động", "en": "Startup"},
    "lbl_backend_url":     {"vi": "Backend URL:",          "en": "Backend URL:"},
    "lbl_api_key":         {"vi": "API Key:",              "en": "API Key:"},
    "lbl_poll_interval":   {"vi": "Polling interval:",     "en": "Polling interval:"},
    "lbl_hb_interval":     {"vi": "Heartbeat interval:",   "en": "Heartbeat interval:"},
    "btn_test_conn":       {"vi": "Kiểm tra kết nối",  "en": "Test Connection"},
    "lbl_lot_macro":       {"vi": "Macro Số Lot (.xlsm):", "en": "Lot Macro (.xlsm):"},
    "lbl_value_macro":     {"vi": "Macro Giá Trị (.xlsm):","en": "Value Macro (.xlsm):"},
    "lbl_ms_backup":       {"vi": "Thư mục Backup MS:",    "en": "MS Backup Folder:"},
    "lbl_acm_backup":      {"vi": "Thư mục Backup ACM:",   "en": "ACM Backup Folder:"},
    "chk_autostart":       {"vi": "Tự chạy khi Windows khởi động", "en": "Run on Windows startup"},
    "chk_minimized":       {"vi": "Khởi động ở chế độ tối giản (chỉ hiện tray)", "en": "Start minimized (tray only)"},
    "btn_save":            {"vi": "Lưu & Áp dụng", "en": "Save & Apply"},
    "btn_cancel":          {"vi": "Huỷ",               "en": "Cancel"},
    "msg_saved":           {"vi": "Cài đặt đã được lưu và áp dụng.", "en": "Settings saved and applied."},
    "conn_ok":             {"vi": "Kết nối OK",   "en": "Connection OK"},
    "conn_fail":           {"vi": "Lỗi kết nối:", "en": "Connection error:"},
    "conn_missing":        {"vi": "Nhập URL và API Key trước", "en": "Enter URL and API Key first"},
    "note_registry":       {"vi": "Tự chạy được ghi vào Windows Registry.", "en": "Autostart is stored in Windows Registry."},

    # ── Log window ────────────────────────────────────────────────────────────
    "log_title":           {"vi": "MXV RPA Agent — Log Viewer",  "en": "MXV RPA Agent — Log Viewer"},
    "log_filter_all":      {"vi": "Tất cả", "en": "All"},
    "btn_pause_scroll":    {"vi": "Dừng cuộn",   "en": "Pause Scroll"},
    "btn_resume_scroll":   {"vi": "Tiếp tục cuộn","en": "Resume Scroll"},
    "btn_clear":           {"vi": "Xoá",         "en": "Clear"},
    "btn_export":          {"vi": "Export .txt",  "en": "Export .txt"},

    # ── Notifications ─────────────────────────────────────────────────────────
    "notif_started":       {"vi": "Đang chạy: {label}",          "en": "Running: {label}"},
    "notif_completed":     {"vi": "{label} hoàn thành! Kết quả đã upload.", "en": "{label} completed! Results uploaded."},
    "notif_failed":        {"vi": "{label} thất bại:\n{error}",  "en": "{label} failed:\n{error}"},
    "notif_disconnected":  {"vi": "Mất kết nối tới Backend Server. Đang thử lại...", "en": "Lost connection to Backend. Retrying..."},

    # ── Language toggle ───────────────────────────────────────────────────────
    "lang_toggle":         {"vi": "Switch to English", "en": "Chuyển sang Tiếng Việt"},

    # ── Seconds suffix ────────────────────────────────────────────────────────
    "seconds":             {"vi": " giây", "en": " sec"},
}

# ── Singleton state ────────────────────────────────────────────────────────────

_current_lang: Lang = "vi"


def set_lang(lang: Lang) -> None:
    global _current_lang
    _current_lang = lang


def get_lang() -> Lang:
    return _current_lang


def t(key: str, **kwargs) -> str:
    """Translate a key to the current language. Supports .format(**kwargs)."""
    entry = _STRINGS.get(key)
    if entry is None:
        return key  # fallback: return key itself
    text = entry.get(_current_lang, entry.get("vi", key))
    if kwargs:
        try:
            text = text.format(**kwargs)
        except KeyError:
            pass
    return text


def toggle_lang() -> Lang:
    """Switch between vi and en, return new lang."""
    new_lang: Lang = "en" if _current_lang == "vi" else "vi"
    set_lang(new_lang)
    return new_lang

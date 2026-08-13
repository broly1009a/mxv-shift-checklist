"""
i18n.py — Internationalization support for MXV RPA Agent
Supports Vietnamese (vi) and English (en) with runtime switching.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Literal

Lang = Literal["vi", "en"]

_STRINGS: dict[str, dict[str, str]] = {
    # ── App general ──────────────────────────────────────────────────────────
    "app_name":             {"vi": "MXV RPA Agent",  "en": "MXV RPA Agent"},
    "app_version":          {"vi": "v1.0.0",          "en": "v1.0.0"},
    "app_already_running":  {"vi": "MXV RPA Agent đã đang chạy.\nKiểm tra biểu tượng ở góc dưới bên phải màn hình.",
                             "en": "MXV RPA Agent is already running.\nCheck the icon in the bottom-right corner of your screen."},
    "no_tray_support":      {"vi": "Máy tính không hỗ trợ biểu tượng góc màn hình. Vui lòng kiểm tra cài đặt Windows.",
                             "en": "System tray is not supported on this machine. Please check Windows settings."},
    "startup_balloon":      {"vi": "Agent đã khởi động — đang chạy nền ở góc dưới bên phải màn hình.",
                             "en": "Agent started — running in the bottom-right corner of your screen."},

    # ── Tray menu ─────────────────────────────────────────────────────────────
    "tray_start":           {"vi": "Bắt đầu Agent",   "en": "Start Agent"},
    "tray_stop":            {"vi": "Dừng Agent",       "en": "Stop Agent"},
    "tray_settings":        {"vi": "Cài đặt...",       "en": "Settings..."},
    "tray_logs":            {"vi": "Xem Logs...",      "en": "View Logs..."},
    "tray_restart":         {"vi": "Khởi động lại",    "en": "Restart"},
    "tray_quit":            {"vi": "Thoát",            "en": "Quit"},
    "tray_tooltip_online":  {"vi": "MXV RPA Agent — Đang chạy",      "en": "MXV RPA Agent — Running"},
    "tray_tooltip_offline": {"vi": "MXV RPA Agent — Mất kết nối",    "en": "MXV RPA Agent — Disconnected"},
    "tray_tooltip_stopped": {"vi": "MXV RPA Agent — Đã dừng",        "en": "MXV RPA Agent — Stopped"},
    "tray_tooltip_working": {"vi": "MXV RPA Agent — Đang xử lý",     "en": "MXV RPA Agent — Processing"},
    "tray_not_connected":   {"vi": "MXV RPA Agent — Chưa kết nối",   "en": "MXV RPA Agent — Not connected"},

    # ── Settings window ───────────────────────────────────────────────────────
    "settings_title":       {"vi": "MXV RPA Agent — Cài đặt",        "en": "MXV RPA Agent — Settings"},
    "tab_connection":       {"vi": "Kết nối",      "en": "Connection"},
    "tab_startup":          {"vi": "Khởi động",    "en": "Startup"},
    "tab_guide":            {"vi": "Hướng dẫn",   "en": "Guide"},
    "lbl_backend_url":      {"vi": "Backend URL:", "en": "Backend URL:"},
    "lbl_api_key":          {"vi": "API Key:",     "en": "API Key:"},
    "lbl_poll_interval":    {"vi": "Polling interval:", "en": "Polling interval:"},
    "lbl_hb_interval":      {"vi": "Heartbeat interval:", "en": "Heartbeat interval:"},
    "btn_test_conn":        {"vi": "Kiểm tra kết nối", "en": "Test Connection"},
    "conn_ok":              {"vi": "Kết nối OK",        "en": "Connection OK"},
    "conn_fail":            {"vi": "Lỗi kết nối:",      "en": "Connection error:"},
    "conn_missing":         {"vi": "Nhập URL & API Key trước", "en": "Enter URL & API Key first"},
    "chk_autostart":        {"vi": "Tự chạy Agent khi Windows khởi động", "en": "Run Agent on Windows startup"},
    "chk_minimized":        {"vi": "Khởi động thu nhỏ — chỉ hiện biểu tượng góc màn hình, không mở cửa sổ",
                             "en": "Start minimized — show tray icon only, don't open a window"},
    "chk_notifications":    {"vi": "Hiển thị thông báo màn hình (Windows Toast)", "en": "Show desktop notifications (Windows Toast)"},
    "lbl_notif_duration":   {"vi": "Thời gian tự đóng thông báo:", "en": "Auto-close notification after:"},
    "note_registry":        {"vi": "Tự chạy được ghi vào Windows Registry (HKCU\\...\\Run).",
                             "en": "Autostart is stored in Windows Registry (HKCU\\...\\Run)."},
    "btn_save":             {"vi": "Lưu && Áp dụng", "en": "Save && Apply"},
    "btn_cancel":           {"vi": "Huỷ",            "en": "Cancel"},
    "msg_saved":            {"vi": "Cài đặt đã được lưu và áp dụng.", "en": "Settings saved and applied."},
    "msg_saved_title":      {"vi": "Đã lưu", "en": "Saved"},
    "err_registry_title":   {"vi": "Lỗi Registry", "en": "Registry Error"},
    "err_registry_msg":     {"vi": "Không thể cập nhật autostart:\n{e}", "en": "Could not update autostart:\n{e}"},
    "seconds_suffix":       {"vi": " giây", "en": " sec"},
    "placeholder_url":      {"vi": "http://192.168.1.100", "en": "http://192.168.1.100"},
    "placeholder_key":      {"vi": "mxv_rpa_secure_agent_key_...", "en": "mxv_rpa_secure_agent_key_..."},

    # ── Log window UI chrome (NOT log content) ────────────────────────────────
    "log_title":            {"vi": "MXV RPA Agent — Nhật ký",  "en": "MXV RPA Agent — Log Viewer"},
    "log_filter_label":     {"vi": "Lọc:",  "en": "Filter:"},
    "log_filter_all":       {"vi": "Tất cả", "en": "All"},
    "btn_pause_scroll":     {"vi": "Dừng cuộn",    "en": "Pause Scroll"},
    "btn_resume_scroll":    {"vi": "Tiếp tục cuộn","en": "Resume Scroll"},
    "btn_clear":            {"vi": "Xoá",           "en": "Clear"},
    "btn_export":           {"vi": "Xuất .txt",     "en": "Export .txt"},
    "export_dialog_title":  {"vi": "Lưu log ra file", "en": "Export log to file"},

    # ── Guide tab ─────────────────────────────────────────────────────────────
    "guide_setup_title":    {"vi": "Thiết lập lần đầu",   "en": "Initial Setup"},
    "guide_step1_label":    {"vi": "<b>Bước 1.</b> Mở tab <b>Kết nối</b> → điền <b>Backend URL</b> của hệ thống:",
                             "en": "<b>Step 1.</b> Open the <b>Connection</b> tab → enter the system's <b>Backend URL</b>:"},
    "guide_step1_box":      {"vi": "Ví dụ:  http://192.168.1.100:5000  hoặc  http://10.0.0.5:5000",
                             "en": "Example:  http://192.168.1.100:5000  or  http://10.0.0.5:5000"},
    "guide_step2_label":    {"vi": "<b>Bước 2.</b> Điền <b>API Key</b> — lấy từ trang Admin của hệ thống (mục Cài đặt → Agent API Key).",
                             "en": "<b>Step 2.</b> Enter the <b>API Key</b> — get it from the Admin page (Settings → Agent API Key)."},
    "guide_step2_box":      {"vi": "API Key có dạng:  mxv_rpa_secure_agent_key_XXXX…",
                             "en": "API Key format:  mxv_rpa_secure_agent_key_XXXX…"},
    "guide_step3_label":    {"vi": "<b>Bước 3.</b> Nhấn <b>Lưu &amp; Áp dụng</b>. Agent sẽ tự động kết nối và gửi tín hiệu mỗi 30 giây.",
                             "en": "<b>Step 3.</b> Click <b>Save &amp; Apply</b>. The Agent will connect automatically and send a heartbeat every 30 seconds."},
    "guide_tray_title":     {"vi": "Biểu tượng góc màn hình (góc dưới bên phải)",
                             "en": "System Tray Icon (bottom-right corner)"},
    "guide_tray_desc":      {"vi": "Sau khi khởi động, MXV RPA Agent thu nhỏ thành một <b>biểu tượng nhỏ ở góc dưới bên phải màn hình</b> (gần đồng hồ). Nhấp đúp để mở, nhấp chuột phải để xem menu.",
                             "en": "After starting, MXV RPA Agent minimizes to a <b>small icon in the bottom-right corner</b> (near the clock). Double-click to open, right-click for the menu."},
    "guide_tray_green":     {"vi": "<b>Xanh lá</b> — Kết nối thành công, Agent đang hoạt động bình thường.",
                             "en": "<b>Green</b> — Connected successfully, Agent is running normally."},
    "guide_tray_red":       {"vi": "<b>Đỏ</b> — Mất kết nối. Kiểm tra lại Backend URL hoặc API Key.",
                             "en": "<b>Red</b> — Disconnected. Check your Backend URL or API Key."},
    "guide_tray_yellow":    {"vi": "<b>Vàng</b> — Đang xử lý. Agent đang gửi tín hiệu tới server.",
                             "en": "<b>Yellow</b> — Processing. Agent is sending a signal to the server."},
    "guide_trouble_title":  {"vi": "Xử lý sự cố thường gặp",  "en": "Troubleshooting"},
    "guide_trouble_1_q":    {"vi": "<b>Agent luôn đỏ (mất kết nối)</b>",
                             "en": "<b>Agent always shows red (disconnected)</b>"},
    "guide_trouble_1_a":    {"vi": "Kiểm tra: (1) Backend đang chạy chưa? (2) URL có đúng IP:Port? (3) Firewall có chặn port 5000?",
                             "en": "Check: (1) Is the Backend running? (2) Is the URL correct (IP:Port)? (3) Is port 5000 blocked by a firewall?"},
    "guide_trouble_2_q":    {"vi": "<b>Không nhận được thông báo</b>",
                             "en": "<b>Not receiving notifications</b>"},
    "guide_trouble_2_a":    {"vi": "Vào tab Khởi động → bật 'Hiển thị thông báo màn hình'. Kiểm tra cài đặt Notification của Windows.",
                             "en": "Go to Startup tab → enable 'Show desktop notifications'. Check Windows Notification settings."},
    "guide_trouble_3_q":    {"vi": "<b>Agent không tự chạy khi bật máy</b>",
                             "en": "<b>Agent doesn't start automatically on boot</b>"},
    "guide_trouble_3_a":    {"vi": "Vào tab Khởi động → bật 'Tự chạy Agent khi Windows khởi động'. Cần quyền Admin.",
                             "en": "Go to Startup tab → enable 'Run Agent on Windows startup'. Admin rights may be required."},
    "guide_contact_title":  {"vi": "Liên hệ hỗ trợ",          "en": "Support Contact"},
    "guide_contact_box":    {"vi": "Teams / Email: <b>Bộ phận IT – MXV</b>\nMô tả lỗi kèm theo ảnh chụp màn hình Log Viewer để được hỗ trợ nhanh nhất.",
                             "en": "Teams / Email: <b>IT Department – MXV</b>\nDescribe the issue with a screenshot of the Log Viewer for the fastest support."},

    # ── Notifications ─────────────────────────────────────────────────────────
    "notif_started":        {"vi": "Đang chạy: {label}",                      "en": "Running: {label}"},
    "notif_completed":      {"vi": "{label} hoàn thành! Kết quả đã upload.",   "en": "{label} completed! Results uploaded."},
    "notif_failed":         {"vi": "{label} thất bại:\n{error}",               "en": "{label} failed:\n{error}"},
    "notif_disconnected":   {"vi": "Mất kết nối tới Backend Server. Đang thử lại...",
                             "en": "Lost connection to Backend. Retrying..."},

    # ── Language toggle ───────────────────────────────────────────────────────
    "lang_toggle":          {"vi": "Switch to English", "en": "Chuyển sang Tiếng Việt"},
}

# ── Singleton state ────────────────────────────────────────────────────────────

_current_lang: Lang = "vi"
_BASE_DIR = Path(__file__).parent.parent
_CONFIG_PATH = _BASE_DIR / "config.json"


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


def save_lang_pref() -> None:
    """Persist language preference to config.json."""
    try:
        cfg: dict = {}
        if _CONFIG_PATH.exists():
            with open(_CONFIG_PATH, encoding="utf-8") as f:
                cfg = json.load(f)
        cfg["language"] = _current_lang
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def load_lang_pref() -> None:
    """Load language preference from config.json (if exists)."""
    global _current_lang
    try:
        if _CONFIG_PATH.exists():
            with open(_CONFIG_PATH, encoding="utf-8") as f:
                cfg = json.load(f)
            lang = cfg.get("language", "vi")
            if lang in ("vi", "en"):
                _current_lang = lang
    except Exception:
        pass

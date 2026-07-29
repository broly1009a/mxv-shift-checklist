"""
main.py — MXV RPA Agent Entry Point
Bootstraps the PyQt6 application: single instance, tray icon, core agent.
"""

from __future__ import annotations

import sys
import json
from pathlib import Path

from PyQt6.QtWidgets import QApplication, QMessageBox
from PyQt6.QtGui import QIcon
from PyQt6.QtCore import QLockFile, QStandardPaths, Qt

# Ensure app/  is in path when run from rpa-agent/app/
sys.path.insert(0, str(Path(__file__).parent))

import i18n
from agent_core import AgentCore, load_config
from tray import TrayIcon
from settings_window import SettingsWindow
from log_window import LogWindow
from notifier import Notifier

ASSETS = Path(__file__).parent / "assets"
BASE_DIR = Path(__file__).parent.parent
CONFIG_PATH = BASE_DIR / "config.json"


def _load_icon() -> QIcon:
    """Load MXV logo from assets, fallback to auto-generated icon."""
    candidates = [
        ASSETS / "icon_base.png",   # copied from frontend/public/logomxv.png
        ASSETS / "icon.ico",
        ASSETS / "icon_online.png",
    ]
    for p in candidates:
        if p.exists():
            return QIcon(str(p))
    # Fallback: generate programmatically
    from tray import _make_circle_icon
    return _make_circle_icon("#1a2744", "M")


def _load_initial_lang() -> None:
    """Read preferred language from config.json via i18n helper."""
    i18n.load_lang_pref()


def main() -> None:
    # ── Single instance guard ─────────────────────────────────────────────────
    lock_dir = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.TempLocation)
    lock_file = QLockFile(f"{lock_dir}/mxv_rpa_agent.lock")
    lock_file.setStaleLockTime(0)
    if not lock_file.tryLock():
        app = QApplication(sys.argv)
        i18n.load_lang_pref()
        QMessageBox.information(None, "MXV RPA Agent", i18n.t("app_already_running"))
        sys.exit(0)

    # ── Qt Application ────────────────────────────────────────────────────────
    app = QApplication(sys.argv)
    app.setApplicationName("MXV RPA Agent")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("MXV")
    # Keep app running even when all windows are closed (tray-only mode)
    app.setQuitOnLastWindowClosed(False)

    # Load i18n preference
    _load_initial_lang()

    # App icon (shown in taskbar + alt-tab)
    icon = _load_icon()
    app.setWindowIcon(icon)

    # ── Core agent ────────────────────────────────────────────────────────────
    core = AgentCore()

    # ── Windows ───────────────────────────────────────────────────────────────
    settings_win = SettingsWindow(core)
    log_win = LogWindow(core)
    notifier = Notifier(core, str(ASSETS / "icon_base.png"))

    # ── System Tray ───────────────────────────────────────────────────────────
    if not QApplication.instance() or not QSystemTrayIcon_available():
        QMessageBox.critical(None, "MXV RPA Agent", i18n.t("no_tray_support"))
        sys.exit(1)

    tray = TrayIcon(core)
    tray.set_windows(settings_win, log_win)
    tray.show()

    # ── Language toggle: add to tray menu ─────────────────────────────────────
    _add_lang_toggle(tray, settings_win, log_win)

    # ── Auto-start agent if config exists and valid ───────────────────────────
    try:
        cfg = load_config()
        if cfg.get("backend_url") and cfg.get("api_key"):
            # Start minimized unless start_minimized is False
            core.start()
    except Exception:
        # Config missing/invalid — open settings on first run
        settings_win.show()

    # ── Show tray balloon on startup ──────────────────────────────────────────
    tray.showMessage(
        i18n.t("app_name"),
        i18n.t("startup_balloon"),
        QIcon(str(ASSETS / "icon_base.png")) if (ASSETS / "icon_base.png").exists()
        else tray.icon(),
        2000,
    )

    sys.exit(app.exec())


def _add_lang_toggle(tray: "TrayIcon", settings_win, log_win) -> None:
    """Inject language toggle action into tray context menu."""
    menu = tray.contextMenu()
    if not menu:
        return

    # Find last separator to insert before Quit
    actions = menu.actions()
    separator_indices = [i for i, a in enumerate(actions) if a.isSeparator()]
    insert_before = actions[-1] if actions else None  # before Quit

    sep = menu.insertSeparator(insert_before)

    lang_action = menu.insertSection(insert_before, i18n.t("lang_toggle"))

    def _on_toggle_lang():
        new_lang = i18n.toggle_lang()
        # Save preference
        i18n.save_lang_pref()
        # Update action text
        lang_action.setText(i18n.t("lang_toggle"))
        # Refresh ALL windows immediately
        tray.retranslate_ui()
        settings_win.retranslate_ui()
        log_win.retranslate_ui()

    lang_action.triggered.connect(_on_toggle_lang)


def QSystemTrayIcon_available() -> bool:
    from PyQt6.QtWidgets import QSystemTrayIcon
    return QSystemTrayIcon.isSystemTrayAvailable()


if __name__ == "__main__":
    main()

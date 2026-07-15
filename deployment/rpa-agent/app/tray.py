"""
tray.py — MXV RPA Agent System Tray Icon
Manages the Windows system tray icon, tooltip, and right-click menu.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from PyQt6.QtGui import QIcon, QPixmap, QPainter, QColor, QFont
from PyQt6.QtWidgets import QSystemTrayIcon, QMenu, QApplication
from PyQt6.QtCore import Qt

if TYPE_CHECKING:
    from agent_core import AgentCore
    from settings_window import SettingsWindow
    from log_window import LogWindow

ASSETS = Path(__file__).parent / "assets"


def _make_circle_icon(color: str, letter: str = "M") -> QIcon:
    """Create a simple colored circle icon with a letter (fallback if PNG missing)."""
    size = 64
    pix = QPixmap(size, size)
    pix.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pix)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    painter.setBrush(QColor(color))
    painter.setPen(Qt.PenStyle.NoPen)
    painter.drawEllipse(2, 2, size - 4, size - 4)
    painter.setPen(QColor("white"))
    font = QFont("Arial", 22, QFont.Weight.Bold)
    painter.setFont(font)
    painter.drawText(pix.rect(), Qt.AlignmentFlag.AlignCenter, letter)
    painter.end()
    return QIcon(pix)


def _load_icon(name: str, fallback_color: str, fallback_letter: str = "M") -> QIcon:
    path = ASSETS / name
    if path.exists():
        return QIcon(str(path))
    return _make_circle_icon(fallback_color, fallback_letter)


class TrayIcon(QSystemTrayIcon):
    """
    System tray icon with dynamic state (online/offline/working)
    and a context menu to control the agent.
    """

    def __init__(self, core: "AgentCore") -> None:
        super().__init__()
        self._core = core
        self._settings_win: "SettingsWindow | None" = None
        self._log_win: "LogWindow | None" = None

        # Icons for each state
        self._icon_offline = _load_icon("icon_offline.png", "#c0392b", "M")
        self._icon_online  = _load_icon("icon_online.png",  "#27ae60", "M")
        self._icon_working = _load_icon("icon_working.png", "#f39c12", "M")

        self.setIcon(self._icon_offline)
        self.setToolTip("MXV RPA Agent — Chưa kết nối")

        self._build_menu()

        # Wire agent signals → UI updates
        self._core.connection_changed.connect(self._on_connection_changed)
        self._core.job_started.connect(self._on_job_started)
        self._core.job_completed.connect(self._on_job_completed)
        self._core.job_failed.connect(self._on_job_failed)
        self._core.stats_updated.connect(self._on_stats_updated)

        # Double-click opens settings
        self.activated.connect(self._on_activated)

    # ── Menu ──────────────────────────────────────────────────────────────────

    def _build_menu(self) -> None:
        menu = QMenu()

        # Header (non-clickable label)
        title_action = menu.addAction("⚙ MXV RPA Agent v1.0")
        title_action.setEnabled(False)
        menu.addSeparator()

        # Start / Stop
        self._act_start = menu.addAction("▶  Bắt đầu Agent")
        self._act_stop  = menu.addAction("⏹  Dừng Agent")
        self._act_start.triggered.connect(self._on_start)
        self._act_stop.triggered.connect(self._on_stop)
        self._act_stop.setEnabled(False)   # initially stopped
        menu.addSeparator()

        # Windows
        act_settings = menu.addAction("⚙  Cài đặt...")
        act_logs     = menu.addAction("📋  Xem Logs...")
        act_settings.triggered.connect(self._open_settings)
        act_logs.triggered.connect(self._open_logs)
        menu.addSeparator()

        # Restart
        act_restart = menu.addAction("🔄  Khởi động lại Agent")
        act_restart.triggered.connect(self._on_restart)
        menu.addSeparator()

        # Quit
        act_quit = menu.addAction("❌  Thoát")
        act_quit.triggered.connect(self._on_quit)

        self.setContextMenu(menu)

    # ── Slots ─────────────────────────────────────────────────────────────────

    def _on_start(self) -> None:
        self._core.start()
        self._act_start.setEnabled(False)
        self._act_stop.setEnabled(True)
        self.setToolTip("MXV RPA Agent — Đang khởi động...")

    def _on_stop(self) -> None:
        self._core.stop()
        self._act_start.setEnabled(True)
        self._act_stop.setEnabled(False)
        self.setIcon(self._icon_offline)
        self.setToolTip("MXV RPA Agent — Đã dừng")

    def _on_restart(self) -> None:
        self._on_stop()
        self._on_start()

    def _on_quit(self) -> None:
        self._core.stop()
        QApplication.instance().quit()

    def _on_activated(self, reason: QSystemTrayIcon.ActivationReason) -> None:
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self._open_settings()

    def _open_settings(self) -> None:
        # Lazy import to avoid circular deps
        if self._settings_win is None:
            from settings_window import SettingsWindow
            self._settings_win = SettingsWindow(self._core)
        self._settings_win.show()
        self._settings_win.raise_()
        self._settings_win.activateWindow()

    def _open_logs(self) -> None:
        if self._log_win is None:
            from log_window import LogWindow
            self._log_win = LogWindow(self._core)
        self._log_win.show()
        self._log_win.raise_()
        self._log_win.activateWindow()

    # ── Agent signal handlers ─────────────────────────────────────────────────

    def _on_connection_changed(self, online: bool) -> None:
        if online:
            self.setIcon(self._icon_online)
            self.setToolTip("MXV RPA Agent — Đang chạy ✓")
        else:
            self.setIcon(self._icon_offline)
            self.setToolTip("MXV RPA Agent — Mất kết nối ⚠")

    def _on_job_started(self, job_id: str, job_type: str) -> None:
        self.setIcon(self._icon_working)
        label = _job_label(job_type)
        self.setToolTip(f"MXV RPA Agent — Đang chạy: {label}")

    def _on_job_completed(self, job_id: str, job_type: str) -> None:
        self.setIcon(self._icon_online)

    def _on_job_failed(self, job_id: str, job_type: str, error: str) -> None:
        self.setIcon(self._icon_online)  # back to online (agent still running)

    def _on_stats_updated(self, jobs_today: int) -> None:
        self.setToolTip(f"MXV RPA Agent — Online ✓ | {jobs_today} jobs hôm nay")

    # ── Lazy window references (set from main.py) ─────────────────────────────

    def set_windows(self, settings: "SettingsWindow", logs: "LogWindow") -> None:
        self._settings_win = settings
        self._log_win = logs


def _job_label(job_type: str) -> str:
    mapping = {
        "RUN_LOT_MACRO": "Macro Số Lot",
        "RUN_VALUE_MACRO": "Macro Giá Trị",
        "RPA_DOWNLOAD_REPORTS": "Tải báo cáo",
        "DOWNLOAD_CAST": "Tải CAST",
        "FILE_AUDIT_MS": "Kiểm tra file MS",
        "FILE_AUDIT_CQG": "Kiểm tra file CQG",
        "FILE_AUDIT_ACM": "Kiểm tra file ACM",
    }
    return mapping.get(job_type, job_type)

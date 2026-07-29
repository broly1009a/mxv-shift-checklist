"""
tray.py — MXV RPA Agent System Tray Icon
Manages the Windows system tray icon, tooltip, and right-click menu.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import i18n

from PyQt6.QtGui import QIcon, QPixmap, QPainter, QColor, QFont, QPen, QBrush, QPainterPath
from PyQt6.QtWidgets import QSystemTrayIcon, QMenu, QApplication, QWidgetAction, QWidget, QHBoxLayout, QLabel
from PyQt6.QtCore import Qt, QRectF

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


def _draw_menu_icon(icon_type: str, color_str: str = "#0f172a") -> QIcon:
    """Draw clean, modern vector icons for the tray menu programmatically."""
    icon = QIcon()
    
    # We will build a normal state and active/hover state
    states = [
        (color_str, QIcon.Mode.Normal, QIcon.State.Off),
        ("#1CAEE6", QIcon.Mode.Active, QIcon.State.On),
        ("#1CAEE6", QIcon.Mode.Selected, QIcon.State.On),
    ]
    
    for c, mode, state in states:
        pix = QPixmap(24, 24)
        pix.fill(Qt.GlobalColor.transparent)
        
        painter = QPainter(pix)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        pen = QPen(QColor(c))
        pen.setWidthF(2.0)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
        painter.setPen(pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        
        if icon_type == "gear":
            # Clean settings cog wheel
            painter.drawEllipse(QRectF(8, 8, 8, 8))
            painter.translate(12, 12)
            for _ in range(8):
                painter.drawLine(0, -5, 0, -7)
                painter.rotate(45)
                
        elif icon_type == "play":
            # Play triangle
            painter.setBrush(QColor(c))
            path = QPainterPath()
            path.moveTo(9, 7)
            path.lineTo(17, 12)
            path.lineTo(9, 17)
            path.closeSubpath()
            painter.drawPath(path)
            
        elif icon_type == "stop":
            # Stop square
            painter.setBrush(QColor(c))
            painter.drawRoundedRect(QRectF(8, 8, 8, 8), 1.5, 1.5)
            
        elif icon_type == "logs":
            # Clipboard / Document outline
            painter.drawRoundedRect(QRectF(7, 6, 10, 12), 2, 2)
            painter.drawLine(10, 10, 14, 10)
            painter.drawLine(10, 13, 14, 13)
            
        elif icon_type == "restart":
            # Circular arrow
            painter.drawArc(QRectF(7, 7, 10, 10), 45 * 16, 270 * 16)
            painter.drawLine(14, 7, 17, 7)
            painter.drawLine(17, 7, 17, 10)
            
        elif icon_type == "quit":
            # X mark
            painter.drawLine(8, 8, 16, 16)
            painter.drawLine(16, 8, 8, 16)
            
        elif icon_type == "update":
            # Globe/Upload
            painter.drawEllipse(QRectF(7, 7, 10, 10))
            painter.drawLine(12, 5, 12, 12)
            painter.drawLine(10, 7, 12, 5)
            painter.drawLine(14, 7, 12, 5)
            
        painter.end()
        icon.addPixmap(pix, mode, state)
        
    return icon


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
        self._core.update_available.connect(self._on_update_available)

        # Double-click opens settings
        self.activated.connect(self._on_activated)
        self.messageClicked.connect(self._on_message_clicked)

        self._download_url = ""

    def _on_update_available(self, version: str, download_url: str) -> None:
        self._download_url = download_url
        self.showMessage(
            "MXV RPA Agent Update",
            f"Đã có phiên bản mới v{version}. Click để tải về.",
            QIcon(str(ASSETS / "icon_base.png")) if (ASSETS / "icon_base.png").exists() else self.icon(),
            8000,
        )
        if not hasattr(self, "_act_update"):
            menu = self.contextMenu()
            if menu:
                actions = menu.actions()
                before_action = actions[-1] if actions else None
                for a in actions:
                    if "Thoát" in a.text():
                        before_action = a
                        break
                self._act_update = menu.addAction(_draw_menu_icon("update"), f"Cập nhật v{version}...")
                if before_action:
                    menu.insertAction(before_action, self._act_update)
                self._act_update.triggered.connect(self._on_trigger_update)

    def _on_message_clicked(self) -> None:
        if self._download_url:
            import webbrowser
            webbrowser.open(self._download_url)

    def _on_trigger_update(self) -> None:
        if self._download_url:
            import webbrowser
            webbrowser.open(self._download_url)

    # ── Menu ──────────────────────────────────────────────────────────────────

    def _build_menu(self) -> None:
        menu = QMenu()
        menu.setStyleSheet("""
            QMenu {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                padding: 4px;
            }
            QMenu::item {
                padding: 6px 28px 6px 28px;
                color: #0f172a;
            }
            QMenu::item:selected {
                background-color: #eaf8fe;
                color: #1CAEE6;
            }
            QMenu::item:disabled {
                color: #94a3b8;
            }
            QMenu::separator {
                height: 1px;
                background-color: #cbd5e1;
                margin: 4px 0px;
            }
        """)

        # Header (non-clickable custom widget action)
        header_action = QWidgetAction(menu)
        header_widget = QWidget()
        header_widget.setObjectName("MenuHeaderWidget")
        header_widget.setStyleSheet("background-color: transparent;")
        
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(10, 8, 10, 8)
        header_layout.setSpacing(10)
        
        icon_lbl = QLabel()
        logo_pix = QPixmap(str(ASSETS / "icon_base.png"))
        if not logo_pix.isNull():
            icon_lbl.setPixmap(logo_pix.scaled(18, 18, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        
        text_lbl = QLabel("MXV RPA Agent v1.0")
        text_lbl.setStyleSheet("color: #1CAEE6; font-weight: bold; font-size: 10pt; font-family: 'Segoe UI'; background: transparent;")
        
        header_layout.addWidget(icon_lbl)
        header_layout.addWidget(text_lbl)
        header_layout.addStretch()
        
        header_action.setDefaultWidget(header_widget)
        menu.addAction(header_action)
        menu.addSeparator()

        # Start / Stop
        self._act_start = menu.addAction(_draw_menu_icon("play"), i18n.t("tray_start"))
        self._act_stop  = menu.addAction(_draw_menu_icon("stop"), i18n.t("tray_stop"))
        self._act_start.triggered.connect(self._on_start)
        self._act_stop.triggered.connect(self._on_stop)
        self._act_stop.setEnabled(False)
        menu.addSeparator()

        self._act_settings = menu.addAction(_draw_menu_icon("gear"), i18n.t("tray_settings"))
        self._act_logs     = menu.addAction(_draw_menu_icon("logs"), i18n.t("tray_logs"))
        self._act_settings.triggered.connect(self._open_settings)
        self._act_logs.triggered.connect(self._open_logs)
        menu.addSeparator()

        self._act_restart = menu.addAction(_draw_menu_icon("restart"), i18n.t("tray_restart"))
        self._act_restart.triggered.connect(self._on_restart)
        menu.addSeparator()

        self._act_quit = menu.addAction(_draw_menu_icon("quit"), i18n.t("tray_quit"))
        self._act_quit.triggered.connect(self._on_quit)

        self.setContextMenu(menu)

    # ── Slots ─────────────────────────────────────────────────────────────────

    def _on_start(self) -> None:
        self._core.start()
        self._act_start.setEnabled(False)
        self._act_stop.setEnabled(True)
        self.setToolTip(i18n.t("tray_tooltip_online"))

    def _on_stop(self) -> None:
        self._core.stop()
        self._act_start.setEnabled(True)
        self._act_stop.setEnabled(False)
        self.setIcon(self._icon_offline)
        self.setToolTip(i18n.t("tray_tooltip_stopped"))

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
            self.setToolTip(i18n.t("tray_tooltip_online"))
        else:
            self.setIcon(self._icon_offline)
            self.setToolTip(i18n.t("tray_tooltip_offline"))

    def _on_job_started(self, job_id: str, job_type: str) -> None:
        self.setIcon(self._icon_working)
        self.setToolTip(i18n.t("tray_tooltip_working"))

    def _on_job_completed(self, job_id: str, job_type: str) -> None:
        self.setIcon(self._icon_online)

    def _on_job_failed(self, job_id: str, job_type: str, error: str) -> None:
        self.setIcon(self._icon_online)

    def _on_stats_updated(self, jobs_today: int) -> None:
        self.setToolTip(f"{i18n.t('tray_tooltip_online')} | {jobs_today} jobs")

    # ── Lazy window references (set from main.py) ─────────────────────────────

    def set_windows(self, settings: "SettingsWindow", logs: "LogWindow") -> None:
        self._settings_win = settings
        self._log_win = logs

    def retranslate_ui(self) -> None:
        """Update all tray menu text and tooltip from i18n."""
        self._act_start.setText(i18n.t("tray_start"))
        self._act_stop.setText(i18n.t("tray_stop"))
        self._act_settings.setText(i18n.t("tray_settings"))
        self._act_logs.setText(i18n.t("tray_logs"))
        self._act_restart.setText(i18n.t("tray_restart"))
        self._act_quit.setText(i18n.t("tray_quit"))
        # Refresh tooltip based on current connection state
        self.setToolTip(i18n.t("tray_not_connected"))


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

"""
settings_window.py — MXV RPA Agent Settings Window
A QDialog with 3 tabs: Connection, File Paths, Startup.
"""

from __future__ import annotations

import json
import winreg
from pathlib import Path
from typing import TYPE_CHECKING

import i18n

from PyQt6.QtWidgets import (
    QDialog, QTabWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QFormLayout, QLineEdit, QPushButton, QSpinBox, QLabel,
    QCheckBox, QMessageBox, QDialogButtonBox, QScrollArea, QFrame,
)
from PyQt6.QtCore import Qt, QRectF, QSize
from PyQt6.QtGui import QFont, QPainter, QPainterPath, QPen, QBrush, QColor, QPixmap, QIcon

if TYPE_CHECKING:
    from agent_core import AgentCore

BASE_DIR = Path(__file__).parent.parent
CONFIG_PATH = BASE_DIR / "config.json"
APP_NAME = "MXV_RPA_Agent"
APP_EXE = str(Path(__file__).parent / "main.py")  # replaced by .exe path in build


def _load_cfg() -> dict:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _draw_svg_icon(icon_type: str, custom_color: str = None) -> QIcon:
    """Draw professional minimalist outline icons programmatically using QPainter."""
    icon = QIcon()
    
    # We define states: Normal (inactive tab color), Active/Selected (MXV Cyan color)
    if custom_color:
        states = [(custom_color, QIcon.Mode.Normal, QIcon.State.Off)]
    else:
        states = [
            ("#64748b", QIcon.Mode.Normal, QIcon.State.Off),
            ("#1CAEE6", QIcon.Mode.Active, QIcon.State.On),
            ("#1CAEE6", QIcon.Mode.Selected, QIcon.State.On),
        ]
    
    for color_str, mode, state in states:
        pix = QPixmap(32, 32)
        pix.fill(Qt.GlobalColor.transparent)
        
        painter = QPainter(pix)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        pen = QPen(QColor(color_str))
        pen.setWidthF(2.2)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
        painter.setPen(pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        
        if icon_type == "connection":
            # Diagonal chain link style
            painter.translate(16, 16)
            painter.rotate(-45)
            # Left link
            painter.drawRoundedRect(QRectF(-9, -4, 9, 8), 3, 3)
            # Right link
            painter.drawRoundedRect(QRectF(-1, -4, 9, 8), 3, 3)
            
        elif icon_type == "folder":
            # Modern folder icon
            path = QPainterPath()
            path.moveTo(6, 9)
            path.lineTo(13, 9)
            path.lineTo(16, 12)
            path.lineTo(26, 12)
            path.lineTo(26, 23)
            path.lineTo(6, 23)
            path.closeSubpath()
            painter.drawPath(path)
            
        elif icon_type == "startup":
            # Sleek rocket icon
            path = QPainterPath()
            path.moveTo(16, 6)
            path.cubicTo(19, 10, 19, 17, 21, 21)
            path.lineTo(11, 21)
            path.cubicTo(13, 17, 13, 10, 16, 6)
            painter.drawPath(path)
            # Fins
            painter.drawLine(11, 21, 7, 25)
            painter.drawLine(21, 21, 25, 25)
            # Engine Flame
            painter.drawLine(15, 22, 15, 25)
            painter.drawLine(16, 22, 16, 27)
            painter.drawLine(17, 22, 17, 25)

        elif icon_type == "guide":
            # Question mark icon
            path = QPainterPath()
            path.moveTo(12, 11)
            path.cubicTo(12, 8, 20, 8, 20, 13)
            path.cubicTo(20, 17, 16, 17, 16, 20)
            painter.drawPath(path)
            painter.setBrush(QColor(color_str))
            painter.drawEllipse(QRectF(14.5, 22.5, 3, 3))
            painter.setBrush(Qt.BrushStyle.NoBrush)
            
        elif icon_type == "save":
            # Checkmark icon (modern replacement for floppy disk)
            path = QPainterPath()
            path.moveTo(8, 16)
            path.lineTo(13, 21)
            path.lineTo(24, 10)
            painter.drawPath(path)
            
        elif icon_type == "search":
            # Magnifying glass
            painter.drawEllipse(QRectF(7, 7, 11, 11))
            painter.drawLine(15, 15, 23, 23)
            
        elif icon_type == "eye":
            # Sleek eye icon
            path = QPainterPath()
            path.moveTo(6, 16)
            path.quadTo(16, 7, 26, 16)
            path.quadTo(16, 25, 6, 16)
            painter.drawPath(path)
            painter.setBrush(QColor(color_str))
            painter.drawEllipse(QRectF(13, 13, 6, 6))
            
        elif icon_type == "open_folder":
            # Sleek open folder icon
            path = QPainterPath()
            path.moveTo(6, 11)
            path.lineTo(12, 11)
            path.lineTo(14, 14)
            path.lineTo(24, 14)
            path.lineTo(24, 23)
            path.lineTo(6, 23)
            path.closeSubpath()
            painter.drawPath(path)
            painter.drawLine(8, 14, 22, 14)
            
        elif icon_type == "clear":
            # Clean diagonal cross for Cancel button
            painter.drawLine(9, 9, 23, 23)
            painter.drawLine(23, 9, 9, 23)
            
        painter.end()
        icon.addPixmap(pix, mode, state)
        
    return icon


def _save_cfg(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

class SettingsWindow(QDialog):
    def __init__(self, core: "AgentCore", parent=None) -> None:
        super().__init__(parent)
        self._core = core
        self.setWindowTitle("MXV RPA Agent — Cài đặt")
        self.setMinimumWidth(560)
        self.setModal(False)

        font = QFont("Segoe UI", 10)
        self.setFont(font)

        # Apply premium design system QSS stylesheet
        self.setStyleSheet("""
            QDialog {
                background-color: #f8fafc;
            }
            QTabWidget::pane {
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background-color: #ffffff;
                top: -1px;
                padding: 16px;
            }
            QTabWidget::tab-bar {
                left: 4px;
            }
            QTabBar::tab {
                background-color: #f1f5f9;
                color: #64748b;
                border: 1px solid #e2e8f0;
                border-bottom: none;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                padding: 10px 20px;
                font-weight: 600;
                margin-right: 6px;
            }
            QTabBar::tab:hover {
                background-color: #e2e8f0;
                color: #334155;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                color: #1CAEE6;
                border-color: #e2e8f0;
                border-bottom: 2px solid #ffffff;
            }
            QLabel {
                color: #475569;
                font-weight: 600;
                font-size: 9.5pt;
            }
            QLineEdit, QSpinBox {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 8px 12px;
                color: #0f172a;
                font-size: 9.5pt;
            }
            QLineEdit:focus, QSpinBox:focus {
                border: 2px solid #1CAEE6;
                background-color: #f8fafc;
            }
            QCheckBox {
                spacing: 10px;
                color: #334155;
                font-size: 9.5pt;
                font-weight: 500;
            }
            QCheckBox::indicator {
                width: 20px;
                height: 20px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background-color: #ffffff;
            }
            QCheckBox::indicator:unchecked:hover {
                border-color: #94a3b8;
                background-color: #f8fafc;
            }
            QCheckBox::indicator:checked {
                background-color: #1CAEE6;
                border-color: #1CAEE6;
            }
            QPushButton {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 10px 20px;
                color: #334155;
                font-weight: 600;
                font-size: 9.5pt;
            }
            QPushButton:hover {
                background-color: #f1f5f9;
                border-color: #94a3b8;
            }
            QPushButton#BtnSave {
                background-color: #1CAEE6;
                border: 1px solid #1CAEE6;
                color: #ffffff;
            }
            QPushButton#BtnSave:hover {
                background-color: #1898ca;
                border-color: #1898ca;
            }
            QPushButton#BtnSave:pressed {
                background-color: #127aa4;
                border-color: #127aa4;
            }
            QPushButton#BtnCancel {
                background-color: #f1f5f9;
                border: 1px solid #e2e8f0;
                color: #475569;
            }
            QPushButton#BtnCancel:hover {
                background-color: #e2e8f0;
                border-color: #cbd5e1;
                color: #334155;
            }
            QScrollBar:vertical {
                border: none;
                background: #f1f5f9;
                width: 8px;
                margin: 0px;
                border-radius: 4px;
            }
            QScrollBar::handle:vertical {
                background: #cbd5e1;
                min-height: 20px;
                border-radius: 4px;
            }
            QScrollBar::handle:vertical:hover {
                background: #94a3b8;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
        """)

        self._cfg = _load_cfg()
        self._build_ui()
        self._load_values()
        self.retranslate_ui()

    # ── UI Build ──────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 16)
        layout.setSpacing(14)

        # Tabs
        self._tabs = QTabWidget()
        self._tabs.addTab(self._build_connection_tab(), _draw_svg_icon("connection"), "")
        self._tabs.addTab(self._build_startup_tab(),   _draw_svg_icon("startup"),    "")
        self._tabs.addTab(self._build_guide_tab(),     _draw_svg_icon("guide"),      "")
        layout.addWidget(self._tabs)

        # Buttons
        btn_box = QDialogButtonBox()
        self._btn_save = QPushButton()
        self._btn_save.setObjectName("BtnSave")
        self._btn_save.setIcon(_draw_svg_icon("save", "#ffffff"))
        self._btn_cancel = QPushButton()
        self._btn_cancel.setObjectName("BtnCancel")
        self._btn_cancel.setIcon(_draw_svg_icon("clear", "#475569"))
        btn_box.addButton(self._btn_save,   QDialogButtonBox.ButtonRole.AcceptRole)
        btn_box.addButton(self._btn_cancel, QDialogButtonBox.ButtonRole.RejectRole)
        btn_box.accepted.connect(self._on_save)
        btn_box.rejected.connect(self.close)
        layout.addWidget(btn_box)


    def _build_connection_tab(self) -> QWidget:
        tab = QWidget()
        tab.setObjectName("TabConnection")
        form = QFormLayout(tab)
        form.setContentsMargins(16, 20, 16, 16)
        form.setSpacing(14)

        # Backend URL
        self._url_edit = QLineEdit()
        self._conn_form = form
        form.addRow("", self._url_edit)

        # API Key (masked)
        key_row = QHBoxLayout()
        key_row.setContentsMargins(0, 0, 0, 0)
        key_row.setSpacing(8)
        self._key_edit = QLineEdit()
        self._key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self._btn_reveal = QPushButton()
        self._btn_reveal.setIcon(_draw_svg_icon("eye"))
        self._btn_reveal.setFixedWidth(32)
        self._btn_reveal.setCheckable(True)
        self._btn_reveal.toggled.connect(
            lambda checked: self._key_edit.setEchoMode(
                QLineEdit.EchoMode.Normal if checked else QLineEdit.EchoMode.Password
            )
        )
        key_row.addWidget(self._key_edit)
        key_row.addWidget(self._btn_reveal)
        key_widget = QWidget()
        key_widget.setObjectName("KeyWidget")
        key_widget.setStyleSheet("background: transparent;")
        key_widget.setLayout(key_row)
        form.addRow("", key_widget)

        # Polling interval
        self._poll_spin = QSpinBox()
        self._poll_spin.setRange(3, 30)
        form.addRow("", self._poll_spin)

        # Heartbeat interval
        self._hb_spin = QSpinBox()
        self._hb_spin.setRange(10, 120)
        form.addRow("", self._hb_spin)

        # Test connection button
        test_row = QHBoxLayout()
        test_row.setContentsMargins(0, 0, 0, 0)
        test_row.setSpacing(8)
        self._btn_test = QPushButton()
        self._btn_test.setIcon(_draw_svg_icon("search", "#1CAEE6"))
        self._btn_test.clicked.connect(self._test_connection)
        self._test_label = QLabel("")
        self._test_label.setWordWrap(True)
        self._test_label.setStyleSheet("font-weight: bold;")
        test_row.addWidget(self._btn_test)
        test_row.addWidget(self._test_label)
        test_row.addStretch()
        test_widget = QWidget()
        test_widget.setObjectName("TestWidget")
        test_widget.setStyleSheet("background: transparent;")
        test_widget.setLayout(test_row)
        form.addRow("", test_widget)

        return tab

    def _build_guide_tab(self) -> QWidget:
        """Self-onboarding guide tab — content populated by _rebuild_guide_content()."""
        outer = QWidget()
        outer.setObjectName("TabGuide")
        outer_layout = QVBoxLayout(outer)
        outer_layout.setContentsMargins(0, 0, 0, 0)
        self._guide_scroll = QScrollArea()
        self._guide_scroll.setWidgetResizable(True)
        self._guide_scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._guide_scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")
        outer_layout.addWidget(self._guide_scroll)
        return outer

    def _rebuild_guide_content(self) -> None:
        """Rebuild guide tab content using current language. Called on init + lang switch."""
        content = QWidget()
        content.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(content)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(16)

        def sec(key: str) -> QLabel:
            lbl = QLabel(i18n.t(key))
            lbl.setStyleSheet(
                "font-size: 10.5pt; font-weight: bold; color: #1CAEE6;"
                "border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;"
            )
            return lbl

        def step(key: str) -> QLabel:
            lbl = QLabel(i18n.t(key))
            lbl.setWordWrap(True)
            lbl.setStyleSheet("font-size: 9.5pt; color: #334155;")
            return lbl

        def box(key: str, color: str = "#e0f2fe", border: str = "#1CAEE6") -> QLabel:
            lbl = QLabel(i18n.t(key))
            lbl.setWordWrap(True)
            lbl.setStyleSheet(
                f"background-color: {color}; border-left: 3px solid {border};"
                "border-radius: 4px; padding: 8px 12px; font-size: 9pt; color: #0f172a;"
            )
            return lbl

        layout.addWidget(sec("guide_setup_title"))
        layout.addWidget(step("guide_step1_label"))
        layout.addWidget(box("guide_step1_box"))
        layout.addWidget(step("guide_step2_label"))
        layout.addWidget(box("guide_step2_box", "#fef9c3", "#f59e0b"))
        layout.addWidget(step("guide_step3_label"))
        layout.addSpacing(4)

        layout.addWidget(sec("guide_tray_title"))
        layout.addWidget(step("guide_tray_desc"))
        for key in ["guide_tray_green", "guide_tray_red", "guide_tray_yellow"]:
            row = QLabel(f"  •  {i18n.t(key)}")
            row.setWordWrap(True)
            row.setStyleSheet("font-size: 9.5pt; color: #334155; padding: 2px 0;")
            layout.addWidget(row)
        layout.addSpacing(4)

        layout.addWidget(sec("guide_trouble_title"))
        for q, a in [("guide_trouble_1_q", "guide_trouble_1_a"),
                     ("guide_trouble_2_q", "guide_trouble_2_a"),
                     ("guide_trouble_3_q", "guide_trouble_3_a")]:
            layout.addWidget(step(q))
            layout.addWidget(box(a, "#f1f5f9", "#94a3b8"))
            layout.addSpacing(2)
        layout.addSpacing(4)

        layout.addWidget(sec("guide_contact_title"))
        layout.addWidget(box("guide_contact_box", "#f0fdf4", "#22c55e"))
        layout.addStretch()
        self._guide_scroll.setWidget(content)

    def _build_startup_tab(self) -> QWidget:
        tab = QWidget()
        tab.setObjectName("TabStartup")
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(16, 20, 16, 16)
        layout.setSpacing(14)

        self._chk_autostart    = QCheckBox()
        self._chk_minimized    = QCheckBox()
        self._chk_notifications = QCheckBox()

        # Duration settings spinbox
        duration_layout = QHBoxLayout()
        duration_layout.setContentsMargins(0, 0, 0, 0)
        duration_layout.setSpacing(8)
        self._lbl_duration = QLabel()
        self._duration_spin = QSpinBox()
        self._duration_spin.setRange(3, 60)
        self._duration_spin.setValue(10)
        self._duration_spin.setFixedWidth(110)
        duration_layout.addWidget(self._lbl_duration)
        duration_layout.addWidget(self._duration_spin)
        duration_layout.addStretch()

        layout.addWidget(self._chk_autostart)
        layout.addWidget(self._chk_minimized)
        layout.addWidget(self._chk_notifications)
        layout.addLayout(duration_layout)
        layout.addStretch()

        self._note_registry = QLabel()
        self._note_registry.setStyleSheet("color: #71717a; font-size: 9pt;")
        layout.addWidget(self._note_registry)

        return tab

    # ── Retranslate UI ────────────────────────────────────────────────────────

    def retranslate_ui(self) -> None:
        """Update all UI text from i18n. Call after language change."""
        self.setWindowTitle(i18n.t("settings_title"))
        # Tabs
        self._tabs.setTabText(0, i18n.t("tab_connection"))
        self._tabs.setTabText(1, i18n.t("tab_startup"))
        self._tabs.setTabText(2, i18n.t("tab_guide"))
        # Buttons
        self._btn_save.setText(i18n.t("btn_save"))
        self._btn_cancel.setText(i18n.t("btn_cancel"))
        self._btn_test.setText(i18n.t("btn_test_conn"))
        # Connection form labels (row 0-3)
        self._conn_form.setWidget(0, QFormLayout.ItemRole.LabelRole,
                                  QLabel(i18n.t("lbl_backend_url")))
        self._conn_form.setWidget(1, QFormLayout.ItemRole.LabelRole,
                                  QLabel(i18n.t("lbl_api_key")))
        self._conn_form.setWidget(2, QFormLayout.ItemRole.LabelRole,
                                  QLabel(i18n.t("lbl_poll_interval")))
        self._conn_form.setWidget(3, QFormLayout.ItemRole.LabelRole,
                                  QLabel(i18n.t("lbl_hb_interval")))
        # Placeholders
        self._url_edit.setPlaceholderText(i18n.t("placeholder_url"))
        self._key_edit.setPlaceholderText(i18n.t("placeholder_key"))
        # Spin suffixes
        self._poll_spin.setSuffix(i18n.t("seconds_suffix"))
        self._hb_spin.setSuffix(i18n.t("seconds_suffix"))
        self._duration_spin.setSuffix(i18n.t("seconds_suffix"))
        # Startup tab
        self._chk_autostart.setText(i18n.t("chk_autostart"))
        self._chk_minimized.setText(i18n.t("chk_minimized"))
        self._chk_notifications.setText(i18n.t("chk_notifications"))
        self._lbl_duration.setText(i18n.t("lbl_notif_duration"))
        self._note_registry.setText(i18n.t("note_registry"))
        # Guide tab — rebuild content with current language
        self._rebuild_guide_content()

    # ── Logic ─────────────────────────────────────────────────────────────────

    def _load_values(self) -> None:
        cfg = self._cfg
        self._url_edit.setText(cfg.get("backend_url", ""))
        self._key_edit.setText(cfg.get("api_key", ""))
        self._poll_spin.setValue(cfg.get("polling_interval", 5))
        self._hb_spin.setValue(cfg.get("heartbeat_interval", 30))


        self._chk_minimized.setChecked(cfg.get("start_minimized", False))
        self._chk_notifications.setChecked(cfg.get("enable_notifications", True))
        self._duration_spin.setValue(cfg.get("notification_duration", 10))
        self._chk_autostart.setChecked(self._is_autostart_set())

    def _on_save(self) -> None:
        cfg = self._cfg
        cfg["backend_url"] = self._url_edit.text().strip()
        cfg["api_key"] = self._key_edit.text().strip()
        cfg["polling_interval"] = self._poll_spin.value()
        cfg["heartbeat_interval"] = self._hb_spin.value()
        cfg["start_minimized"] = self._chk_minimized.isChecked()
        cfg["enable_notifications"] = self._chk_notifications.isChecked()
        cfg["notification_duration"] = self._duration_spin.value()

        _save_cfg(cfg)

        # Apply autostart registry
        if self._chk_autostart.isChecked():
            self._set_autostart(True)
        else:
            self._set_autostart(False)

        # Hot-reload agent if running
        if self._core.is_running:
            self._core.reload_config()

        QMessageBox.information(self, i18n.t("msg_saved_title"), i18n.t("msg_saved"))
        self.close()

    def _test_connection(self) -> None:
        url = self._url_edit.text().strip().rstrip("/")
        key = self._key_edit.text().strip()
        if not url or not key:
            self._test_label.setText(i18n.t("conn_missing"))
            return
        try:
            import requests
            r = requests.get(
                f"{url}/api/v1/bot-engine/agent/status",
                headers={"x-agent-api-key": key},
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                online_str = "Online" if data.get("online") else "Not started"
                self._test_label.setStyleSheet("color: green; font-weight: bold;")
                self._test_label.setText(f"{i18n.t('conn_ok')} — {online_str}")
            else:
                self._test_label.setStyleSheet("color: red; font-weight: bold;")
                self._test_label.setText(f"HTTP {r.status_code}")
        except Exception as e:
            self._test_label.setStyleSheet("color: red; font-weight: bold;")
            self._test_label.setText(f"{str(e)[:60]}")


    # ── Registry autostart ────────────────────────────────────────────────────

    def _is_autostart_set(self) -> bool:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                 r"Software\Microsoft\Windows\CurrentVersion\Run")
            winreg.QueryValueEx(key, APP_NAME)
            winreg.CloseKey(key)
            return True
        except FileNotFoundError:
            return False

    def _set_autostart(self, enable: bool) -> None:
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_SET_VALUE,
            )
            if enable:
                import sys
                exe_path = sys.executable if sys.executable.endswith(".exe") else APP_EXE
                winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
            else:
                try:
                    winreg.DeleteValue(key, APP_NAME)
                except FileNotFoundError:
                    pass
            winreg.CloseKey(key)
        except Exception as e:
            QMessageBox.warning(self, i18n.t("err_registry_title"),
                                i18n.t("err_registry_msg", e=e))

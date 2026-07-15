"""
settings_window.py — MXV RPA Agent Settings Window
A QDialog with 3 tabs: Connection, File Paths, Startup.
"""

from __future__ import annotations

import json
import winreg
from pathlib import Path
from typing import TYPE_CHECKING

from PyQt6.QtWidgets import (
    QDialog, QTabWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QFormLayout, QLineEdit, QPushButton, QSpinBox, QLabel,
    QCheckBox, QFileDialog, QMessageBox, QDialogButtonBox,
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
        self.setMinimumWidth(520)
        self.setModal(False)

        font = QFont("Segoe UI", 10)
        self.setFont(font)

        arrow_up = str((Path(__file__).parent / "assets" / "arrow_up.png").as_posix())
        arrow_down = str((Path(__file__).parent / "assets" / "arrow_down.png").as_posix())

        # Apply a premium light mode corporate stylesheet matching MXV brand identity (Cyan)
        self.setStyleSheet(("""
            QDialog {
                background-color: #f8fafc; /* Slate 50 */
                color: #0f172a; /* Slate 900 */
            }
            QLabel {
                color: #334155; /* Slate 700 */
                font-size: 9.5pt;
            }
            QLineEdit {
                background-color: #ffffff;
                color: #0f172a;
                border: 1px solid #cbd5e1; /* Slate 300 */
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 9.5pt;
            }
            QLineEdit:focus {
                border: 1px solid #1CAEE6; /* MXV Brand Cyan */
                background-color: #eaf8fe; /* Soft cyan focus background */
            }
            QSpinBox {
                background-color: #ffffff;
                color: #0f172a;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 5px 30px 5px 8px; /* space for buttons on right */
                font-size: 9.5pt;
            }
            QSpinBox:focus {
                border: 1px solid #1CAEE6;
            }
            QSpinBox::up-button {
                subcontrol-origin: border;
                subcontrol-position: top right;
                width: 20px;
                border-left: 1px solid #cbd5e1;
                border-top-right-radius: 5px;
                background-color: #f8fafc;
            }
            QSpinBox::up-button:hover {
                background-color: #f1f5f9;
            }
            QSpinBox::up-button:pressed {
                background-color: #e2e8f0;
            }
            QSpinBox::down-button {
                subcontrol-origin: border;
                subcontrol-position: bottom right;
                width: 20px;
                border-left: 1px solid #cbd5e1;
                border-top: 1px solid #cbd5e1;
                border-bottom-right-radius: 5px;
                background-color: #f8fafc;
            }
            QSpinBox::down-button:hover {
                background-color: #f1f5f9;
            }
            QSpinBox::down-button:pressed {
                background-color: #e2e8f0;
            }
            QSpinBox::up-arrow {
                image: url(ARROW_UP_PATH);
                width: 10px;
                height: 10px;
            }
            QSpinBox::down-arrow {
                image: url(ARROW_DOWN_PATH);
                width: 10px;
                height: 10px;
            }
            QTabWidget::pane {
                border: 1px solid #cbd5e1;
                background-color: #ffffff;
                border-radius: 8px;
            }
            QTabBar::tab {
                background-color: #f1f5f9; /* Slate 100 */
                color: #64748b; /* Slate 500 */
                padding: 8px 16px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                border-bottom: 2px solid transparent;
                font-weight: bold;
                margin-right: 4px;
            }
            QTabBar::tab:hover {
                color: #0f172a;
                background-color: #e2e8f0;
            }
            QTabBar::tab:selected {
                color: #1CAEE6; /* MXV Brand Cyan */
                background-color: #ffffff;
                border-bottom: 2px solid #1CAEE6;
            }
            QCheckBox {
                color: #334155;
                spacing: 8px;
            }
            QCheckBox::indicator {
                width: 18px;
                height: 18px;
                border: 1.5px solid #94a3b8; /* Slate 400 */
                border-radius: 4px;
                background-color: #ffffff;
            }
            QCheckBox::indicator:hover {
                border-color: #1CAEE6;
            }
            QCheckBox::indicator:checked {
                background-color: #1CAEE6;
                border-color: #1CAEE6;
            }
            QPushButton {
                background-color: #ffffff;
                color: #0f172a;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 6px 14px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #f8fafc;
                border-color: #94a3b8;
            }
            QPushButton:pressed {
                background-color: #e2e8f0;
            }
            QWidget#TabConnection, QWidget#TabPaths, QWidget#TabStartup {
                background-color: #ffffff;
                border-radius: 8px;
            }
        """).replace("ARROW_UP_PATH", arrow_up).replace("ARROW_DOWN_PATH", arrow_down))

        self._cfg = _load_cfg()
        self._build_ui()
        self._load_values()

    # ── UI Build ──────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 12)
        layout.setSpacing(12)



        # Tabs
        tabs = QTabWidget()
        tabs.setIconSize(QSize(18, 18))
        tabs.addTab(self._build_connection_tab(), _draw_svg_icon("connection"), "Kết nối")
        tabs.addTab(self._build_paths_tab(), _draw_svg_icon("folder"), "Đường dẫn")
        tabs.addTab(self._build_startup_tab(), _draw_svg_icon("startup"), "Khởi động")
        layout.addWidget(tabs)

        # Buttons
        btn_box = QDialogButtonBox()
        self._btn_save = QPushButton("Lưu & Áp dụng")
        self._btn_save.setIcon(_draw_svg_icon("save", "#ffffff"))
        self._btn_save.setStyleSheet(
            "QPushButton { background-color: #1CAEE6; color: white; border: none; padding: 6px 18px; font-weight: bold; }"
            "QPushButton:hover { background-color: #00ADEF; }"
        )
        btn_cancel = QPushButton("Huỷ")
        btn_cancel.setStyleSheet(
            "QPushButton { background-color: transparent; color: #64748b; border: 1px solid #cbd5e1; padding: 6px 18px; }"
            "QPushButton:hover { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: #ef4444; }"
        )
        btn_box.addButton(self._btn_save, QDialogButtonBox.ButtonRole.AcceptRole)
        btn_box.addButton(btn_cancel, QDialogButtonBox.ButtonRole.RejectRole)
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
        self._url_edit.setPlaceholderText("http://192.168.1.100")
        form.addRow("Backend URL:", self._url_edit)

        # API Key (masked)
        key_row = QHBoxLayout()
        key_row.setContentsMargins(0, 0, 0, 0)
        key_row.setSpacing(8)
        self._key_edit = QLineEdit()
        self._key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self._key_edit.setPlaceholderText("mxv_rpa_secure_agent_key_...")
        btn_reveal = QPushButton()
        btn_reveal.setIcon(_draw_svg_icon("eye"))
        btn_reveal.setFixedWidth(32)
        btn_reveal.setCheckable(True)
        btn_reveal.toggled.connect(
            lambda checked: self._key_edit.setEchoMode(
                QLineEdit.EchoMode.Normal if checked else QLineEdit.EchoMode.Password
            )
        )
        key_row.addWidget(self._key_edit)
        key_row.addWidget(btn_reveal)
        key_widget = QWidget()
        key_widget.setObjectName("KeyWidget")
        key_widget.setStyleSheet("background: transparent;")
        key_widget.setLayout(key_row)
        form.addRow("API Key:", key_widget)

        # Polling interval
        self._poll_spin = QSpinBox()
        self._poll_spin.setRange(3, 30)
        self._poll_spin.setSuffix(" giây")
        form.addRow("Polling interval:", self._poll_spin)

        # Heartbeat interval
        self._hb_spin = QSpinBox()
        self._hb_spin.setRange(10, 120)
        self._hb_spin.setSuffix(" giây")
        form.addRow("Heartbeat interval:", self._hb_spin)

        # Test connection button
        test_row = QHBoxLayout()
        test_row.setContentsMargins(0, 0, 0, 0)
        test_row.setSpacing(8)
        btn_test = QPushButton("Kiểm tra kết nối")
        btn_test.setIcon(_draw_svg_icon("search"))
        btn_test.clicked.connect(self._test_connection)
        self._test_label = QLabel("")
        self._test_label.setStyleSheet("font-weight: bold;")
        test_row.addWidget(btn_test)
        test_row.addWidget(self._test_label)
        test_row.addStretch()
        test_widget = QWidget()
        test_widget.setObjectName("TestWidget")
        test_widget.setStyleSheet("background: transparent;")
        test_widget.setLayout(test_row)
        form.addRow("", test_widget)

        return tab

    def _build_paths_tab(self) -> QWidget:
        tab = QWidget()
        tab.setObjectName("TabPaths")
        form = QFormLayout(tab)
        form.setContentsMargins(16, 20, 16, 16)
        form.setSpacing(14)

        self._workspace_edit   = self._path_row(form, "Thư mục Backend NestJS:", file=False)
        self._lot_macro_edit   = self._path_row(form, "Macro Số Lot (.xlsm):",   file=True,  ext="Excel Macro (*.xlsm)")
        self._value_macro_edit = self._path_row(form, "Macro Giá Trị (.xlsm):",  file=True,  ext="Excel Macro (*.xlsm)")
        self._ms_backup_edit   = self._path_row(form, "Thư mục Backup MS:",       file=False)
        self._acm_backup_edit  = self._path_row(form, "Thư mục Backup ACM:",      file=False)

        return tab

    def _path_row(self, form: QFormLayout, label: str, file: bool, ext: str = "") -> QLineEdit:
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(8)
        edit = QLineEdit()
        btn = QPushButton()
        btn.setIcon(_draw_svg_icon("open_folder"))
        btn.setFixedWidth(36)
        if file:
            btn.clicked.connect(lambda _, e=edit, x=ext: self._browse_file(e, x))
        else:
            btn.clicked.connect(lambda _, e=edit: self._browse_dir(e))
        row.addWidget(edit)
        row.addWidget(btn)
        widget = QWidget()
        widget.setObjectName("PathRowWidget")
        widget.setStyleSheet("background: transparent;")
        widget.setLayout(row)
        form.addRow(label, widget)
        return edit

    def _build_startup_tab(self) -> QWidget:
        tab = QWidget()
        tab.setObjectName("TabStartup")
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(16, 20, 16, 16)
        layout.setSpacing(14)

        self._chk_autostart = QCheckBox("Tự chạy Agent khi Windows khởi động")
        self._chk_minimized = QCheckBox("Khởi động ở chế độ tối giản (chỉ hiện tray)")
        self._chk_notifications = QCheckBox("Hiển thị thông báo màn hình (Windows Toast)")

        # Duration settings spinbox
        duration_layout = QHBoxLayout()
        duration_layout.setContentsMargins(0, 0, 0, 0)
        duration_layout.setSpacing(8)
        duration_label = QLabel("Thời gian tự đóng thông báo (giây):")
        self._duration_spin = QSpinBox()
        self._duration_spin.setRange(3, 60)
        self._duration_spin.setValue(10)
        self._duration_spin.setFixedWidth(70)
        duration_layout.addWidget(duration_label)
        duration_layout.addWidget(self._duration_spin)
        duration_layout.addStretch()

        layout.addWidget(self._chk_autostart)
        layout.addWidget(self._chk_minimized)
        layout.addWidget(self._chk_notifications)
        layout.addLayout(duration_layout)
        layout.addStretch()

        note = QLabel("💡 Tự chạy được ghi vào Windows Registry (HKCU\\...\\Run).")
        note.setStyleSheet("color: #71717a; font-size: 9pt;")
        layout.addWidget(note)

        return tab

    # ── Logic ─────────────────────────────────────────────────────────────────

    def _load_values(self) -> None:
        cfg = self._cfg
        self._url_edit.setText(cfg.get("backend_url", ""))
        self._key_edit.setText(cfg.get("api_key", ""))
        self._poll_spin.setValue(cfg.get("polling_interval", 5))
        self._hb_spin.setValue(cfg.get("heartbeat_interval", 30))

        self._workspace_edit.setText(cfg.get("workspace_path", ""))
        paths = cfg.get("paths", {})
        self._lot_macro_edit.setText(paths.get("lot_macro_path", ""))
        self._value_macro_edit.setText(paths.get("value_macro_path", ""))
        self._ms_backup_edit.setText(paths.get("ms_backup_futures", ""))
        self._acm_backup_edit.setText(paths.get("acm_backup", ""))

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
        cfg["workspace_path"] = self._workspace_edit.text().strip()
        cfg.setdefault("paths", {})
        cfg["paths"]["lot_macro_path"]    = self._lot_macro_edit.text().strip()
        cfg["paths"]["value_macro_path"]  = self._value_macro_edit.text().strip()
        cfg["paths"]["ms_backup_futures"] = self._ms_backup_edit.text().strip()
        cfg["paths"]["acm_backup"]        = self._acm_backup_edit.text().strip()
        _save_cfg(cfg)

        # Apply autostart registry
        if self._chk_autostart.isChecked():
            self._set_autostart(True)
        else:
            self._set_autostart(False)

        # Hot-reload agent if running
        if self._core.is_running:
            self._core.reload_config()

        QMessageBox.information(self, "Đã lưu", "Cài đặt đã được lưu và áp dụng.")
        self.close()

    def _test_connection(self) -> None:
        url = self._url_edit.text().strip().rstrip("/")
        key = self._key_edit.text().strip()
        if not url or not key:
            self._test_label.setText("Nhập URL và API Key trước")
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
                online_str = "Online" if data.get("online") else "Agent chưa khởi động"
                self._test_label.setStyleSheet("color: green;")
                self._test_label.setText(f"Kết nối OK — {online_str}")
            else:
                self._test_label.setStyleSheet("color: red;")
                self._test_label.setText(f"HTTP {r.status_code}")
        except Exception as e:
            self._test_label.setStyleSheet("color: red;")
            self._test_label.setText(f"{str(e)[:60]}")

    def _browse_file(self, edit: QLineEdit, ext: str) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "Chọn file", "", ext)
        if path:
            edit.setText(path)

    def _browse_dir(self, edit: QLineEdit) -> None:
        path = QFileDialog.getExistingDirectory(self, "Chọn thư mục")
        if path:
            edit.setText(path)

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
            QMessageBox.warning(self, "Lỗi Registry", f"Không thể cập nhật autostart:\n{e}")

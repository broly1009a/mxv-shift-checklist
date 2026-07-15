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
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

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


def _save_cfg(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


class SettingsWindow(QDialog):
    def __init__(self, core: "AgentCore", parent=None) -> None:
        super().__init__(parent)
        self._core = core
        self.setWindowTitle("⚙ MXV RPA Agent — Cài đặt")
        self.setMinimumWidth(520)
        self.setModal(False)

        font = QFont("Segoe UI", 10)
        self.setFont(font)

        self._cfg = _load_cfg()
        self._build_ui()
        self._load_values()

    # ── UI Build ──────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 12)
        layout.setSpacing(12)

        # Header
        header = QLabel("⚙ MXV RPA Agent — Cài đặt")
        header.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
        header.setStyleSheet("color: #1a2744; margin-bottom: 4px;")
        layout.addWidget(header)

        # Tabs
        tabs = QTabWidget()
        tabs.addTab(self._build_connection_tab(), "🔗 Kết nối")
        tabs.addTab(self._build_paths_tab(), "📁 Đường dẫn")
        tabs.addTab(self._build_startup_tab(), "🚀 Khởi động")
        layout.addWidget(tabs)

        # Buttons
        btn_box = QDialogButtonBox()
        self._btn_save = QPushButton("💾 Lưu & Áp dụng")
        self._btn_save.setStyleSheet(
            "QPushButton { background: #1a2744; color: white; padding: 6px 18px; "
            "border-radius: 4px; font-weight: bold; }"
            "QPushButton:hover { background: #2c3e6b; }"
        )
        btn_cancel = QPushButton("Huỷ")
        btn_box.addButton(self._btn_save, QDialogButtonBox.ButtonRole.AcceptRole)
        btn_box.addButton(btn_cancel, QDialogButtonBox.ButtonRole.RejectRole)
        btn_box.accepted.connect(self._on_save)
        btn_box.rejected.connect(self.close)
        layout.addWidget(btn_box)

    def _build_connection_tab(self) -> QWidget:
        tab = QWidget()
        form = QFormLayout(tab)
        form.setContentsMargins(12, 16, 12, 12)
        form.setSpacing(12)

        # Backend URL
        self._url_edit = QLineEdit()
        self._url_edit.setPlaceholderText("http://192.168.1.100")
        form.addRow("Backend URL:", self._url_edit)

        # API Key (masked)
        key_row = QHBoxLayout()
        self._key_edit = QLineEdit()
        self._key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self._key_edit.setPlaceholderText("mxv_rpa_secure_agent_key_...")
        btn_reveal = QPushButton("👁")
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
        btn_test = QPushButton("🔍 Kiểm tra kết nối")
        btn_test.clicked.connect(self._test_connection)
        self._test_label = QLabel("")
        test_row.addWidget(btn_test)
        test_row.addWidget(self._test_label)
        test_row.addStretch()
        test_widget = QWidget()
        test_widget.setLayout(test_row)
        form.addRow("", test_widget)

        return tab

    def _build_paths_tab(self) -> QWidget:
        tab = QWidget()
        form = QFormLayout(tab)
        form.setContentsMargins(12, 16, 12, 12)
        form.setSpacing(12)

        self._workspace_edit   = self._path_row(form, "Thư mục Backend NestJS:", file=False)
        self._lot_macro_edit   = self._path_row(form, "Macro Số Lot (.xlsm):",   file=True,  ext="Excel Macro (*.xlsm)")
        self._value_macro_edit = self._path_row(form, "Macro Giá Trị (.xlsm):",  file=True,  ext="Excel Macro (*.xlsm)")
        self._ms_backup_edit   = self._path_row(form, "Thư mục Backup MS:",       file=False)
        self._acm_backup_edit  = self._path_row(form, "Thư mục Backup ACM:",      file=False)

        return tab

    def _path_row(self, form: QFormLayout, label: str, file: bool, ext: str = "") -> QLineEdit:
        row = QHBoxLayout()
        edit = QLineEdit()
        btn = QPushButton("📂")
        btn.setFixedWidth(36)
        if file:
            btn.clicked.connect(lambda _, e=edit, x=ext: self._browse_file(e, x))
        else:
            btn.clicked.connect(lambda _, e=edit: self._browse_dir(e))
        row.addWidget(edit)
        row.addWidget(btn)
        widget = QWidget()
        widget.setLayout(row)
        form.addRow(label, widget)
        return edit

    def _build_startup_tab(self) -> QWidget:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(12, 16, 12, 12)
        layout.setSpacing(12)

        self._chk_autostart = QCheckBox("Tự chạy Agent khi Windows khởi động")
        self._chk_minimized = QCheckBox("Khởi động ở chế độ tối giản (chỉ hiện tray)")

        layout.addWidget(self._chk_autostart)
        layout.addWidget(self._chk_minimized)
        layout.addStretch()

        note = QLabel("💡 Tự chạy được ghi vào Windows Registry (HKCU\\...\\Run).")
        note.setStyleSheet("color: gray; font-size: 9pt;")
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
        self._chk_autostart.setChecked(self._is_autostart_set())

    def _on_save(self) -> None:
        cfg = self._cfg
        cfg["backend_url"] = self._url_edit.text().strip()
        cfg["api_key"] = self._key_edit.text().strip()
        cfg["polling_interval"] = self._poll_spin.value()
        cfg["heartbeat_interval"] = self._hb_spin.value()
        cfg["start_minimized"] = self._chk_minimized.isChecked()
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

        QMessageBox.information(self, "Đã lưu", "✅ Cài đặt đã được lưu và áp dụng.")
        self.close()

    def _test_connection(self) -> None:
        url = self._url_edit.text().strip().rstrip("/")
        key = self._key_edit.text().strip()
        if not url or not key:
            self._test_label.setText("⚠ Nhập URL và API Key trước")
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
                online_str = "Online ✓" if data.get("online") else "Agent chưa khởi động"
                self._test_label.setStyleSheet("color: green;")
                self._test_label.setText(f"✅ Kết nối OK — {online_str}")
            else:
                self._test_label.setStyleSheet("color: red;")
                self._test_label.setText(f"❌ HTTP {r.status_code}")
        except Exception as e:
            self._test_label.setStyleSheet("color: red;")
            self._test_label.setText(f"❌ {str(e)[:60]}")

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

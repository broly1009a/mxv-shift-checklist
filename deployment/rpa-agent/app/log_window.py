"""
log_window.py — MXV RPA Agent Log Viewer
Realtime log display with filtering, auto-scroll, and export.
"""

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QPlainTextEdit, QComboBox, QLabel, QFileDialog,
)
from PyQt6.QtGui import QFont, QTextCharFormat, QColor, QTextCursor
from PyQt6.QtCore import Qt, pyqtSlot

if TYPE_CHECKING:
    from agent_core import AgentCore

LEVEL_COLORS = {
    "INFO":    "#d4d4d4",
    "WARNING": "#f0c040",
    "ERROR":   "#f47171",
    "DEBUG":   "#7ec8e3",
}


class LogWindow(QWidget):
    def __init__(self, core: "AgentCore", parent=None) -> None:
        super().__init__(parent)
        self._core = core
        self._auto_scroll = True
        self._filter_level = "ALL"
        self._all_entries: list[tuple[str, str]] = []  # [(level, message)]

        self.setWindowTitle("📋 MXV RPA Agent — Log Viewer")
        self.resize(820, 500)
        self._build_ui()

        core.log_emitted.connect(self._on_log)

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        # Toolbar
        toolbar = QHBoxLayout()

        lbl_filter = QLabel("Lọc:")
        self._combo_filter = QComboBox()
        self._combo_filter.addItems(["Tất cả", "INFO", "WARNING", "ERROR"])
        self._combo_filter.currentTextChanged.connect(self._on_filter_changed)

        self._btn_pause = QPushButton("⏸ Dừng cuộn")
        self._btn_pause.setCheckable(True)
        self._btn_pause.toggled.connect(self._on_pause_toggled)

        btn_clear = QPushButton("🔴 Xoá")
        btn_clear.clicked.connect(self._clear)

        btn_export = QPushButton("💾 Export .txt")
        btn_export.clicked.connect(self._export)

        toolbar.addWidget(lbl_filter)
        toolbar.addWidget(self._combo_filter)
        toolbar.addStretch()
        toolbar.addWidget(self._btn_pause)
        toolbar.addWidget(btn_clear)
        toolbar.addWidget(btn_export)
        layout.addLayout(toolbar)

        # Log area
        self._text = QPlainTextEdit()
        self._text.setReadOnly(True)
        self._text.setFont(QFont("Consolas", 9))
        self._text.setStyleSheet(
            "QPlainTextEdit {"
            "  background-color: #1e1e1e;"
            "  color: #d4d4d4;"
            "  border: 1px solid #333;"
            "  border-radius: 4px;"
            "}"
        )
        self._text.setMaximumBlockCount(2000)  # keep last 2000 lines
        layout.addWidget(self._text)

    # ── Slots ─────────────────────────────────────────────────────────────────

    @pyqtSlot(str, str)
    def _on_log(self, level: str, message: str) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        full_msg = f"[{timestamp}] [{level}] {message}"
        self._all_entries.append((level, full_msg))

        if self._filter_level in ("ALL", "Tất cả") or self._filter_level == level:
            self._append_line(level, full_msg)

    def _append_line(self, level: str, text: str) -> None:
        color = LEVEL_COLORS.get(level, "#d4d4d4")
        fmt = QTextCharFormat()
        fmt.setForeground(QColor(color))

        cursor = self._text.textCursor()
        cursor.movePosition(QTextCursor.MoveOperation.End)
        cursor.insertText(text + "\n", fmt)

        if self._auto_scroll:
            self._text.ensureCursorVisible()
            scrollbar = self._text.verticalScrollBar()
            scrollbar.setValue(scrollbar.maximum())

    def _on_filter_changed(self, text: str) -> None:
        level = text if text != "Tất cả" else "ALL"
        self._filter_level = level
        self._redraw()

    def _redraw(self) -> None:
        self._text.clear()
        for lvl, msg in self._all_entries:
            if self._filter_level in ("ALL", lvl):
                self._append_line(lvl, msg)

    def _on_pause_toggled(self, paused: bool) -> None:
        self._auto_scroll = not paused
        self._btn_pause.setText("▶ Tiếp tục cuộn" if paused else "⏸ Dừng cuộn")

    def _clear(self) -> None:
        self._all_entries.clear()
        self._text.clear()

    def _export(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Lưu log ra file",
            f"mxv_agent_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            "Text Files (*.txt)",
        )
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(msg for _, msg in self._all_entries))

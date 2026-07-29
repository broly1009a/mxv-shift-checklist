"""
log_window.py — MXV RPA Agent Log Viewer
Realtime log display with filtering, auto-scroll, and export.
"""

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING

import i18n

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QPlainTextEdit, QComboBox, QLabel, QFileDialog,
)
from PyQt6.QtGui import QFont, QTextCharFormat, QColor, QTextCursor, QPainter, QPainterPath, QPen, QBrush, QPixmap, QIcon
from PyQt6.QtCore import Qt, pyqtSlot, QRectF

if TYPE_CHECKING:
    from agent_core import AgentCore

LEVEL_COLORS = {
    "INFO":    "#a3e635", # Lime-green
    "WARNING": "#fbbf24", # Amber
    "ERROR":   "#f87171", # Red
    "DEBUG":   "#38bdf8", # Sky-blue
}


def _draw_svg_icon(icon_type: str, color_str: str = "#64748b") -> QIcon:
    """Draw clean, modern vector icons for the log viewer programmatically."""
    icon = QIcon()
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
        
        if icon_type == "pause":
            painter.drawLine(9, 7, 9, 17)
            painter.drawLine(15, 7, 15, 17)
            
        elif icon_type == "play":
            painter.setBrush(QColor(c))
            path = QPainterPath()
            path.moveTo(9, 7)
            path.lineTo(16, 12)
            path.lineTo(9, 17)
            path.closeSubpath()
            painter.drawPath(path)
            
        elif icon_type == "clear":
            # Trash can outline
            painter.drawRect(QRectF(8, 8, 8, 10))
            painter.drawLine(6, 8, 18, 8)
            painter.drawLine(10, 6, 14, 6)
            
        elif icon_type == "export":
            # Download arrow / share
            painter.drawRect(QRectF(7, 12, 10, 6))
            painter.drawLine(12, 4, 12, 11)
            painter.drawLine(9, 8, 12, 11)
            painter.drawLine(15, 8, 12, 11)
            
        painter.end()
        icon.addPixmap(pix, mode, state)
        
    return icon


class LogWindow(QWidget):
    def __init__(self, core: "AgentCore", parent=None) -> None:
        super().__init__(parent)
        self._core = core
        self._auto_scroll = True
        self._filter_level = "ALL"
        self._all_entries: list[tuple[str, str]] = []  # [(level, message)]

        self.setWindowTitle("MXV RPA Agent — Log Viewer")
        self.resize(820, 500)
        
        self._build_ui()

        core.log_emitted.connect(self._on_log)
        self.retranslate_ui()

    def retranslate_ui(self) -> None:
        """Update all UI chrome text from i18n. Log content is NOT translated."""
        self.setWindowTitle(i18n.t("log_title"))
        self._lbl_filter.setText(i18n.t("log_filter_label"))
        # Preserve current selection index
        cur = self._combo_filter.currentIndex()
        self._combo_filter.blockSignals(True)
        self._combo_filter.clear()
        self._combo_filter.addItems([
            i18n.t("log_filter_all"), "INFO", "WARNING", "ERROR"
        ])
        self._combo_filter.setCurrentIndex(max(0, cur))
        self._combo_filter.blockSignals(False)
        paused = not self._auto_scroll
        self._btn_pause.setText(i18n.t("btn_resume_scroll") if paused else i18n.t("btn_pause_scroll"))
        self._btn_clear.setText(i18n.t("btn_clear"))
        self._btn_export.setText(i18n.t("btn_export"))

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        # Toolbar
        toolbar = QHBoxLayout()

        self._lbl_filter = QLabel()
        self._lbl_filter.setObjectName("FilterLabel")
        self._combo_filter = QComboBox()
        self._combo_filter.addItems(["Tất cả", "INFO", "WARNING", "ERROR"])
        self._combo_filter.currentTextChanged.connect(self._on_filter_changed)

        self._btn_pause = QPushButton()
        self._btn_pause.setIcon(_draw_svg_icon("pause"))
        self._btn_pause.setCheckable(True)
        self._btn_pause.toggled.connect(self._on_pause_toggled)

        self._btn_clear = QPushButton()
        self._btn_clear.setIcon(_draw_svg_icon("clear"))
        self._btn_clear.clicked.connect(self._clear)

        self._btn_export = QPushButton()
        self._btn_export.setIcon(_draw_svg_icon("export"))
        self._btn_export.clicked.connect(self._export)

        toolbar.addWidget(self._lbl_filter)
        toolbar.addWidget(self._combo_filter)
        toolbar.addStretch()
        toolbar.addWidget(self._btn_pause)
        toolbar.addWidget(self._btn_clear)
        toolbar.addWidget(self._btn_export)
        layout.addLayout(toolbar)

        # Log area
        self._text = QPlainTextEdit()
        self._text.setReadOnly(True)
        self._text.setFont(QFont("Consolas", 9))
        self._text.setStyleSheet(
            "QPlainTextEdit {"
            "  background-color: #1e1e1e;"
            "  color: #d4d4d4;"
            "  border: 1px solid #cbd5e1;"
            "  border-radius: 4px;"
            "}"
        )
        self._text.setMaximumBlockCount(2000)
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
        self._btn_pause.setText(i18n.t("btn_resume_scroll") if paused else i18n.t("btn_pause_scroll"))
        self._btn_pause.setIcon(_draw_svg_icon("play" if paused else "pause"))

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

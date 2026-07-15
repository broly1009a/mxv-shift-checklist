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
        
        # Apply theme stylesheet
        self.setStyleSheet("""
            QWidget {
                background-color: #f8fafc; /* Slate 50 */
                color: #0f172a; /* Slate 900 */
            }
            QLabel {
                color: #334155;
                font-size: 9.5pt;
            }
            QComboBox {
                background-color: #ffffff;
                color: #0f172a;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 9.5pt;
            }
            QComboBox:focus {
                border: 1px solid #1CAEE6;
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
        """)
        
        self._build_ui()

        core.log_emitted.connect(self._on_log)

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        # Toolbar
        toolbar = QHBoxLayout()

        lbl_filter = QLabel("Lọc:")
        self._combo_filter = QComboBox()
        self._combo_filter.addItems(["Tất cả", "INFO", "WARNING", "ERROR"])
        self._combo_filter.currentTextChanged.connect(self._on_filter_changed)

        self._btn_pause = QPushButton("Dừng cuộn")
        self._btn_pause.setIcon(_draw_svg_icon("pause"))
        self._btn_pause.setCheckable(True)
        self._btn_pause.toggled.connect(self._on_pause_toggled)

        btn_clear = QPushButton("Xoá")
        btn_clear.setIcon(_draw_svg_icon("clear"))
        btn_clear.clicked.connect(self._clear)

        btn_export = QPushButton("Xuất .txt")
        btn_export.setIcon(_draw_svg_icon("export"))
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
        self._text.setFont(QFont("Consolas", 10))
        self._text.setStyleSheet(
            "QPlainTextEdit {"
            "  background-color: #0f172a; /* Deep Slate 900 */"
            "  color: #f8fafc;"
            "  border: 1px solid #cbd5e1;"
            "  border-radius: 6px;"
            "  padding: 8px;"
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
        self._btn_pause.setText("Tiếp tục cuộn" if paused else "Dừng cuộn")
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

"""
notifier_widget.py — Custom PyQt6 Toast Notification System
Provides glassmorphic, stacking notifications at the bottom-right corner of the screen.
"""

from PyQt6.QtWidgets import (
    QWidget, QLabel, QPushButton, QHBoxLayout, QVBoxLayout, 
    QProgressBar, QGraphicsOpacityEffect, QApplication
)
from PyQt6.QtCore import Qt, QTimer, QPropertyAnimation, pyqtSignal
from PyQt6.QtGui import QIcon, QPixmap

class NotificationToast(QWidget):
    """
    A single frameless custom notification toast displaying at the bottom-right.
    """
    closed = pyqtSignal()

    def __init__(
        self, 
        title: str, 
        message: str, 
        icon_path: str = "", 
        toast_type: str = "info", 
        duration_sec: int = 10
    ) -> None:
        super().__init__()
        self.duration_ms = duration_sec * 1000
        self.remaining_ms = self.duration_ms
        self.toast_type = toast_type.lower()

        # Frameless window properties: always on top, no taskbar icon, translucent background
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint | 
            Qt.WindowType.WindowStaysOnTopHint | 
            Qt.WindowType.Tool |
            Qt.WindowType.WindowDoesNotAcceptFocus
        )
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(340, 95)

        # Style colors based on type
        # success: Green, failed: Red, started: Orange, info: Blue
        color_map = {
            "success": "#10b981", # Emerald-500
            "failed": "#ef4444",  # Red-500
            "started": "#f59e0b", # Orange-500
            "info": "#3b82f6"     # Blue-500
        }
        accent_color = color_map.get(self.toast_type, color_map["info"])

        # Main container with rounded corners and border
        container = QWidget(self)
        container.setObjectName("Container")
        container.setGeometry(0, 0, 340, 95)
        
        # Stylesheet for high-fidelity dark glassmorphic look
        container.setStyleSheet(f"""
            QWidget#Container {{
                background-color: rgba(24, 24, 27, 240); /* Zinc 900 with high opacity */
                border: 1px solid {accent_color};
                border-radius: 10px;
            }}
            QLabel {{
                color: #e4e4e7; /* Zinc 200 */
                font-family: "Segoe UI", Arial, sans-serif;
            }}
            QLabel#Title {{
                font-weight: bold;
                font-size: 10.5pt;
                color: #ffffff;
            }}
            QLabel#Message {{
                font-size: 9pt;
                color: #a1a1aa; /* Zinc 400 */
            }}
            QPushButton#CloseBtn {{
                background: transparent;
                color: #71717a; /* Zinc 500 */
                border: none;
                font-size: 11pt;
                font-weight: bold;
                border-radius: 4px;
            }}
            QPushButton#CloseBtn:hover {{
                color: #ffffff;
                background-color: rgba(239, 68, 68, 80); /* Soft red hover */
            }}
            QProgressBar {{
                background: transparent;
                border: none;
                height: 3px;
            }}
            QProgressBar::chunk {{
                background-color: {accent_color};
                border-radius: 1px;
            }}
        """)

        # Layout construction
        main_layout = QVBoxLayout(container)
        main_layout.setContentsMargins(12, 10, 12, 8)
        main_layout.setSpacing(6)

        # Header Row
        header_layout = QHBoxLayout()
        header_layout.setSpacing(8)

        # Icon Label
        self.icon_label = QLabel()
        self.icon_label.setFixedSize(20, 20)
        
        # Select status icon representation
        emoji_map = {
            "success": "✅",
            "failed": "❌",
            "started": "📋",
            "info": "ℹ"
        }
        emoji = emoji_map.get(self.toast_type, "ℹ")
        self.icon_label.setText(emoji)
        self.icon_label.setStyleSheet("font-size: 12pt;")
        header_layout.addWidget(self.icon_label)

        # Title Label
        title_label = QLabel(title)
        title_label.setObjectName("Title")
        header_layout.addWidget(title_label)
        header_layout.addStretch()

        # Close Button
        close_btn = QPushButton("✕")
        close_btn.setObjectName("CloseBtn")
        close_btn.setFixedSize(20, 20)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.clicked.connect(self.close_toast)
        header_layout.addWidget(close_btn)

        main_layout.addLayout(header_layout)

        # Message Row
        msg_label = QLabel(message)
        msg_label.setObjectName("Message")
        msg_label.setWordWrap(True)
        msg_label.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
        main_layout.addWidget(msg_label)
        main_layout.addStretch()

        # Progress bar representing remaining time
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(100)
        self.progress_bar.setTextVisible(False)
        main_layout.addWidget(self.progress_bar)

        # Setup opacity effect for smooth fade-out
        self.opacity_effect = QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        self.fade_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_animation.setDuration(400)
        self.fade_animation.setStartValue(1.0)
        self.fade_animation.setEndValue(0.0)
        self.fade_animation.finished.connect(self.close)

        # Setup ticking timer (every 100ms)
        self.timer = QTimer(self)
        self.timer.setInterval(100)
        self.timer.timeout.connect(self._on_tick)
        self.timer.start()

    def _on_tick(self) -> None:
        self.remaining_ms -= 100
        if self.remaining_ms <= 0:
            self.timer.stop()
            self.fade_out()
        else:
            pct = int((self.remaining_ms / self.duration_ms) * 100)
            self.progress_bar.setValue(pct)

    def fade_out(self) -> None:
        self.timer.stop()
        self.fade_animation.start()

    def close_toast(self) -> None:
        self.fade_out()

    def closeEvent(self, event) -> None:
        self.closed.emit()
        super().closeEvent(event)


class ToastManager:
    """
    Manages active toasts, stacks them vertically starting from the bottom-right corner.
    """
    _active_toasts: list[NotificationToast] = []

    @classmethod
    def show_toast(
        cls, 
        title: str, 
        message: str, 
        toast_type: str = "info", 
        duration_sec: int = 10,
        icon_path: str = ""
    ) -> None:
        # Create new toast widget
        toast = NotificationToast(title, message, icon_path, toast_type, duration_sec)
        cls._active_toasts.append(toast)
        
        # Position and display
        cls.reposition_toasts()
        toast.show()
        
        # Hook close signal to reposition remaining toasts
        toast.closed.connect(lambda: cls.on_toast_closed(toast))

    @classmethod
    def on_toast_closed(cls, toast: NotificationToast) -> None:
        if toast in cls._active_toasts:
            cls._active_toasts.remove(toast)
        cls.reposition_toasts()

    @classmethod
    def reposition_toasts(cls) -> None:
        screen = QApplication.primaryScreen()
        if not screen:
            return
        
        avail = screen.availableGeometry()
        margin_x = 20
        margin_y = 20
        toast_width = 340
        toast_height = 95
        spacing = 10

        # Stack notifications from bottom to top
        current_y = avail.y() + avail.height() - margin_y

        for toast in reversed(cls._active_toasts):
            current_y -= toast_height
            x = avail.x() + avail.width() - toast_width - margin_x
            toast.move(x, current_y)
            current_y -= spacing

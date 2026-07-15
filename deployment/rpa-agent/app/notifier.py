"""
notifier.py — Windows Toast Notifications for MXV RPA Agent
Uses winotify for Windows 10/11 native toast notifications.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from PyQt6.QtCore import QObject, pyqtSlot

if TYPE_CHECKING:
    from agent_core import AgentCore

APP_NAME = "MXV RPA Agent"

try:
    from winotify import Notification, audio
    _WINOTIFY_AVAILABLE = True
except ImportError:
    _WINOTIFY_AVAILABLE = False


def _toast(title: str, message: str, icon_path: str = "", duration: str = "short") -> None:
    if not _WINOTIFY_AVAILABLE:
        return
    try:
        toast = Notification(
            app_id=APP_NAME,
            title=title,
            msg=message,
            duration=duration,
            icon=icon_path or "",
        )
        toast.show()
    except Exception:
        pass  # Notifications are best-effort — never crash the agent


class Notifier(QObject):
    """
    Subscribes to AgentCore signals and displays Windows toast notifications.
    """

    def __init__(self, core: "AgentCore", icon_path: str = "") -> None:
        super().__init__()
        self._icon = icon_path
        self._online = False

        # Connect agent signals
        core.job_started.connect(self._on_job_started)
        core.job_completed.connect(self._on_job_completed)
        core.job_failed.connect(self._on_job_failed)
        core.connection_changed.connect(self._on_connection_changed)

    @pyqtSlot(str, str)
    def _on_job_started(self, job_id: str, job_type: str) -> None:
        label = _job_label(job_type)
        _toast(
            title=f"📋 {APP_NAME}",
            message=f"Đang chạy: {label}",
            icon_path=self._icon,
        )

    @pyqtSlot(str, str)
    def _on_job_completed(self, job_id: str, job_type: str) -> None:
        label = _job_label(job_type)
        _toast(
            title=f"✅ {APP_NAME}",
            message=f"{label} hoàn thành! Kết quả đã upload lên server.",
            icon_path=self._icon,
        )

    @pyqtSlot(str, str, str)
    def _on_job_failed(self, job_id: str, job_type: str, error: str) -> None:
        label = _job_label(job_type)
        short_error = error[:80] + "..." if len(error) > 80 else error
        _toast(
            title=f"❌ {APP_NAME} — Lỗi",
            message=f"{label} thất bại:\n{short_error}",
            icon_path=self._icon,
            duration="long",
        )

    @pyqtSlot(bool)
    def _on_connection_changed(self, online: bool) -> None:
        if not online and self._online:
            # Only notify on transition online→offline (not on first startup)
            _toast(
                title=f"⚠ {APP_NAME}",
                message="Mất kết nối tới Backend Server. Đang thử lại...",
                icon_path=self._icon,
                duration="long",
            )
        self._online = online


def _job_label(job_type: str) -> str:
    mapping = {
        "RUN_LOT_MACRO": "Macro Số Lot",
        "RUN_VALUE_MACRO": "Macro Giá Trị",
        "RPA_DOWNLOAD_REPORTS": "Tải báo cáo M-System",
        "DOWNLOAD_CAST": "Tải CAST Balances",
        "FILE_AUDIT_MS": "Kiểm tra file MS",
        "FILE_AUDIT_CQG": "Kiểm tra file CQG",
        "FILE_AUDIT_ACM": "Kiểm tra file ACM",
    }
    return mapping.get(job_type, job_type)

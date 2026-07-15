"""
notifier.py — Windows Custom Toast Notifications for MXV RPA Agent
Uses custom PyQt6 glassmorphic notifications with auto-closing timers.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from PyQt6.QtCore import QObject, pyqtSlot
from notifier_widget import ToastManager

if TYPE_CHECKING:
    from agent_core import AgentCore

APP_NAME = "MXV RPA"

def _toast(title: str, message: str, toast_type: str = "info") -> None:
    try:
        from agent_core import load_config
        cfg = load_config()
        if not cfg.get("enable_notifications", True):
            return
        duration = cfg.get("notification_duration", 10)
        ToastManager.show_toast(
            title=title,
            message=message,
            toast_type=toast_type,
            duration_sec=duration
        )
    except Exception:
        pass


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
            title=f"{APP_NAME} — Đang chạy",
            message=f"Tác vụ: {label}",
            toast_type="started"
        )

    @pyqtSlot(str, str)
    def _on_job_completed(self, job_id: str, job_type: str) -> None:
        label = _job_label(job_type)
        _toast(
            title=f"{APP_NAME} — Hoàn thành",
            message=f"{label} đã hoàn tất và upload lên server.",
            toast_type="success"
        )

    @pyqtSlot(str, str, str)
    def _on_job_failed(self, job_id: str, job_type: str, error: str) -> None:
        label = _job_label(job_type)
        short_error = error[:80] + "..." if len(error) > 80 else error
        _toast(
            title=f"{APP_NAME} — Lỗi",
            message=f"{label} thất bại:\n{short_error}",
            toast_type="failed"
        )

    @pyqtSlot(bool)
    def _on_connection_changed(self, online: bool) -> None:
        if not online and self._online:
            _toast(
                title=f"{APP_NAME} — Mất kết nối",
                message="Mất kết nối tới Core Server. Đang thử lại...",
                toast_type="failed"
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

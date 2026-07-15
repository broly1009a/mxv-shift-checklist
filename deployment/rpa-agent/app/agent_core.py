"""
agent_core.py — MXV RPA Agent Core Logic
Refactored from agent.py into a QObject-based class with Qt Signals
so that the UI (tray, log window, notifier) can react to agent events.
"""

from __future__ import annotations

import json
import logging
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

from PyQt6.QtCore import QObject, QThread, pyqtSignal, pyqtSlot

BASE_DIR = Path(__file__).parent.parent  # rpa-agent/
CONFIG_PATH = BASE_DIR / "config.json"


# ─── Config helpers ────────────────────────────────────────────────────────────

def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# ─── Worker Thread ─────────────────────────────────────────────────────────────

class AgentWorker(QObject):
    """Runs in a QThread — handles polling + heartbeat loops."""

    # Signals emitted to the main thread (UI)
    log_emitted = pyqtSignal(str, str)          # (level, message)
    job_started = pyqtSignal(str, str)           # (job_id, job_type)
    job_completed = pyqtSignal(str, str)         # (job_id, job_type)
    job_failed = pyqtSignal(str, str, str)       # (job_id, job_type, error)
    connection_changed = pyqtSignal(bool)        # (is_online)
    stats_updated = pyqtSignal(int)             # (jobs_completed_today)

    def __init__(self) -> None:
        super().__init__()
        self._stop = False
        self._cfg: dict = {}
        self._backend_url = ""
        self._api_key = ""
        self._poll_interval = 5
        self._heartbeat_interval = 30
        self._paths: dict = {}
        self._is_online = False
        self._jobs_today = 0
        self._last_heartbeat: Optional[float] = None

    def reload_config(self) -> None:
        self._cfg = load_config()
        self._backend_url = self._cfg.get("backend_url", "").rstrip("/")
        self._api_key = self._cfg.get("api_key", "")
        self._poll_interval = self._cfg.get("polling_interval", 5)
        self._heartbeat_interval = self._cfg.get("heartbeat_interval", 30)
        self._paths = self._cfg.get("paths", {})

    def _headers(self) -> dict:
        return {
            "x-agent-api-key": self._api_key,
            "Content-Type": "application/json",
        }

    def _log(self, level: str, msg: str) -> None:
        self.log_emitted.emit(level, msg)

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _get(self, path: str) -> Optional[dict]:
        try:
            import requests
            r = requests.get(
                f"{self._backend_url}{path}",
                headers=self._headers(),
                timeout=10,
            )
            r.raise_for_status()
            if not self._is_online:
                self._is_online = True
                self.connection_changed.emit(True)
            return r.json()
        except Exception as e:
            if self._is_online:
                self._is_online = False
                self.connection_changed.emit(False)
            self._log("WARNING", f"GET {path} failed: {e}")
            return None

    def _post(self, path: str, data: dict = None, files=None) -> Optional[dict]:
        try:
            import requests
            if files:
                h = {"x-agent-api-key": self._api_key}
                r = requests.post(
                    f"{self._backend_url}{path}",
                    headers=h, data=data, files=files, timeout=60,
                )
            else:
                r = requests.post(
                    f"{self._backend_url}{path}",
                    headers=self._headers(),
                    json=data or {},
                    timeout=10,
                )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            self._log("WARNING", f"POST {path} failed: {e}")
            return None

    # ── Job helpers ───────────────────────────────────────────────────────────

    def _send_log(self, job_id: str, message: str) -> None:
        self._post(f"/api/v1/bot-engine/agent/jobs/{job_id}/log", {"message": message})

    def _fail_job(self, job_id: str, job_type: str, error: str) -> None:
        self._log("ERROR", f"[Job {job_id}] FAILED: {error}")
        self._post(f"/api/v1/bot-engine/agent/jobs/{job_id}/fail", {"error": error})
        self.job_failed.emit(job_id, job_type, error)

    def _complete_job(self, job_id: str, job_type: str, file_path: str = None) -> None:
        self._log("INFO", f"[Job {job_id}] COMPLETED")
        if file_path and os.path.exists(file_path):
            with open(file_path, "rb") as fp:
                self._post(
                    f"/api/v1/bot-engine/agent/jobs/{job_id}/complete",
                    files={"file": (os.path.basename(file_path), fp)},
                )
        else:
            self._post(f"/api/v1/bot-engine/agent/jobs/{job_id}/complete", {})
        self._jobs_today += 1
        self.stats_updated.emit(self._jobs_today)
        self.job_completed.emit(job_id, job_type)

    # ── Script runner ─────────────────────────────────────────────────────────

    def _run_script(self, job_id: str, script_path: str, args: list[str]) -> bool:
        cmd = [sys.executable, script_path] + args
        self._send_log(job_id, f"Executing: {' '.join(cmd)}")
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._log("ERROR", f"Failed to start process: {e}")
            return False

        result_json = None
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            if line.startswith("{") and line.endswith("}"):
                result_json = line
            else:
                self._send_log(job_id, line)
                self._log("INFO", f"  > {line}")
        proc.wait()

        if result_json:
            try:
                parsed = json.loads(result_json)
                if parsed.get("success"):
                    return True
                return False
            except json.JSONDecodeError:
                pass

        return proc.returncode == 0

    # ── Job handlers ──────────────────────────────────────────────────────────

    def _handle_lot_macro(self, job_id: str, payload: dict) -> None:
        macro_path = payload.get("macroPath") or self._paths.get("lot_macro_path")
        target_date = payload.get("targetDate", "")
        if not macro_path:
            self._fail_job(job_id, "RUN_LOT_MACRO", "Thiếu macroPath trong payload và config.json")
            return
        script = str(BASE_DIR.parent / "scripts" / "run_lot_macro.py")
        self._send_log(job_id, f"Chạy Macro Số Lot: {macro_path} | Ngày: {target_date}")
        if self._run_script(job_id, script, [macro_path]):
            self._complete_job(job_id, "RUN_LOT_MACRO")
        else:
            self._fail_job(job_id, "RUN_LOT_MACRO", "Script kết thúc với lỗi")

    def _handle_value_macro(self, job_id: str, payload: dict) -> None:
        macro_path = payload.get("macroPath") or self._paths.get("value_macro_path")
        target_date = payload.get("targetDate", "")
        if not macro_path:
            self._fail_job(job_id, "RUN_VALUE_MACRO", "Thiếu macroPath trong payload và config.json")
            return
        script = str(BASE_DIR.parent / "scripts" / "run_value_macro.py")
        self._send_log(job_id, f"Chạy Macro Giá Trị: {macro_path} | Ngày: {target_date}")
        if self._run_script(job_id, script, [macro_path, target_date]):
            self._complete_job(job_id, "RUN_VALUE_MACRO")
        else:
            self._fail_job(job_id, "RUN_VALUE_MACRO", "Script kết thúc với lỗi")

    def _dispatch(self, job: dict) -> None:
        job_id = str(job["_id"])
        job_type = job["jobType"]
        payload = job.get("payload") or {}

        self._log("INFO", f"Nhận job: {job_type} (ID: {job_id})")
        self.job_started.emit(job_id, job_type)
        self._post(f"/api/v1/bot-engine/agent/jobs/{job_id}/start", {})

        try:
            if job_type == "RUN_LOT_MACRO":
                self._handle_lot_macro(job_id, payload)
            elif job_type == "RUN_VALUE_MACRO":
                self._handle_value_macro(job_id, payload)
            else:
                self._fail_job(job_id, job_type, f"Job type '{job_type}' chưa được hỗ trợ trên Agent")
        except Exception as e:
            self._fail_job(job_id, job_type, str(e))

    # ── Main loops ────────────────────────────────────────────────────────────

    @pyqtSlot()
    def run(self) -> None:
        """Main entry point — called when QThread starts."""
        self.reload_config()
        self._log("INFO", "=" * 50)
        self._log("INFO", "MXV RPA Agent khởi động.")
        self._log("INFO", f"Backend: {self._backend_url}")
        self._log("INFO", f"Polling: {self._poll_interval}s | Heartbeat: {self._heartbeat_interval}s")
        self._log("INFO", "=" * 50)

        _last_hb = 0.0
        while not self._stop:
            now = time.time()

            # Heartbeat
            if now - _last_hb >= self._heartbeat_interval:
                self._post("/api/v1/bot-engine/agent/heartbeat", {
                    "hostname": platform.node(),
                    "platform": platform.system(),
                    "version": platform.version(),
                })
                _last_hb = now

            # Poll for job
            result = self._get("/api/v1/bot-engine/agent/poll")
            if result and result.get("job"):
                self._dispatch(result["job"])

            time.sleep(self._poll_interval)

        self._log("INFO", "Agent đã dừng.")

    def request_stop(self) -> None:
        self._stop = True


# ─── AgentCore (public API for UI) ────────────────────────────────────────────

class AgentCore(QObject):
    """
    Public facade used by tray, settings window, log window, and notifier.
    Manages the lifecycle of AgentWorker running in a QThread.
    """

    # Forward signals from worker
    log_emitted = pyqtSignal(str, str)
    job_started = pyqtSignal(str, str)
    job_completed = pyqtSignal(str, str)
    job_failed = pyqtSignal(str, str, str)
    connection_changed = pyqtSignal(bool)
    stats_updated = pyqtSignal(int)

    def __init__(self) -> None:
        super().__init__()
        self._thread: Optional[QThread] = None
        self._worker: Optional[AgentWorker] = None
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        if self._running:
            return
        self._thread = QThread()
        self._worker = AgentWorker()
        self._worker.moveToThread(self._thread)

        # Wire worker signals → core signals (forwarded to UI)
        self._worker.log_emitted.connect(self.log_emitted)
        self._worker.job_started.connect(self.job_started)
        self._worker.job_completed.connect(self.job_completed)
        self._worker.job_failed.connect(self.job_failed)
        self._worker.connection_changed.connect(self.connection_changed)
        self._worker.stats_updated.connect(self.stats_updated)

        self._thread.started.connect(self._worker.run)
        self._thread.start()
        self._running = True

    def stop(self) -> None:
        if not self._running or not self._worker or not self._thread:
            return
        self._worker.request_stop()
        self._thread.quit()
        self._thread.wait(5000)
        self._running = False
        self._thread = None
        self._worker = None

    def restart(self) -> None:
        self.stop()
        self.start()

    def reload_config(self) -> None:
        if self._worker:
            self._worker.reload_config()

    def get_status(self) -> dict:
        cfg = {}
        try:
            cfg = load_config()
        except Exception:
            pass
        return {
            "running": self._running,
            "backend_url": cfg.get("backend_url", "—"),
            "online": self._worker._is_online if self._worker else False,
            "jobs_today": self._worker._jobs_today if self._worker else 0,
        }

"""
agent_core.py — MXV RPA Agent Core Logic
Refactored from agent.py into a QObject-based class with Qt Signals
so that the UI (tray, log window, notifier) can react to agent events.
"""

from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import psutil
from PyQt6.QtCore import QObject, QThread, pyqtSignal, pyqtSlot

BASE_DIR = Path(__file__).parent.parent  # rpa-agent/
CONFIG_PATH = BASE_DIR / "config.json"
LOG_FILE = BASE_DIR / "agent.log"

# ─── File Logger Setup ────────────────────────────────────────────────────────
logger = logging.getLogger("MXV-Agent")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Rotate log file at 5MB, keeping 3 old log files max
    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)



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
    update_available = pyqtSignal(str, str)      # (version, download_url)

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
        self._workspace_path = ""
        self._jobs_today = 0
        self._last_heartbeat: Optional[float] = None
        self._session_token = ""
        self._token_expire_at = 0.0

    def reload_config(self) -> None:
        self._cfg = load_config()
        self._backend_url = self._cfg.get("backend_url", "").rstrip("/")
        self._api_key = self._cfg.get("api_key", "")
        self._poll_interval = self._cfg.get("polling_interval", 5)
        self._heartbeat_interval = self._cfg.get("heartbeat_interval", 30)
        self._paths = self._cfg.get("paths", {})
        self._workspace_path = self._cfg.get("workspace_path", "")
        # Reset token on config reload to force handshake login
        self._session_token = ""
        self._token_expire_at = 0.0

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._session_token:
            headers["Authorization"] = f"Bearer {self._session_token}"
        else:
            headers["x-agent-api-key"] = self._api_key
        return headers

    def _log(self, level: str, msg: str) -> None:
        self.log_emitted.emit(level, msg)
        lvl = getattr(logging, level.upper(), logging.INFO)
        logger.log(lvl, msg)

    # ── Auth & Process Helpers ────────────────────────────────────────────────

    def _login(self) -> bool:
        try:
            import requests
            url = f"{self._backend_url}/api/v1/bot-engine/agent/login"
            r = requests.post(url, json={
                "apiKey": self._api_key,
                "hostname": platform.node()
            }, timeout=10)
            if r.status_code in (200, 201):
                res = r.json()
                self._session_token = res.get("token")
                # Expire token after 1 hour (refresh after 55 mins)
                self._token_expire_at = time.time() + 3300
                self._log("INFO", "Handshake thành công. Đã lấy Token phiên động mới.")
                return True
            else:
                self._log("WARNING", f"Handshake thất bại: HTTP {r.status_code}")
                return False
        except Exception as e:
            self._log("WARNING", f"Lỗi Handshake: {e}")
            return False

    def _ensure_logged_in(self) -> bool:
        if not self._backend_url or not self._api_key:
            return False
        # If token is empty or expiring in less than 60s
        if not self._session_token or time.time() >= self._token_expire_at - 60:
            return self._login()
        return True

    def sweep_orphaned_excel(self) -> None:
        """Scan running processes and kill orphaned EXCEL.EXE processes to free RAM."""
        self._log("INFO", "🧹 Đang quét dọn các tiến trình Excel chạy ngầm...")
        killed_count = 0
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if proc.info['name'] and proc.info['name'].lower() == 'excel.exe':
                    proc.terminate()
                    killed_count += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        if killed_count > 0:
            self._log("INFO", f"🧹 Đã diệt {killed_count} tiến trình Excel chạy ẩn thành công.")
        else:
            self._log("INFO", "🧹 Không tìm thấy tiến trình Excel chạy ngầm nào.")

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _get(self, path: str) -> Optional[dict]:
        if path != "/api/v1/bot-engine/agent/login" and not self._ensure_logged_in():
            if self._is_online:
                self._is_online = False
                self.connection_changed.emit(False)
            return None
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
        if path not in ("/api/v1/bot-engine/agent/login", "/api/v1/bot-engine/agent/logout") and not self._ensure_logged_in():
            return None
        try:
            import requests
            if files:
                h = {}
                if self._session_token:
                    h["Authorization"] = f"Bearer {self._session_token}"
                else:
                    h["x-agent-api-key"] = self._api_key
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

    def _handle_delegated_nestjs_job(self, job_id: str, job_type: str, payload: dict) -> None:
        workspace = self._workspace_path
        if not workspace:
            candidate_pkg = Path(sys.executable).parent
            candidate_dev = BASE_DIR.parent
            if (candidate_pkg / "backend").exists():
                workspace = str(candidate_pkg)
            elif (candidate_dev / "backend").exists():
                workspace = str(candidate_dev)
            else:
                self._fail_job(job_id, job_type, "Thiếu cấu hình workspace_path và không tìm thấy thư mục backend mặc định")
                return

        backend_dir = os.path.join(workspace, "backend")
        dist_script = os.path.join(backend_dir, "dist", "scripts", "run-job-cli.js")
        if os.path.exists(dist_script):
            cmd = ["node", "dist/scripts/run-job-cli.js", job_id]
        else:
            script_path = os.path.join("src", "scripts", "run-job-cli.ts")
            cmd = ["npx", "ts-node", script_path, job_id]
        
        self._send_log(job_id, f"Ủy quyền chạy job {job_type} cho NestJS CLI: {' '.join(cmd)}")
        self._log("INFO", f"Đang chạy NestJS job {job_id} trong thư mục: {backend_dir}")

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
                shell=True
            )
        except Exception as e:
            self._fail_job(job_id, job_type, f"Không thể khởi chạy NestJS CLI: {e}")
            return

        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            self._send_log(job_id, line)
            self._log("INFO", f"  [NestJS] {line}")
        proc.wait()

        if proc.returncode == 0:
            self._jobs_today += 1
            self.stats_updated.emit(self._jobs_today)
            self.job_completed.emit(job_id, job_type)
        else:
            self.job_failed.emit(job_id, job_type, f"NestJS CLI kết thúc với mã lỗi {proc.returncode}")

    def _dispatch(self, job: dict) -> None:
        job_id = str(job["_id"])
        job_type = job["jobType"]
        payload = job.get("payload") or {}

        self._log("INFO", f"Nhận job: {job_type} (ID: {job_id})")
        self.job_started.emit(job_id, job_type)
        self._post(f"/api/v1/bot-engine/agent/jobs/{job_id}/start", {})

        # Sweep orphaned Excel processes if executing macro jobs
        if job_type in ("RUN_LOT_MACRO", "RUN_VALUE_MACRO"):
            self.sweep_orphaned_excel()

        try:
            if job_type in ("RUN_LOT_MACRO", "RUN_VALUE_MACRO", "RPA_DOWNLOAD_REPORTS", "DOWNLOAD_CAST", "FILE_AUDIT_MS", "FILE_AUDIT_CQG", "FILE_AUDIT_ACM"):
                self._handle_delegated_nestjs_job(job_id, job_type, payload)
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

        # Initial clean up of Excel processes
        self.sweep_orphaned_excel()

        # Check version updates
        version_info = self._get("/api/v1/bot-engine/agent/version")
        if version_info:
            latest = version_info.get("latestVersion", "1.0.0")
            url = version_info.get("downloadUrl", "")
            if latest != "1.0.0":
                self._log("WARNING", f"Đã có phiên bản Agent mới: v{latest}. Tải tại: {url}")
                self.update_available.emit(latest, url)

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

            # Poll for job (Temporarily commented out because NestJS runs jobs locally on Linux server)
            # result = self._get("/api/v1/bot-engine/agent/poll")
            # if result and result.get("job"):
            #     self._dispatch(result["job"])

            time.sleep(self._poll_interval)

        # Logout on clean exit
        if self._session_token:
            self._post("/api/v1/bot-engine/agent/logout", {"hostname": platform.node()})
            self._session_token = ""
            self._token_expire_at = 0.0

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
    update_available = pyqtSignal(str, str)

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
        self._worker.update_available.connect(self.update_available)

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

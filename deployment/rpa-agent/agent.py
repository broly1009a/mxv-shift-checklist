"""
MXV RPA Agent - Windows Service
Polls jobs from Linux NestJS Backend and executes them locally on Windows.
"""

import json
import logging
import os
import subprocess
import sys
import time
import threading
from pathlib import Path

import requests

# ─── Setup ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(BASE_DIR / "agent.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("RPA-Agent")


def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


CFG = load_config()
BACKEND_URL = CFG["backend_url"].rstrip("/")
API_KEY = CFG["api_key"]
POLL_INTERVAL = CFG.get("polling_interval", 5)
HEARTBEAT_INTERVAL = CFG.get("heartbeat_interval", 30)
PATHS = CFG.get("paths", {})

# Job types handled locally on Windows
WINDOWS_JOB_TYPES = {
    "RUN_LOT_MACRO",
    "RUN_VALUE_MACRO",
    "FILE_AUDIT_MS",
    "FILE_AUDIT_CQG",
    "FILE_AUDIT_ACM",
    "RPA_DOWNLOAD_REPORTS",
    "DOWNLOAD_CAST",
}

HEADERS = {
    "x-agent-api-key": API_KEY,
    "Content-Type": "application/json",
}


# ─── HTTP helpers ──────────────────────────────────────────────────────────────

def agent_get(path: str) -> dict | None:
    try:
        r = requests.get(f"{BACKEND_URL}{path}", headers=HEADERS, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning(f"GET {path} failed: {e}")
        return None


def agent_post(path: str, data: dict = None, files=None) -> dict | None:
    try:
        if files:
            h = {"x-agent-api-key": API_KEY}
            r = requests.post(f"{BACKEND_URL}{path}", headers=h, data=data, files=files, timeout=60)
        else:
            r = requests.post(f"{BACKEND_URL}{path}", headers=HEADERS, json=data or {}, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning(f"POST {path} failed: {e}")
        return None


def send_log(job_id: str, message: str):
    agent_post(f"/api/v1/bot-engine/agent/jobs/{job_id}/log", {"message": message})


def fail_job(job_id: str, error: str):
    log.error(f"[Job {job_id}] FAILED: {error}")
    agent_post(f"/api/v1/bot-engine/agent/jobs/{job_id}/fail", {"error": error})


def complete_job(job_id: str, file_path: str = None, extra: dict = None):
    log.info(f"[Job {job_id}] COMPLETED")
    if file_path and os.path.exists(file_path):
        with open(file_path, "rb") as fp:
            agent_post(
                f"/api/v1/bot-engine/agent/jobs/{job_id}/complete",
                data=extra or {},
                files={"file": (os.path.basename(file_path), fp)},
            )
    else:
        agent_post(f"/api/v1/bot-engine/agent/jobs/{job_id}/complete", extra or {})


# ─── Job Handlers ──────────────────────────────────────────────────────────────

def run_python_script(job_id: str, script_path: str, args: list[str]) -> bool:
    """Run a Python script, stream stdout lines as logs, return success."""
    cmd = [sys.executable, script_path] + args
    send_log(job_id, f"Executing: {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    result_json = None
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        if line.startswith("{") and line.endswith("}"):
            result_json = line
        else:
            send_log(job_id, line)
    proc.wait()

    if result_json:
        try:
            parsed = json.loads(result_json)
            if parsed.get("success"):
                return True
            else:
                fail_job(job_id, parsed.get("error", "Script returned failure"))
                return False
        except json.JSONDecodeError:
            pass

    if proc.returncode == 0:
        return True
    fail_job(job_id, f"Script exited with code {proc.returncode}")
    return False


def handle_run_lot_macro(job_id: str, payload: dict):
    macro_path = payload.get("macroPath") or PATHS.get("lot_macro_path")
    target_date = payload.get("targetDate", "")
    if not macro_path:
        fail_job(job_id, "Thiếu macroPath trong payload và config.json")
        return
    script = str(BASE_DIR.parent.parent / "scripts" / "run_lot_macro.py")
    send_log(job_id, f"Chạy Macro Số Lot: {macro_path} | Ngày: {target_date}")
    ok = run_python_script(job_id, script, [macro_path])
    if ok:
        complete_job(job_id)


def handle_run_value_macro(job_id: str, payload: dict):
    macro_path = payload.get("macroPath") or PATHS.get("value_macro_path")
    target_date = payload.get("targetDate", "")
    if not macro_path:
        fail_job(job_id, "Thiếu macroPath trong payload và config.json")
        return
    script = str(BASE_DIR.parent.parent / "scripts" / "run_value_macro.py")
    send_log(job_id, f"Chạy Macro Giá Trị: {macro_path} | Ngày: {target_date}")
    ok = run_python_script(job_id, script, [macro_path, target_date])
    if ok:
        complete_job(job_id)


def handle_unsupported(job_id: str, job_type: str):
    """
    For job types that require Playwright (RPA_DOWNLOAD_REPORTS, DOWNLOAD_CAST,
    FILE_AUDIT_ACM, FILE_AUDIT_MS, FILE_AUDIT_CQG), the agent delegates back to
    the embedded NestJS scripts running locally via npx ts-node.
    This is a placeholder – extend as needed.
    """
    fail_job(job_id, f"Job type '{job_type}' chưa được triển khai trên Agent. Cần bổ sung handler.")


# ─── Dispatch ──────────────────────────────────────────────────────────────────

def dispatch(job: dict):
    job_id = job["_id"]
    job_type = job["jobType"]
    payload = job.get("payload") or {}

    log.info(f"Dispatching job {job_id} ({job_type})")

    # Mark as PROCESSING
    agent_post(f"/api/v1/bot-engine/agent/jobs/{job_id}/start", {})

    try:
        if job_type == "RUN_LOT_MACRO":
            handle_run_lot_macro(job_id, payload)
        elif job_type == "RUN_VALUE_MACRO":
            handle_run_value_macro(job_id, payload)
        else:
            handle_unsupported(job_id, job_type)
    except Exception as e:
        fail_job(job_id, str(e))


# ─── Heartbeat Thread ──────────────────────────────────────────────────────────

def heartbeat_loop():
    while True:
        try:
            import platform
            agent_post("/api/v1/bot-engine/agent/heartbeat", {
                "hostname": platform.node(),
                "platform": platform.system(),
                "version": platform.version(),
            })
        except Exception as e:
            log.warning(f"Heartbeat failed: {e}")
        time.sleep(HEARTBEAT_INTERVAL)


# ─── Main Poll Loop ────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("MXV RPA Agent started.")
    log.info(f"Backend: {BACKEND_URL}")
    log.info(f"Poll interval: {POLL_INTERVAL}s | Heartbeat: {HEARTBEAT_INTERVAL}s")
    log.info("=" * 60)

    # Start heartbeat in background
    t = threading.Thread(target=heartbeat_loop, daemon=True)
    t.start()

    while True:
        try:
            result = agent_get("/api/v1/bot-engine/agent/poll")
            if result and result.get("job"):
                job = result["job"]
                dispatch(job)
        except Exception as e:
            log.error(f"Poll loop error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ================================================
echo   MXV RPA Agent - Setup Script (Windows)
echo ================================================
echo.

:: ── 1. Check Python ──────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python khong tim thay. Vui long cai Python 3.10+ va them vao PATH.
    pause
    exit /b 1
)
echo [OK] Python: 
python --version

:: ── 2. Create venv if not exists ─────────────────────────────────────────────
if not exist "%~dp0venv" (
    echo [INFO] Tao virtual environment...
    python -m venv "%~dp0venv"
)

:: ── 3. Activate venv and install deps ────────────────────────────────────────
echo [INFO] Cai dat dependencies...
call "%~dp0venv\Scripts\activate.bat"
pip install --quiet --upgrade pip
pip install --quiet -r "%~dp0requirements.txt"

:: ── 4. Check pywin32 (Windows-only COM support) ───────────────────────────────
python -c "import win32com.client" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Cai dat pywin32...
    pip install --quiet pywin32
    python "%~dp0venv\Scripts\pywin32_postinstall.py" -install >nul 2>&1
)
echo [OK] pywin32 san sang.

:: ── 5. Check config.json ──────────────────────────────────────────────────────
if not exist "%~dp0config.json" (
    echo [ERROR] Khong tim thay config.json. Vui long tao file config.json truoc.
    pause
    exit /b 1
)
echo [OK] config.json ton tai.

:: ── 6. Test connection to backend ────────────────────────────────────────────
echo [INFO] Kiem tra ket noi den Backend Linux...
python -c "
import json, requests
cfg = json.load(open('config.json', encoding='utf-8'))
url = cfg['backend_url'] + '/api/v1/bot-engine/agent/poll'
h = {'x-agent-api-key': cfg['api_key']}
try:
    r = requests.get(url, headers=h, timeout=5)
    print('[OK] Ket noi Backend thanh cong. Status:', r.status_code)
except Exception as e:
    print('[WARN] Khong the ket noi Backend:', e)
"

:: ── 7. Register as Windows Task Scheduler ────────────────────────────────────
echo.
set /p REGISTER_TASK=Ban co muon dang ky Agent tu dong chay khi Windows khoi dong? (y/n): 
if /i "!REGISTER_TASK!"=="y" (
    set TASK_NAME=MXV_RPA_Agent
    set AGENT_PY=%~dp0agent.py
    set PYTHON_EXE=%~dp0venv\Scripts\python.exe

    schtasks /query /tn "!TASK_NAME!" >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Task da ton tai. Dang xoa de tao lai...
        schtasks /delete /tn "!TASK_NAME!" /f >nul
    )

    schtasks /create ^
        /tn "!TASK_NAME!" ^
        /tr "\"!PYTHON_EXE!\" \"!AGENT_PY!\"" ^
        /sc ONLOGON ^
        /ru "%USERNAME%" ^
        /rl HIGHEST ^
        /f >nul

    if errorlevel 1 (
        echo [ERROR] Khong the tao Scheduled Task. Vui long chay script nay voi quyen Administrator.
    ) else (
        echo [OK] Da dang ky Scheduled Task "!TASK_NAME!" thanh cong.
        echo      Agent se tu dong chay khi Windows khoi dong.
    )
)

echo.
echo ================================================
echo   Setup hoan tat!
echo   De chay thu Agent ngay bay gio:
echo     %~dp0venv\Scripts\python.exe %~dp0agent.py
echo ================================================
pause

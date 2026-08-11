@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   MXV RPA Agent - Build Script
echo ================================================
echo.

:: ── 1. Check venv ────────────────────────────────────────────────────────────
if not exist "%~dp0venv\Scripts\python.exe" (
    echo [ERROR] Chua co venv. Chay setup_agent.bat truoc.
    pause & exit /b 1
)

:: ── 2. Install build deps inside venv ─────────────────────────────────────────
echo [INFO] Cai dat PyInstaller va Pillow trong venv...
"%~dp0venv\Scripts\pip.exe" install --quiet pyinstaller pillow

:: ── 3. Convert PNG → ICO & Generate Status Icons ────────────────────────────────
echo [INFO] Dang tao asset logo & tray status icons...
"%~dp0venv\Scripts\python.exe" app\generate_icons.py

:: ── 4. Build EXE using venv PyInstaller ─────────────────────────────────────────
echo [INFO] Build MXVAgent.exe voi PyInstaller trong venv...
"%~dp0venv\Scripts\pyinstaller.exe" build.spec --clean --noconfirm

if errorlevel 1 (
    echo [ERROR] PyInstaller build that bai.
    pause & exit /b 1
)

echo [OK] Build thanh cong: dist\MXVAgent.exe

:: ── 5. Build Installer (Inno Setup) ──────────────────────────────────────────
set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "%ISCC_PATH%" goto :no_iscc
echo [INFO] Dang tao installer MXV_Agent_Setup_v1.0.exe...
"%ISCC_PATH%" setup.iss
if errorlevel 1 (
    echo [ERROR] Inno Setup build that bai.
) else (
    echo [OK] Installer: Output\MXV_Agent_Setup_v1.0.exe
)
goto :end_iscc

:no_iscc
echo [WARN] Khong tim thay Inno Setup tai: %ISCC_PATH%
echo        Tai Inno Setup tai: https://jrsoftware.org/isinfo.php

:end_iscc

echo.
echo ================================================
echo   Ket qua:
echo   - dist\MXVAgent.exe         (File chay don le)
echo   - dist\MXV_Agent_Setup.exe  (Bo cai dat, neu co Inno Setup)
echo ================================================
pause

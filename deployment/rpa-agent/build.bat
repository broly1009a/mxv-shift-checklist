@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   MXV RPA Agent - Build Script
echo ================================================
echo.

:: ── 1. Activate venv ─────────────────────────────────────────────────────────
if not exist "%~dp0venv\Scripts\activate.bat" (
    echo [ERROR] Chua co venv. Chay setup_agent.bat truoc.
    pause & exit /b 1
)
call "%~dp0venv\Scripts\activate.bat"

:: ── 2. Install build deps ─────────────────────────────────────────────────────
echo [INFO] Cai dat PyInstaller va Pillow...
pip install --quiet pyinstaller pillow

:: ── 3. Convert PNG → ICO & Generate Status Icons ────────────────────────────────
echo [INFO] Dang tao asset logo & tray status icons...
python app\generate_icons.py

:: ── 4. Build EXE ──────────────────────────────────────────────────────────────
echo [INFO] Build MXVAgent.exe voi PyInstaller...
pyinstaller build.spec --clean --noconfirm

if errorlevel 1 (
    echo [ERROR] PyInstaller build that bai.
    pause & exit /b 1
)

echo [OK] Build thanh cong: dist\MXVAgent.exe

:: ── 5. Build Installer (Inno Setup) ──────────────────────────────────────────
where ISCC >nul 2>&1
if errorlevel 1 (
    echo [WARN] Khong tim thay ISCC.exe (Inno Setup). Bo qua buoc tao installer.
    echo        Tai Inno Setup tai: https://jrsoftware.org/isinfo.php
) else (
    echo [INFO] Dang tao installer MXV_Agent_Setup_v1.0.exe...
    ISCC setup.iss
    if errorlevel 1 (
        echo [ERROR] Inno Setup build that bai.
    ) else (
        echo [OK] Installer: dist\MXV_Agent_Setup_v1.0.exe
    )
)

echo.
echo ================================================
echo   Ket qua:
echo   - dist\MXVAgent.exe         (File chay don le)
echo   - dist\MXV_Agent_Setup.exe  (Bo cai dat, neu co Inno Setup)
echo ================================================
pause

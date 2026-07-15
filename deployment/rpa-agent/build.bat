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
python -c "
import os
from PIL import Image, ImageDraw

base_png = r'app\assets\icon_base.png'
assets_dir = r'app\assets'

if not os.path.exists(base_png):
    print('[WARN] Khong tim thay icon_base.png, bo qua.')
    sys.exit(0)

# 1. Generate icon.ico
img = Image.open(base_png).convert('RGBA')
sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
icons = [img.resize(s, Image.Resampling.LANCZOS) for s in sizes]
icons[0].save(os.path.join(assets_dir, 'icon.ico'), format='ICO', sizes=sizes, append_images=icons[1:])
print('[OK] Da tao icon.ico')

# 2. Generate status icons (32x32 with indicator badge)
def make_status_icon(color, filename):
    canvas = Image.open(base_png).convert('RGBA')
    canvas = canvas.resize((32, 32), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(canvas)
    # Draw status circle at bottom-right corner
    # position coordinates: (20, 20) to (30, 30) for a 10px status dot
    draw.ellipse([20, 20, 30, 30], fill=color, outline='white', width=1)
    canvas.save(os.path.join(assets_dir, filename), 'PNG')
    print('[OK] Da tao status icon:', filename)

make_status_icon('#27ae60', 'icon_online.png')
make_status_icon('#c0392b', 'icon_offline.png')
make_status_icon('#f39c12', 'icon_working.png')
"

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

@echo off
:: ============================================================
:: run_backup.bat — Wrapper for Windows Task Scheduler
:: PORTABLE: tu dong tim thu muc va Python, chay duoc tren moi may
:: ============================================================

:: %~dp0 = thu muc chua file .bat nay (tu dong, khong hardcode)
cd /d "%~dp0"

:: --- Tao thu muc logs neu chua co ---
if not exist logs mkdir logs
set LOG_FILE=logs\scheduler_run.txt

:: --- Ghi moc thoi gian bat dau ---
echo. >> %LOG_FILE%
echo ============================================================ >> %LOG_FILE%
echo [%DATE% %TIME%] START run_backup.bat >> %LOG_FILE%

:: --- Tu dong tim Python (3 cach) ---

:: Cach 1: py launcher (Python Launcher for Windows)
py --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    set PYTHON_EXE=py
    echo [%DATE% %TIME%] [OK] Tim thay Python: py launcher >> %LOG_FILE%
    goto :run
)

:: Cach 2: Tim trong %LOCALAPPDATA%\Programs\ (bat ky thu muc Python*, Python314, ...)
:: /s = tim de quy tat ca thu muc con => khong can biet ten chinh xac (Python312, Python314, ...)
for /f "delims=" %%i in ('dir /b /s "%LOCALAPPDATA%\Programs\python.exe" 2^>nul ^| findstr /v "WindowsApps" ^| sort /r') do (
    set PYTHON_EXE=%%i
    echo [%DATE% %TIME%] [OK] Tim thay Python (AppData): %%i >> %LOG_FILE%
    goto :run
)

:: Cach 3: Tim trong C:\Python* hoac C:\Program Files\Python*
for /f "delims=" %%i in ('dir /b /s "C:\Python*\python.exe" "C:\Program Files\Python*\python.exe" 2^>nul ^| sort /r') do (
    set PYTHON_EXE=%%i
    echo [%DATE% %TIME%] [OK] Tim thay Python (C:\): %%i >> %LOG_FILE%
    goto :run
)

:: FIX CASE 4: Task Scheduler chay voi account SYSTEM
:: %LOCALAPPDATA% cua SYSTEM = C:\Windows\System32\config\systemprofile\...
:: => can tim trong thu muc user that su cua may
for /f "delims=" %%i in ('dir /b /s "C:\Users\*\AppData\Local\Programs\python.exe" 2^>nul ^| findstr /v "WindowsApps" ^| sort /r') do (
    set PYTHON_EXE=%%i
    echo [%DATE% %TIME%] [OK] Tim thay Python (Users/*/*AppData): %%i >> %LOG_FILE%
    goto :run
)

:: Cach 5: Tim tren o D:\ (mot so may cai Python vao o phu)
for /f "delims=" %%i in ('dir /b /s "D:\Python*\python.exe" "D:\Program Files\Python*\python.exe" 2^>nul ^| sort /r') do (
    set PYTHON_EXE=%%i
    echo [%DATE% %TIME%] [OK] Tim thay Python (D:\): %%i >> %LOG_FILE%
    goto :run
)

echo [%DATE% %TIME%] [ERROR] Khong tim thay Python. Da thu: >> %LOG_FILE%
echo [%DATE% %TIME%]   - Cach 1: py launcher >> %LOG_FILE%
echo [%DATE% %TIME%]   - Cach 2: %LOCALAPPDATA%\Programs\**\python.exe >> %LOG_FILE%
echo [%DATE% %TIME%]   - Cach 3: C:\Python*\python.exe, C:\Program Files\Python*\python.exe >> %LOG_FILE%
echo [%DATE% %TIME%]   => Giai phap: Cai Python tai https://www.python.org/downloads/ >> %LOG_FILE%
echo [ERROR] Python khong duoc tim thay. Xem log: %LOG_FILE%
exit /b 1

:run
echo [INFO] Dung Python: %PYTHON_EXE%

:: Chay script va capture ca stdout + stderr vao log
echo [%DATE% %TIME%] [RUN] %PYTHON_EXE% scripts\backup_winscp.py >> %LOG_FILE%
%PYTHON_EXE% scripts\backup_winscp.py >> %LOG_FILE% 2>&1
set EXIT_CODE=%ERRORLEVEL%

:: Ghi ket qua cuoi cung
if %EXIT_CODE% == 0 (
    echo [%DATE% %TIME%] [PASS] Hoan thanh. Exit code: %EXIT_CODE% >> %LOG_FILE%
) else (
    echo [%DATE% %TIME%] [FAIL] Co loi. Exit code: %EXIT_CODE% >> %LOG_FILE%
)
echo ============================================================ >> %LOG_FILE%
exit /b %EXIT_CODE%

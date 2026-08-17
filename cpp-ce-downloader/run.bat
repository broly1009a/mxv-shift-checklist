@echo off
title Tool Tai Bao Cao CPP va CE Theo Thang
cd /d "%~dp0"

echo ========================================================
echo   KHOI DONG TOOL TAI BAO CAO CPP VA CE
echo ========================================================
echo.

echo [1/2] Dang kiem tra va cai dat thu vien phu thuoc...
python -m pip install -r requirements.txt
python -m playwright install chromium

echo.
echo [2/2] Dang khoi chay giao dien ung dung...
python main.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Co loi khi khoi chay giao dien. Vui long dam bao Python da duoc cai dat va co trong PATH.
)

pause

@echo off
chcp 65001 > nul
title Đóng Gói Tool Thành File EXE
echo ========================================================
echo   ĐÓNG GÓI TOOL CPP/CE DOWNLOADER THÀNH FILE .EXE
echo ========================================================
echo.

if exist venv (
    call venv\Scripts\activate.bat
) else (
    pip install pyinstaller playwright python-dateutil PyQt6
)

echo Đang chạy PyInstaller để đóng gói thành file duy nhất...
pyinstaller --noconfirm --onedir --windowed ^
    --name "CPP_CE_Report_Downloader" ^
    --add-data "config.json;." ^
    main.py

echo.
echo ========================================================
echo   ĐÓNG GÓI HOÀN TẤT!
echo   File chạy .exe nằm tại: dist\CPP_CE_Report_Downloader\CPP_CE_Report_Downloader.exe
echo ========================================================
pause

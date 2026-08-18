@echo off
chcp 65001 > nul
echo Rebuilding PyInstaller Single-File EXE for original monolithic code...

if exist "build\CPP_CE_Report_Downloader_Original" rd /s /q "build\CPP_CE_Report_Downloader_Original"
if exist "dist\CPP_CE_Report_Downloader_Original.exe" del /f /q "dist\CPP_CE_Report_Downloader_Original.exe"

pyinstaller --noconfirm --onefile --windowed --name "CPP_CE_Report_Downloader_Original" --add-data "header-logo-icon.svg;." --add-data "header-logo-light.svg;." --add-data "config.json;." --add-data "backup_original_monolithic/downloader_original.py;." backup_original_monolithic/gui_original.py

echo Done building original executable!

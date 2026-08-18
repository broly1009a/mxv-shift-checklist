@echo off
title Build File App EXE Standalone cho CPP/CE Downloader
cd /d "%~dp0"

echo ========================================================
echo   DONG GOI UNG DUNG THANH 1 FILE APP EXE DUY NHAT (ONEFILE)
echo ========================================================
echo.

echo [1/3] Dang tao file icon app_icon.ico tu SVG...
python -c "from PyQt6.QtWidgets import QApplication; from PyQt6.QtSvg import QSvgRenderer; from PyQt6.QtGui import QPainter, QImage; from PIL import Image; import sys; app = QApplication(sys.argv); renderer = QSvgRenderer('header-logo-icon.svg'); img = QImage(256, 256, QImage.Format.Format_ARGB32); img.fill(0); p = QPainter(img); renderer.render(p); p.end(); img.save('temp_icon.png'); Image.open('temp_icon.png').save('app_icon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])"

echo.
echo [2/3] Dang dong goi source code va gan Icon Logo cho File EXE...
pyinstaller -y --noconsole --onefile --icon=app_icon.ico --name "CPP_CE_Report_Downloader" ^
  --add-data "config.json;." ^
  --add-data "header-logo-light.svg;." ^
  --add-data "header-logo-icon.svg;." ^
  --add-data "app_icon.ico;." ^
  --exclude-module PyQt6.QtWebEngine ^
  --exclude-module PyQt6.QtWebEngineCore ^
  --exclude-module PyQt6.QtWebEngineWidgets ^
  --exclude-module PyQt6.QtQml ^
  --exclude-module PyQt6.QtQuick ^
  --exclude-module PyQt6.QtPdf ^
  --exclude-module PyQt6.Qt3D ^
  --exclude-module PyQt6.QtMultimedia ^
  --exclude-module PyQt6.QtSql ^
  --exclude-module tkinter ^
  --exclude-module unittest ^
  main.py

echo.
echo ========================================================
echo   🎉 HOAN THANH DONG GOI FILE EXE VOI ICON LOGO THUONG HIEU!
echo   File App EXE duy nhat luu tai: dist\CPP_CE_Report_Downloader.exe
echo ========================================================
echo.
pause

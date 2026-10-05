@echo off
chcp 65001 > nul
title MXV TKGD - Realtime Server Logs (10.1.0.16)
cls

echo ================================================================
echo   MXV TKGD - XEM LOG THỜI GIAN THỰC (Server: 10.1.0.16)
echo ================================================================
echo.
echo  [1] Xem LOG CẢ HAI (Backend + Frontend)
echo  [2] Chỉ xem LOG BACKEND (M-System Crawler, OCR, NestJS API)
echo  [3] Chỉ xem LOG FRONTEND (Next.js Dashboard)
echo.
echo  [0] Thoát
echo ================================================================
set /p choice="Nhập lựa chọn của bạn (1/2/3/0) [Mặc định: 1]: "

if "%choice%"=="" set choice=1
if "%choice%"=="1" python "%~dp0view_logs.py"
if "%choice%"=="2" python "%~dp0view_logs.py" --backend
if "%choice%"=="3" python "%~dp0view_logs.py" --frontend
if "%choice%"=="0" exit /b

pause

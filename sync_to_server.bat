@echo off
chcp 65001 > nul
title MXV TKGD - 1-Click Sync Tool (Server: 10.1.0.16)
cls

echo ================================================================
echo   MXV TKGD RECONCILER - 1-CLICK SYNC TOOL (Server: 10.1.0.16)
echo ================================================================
echo.
echo  --- ĐỒNG BỘ MÃ NGUỒN (SOURCE CODE) ---
echo  [1] Đồng bộ TOÀN BỘ CODE (Backend + Frontend)
echo  [2] Chỉ đồng bộ BACKEND CODE (NestJS API + Python)
echo  [3] Chỉ đồng bộ FRONTEND CODE (Next.js Dashboard)
echo  [4] Chỉ COPY files (Không build, không reload PM2)
echo.
echo  --- SAO LƯU & ĐỒNG BỘ DATABASE MONGODB ---
echo  [5] SAO LƯU DATABASE TKGD (Từ 10.0.0.26 sang 10.1.0.16)
echo  [6] SAO LƯU TOÀN BỘ DATABASE (Cả ca trực, users, templates...)
echo.
echo  --- TIỆN ÍCH HỆ THỐNG ---
echo  [7] XEM LOG THỜI GIAN THỰC (pm2 logs Backend & Frontend)
echo.
echo  [0] Thoát
echo ================================================================
set /p choice="Nhập lựa chọn của bạn (1/2/3/4/5/6/7/0) [Mặc định: 1]: "

if "%choice%"=="" set choice=1
if "%choice%"=="1" goto sync_all
if "%choice%"=="2" goto sync_backend
if "%choice%"=="3" goto sync_frontend
if "%choice%"=="4" goto sync_no_build
if "%choice%"=="5" goto sync_db_tkgd
if "%choice%"=="6" goto sync_db_all
if "%choice%"=="7" goto view_logs
if "%choice%"=="0" goto exit_app

echo Lựa chọn không hợp lệ!
pause
exit /b

:sync_all
python "%~dp0sync_to_server.py"
goto done

:sync_backend
python "%~dp0sync_to_server.py" --backend
goto done

:sync_frontend
python "%~dp0sync_to_server.py" --frontend
goto done

:sync_no_build
python "%~dp0sync_to_server.py" --no-build
goto done

:sync_db_tkgd
python "%~dp0sync_db_to_server.py"
goto done

:sync_db_all
python "%~dp0sync_db_to_server.py" --all
goto done

:done
echo.
echo ================================================================
echo   Thao tác hoàn tất! Nhấn phím bất kỳ để đóng cửa sổ.
echo ================================================================
pause > nul
exit /b

:exit_app
exit /b

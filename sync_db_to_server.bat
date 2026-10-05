@echo off
chcp 65001 > nul
title MXV TKGD - 1-Click Database Sync
python "%~dp0sync_db_to_server.py"
echo.
pause

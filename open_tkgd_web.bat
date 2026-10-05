@echo off
chcp 65001 >nul
title MXV TKGD - Web Dashboard Access
cls
python "%~dp0open_tkgd_web.py"
pause

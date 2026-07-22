@echo off
title Mock SFTP Server
echo ====================================================
echo Khoi dong Mock SFTP Server cho ACM Audit RPA Jobs
echo ====================================================
echo.

:: 1. Kiem tra va tu dong cai dat thu vien Python neu thieu
echo [1/2] Dang kiem tra va cai dat thu vien can thiet...
python -m pip install paramiko sftpserver --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Khong the cai dat thu vien Python. Vui long kiem tra lai phien ban Python!
    pause
    exit /b %errorlevel%
)
echo [OK] Thu vien da duoc chuan bi day du.
echo.

:: 2. Chay script mock SFTP
echo [2/2] Dang khoi chay Mock SFTP Server...
python "%~dp0POC\scripts\start_mock_sftp.py"
if %errorlevel% neq 0 (
    echo [ERROR] Loi khi chay file start_mock_sftp.py!
    pause
)

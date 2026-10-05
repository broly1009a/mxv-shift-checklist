#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
MXV TKGD - Xem Log Thời Gian Thực Trực Tiếp Từ Server 10.1.0.16
=============================================================================
"""

import sys
import os
import time
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    import paramiko
except ImportError:
    print("❌ Lỗi: Thư viện 'paramiko' chưa được cài đặt.")
    sys.exit(1)

SERVER_IP = '10.1.0.16'
SERVER_PORT = 22
SERVER_USER = 'vncadmin'
SERVER_PASS = 'CiC=,!2o26'

def main():
    parser = argparse.ArgumentParser(description="Xem log trực tiếp từ server 10.1.0.16")
    parser.add_argument("--backend", action="store_true", help="Chỉ xem log Backend")
    parser.add_argument("--frontend", action="store_true", help="Chỉ xem log Frontend")
    parser.add_argument("--lines", type=int, default=100, help="Số dòng log cũ muốn xem trước (mặc định 100)")
    args = parser.parse_args()

    app_name = ""
    if args.backend:
        app_name = "mxv-account-opening-reconciler"
    elif args.frontend:
        app_name = "mxv-account-opening-reconciler-ui"

    print("=" * 65)
    print(f"📡 Đang kết nối tới máy chủ {SERVER_IP} để lấy log...")
    print("=" * 65)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(SERVER_IP, port=SERVER_PORT, username=SERVER_USER, password=SERVER_PASS, timeout=10)
        print("✅ Kết nối thành công! Đang stream log (Nhấn Ctrl + C để dừng)...\n")
    except Exception as e:
        print(f"❌ Không thể kết nối SSH: {e}")
        input("\nNhấn Enter để thoát...")
        sys.exit(1)

    cmd = f"pm2 logs {app_name} --lines {args.lines}"
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)

    try:
        while True:
            if stdout.channel.recv_ready():
                data = stdout.channel.recv(2048).decode('utf-8', errors='replace')
                sys.stdout.write(data)
                sys.stdout.flush()
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n\n🛑 Đã dừng theo dõi log.")
    finally:
        client.close()

if __name__ == '__main__':
    main()

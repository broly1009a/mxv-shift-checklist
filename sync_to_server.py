#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
MXV TKGD Standalone - 1-Click Deploy & Sync Script
=============================================================================
Tự động nén, truyền tải mã nguồn qua SFTP lên máy chủ VNC-CIC-01 (10.1.0.16),
tự biên dịch (npm run build) và reload PM2 tức thì.

Cách dùng:
  python sync_to_server.py             # Đồng bộ cả Backend và Frontend
  python sync_to_server.py --backend   # Chỉ đồng bộ Backend
  python sync_to_server.py --frontend  # Chỉ đồng bộ Frontend
  python sync_to_server.py --no-build  # Chỉ đồng bộ file, không chạy build
=============================================================================
"""

import os
import sys
import time
import tarfile
import tempfile
import argparse

# Khắc phục lỗi hiển thị tiếng Việt trên Windows CMD / PowerShell (cp1252)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    import paramiko
except ImportError:
    print("❌ Lỗi: Thư viện 'paramiko' chưa được cài đặt.")
    print("Vui lòng chạy: pip install paramiko")
    sys.exit(1)

# Cấu hình kết nối máy chủ
SERVER_IP = '10.1.0.16'
SERVER_PORT = 22
SERVER_USER = 'vncadmin'
SERVER_PASS = 'CiC=,!2o26'

SERVER_DIR_BACKEND = '/opt/mxv-tkgd/backend'
SERVER_DIR_FRONTEND = '/opt/mxv-tkgd/frontend'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_BACKEND = os.path.join(BASE_DIR, 'mxv-account-opening-reconciler')
LOCAL_FRONTEND = os.path.join(BASE_DIR, 'mxv-account-opening-reconciler-ui')

EXCLUDE_COMMON = {
    'node_modules', '.git', '.cache', 'dist', '.next', 'logs',
    'test_screenshots', 'caithienthem', 'ngucanhnew29', 'serviceold.md',
    '.env', '.env.local', 'data'
}

def create_tar_archive(source_dir, name_tag):
    temp_tar = os.path.join(tempfile.gettempdir(), f"sync_{name_tag}_{int(time.time())}.tar.gz")
    print(f"📦 [1/4] Đang đóng gói {name_tag}...", end=' ', flush=True)
    start_time = time.time()
    
    with tarfile.open(temp_tar, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_COMMON]
            for file in files:
                if any(file.endswith(ext) for ext in ['.log', '.tmp', '.png', '.jpg', '.jpeg']) and not file.startswith('logo'):
                    continue
                if file in ['.env', '.env.local', 'caithienthem', 'ngucanhnew29', 'serviceold.md']:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir)
                tar.add(full_path, arcname=rel_path)
                
    size_mb = os.path.getsize(temp_tar) / (1024 * 1024)
    duration = time.time() - start_time
    print(f"Xong! ({size_mb:.2f} MB trong {duration:.1f}s)")
    return temp_tar

def execute_remote_cmd(ssh, cmd, title=""):
    if title:
        print(f"\n⚙️  {title}...")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            text = stdout.channel.recv(2048).decode('utf-8', errors='replace')
            sys.stdout.write(text)
            sys.stdout.flush()
        time.sleep(0.3)
        
    while stdout.channel.recv_ready():
        text = stdout.channel.recv(2048).decode('utf-8', errors='replace')
        sys.stdout.write(text)
        sys.stdout.flush()
        
    exit_code = stdout.channel.recv_exit_status()
    return exit_code

def sync_module(ssh, sftp, local_dir, remote_dir, name_tag, pm2_name, run_build=True):
    print(f"\n{'='*60}")
    print(f"🚀 BẮT ĐẦU ĐỒNG BỘ: {name_tag.upper()}")
    print(f"{'='*60}")
    
    if not os.path.exists(local_dir):
        print(f"❌ Không tìm thấy thư mục cục bộ: {local_dir}")
        return False

    # 1. Đóng gói
    tar_path = create_tar_archive(local_dir, name_tag)
    remote_tar = f"/tmp/upload_{name_tag}.tar.gz"

    try:
        # 2. Truyền file qua SFTP
        print(f"🌐 [2/4] Đang upload lên server {SERVER_IP}...", end=' ', flush=True)
        t0 = time.time()
        sftp.put(tar_path, remote_tar)
        print(f"Xong! ({time.time() - t0:.1f}s)")

        # 3. Giải nén trên server (bảo vệ file .env)
        print(f"📂 [3/4] Đang giải nén vào {remote_dir}...")
        extract_cmd = (
            f"tar -xzf {remote_tar} -C {remote_dir} && "
            f"rm -f {remote_tar} && "
            f"chown -R {SERVER_USER}:{SERVER_USER} {remote_dir}"
        )
        code = execute_remote_cmd(ssh, extract_cmd)
        if code != 0:
            print(f"❌ Giải nén thất bại với mã lỗi {code}")
            return False

        # 4. Build & Reload PM2
        if run_build:
            print(f"🔨 [4/4] Đang biên dịch & reload PM2 [{pm2_name}]...")
            extra_step = "mkdir -p dist/python && cp -rf src/python/* dist/python/ 2>/dev/null || true && " if name_tag == 'backend' else ""
            build_cmd = (
                f"cd {remote_dir} && "
                f"npm run build && "
                f"{extra_step}"
                f"pm2 reload {pm2_name}"
            )
            code = execute_remote_cmd(ssh, build_cmd)
            if code != 0:
                print(f"⚠️ Cảnh báo: Lệnh build/reload trả về mã lỗi {code}")
                return False
        else:
            print("⏩ Bỏ qua bước build theo yêu cầu (--no-build).")

        print(f"✅ Đồng bộ {name_tag} THÀNH CÔNG!")
        return True

    finally:
        if os.path.exists(tar_path):
            os.remove(tar_path)

def main():
    parser = argparse.ArgumentParser(description="Đồng bộ nhanh dự án TKGD lên server 10.1.0.16")
    parser.add_argument("--backend", action="store_true", help="Chỉ đồng bộ Backend")
    parser.add_argument("--frontend", action="store_true", help="Chỉ đồng bộ Frontend")
    parser.add_argument("--no-build", action="store_true", help="Chỉ copy file, không build")
    args = parser.parse_args()

    sync_all = not args.backend and not args.frontend
    do_backend = sync_all or args.backend
    do_frontend = sync_all or args.frontend

    print(f"\n📡 Đang kết nối tới máy chủ {SERVER_IP} ({SERVER_USER})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(SERVER_IP, port=SERVER_PORT, username=SERVER_USER, password=SERVER_PASS, timeout=15)
        print("✅ Kết nối SSH thành công!")
        sftp = ssh.open_sftp()
    except Exception as e:
        print(f"❌ Kết nối thất bại: {e}")
        sys.exit(1)

    overall_start = time.time()

    if do_backend:
        sync_module(ssh, sftp, LOCAL_BACKEND, SERVER_DIR_BACKEND, "backend", "mxv-account-opening-reconciler", not args.no_build)

    if do_frontend:
        sync_module(ssh, sftp, LOCAL_FRONTEND, SERVER_DIR_FRONTEND, "frontend", "mxv-account-opening-reconciler-ui", not args.no_build)

    # Hiển thị trạng thái PM2 cuối cùng
    print(f"\n{'='*60}")
    print("📊 TRẠNG THÁI TIẾN TRÌNH PM2 HIỆN TẠI TRÊN SERVER:")
    print(f"{'='*60}")
    execute_remote_cmd(ssh, "pm2 status")

    sftp.close()
    ssh.close()
    
    total_time = time.time() - overall_start
    print(f"\n🎉 HOÀN TẤT TOÀN BỘ TRONG {total_time:.1f} GIÂY!")

if __name__ == '__main__':
    main()

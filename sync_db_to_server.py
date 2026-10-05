#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
MXV TKGD - Công Cụ 1-Click Sao Lưu & Đồng Bộ Database MongoDB
=============================================================================
Tự động dump dữ liệu từ Server cũ (10.0.0.26) ➜ Tải về máy cá nhân lưu trữ
➜ Đẩy và khôi phục vào MongoDB Server mới (10.1.0.16).

Cách dùng:
  python sync_db_to_server.py          # Sao lưu phân hệ TKGD (khuyên dùng)
  python sync_db_to_server.py --all    # Sao lưu toàn bộ Database (ca trực, user...)
=============================================================================
"""

import os
import sys
import time
import argparse
from datetime import datetime

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

# Cấu hình máy chủ NGUỒN (Checklist cũ)
OLD_SERVER_IP = '10.0.0.26'
OLD_SERVER_USER = 'mxvadmin'
OLD_SERVER_PASS = 'MxV!,#2o26'
OLD_DB_NAME = 'mxv_shift_checklist'

# Cấu hình máy chủ ĐÍCH (Server mới VNC-CIC-01)
NEW_SERVER_IP = '10.1.0.16'
NEW_SERVER_USER = 'vncadmin'
NEW_SERVER_PASS = 'CiC=,!2o26'
NEW_DB_NAME = 'mxv_tkgd_reconciler'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_LOCAL_DIR = os.path.join(BASE_DIR, 'backups', 'db')
os.makedirs(BACKUP_LOCAL_DIR, exist_ok=True)

TKGD_COLLECTIONS = [
    'clean_account_records',
    'raw_account_mails',
    'tkgd_extraction_logs',
    'tkgd_activity_logs',
    'tkgd_user_configs'
]

def run_ssh_cmd(ssh, cmd, title=""):
    if title:
        print(f"  ➜ {title}...")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('ascii', errors='ignore').strip()
    err = stderr.read().decode('ascii', errors='ignore').strip()
    return exit_code, out, err

def main():
    parser = argparse.ArgumentParser(description="Sao lưu & Đồng bộ Database MongoDB sang server mới 10.1.0.16")
    parser.add_argument("--all", action="store_true", help="Sao lưu toàn bộ Database thay vì chỉ riêng phân hệ TKGD")
    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_archive = os.path.join(BACKUP_LOCAL_DIR, f"tkgd_backup_{timestamp}.tar.gz")
    
    start_time = time.time()
    print("=" * 65)
    print("🚀 BẮT ĐẦU QUY TRÌNH ĐỒNG BỘ DATABASE SANG SERVER 10.1.0.16")
    print("=" * 65)

    # -------------------------------------------------------------
    # BƯỚC 1: DUMP DỮ LIỆU TỪ SERVER CŨ (10.0.0.26)
    # -------------------------------------------------------------
    print(f"\n📡 [1/4] Đang kết nối tới Server NGUỒN {OLD_SERVER_IP} ({OLD_SERVER_USER})...")
    ssh_old = paramiko.SSHClient()
    ssh_old.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh_old.connect(OLD_SERVER_IP, port=22, username=OLD_SERVER_USER, password=OLD_SERVER_PASS, timeout=15)
        print("  ✅ Kết nối Server NGUỒN thành công!")
    except Exception as e:
        print(f"  ❌ Không thể kết nối Server NGUỒN ({OLD_SERVER_IP}): {e}")
        sys.exit(1)

    ssh_old.exec_command("rm -rf /tmp/db_sync_dump /tmp/db_sync_dump.tar.gz")
    ssh_old.exec_command("mkdir -p /tmp/db_sync_dump")

    if args.all:
        print(f"  📦 Đang dump TOÀN BỘ database '{OLD_DB_NAME}'...")
        cmd = f"mongodump --db={OLD_DB_NAME} --gzip --out=/tmp/db_sync_dump"
        code, out, err = run_ssh_cmd(ssh_old, cmd)
    else:
        print(f"  📦 Đang dump 5 collection của phân hệ TKGD...")
        for col in TKGD_COLLECTIONS:
            cmd = f"mongodump --db={OLD_DB_NAME} --collection={col} --gzip --out=/tmp/db_sync_dump"
            run_ssh_cmd(ssh_old, cmd, f"Đang xuất bảng '{col}'")

    # Đóng gói tar.gz trên server cũ
    run_ssh_cmd(ssh_old, "tar -czf /tmp/db_sync_dump.tar.gz -C /tmp db_sync_dump", "Nén dữ liệu dump thành file tar.gz")
    
    # -------------------------------------------------------------
    # BƯỚC 2: TẢI VỀ MÁY CÁ NHÂN LÀM BẢN BACKUP
    # -------------------------------------------------------------
    print(f"\n📥 [2/4] Đang tải bản backup về máy cá nhân...")
    sftp_old = ssh_old.open_sftp()
    t0 = time.time()
    sftp_old.get("/tmp/db_sync_dump.tar.gz", local_archive)
    sftp_old.close()
    ssh_old.exec_command("rm -rf /tmp/db_sync_dump /tmp/db_sync_dump.tar.gz")
    ssh_old.close()
    
    size_mb = os.path.getsize(local_archive) / (1024 * 1024)
    print(f"  ✅ Đã lưu bản backup: {local_archive} ({size_mb:.2f} MB trong {time.time() - t0:.1f}s)")

    # -------------------------------------------------------------
    # BƯỚC 3: ĐẨY SANG SERVER MỚI (10.1.0.16)
    # -------------------------------------------------------------
    print(f"\n🌐 [3/4] Đang kết nối tới Server ĐÍCH {NEW_SERVER_IP} ({NEW_SERVER_USER})...")
    ssh_new = paramiko.SSHClient()
    ssh_new.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh_new.connect(NEW_SERVER_IP, port=22, username=NEW_SERVER_USER, password=NEW_SERVER_PASS, timeout=15)
        print("  ✅ Kết nối Server ĐÍCH thành công!")
    except Exception as e:
        print(f"  ❌ Không thể kết nối Server ĐÍCH ({NEW_SERVER_IP}): {e}")
        sys.exit(1)

    print("  📤 Đang upload bản backup lên máy chủ 10.1.0.16...")
    sftp_new = ssh_new.open_sftp()
    t1 = time.time()
    sftp_new.put(local_archive, "/tmp/db_sync_dump.tar.gz")
    sftp_new.close()
    print(f"  ✅ Upload thành công trong {time.time() - t1:.1f}s!")

    # -------------------------------------------------------------
    # BƯỚC 4: KHÔI PHỤC VÀO MONGODB TRÊN SERVER MỚI
    # -------------------------------------------------------------
    print(f"\n🔨 [4/4] Đang khôi phục dữ liệu vào Database '{NEW_DB_NAME}'...")
    run_ssh_cmd(ssh_new, "rm -rf /tmp/db_sync_dump && tar -xzf /tmp/db_sync_dump.tar.gz -C /tmp")

    # Khôi phục vào database chuẩn của backend (mxv_tkgd_reconciler)
    restore_cmd = f"mongorestore --db={NEW_DB_NAME} --gzip --drop /tmp/db_sync_dump/{OLD_DB_NAME}"
    code, out, err = run_ssh_cmd(ssh_new, restore_cmd, f"Khôi phục vào database '{NEW_DB_NAME}'")
    
    # Đồng bộ cả database mxv_shift_checklist dự phòng
    run_ssh_cmd(ssh_new, f"mongorestore --db=mxv_shift_checklist --gzip --drop /tmp/db_sync_dump/{OLD_DB_NAME}")

    # Xóa file tạm trên server mới
    ssh_new.exec_command("rm -rf /tmp/db_sync_dump /tmp/db_sync_dump.tar.gz")

    # Kiểm tra số lượng bản ghi thực tế
    verify_script = f"""
    let d = db.getSiblingDB('{NEW_DB_NAME}');
    d.getCollectionNames().filter(c => !c.startsWith('system.')).forEach(c => {{
      print(' - ' + c + ': ' + d.getCollection(c).countDocuments() + ' bản ghi');
    }});
    """
    code, verify_out, _ = run_ssh_cmd(ssh_new, f'mongosh --quiet --eval "{verify_script}"')

    ssh_new.close()

    total_time = time.time() - start_time
    print("\n" + "=" * 65)
    print("📊 KẾT QUẢ ĐỒNG BỘ TRÊN MÁY CHỦ MỚI (10.1.0.16):")
    print("=" * 65)
    print(verify_out)
    print(f"\n🎉 TOÀN BỘ QUY TRÌNH HOÀN TẤT THÀNH CÔNG TRONG {total_time:.1f} GIÂY!")
    print(f"📁 Bản lưu trữ an toàn đã được lưu tại:\n   {local_archive}\n")

if __name__ == '__main__':
    main()

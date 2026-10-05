#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
MXV TKGD Standalone - 1-Click Web Access Tunnel (Auto-KeepAlive & Auto-Reconnect)
=============================================================================
Tự động thiết lập SSH Port Forwarding từ máy cá nhân tới server 10.1.0.16:80
với cơ chế KeepAlive và tự động kết nối lại khi mất mạng.
Tự động mở trình duyệt web tới http://localhost:8080.
=============================================================================
"""

import sys
import os
import time
import socket
import select
import threading
import webbrowser
import subprocess

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    import paramiko
except ImportError:
    print("❌ Lỗi: Thư viện 'paramiko' chưa được cài đặt.")
    print("Vui lòng chạy: pip install paramiko")
    sys.exit(1)

SERVER_IP = '10.1.0.16'
SERVER_PORT = 22
SERVER_USER = 'vncadmin'
SERVER_PASS = 'CiC=,!2o26'
LOCAL_PORT = 8080
REMOTE_HOST = '127.0.0.1'
REMOTE_PORT = 80

def free_port(port):
    """Giải phóng cổng nếu có tiến trình zombie cũ đang chiếm giữ."""
    try:
        if sys.platform == 'win32':
            res = subprocess.run(f"netstat -ano | findstr :{port}", shell=True, capture_output=True, text=True)
            for line in res.stdout.strip().splitlines():
                parts = line.split()
                if len(parts) >= 5 and f":{port}" in parts[1] and parts[3] == "LISTENING":
                    pid = parts[4]
                    if pid != str(os.getpid()):
                        print(f"⚠️ Phát hiện tiến trình cũ (PID {pid}) đang chiếm cổng {port}. Đang giải phóng...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                        time.sleep(0.5)
    except Exception as e:
        pass

def handler(chan, client_socket):
    while True:
        try:
            r, w, x = select.select([client_socket, chan], [], [], 5.0)
            if client_socket in r:
                data = client_socket.recv(4096)
                if len(data) == 0:
                    break
                chan.send(data)
            if chan in r:
                data = chan.recv(4096)
                if len(data) == 0:
                    break
                client_socket.send(data)
        except Exception:
            break
    try:
        chan.close()
    except Exception:
        pass
    try:
        client_socket.close()
    except Exception:
        pass

def forward_tunnel(local_port, remote_host, remote_port, transport_holder, stop_event):
    dock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    dock_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        dock_socket.bind(('127.0.0.1', local_port))
        dock_socket.listen(10)
        dock_socket.settimeout(1.0)
    except Exception as e:
        print(f"❌ Không thể lắng nghe trên cổng {local_port}: {e}")
        return

    while not stop_event.is_set():
        try:
            client_sock, client_addr = dock_socket.accept()
        except socket.timeout:
            continue
        except Exception:
            break

        transport = transport_holder.get('transport')
        if not transport or not transport.is_active():
            client_sock.close()
            continue

        def worker(sock=client_sock):
            try:
                chan = transport.open_channel(
                    'direct-tcpip',
                    (remote_host, remote_port),
                    sock.getpeername()
                )
            except Exception:
                sock.close()
                return

            if chan is None:
                sock.close()
                return

            handler(chan, sock)

        t = threading.Thread(target=worker, daemon=True)
        t.start()

    try:
        dock_socket.close()
    except Exception:
        pass

def main():
    print("=" * 65)
    print("🚀 ĐANG KHỞI ĐỘNG ĐƯỜNG TRUYỀN TỚI HỆ THỐNG TKGD (10.1.0.16)...")
    print("=" * 65)

    free_port(LOCAL_PORT)

    transport_holder = {}
    stop_event = threading.Event()

    # Bật socket listener trên cổng 8080
    tunnel_thread = threading.Thread(
        target=forward_tunnel,
        args=(LOCAL_PORT, REMOTE_HOST, REMOTE_PORT, transport_holder, stop_event),
        daemon=True
    )
    tunnel_thread.start()

    browser_opened = False

    while True:
        try:
            print(f"📡 Đang kết nối SSH tới {SERVER_IP}:{SERVER_PORT}...")
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                SERVER_IP,
                port=SERVER_PORT,
                username=SERVER_USER,
                password=SERVER_PASS,
                timeout=10,
                banner_timeout=15
            )
            
            # Kích hoạt gói tin KeepAlive định kỳ 15 giây để duy trì kết nối vĩnh viễn
            transport = client.get_transport()
            transport.set_keepalive(15)
            transport_holder['transport'] = transport

            url = f"http://localhost:{LOCAL_PORT}"
            print(f"✅ Kết nối SSH thành công! Đường hầm sẵn sàng tại: {url}")
            print("✨ Cửa sổ này đang duy trì kết nối. Vui lòng KHÔNG ĐÓNG cửa sổ này khi đang dùng web.")
            print("👉 Nhấn Ctrl + C để ngắt kết nối.")
            print("-" * 65)

            if not browser_opened:
                time.sleep(1)
                webbrowser.open(url)
                browser_opened = True

            # Theo dõi trạng thái kết nối
            while transport.is_active():
                time.sleep(2)

            print("⚠️ Kết nối SSH bị ngắt quãng. Đang tự động kết nối lại sau 3 giây...")
            client.close()
            time.sleep(3)

        except KeyboardInterrupt:
            print("\n🛑 Người dùng yêu cầu dừng đường truyền.")
            stop_event.set()
            if 'transport' in transport_holder:
                try:
                    transport_holder['transport'].close()
                except Exception:
                    pass
            break
        except Exception as e:
            print(f"❌ Lỗi kết nối ({e}). Thử lại sau 5 giây...")
            time.sleep(5)

if __name__ == '__main__':
    main()

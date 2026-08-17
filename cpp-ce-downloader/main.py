r"""
main.py — Entry Point chính của Tool Tải Báo Cáo CPP/CE

Sử dụng:
  1. Chạy mặc định giao diện GUI:
     python main.py

  2. Chạy giao diện dòng lệnh (CLI):
     python main.py --cli --url https://clearing.mxv.com.vn --user admin --pass secret --start 01/01/2025 --end 30/08/2026 --output D:\BaoCao_CPP_CE
"""

import os
import sys
import argparse

# Ép hệ thống dùng utf-8 cho stdout và stderr trên Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from downloader import run_download, load_config


def main():
    parser = argparse.ArgumentParser(description="Tool Tai Bao Cao CPP/CE Theo Thang")
    parser.add_argument("--cli", action="store_true", help="Chay o che do dong lenh")
    parser.add_argument("--url", type=str, default="", help="URL he thong CPP/CE")
    parser.add_argument("--user", type=str, default="", help="Ten dang nhap")
    parser.add_argument("--pass", type=str, dest="password", default="", help="Mat khau")
    parser.add_argument("--start", type=str, default="01/01/2025", help="Tu ngay (dd/mm/yyyy)")
    parser.add_argument("--end", type=str, default="30/08/2026", help="Den ngay (dd/mm/yyyy)")
    parser.add_argument("--output", type=str, default=r"D:\BaoCao_CPP_CE", help="Thu muc luu file tong")
    parser.add_argument("--headless", action="store_true", help="Chay an trinh duyet")

    args = parser.parse_args()

    if args.cli or len(sys.argv) > 1:
        cfg = load_config()
        url = args.url or cfg.get("system_url", "https://clearing.mxv.com.vn")
        username = args.user or cfg.get("username", "")
        password = args.password or cfg.get("password", "")

        if not username or not password:
            print("❌ Lỗi: Thiếu thông tin --user hoặc --pass!")
            sys.exit(1)

        run_download(
            system_url=url,
            username=username,
            password=password,
            start_date=args.start,
            end_date=args.end,
            output_dir=args.output,
            headless=args.headless
        )
    else:
        # Mở giao diện đồ họa GUI (PyQt6)
        try:
            from gui import launch_gui
            launch_gui()
        except Exception as e:
            print(f"⚠️ Không thể khởi chạy PyQt6 GUI ({e}). Đang mở lại...")
            try:
                from gui import launch_gui
                launch_gui()
            except Exception as ex:
                print(f"❌ Lỗi bật giao diện GUI: {ex}")


if __name__ == "__main__":
    main()

"""
config_manager.py — Quản lý cấu hình tập trung cho Tool CPP/CE Downloader
"""

import os
import sys
import json

CONFIG_FILE_NAME = "config.json"


def get_config_path() -> str:
    """Trả về đường dẫn tuyệt đối của file config.json."""
    if getattr(sys, 'frozen', False):
        # Chạy dưới dạng PyInstaller EXE: Lưu config.json ngay bên cạnh file .exe
        base_dir = os.path.dirname(sys.executable)
    else:
        # Chạy mã nguồn Python
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, CONFIG_FILE_NAME)


DEFAULT_REPORTS = [
    {
        "code": "NR",
        "name": "Lịch sử nộp rút tiền",
        "parent_menu": "Quản lý tiền",
        "child_menu": "Lịch sử nộp rút tiền",
        "cached_url": "https://uat-coreccp.mxv.com.vn/CASHTRANFER/CASHTRANFER_HIST",
        "enabled": True
    },
    {
        "code": "DSL",
        "name": "Lịch sử lệnh",
        "parent_menu": "Lệnh và vị thế",
        "child_menu": "Lịch sử lệnh",
        "cached_url": "",
        "enabled": True
    },
    {
        "code": "DSGD",
        "name": "Lịch sử giao dịch",
        "parent_menu": "Lệnh và vị thế",
        "child_menu": "Lịch sử giao dịch",
        "cached_url": "",
        "enabled": True
    },
    {
        "code": "TTTT",
        "name": "Trạng thái tất toán",
        "parent_menu": "Lệnh và vị thế",
        "child_menu": "Trạng thái tất toán",
        "tab_name": "Lịch sử tất toán",
        "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/PNL_EXECUTED",
        "enabled": True
    },
    {
        "code": "LSGTT",
        "name": "Lịch sử giá thanh toán",
        "parent_menu": "Quản lý sản phẩm",
        "child_menu": "Quản lý lịch sử giá thanh toán",
        "cached_url": "https://uat-coreccp.mxv.com.vn/PRODUCT/SETTLEMENT_HIST",
        "enabled": True
    }
]


def load_config() -> dict:
    """Đọc cấu hình từ config.json, tự động bảo toàn đủ 5 loại báo cáo tiêu chuẩn."""
    config_path = get_config_path()
    cfg = None
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            cfg = None

    if not cfg:
        cfg = {
            "system_type": "CORE_CCP",
            "system_url": "https://uat-coreccp.mxv.com.vn/login",
            "username": "",
            "password": "",
            "start_date": "01/01/2025",
            "end_date": "30/08/2026",
            "output_dir": r"D:\BaoCao_CPP_CE",
            "exchange": "",
            "member_code": "",
            "acct_no": "",
            "headless": False,
            "overwrite_existing": False,
            "auto_split_on_timeout": True,
            "reports": DEFAULT_REPORTS
        }
    else:
        # Tự động kiểm tra và phục hồi các báo cáo bị thiếu trong config.json
        existing_reports = cfg.get("reports", [])
        existing_codes = {r["code"]: r for r in existing_reports if isinstance(r, dict) and "code" in r}

        merged_reports = []
        for default_r in DEFAULT_REPORTS:
            code = default_r["code"]
            if code in existing_codes:
                saved_r = existing_codes[code]
                # Merge thông tin mặc định nếu thiếu
                merged_item = dict(default_r)
                merged_item.update(saved_r)
                merged_reports.append(merged_item)
            else:
                merged_reports.append(dict(default_r))

        cfg["reports"] = merged_reports

    save_config(cfg)
    return cfg


def save_config(cfg: dict):
    """Lưu dictionary cấu hình vào file config.json."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Lỗi ghi file config.json: {e}")

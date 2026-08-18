"""
config_manager.py — Quản lý cấu hình tập trung cho Tool CPP/CE Downloader
"""

import os
import json

CONFIG_FILE_NAME = "config.json"


def get_config_path() -> str:
    """Trả về đường dẫn tuyệt đối của file config.json."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, CONFIG_FILE_NAME)


def load_config() -> dict:
    """Đọc cấu hình từ config.json, nếu chưa có thì tạo file cấu hình mặc định."""
    config_path = get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    default_config = {
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
        "reports": [
            {
                "code": "NR",
                "name": "Lịch sử nộp rút tiền",
                "parent_menu": "Nộp rút tiền",
                "child_menu": "Lịch sử Nộp/ Rút tiền",
                "cached_url": "https://uat-coreccp.mxv.com.vn/CASHTRANFER/CASHTRANFER_HIST",
                "enabled": True
            },
            {
                "code": "DSL",
                "name": "Danh sách lệnh",
                "parent_menu": "Lệnh và vị thế",
                "sub_menu": "Tra cứu tổng hợp",
                "child_menu": "Danh sách lệnh",
                "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERBOOK",
                "enabled": True
            },
            {
                "code": "DSGD",
                "name": "Danh sách giao dịch",
                "parent_menu": "Lệnh và vị thế",
                "sub_menu": "Tra cứu tổng hợp",
                "child_menu": "Danh sách giao dịch",
                "cached_url": "https://uat-coreccp.mxv.com.vn/ORDERS/ORDERMATCH_DETAIL",
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
    }
    save_config(default_config)
    return default_config


def save_config(cfg: dict):
    """Lưu dictionary cấu hình vào file config.json."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Lỗi ghi file config.json: {e}")

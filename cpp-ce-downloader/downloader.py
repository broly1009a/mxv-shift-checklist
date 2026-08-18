"""
downloader.py — Backward Compatibility Wrapper cho CPP/CE Downloader

Mã nguồn thực tế hiện tại đã được tái cấu trúc theo kiến trúc Clean Modular & Page Object Model (POM):
  - config/config_manager.py
  - core/browser_factory.py & base_page.py
  - page_objects/base_report_page.py, core_ccp_page.py, core_ex_page.py
  - services/date_service.py & report_engine.py

File này giữ vai trò re-export để đảm bảo tất cả các script cũ/test module gọi `from downloader import ...` hoạt động 100%.
"""

from config.config_manager import load_config, save_config, get_config_path
from services.date_service import generate_monthly_intervals
from core.browser_factory import launch_browser_resilient
from services.report_engine import ReportEngine, run_download

__all__ = [
    "load_config",
    "save_config",
    "get_config_path",
    "generate_monthly_intervals",
    "launch_browser_resilient",
    "ReportEngine",
    "run_download",
]

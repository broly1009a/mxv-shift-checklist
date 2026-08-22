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

def ensure_sidebar_expanded(page, log=print):
    from core.base_page import BasePage
    bp = BasePage(page, log)
    bp.ensure_sidebar_expanded()

def navigate_to_report_page(page, report_cfg, system_url, log=print) -> str:
    from services.report_engine import ReportEngine
    engine = ReportEngine(system_url, "", "", "", "", "", logger_callback=log)
    page_obj = engine.get_page_object(page)
    return page_obj.navigate_to_report(report_cfg, system_url)

def set_date_range_and_search(page, start_date, end_date, exchange="", member_code="", acct_no="", log=print):
    if callable(exchange):
        log = exchange
        exchange = ""
    elif callable(member_code):
        log = member_code
        member_code = ""
    elif callable(acct_no):
        log = acct_no
        acct_no = ""

    from services.report_engine import ReportEngine
    engine = ReportEngine(page.url, "", "", "", "", "", logger_callback=log)
    page_obj = engine.get_page_object(page)
    page_obj.set_date_range_and_search(start_date, end_date, exchange=exchange, member_code=member_code, acct_no=acct_no)

def set_mui_date_range_and_search(page, start_date, end_date, exchange="", member_code="", acct_no="", log=print):
    if callable(exchange):
        log = exchange
        exchange = ""
    elif callable(member_code):
        log = member_code
        member_code = ""
    elif callable(acct_no):
        log = acct_no
        acct_no = ""
    set_date_range_and_search(page, start_date, end_date, exchange=exchange, member_code=member_code, acct_no=acct_no, log=log)

def trigger_export_download(page, headless=False, timeout_ms=30000, log=print):
    from services.report_engine import ReportEngine
    engine = ReportEngine(page.url, "", "", "", "", "", headless=headless, download_timeout=timeout_ms, logger_callback=log)
    page_obj = engine.get_page_object(page)
    return page_obj.trigger_export_download(headless=headless, timeout_ms=timeout_ms)

__all__ = [
    "load_config",
    "save_config",
    "get_config_path",
    "generate_monthly_intervals",
    "launch_browser_resilient",
    "ReportEngine",
    "run_download",
    "ensure_sidebar_expanded",
    "navigate_to_report_page",
    "set_date_range_and_search",
    "set_mui_date_range_and_search",
    "trigger_export_download",
]

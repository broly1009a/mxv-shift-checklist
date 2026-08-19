"""
date_service.py — Xử lý tính toán và chia khoảng thời gian theo từng tháng.
"""

import calendar
from datetime import datetime
from dateutil.relativedelta import relativedelta


def generate_monthly_intervals(start_date_str: str, end_date_str: str) -> list:
    """
    Sinh danh sách khoảng thời gian theo từng tháng từ start_date -> end_date.
    Định dạng ngày đầu vào: dd/mm/yyyy
    Ví dụ: '01/01/2025' -> '30/08/2026'
    Trả về danh sách dict: [{'start_str': '01/01/2025', 'end_str': '31/01/2025', 'mmyy': '0125'}, ...]
    """
    start_date_clean = start_date_str.strip().replace("-", "/").replace(".", "/")
    end_date_clean = end_date_str.strip().replace("-", "/").replace(".", "/")
    start_dt = datetime.strptime(start_date_clean, "%d/%m/%Y")
    end_dt = datetime.strptime(end_date_clean, "%d/%m/%Y")

    current = start_dt.replace(day=1)
    monthly_ranges = []

    while current <= end_dt:
        first_day = current
        last_day_num = calendar.monthrange(current.year, current.month)[1]
        last_day = current.replace(day=last_day_num)

        actual_start = max(first_day, start_dt)
        actual_end = min(last_day, end_dt)

        mmyy = current.strftime("%m%y")

        monthly_ranges.append({
            "start_str": actual_start.strftime("%d/%m/%Y"),
            "end_str": actual_end.strftime("%d/%m/%Y"),
            "mmyy": mmyy
        })
        current += relativedelta(months=1)

    return monthly_ranges

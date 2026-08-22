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


def split_interval(start_str: str, end_str: str) -> tuple | None:
    """
    Chia đôi khoảng ngày start_str -> end_str (định dạng dd/mm/yyyy).
    Ví dụ: '01/07/2026' -> '31/07/2026' thành:
      - Part 1: '01/07/2026' -> '15/07/2026'
      - Part 2: '16/07/2026' -> '31/07/2026'
    Nếu khoảng ngày chỉ gồm 1 ngày (không thể chia thêm), trả về None.
    """
    from datetime import datetime, timedelta
    start_clean = start_str.strip().replace("-", "/").replace(".", "/")
    end_clean = end_str.strip().replace("-", "/").replace(".", "/")

    try:
        start_dt = datetime.strptime(start_clean, "%d/%m/%Y")
        end_dt = datetime.strptime(end_clean, "%d/%m/%Y")
    except Exception:
        return None

    if start_dt >= end_dt:
        return None

    delta_days = (end_dt - start_dt).days
    if delta_days < 1:
        return None

    mid_dt = start_dt + timedelta(days=delta_days // 2)
    part1_end = mid_dt
    part2_start = mid_dt + timedelta(days=1)

    part1 = {
        "start_str": start_dt.strftime("%d/%m/%Y"),
        "end_str": part1_end.strftime("%d/%m/%Y"),
        "mmyy": start_dt.strftime("%m%y")
    }
    part2 = {
        "start_str": part2_start.strftime("%d/%m/%Y"),
        "end_str": end_dt.strftime("%d/%m/%Y"),
        "mmyy": start_dt.strftime("%m%y")
    }
    return part1, part2


def merge_csv_files(sub_file_paths: list, output_dest_path: str) -> bool:
    """
    Hợp nhất danh sách các file CSV tạm thành 1 file CSV duy nhất.
    Giữ dòng Header của file đầu tiên, nối tiếp các dòng dữ liệu của các file sau.
    Tự động xóa các file tạm sau khi hợp nhất.
    """
    import os

    valid_files = [f for f in sub_file_paths if os.path.exists(f) and os.path.getsize(f) > 0]
    if not valid_files:
        return False

    os.makedirs(os.path.dirname(output_dest_path), exist_ok=True)
    header_written = False

    try:
        with open(output_dest_path, "w", encoding="utf-8-sig", newline="") as outfile:
            for filepath in valid_files:
                try:
                    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as infile:
                        lines = infile.readlines()
                        if not lines:
                            continue
                        if not header_written:
                            outfile.writelines(lines)
                            header_written = True
                        else:
                            # Bỏ qua dòng Header (dòng 1) của các file tiếp theo
                            outfile.writelines(lines[1:])
                except Exception:
                    pass

        # Dọn dẹp các file tạm
        for filepath in sub_file_paths:
            if os.path.exists(filepath) and filepath != output_dest_path:
                try:
                    os.remove(filepath)
                except Exception:
                    pass

        return os.path.exists(output_dest_path) and os.path.getsize(output_dest_path) > 0
    except Exception:
        return False

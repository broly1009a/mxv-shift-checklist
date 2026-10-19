#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_python_symbol_normalizer.py
Unit test kiểm thử 1:1 bộ chuẩn hóa mã hợp đồng và tài khoản (Python vs TypeScript)
Ánh xạ 100% theo symbol-normalizer.helper.ts
"""

import sys
import re
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ==============================================================================
# 1. CORE LOGIC (Python port of symbol-normalizer.helper.ts)
# ==============================================================================
LME_CODE_MAP = {
    'LALZ': 'AHD',
    'LDKZ': 'CAD',
    'LEDZ': 'PBD',
    'LNIZ': 'NID',
    'LTIZ': 'SND',
    'LZHZ': 'ZDS',
}

REVERSE_MONTH_CODE = {
    '01': 'F',
    '02': 'G',
    '03': 'H',
    '04': 'J',
    '05': 'K',
    '06': 'M',
    '07': 'N',
    '08': 'Q',
    '09': 'U',
    '10': 'V',
    '11': 'X',
    '12': 'Z',
}


def get_normalized_account(account: str) -> str:
    """
    Chuẩn hóa số tài khoản giao dịch (Account Normalizer)
    Ví dụ: 001C123456F -> 001C123456, 001C123456L -> 001C123456-L
    """
    if not account:
        return ''
    acc = str(account).strip()
    acc = re.sub(r'F$', '', acc, flags=re.IGNORECASE)
    acc = re.sub(r'L$', '-L', acc, flags=re.IGNORECASE)
    acc = re.sub(r'S$', '-S', acc, flags=re.IGNORECASE)
    acc = re.sub(r'--', '-', acc)
    return acc.upper()


def add_months(sourcedate: datetime, months: int) -> datetime:
    """Adds months handling variable month lengths."""
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    day = min(sourcedate.day, 28)  # safe day clamp
    return sourcedate.replace(year=year, month=month, day=day)


def convert_lme_symbol(symbol: str, date: datetime, holidays: list = None) -> str:
    """
    Quy đổi mã LME của CQG sang chuẩn M-System
    """
    if not symbol or symbol not in LME_CODE_MAP:
        return symbol

    if holidays is None:
        holidays = []

    # Cộng 3 tháng (Tương đương JS setMonth(getMonth() + 3))
    # Trong JS: d.setMonth(d.getMonth() + 3)
    # JS Date logic:
    m = date.month + 3
    y = date.year
    while m > 12:
        m -= 12
        y += 1
    # Day clamp for month end
    import calendar
    max_days = calendar.monthrange(y, m)[1]
    d = min(date.day, max_days)
    adjusted_date = datetime(y, m, d)

    # Trong JS: dayOfWeek = adjustedDate.getDay() (0: CN, 6: T7)
    # Trong Python: adjusted_date.weekday() (5: T7, 6: CN)
    weekday = adjusted_date.weekday()
    if weekday == 5:  # Thứ Bảy
        adjusted_date -= timedelta(days=1)
    elif weekday == 6:  # Chủ Nhật
        adjusted_date += timedelta(days=1)

    def format_ddmmyyyy(dt: datetime) -> str:
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year}"

    adjusted_date_str = format_ddmmyyyy(adjusted_date)
    dayoff_map = {}
    for h in holidays:
        if isinstance(h, str):
            parts = h.split(',')
            if len(parts) >= 2:
                dayoff_map[parts[0].strip()] = parts[1].strip()
        elif isinstance(h, dict) and 'originalDate' in h and 'replacementDate' in h:
            dayoff_map[str(h['originalDate']).strip()] = str(h['replacementDate']).strip()

    while adjusted_date_str in dayoff_map:
        next_date_str = dayoff_map.get(adjusted_date_str)
        if not next_date_str:
            break
        adjusted_date_str = next_date_str
        d_val, m_val, y_val = map(int, adjusted_date_str.split('/'))
        adjusted_date = datetime(y_val, m_val, d_val)

    new_day = f"{adjusted_date.day:02d}"
    new_month = f"{adjusted_date.month:02d}"
    new_year = str(adjusted_date.year)

    mapped = LME_CODE_MAP[symbol]
    month_code = REVERSE_MONTH_CODE.get(new_month)
    if not month_code:
        raise ValueError(f"Convert month failed for: {new_month}")
    year_short = new_year[2:]

    return f"{mapped}D{new_day}{month_code}{year_short}"


def normalize_contract_code(raw_symbol: str, source: str, context: dict = None) -> str:
    """
    Điểm chặn duy nhất (Single Point of Truth) để chuẩn hóa mã hợp đồng trên toàn hệ thống.
    """
    if not raw_symbol:
        return ''
    sym = str(raw_symbol).strip().upper()

    if source == 'CQG':
        # Bỏ tiền tố Option nếu có
        if sym.startswith('C.') or sym.startswith('P.'):
            sym = sym[2:]
        # Quy đổi mã LME nếu thuộc danh mục LME
        date_ctx = context.get('date', datetime.now()) if context else datetime.now()
        holidays_ctx = context.get('holidays', []) if context else []
        return convert_lme_symbol(sym, date_ctx, holidays_ctx)
    elif source == 'MS':
        return sym
    elif source in ('CE', 'CCP'):
        # Chuẩn hóa mã sàn nội bộ CoreExchange / CoreCCP
        return re.sub(r'[\s_]+', '', sym)
    else:
        return sym


# ==============================================================================
# 2. UNIT TEST SUITE (Kiểm tra 100% assertions)
# ==============================================================================
def run_tests():
    total = 0
    passed = 0

    def assert_eq(test_name: str, actual: any, expected: any):
        nonlocal total, passed
        total += 1
        if actual == expected:
            passed += 1
            print(f"  [PASS] {test_name}: {actual}")
        else:
            print(f"  [FAIL] {test_name}: Actual '{actual}' != Expected '{expected}'")

    print("==================================================")
    print("TEST SUITE: PYTHON SYMBOL & ACCOUNT NORMALIZER")
    print("==================================================")

    # 1. Account Normalizer Tests
    print("\n[1] Kiểm thử chuẩn hóa tài khoản (get_normalized_account):")
    assert_eq("Khách hàng Future thường (F)", get_normalized_account("001C123456F"), "001C123456")
    assert_eq("Khách hàng Spread (L)", get_normalized_account("001C123456L"), "001C123456-L")
    assert_eq("Khách hàng Hedge (S)", get_normalized_account("001C123456S"), "001C123456-S")
    assert_eq("Tài khoản đã có sẵn -L không bị trùng (--L)", get_normalized_account("001C123456-L"), "001C123456-L")
    assert_eq("Tài khoản đã có sẵn -S không bị trùng (--S)", get_normalized_account("001C123456-S"), "001C123456-S")
    assert_eq("Tài khoản đã chuẩn", get_normalized_account("080C7777697"), "080C7777697")
    assert_eq("Tài khoản chữ thường", get_normalized_account("080c7777697f"), "080C7777697")

    # 2. Standard Commodity Codes (MS vs CQG)
    print("\n[2] Kiểm thử hợp đồng nông sản / kim loại thông thường:")
    assert_eq("MS Corn 12/26", normalize_contract_code("ZCEZ26", "MS"), "ZCEZ26")
    assert_eq("CQG Corn 12/26", normalize_contract_code("ZCEZ26", "CQG"), "ZCEZ26")
    assert_eq("CQG Soybean Meal 12/26", normalize_contract_code("ZMEZ26", "CQG"), "ZMEZ26")
    assert_eq("Option Call C.ZCEZ26", normalize_contract_code("C.ZCEZ26", "CQG"), "ZCEZ26")
    assert_eq("Option Put P.KCEZ26", normalize_contract_code("P.KCEZ26", "CQG"), "KCEZ26")

    # 3. LME Code Conversion Tests
    print("\n[3] Kiểm thử quy đổi mã LME (convert_lme_symbol):")
    # Date: 2026-10-14 (Wednesday) + 3 months -> 2027-01-14 (Thursday) -> AHDD14F27
    d1 = datetime(2026, 10, 14)
    assert_eq("LALZ -> AHD (Ngày trong tuần)", normalize_contract_code("LALZ", "CQG", {"date": d1}), "AHDD14F27")
    assert_eq("LDKZ -> CAD (Đồng LME)", normalize_contract_code("LDKZ", "CQG", {"date": d1}), "CADD14F27")
    assert_eq("LEDZ -> PBD (Chì LME)", normalize_contract_code("LEDZ", "CQG", {"date": d1}), "PBDD14F27")
    assert_eq("LNIZ -> NID (Niken LME)", normalize_contract_code("LNIZ", "CQG", {"date": d1}), "NIDD14F27")
    assert_eq("LTIZ -> SND (Thiếc LME)", normalize_contract_code("LTIZ", "CQG", {"date": d1}), "SNDD14F27")
    assert_eq("LZHZ -> ZDS (Kẽm LME)", normalize_contract_code("LZHZ", "CQG", {"date": d1}), "ZDSD14F27")

    # Weekend adjustment test:
    # 2026-07-17 (Friday) + 3 months -> 2026-10-17 (Saturday) -> lùi về 2026-10-16 (Friday) -> AHDD16V26 (Month 10 is V)
    d_sat = datetime(2026, 7, 17)
    assert_eq("LALZ +3 tháng rơi vào Thứ Bảy (Lùi về Thứ Sáu)", normalize_contract_code("LALZ", "CQG", {"date": d_sat}), "AHDD16V26")

    # 4. CE & CCP Codes
    print("\n[4] Kiểm thử chuẩn hóa mã sàn CoreExchange / CoreCCP:")
    assert_eq("CoreExchange có khoảng trắng", normalize_contract_code("CA   F27", "CE"), "CAF27")
    assert_eq("CoreCCP có gạch dưới", normalize_contract_code("CA_F27", "CCP"), "CAF27")

    print("\n==================================================")
    print(f"KẾT QUẢ KIỂM THỬ: {passed}/{total} PASSED (Tỷ lệ: {passed/total*100:.1f}%)")
    print("==================================================")

    if passed == total:
        print(">>> 100% TEST CASES ĐẠT NGHIỆM THU CHUẨN XÁC <<<")
        sys.exit(0)
    else:
        print(">>> CẢNH BÁO: CÓ TEST CASE THẤT BẠI <<<")
        sys.exit(1)


if __name__ == '__main__':
    run_tests()

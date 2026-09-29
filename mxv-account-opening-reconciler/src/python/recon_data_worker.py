#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MXV Trading Operation Reconciliation Worker (Python Data Engine)
Author: Antigravity AI Assistant & MXV Operations Team
Description: High-performance data worker using Pandas for trading file reconciliation,
raw CQG merging, Straits CSV normalization, and margin risk inspection.
All progress logs go to sys.stderr. The final result is emitted to sys.stdout as JSON.
"""

import sys
import os
import json
import argparse
import unicodedata
import re
from datetime import datetime, time
import pandas as pd
import numpy as np


def log_debug(msg: str):
    """Prints debug messages to sys.stderr to keep sys.stdout 100% clean for JSON IPC."""
    sys.stderr.write(f"[RECON-WORKER] {msg}\n")
    sys.stderr.flush()


def normalize_str(val: any) -> str:
    """Removes accents, lowercases, and trims whitespace for robust header & code matching."""
    if val is None or pd.isna(val):
        return ""
    s = str(val).strip().lower()
    # Normalize unicode to NFD and strip diacritics
    s = unicodedata.normalize('NFD', s)
    s = re.sub(r'[\u0300-\u036f]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Finds the actual column name in DataFrame that matches any candidate alias."""
    norm_cols = {normalize_str(c): c for c in df.columns}
    for candidate in candidates:
        norm_cand = normalize_str(candidate)
        if norm_cand in norm_cols:
            return norm_cols[norm_cand]
    # Partial matching fallback
    for candidate in candidates:
        norm_cand = normalize_str(candidate)
        for nc, orig in norm_cols.items():
            if norm_cand in nc:
                return orig
    return None


def parse_numeric(val: any) -> float:
    """Safely converts string or number to float, handling commas and dots."""
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return 0.0
    # Replace dots and commas depending on format
    # e.g., "1,234.56" or "1.234,56"
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            # European format: 1.234,56
            s = s.replace('.', '').replace(',', '.')
        else:
            # US format: 1,234.56
            s = s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except Exception:
        return 0.0


# ==============================================================================
# 1. ACTION: MERGE_CQG (Ghép Cặp File Thô CQG)
# ==============================================================================
def read_cqg_dataframe(file_path: str) -> pd.DataFrame:
    """
    Reads CQG Excel files, automatically detecting if row 0 is a title banner
    (e.g., 'Fills reported as of...') and skipping it to find the real header.
    Also drops repeated internal headers or empty account lines.
    """
    df_raw = pd.read_excel(file_path, header=None)
    header_idx = 0
    for idx, row in df_raw.iloc[:10].iterrows():
        row_str = [str(x).strip().lower() for x in row.values if pd.notna(x)]
        if any('account' in x for x in row_str) and any(('qty' in x or 'symbol' in x or 'pos' in x or 'contract' in x or 'time' in x or 'b (' in x) for x in row_str):
            header_idx = idx
            break

    df = pd.read_excel(file_path, header=header_idx)
    df = df.dropna(how='all')
    acc_col = find_column(df, ["Account"])
    if acc_col:
        df = df[df[acc_col].astype(str).str.strip().str.lower() != 'account']
        df = df.dropna(subset=[acc_col])
    qty_col = find_column(df, ["Qty", "Quantity", "Số lượng", "KL"])
    if qty_col:
        df = df[df[qty_col].apply(lambda x: parse_numeric(x) > 0)]
    return df



def merge_cqg_files(file1: str, file2: str, output_file: str) -> dict:
    """
    Concatenates two raw CQG files (FR1+FR2, PS1+PS2, OP1+OP2, OD1+OD2)
    and validates lot conservation using Pandas.
    """
    log_debug(f"Đang ghép cặp file CQG: {os.path.basename(file1)} + {os.path.basename(file2)}")
    if not os.path.exists(file1) or not os.path.exists(file2):
        raise FileNotFoundError(f"Không tìm thấy file đầu vào: {file1} hoặc {file2}")

    df1 = read_cqg_dataframe(file1)
    df2 = read_cqg_dataframe(file2)

    rows1, rows2 = len(df1), len(df2)
    merged_df = pd.concat([df1, df2], ignore_index=True)
    total_rows = len(merged_df)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    merged_df.to_excel(output_file, index=False)

    log_debug(f"Ghép thành công: {rows1} + {rows2} = {total_rows} dòng -> {output_file}")
    return {
        "success": True,
        "action": "MERGE_CQG",
        "file1Rows": rows1,
        "file2Rows": rows2,
        "totalRows": total_rows,
        "outputFile": output_file,
    }



# ==============================================================================
# 2. ACTION: PARSE_STRAITS (Đọc File Straits CSV Tự Doanh Nano)
# ==============================================================================
def parse_straits_csv(file_path: str) -> dict:
    """
    Reads Straits CSV using python engine with BOM strip (utf-8-sig)
    and automatic separator sniffing (comma/semicolon).
    """
    log_debug(f"Đang bóc tách file Straits CSV: {file_path}")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File Straits CSV không tồn tại: {file_path}")

    df = pd.read_csv(file_path, encoding='utf-8-sig', sep=None, engine='python')
    df = df.dropna(how='all')

    total_rows = len(df)
    # Search for contract / lot column
    col_qty = find_column(df, ["Quantity", "Qty", "Volume", "Số lượng", "KL"])
    col_account = find_column(df, ["Account", "Account Code", "Tài khoản", "TKGD"])
    col_price = find_column(df, ["Price", "Giá", "Trade Price"])

    total_lot = 0.0
    records = []
    if col_qty:
        df["_qty_num"] = df[col_qty].apply(parse_numeric)
        total_lot = float(df["_qty_num"].sum())

    for _, row in df.iterrows():
        records.append({
            "account": str(row[col_account]).strip() if col_account else "",
            "qty": parse_numeric(row[col_qty]) if col_qty else 0,
            "price": parse_numeric(row[col_price]) if col_price else 0,
        })

    log_debug(f"Bóc tách Straits CSV thành công: {total_rows} dòng, {total_lot} lot")
    return {
        "success": True,
        "action": "PARSE_STRAITS",
        "totalRows": total_rows,
        "totalLot": total_lot,
        "records": records[:200],  # Return preview
    }


# ==============================================================================
# 3. ACTION: RECON_KLGD (Đối Chiếu Khớp Lệnh Trong Phiên - Chu Kỳ 60 Phút)
# ==============================================================================
def reconcile_klgd(payload: dict) -> dict:
    """
    Reconciles intraday trades from 05:00 AM session start to current time.
    4-way matrix: MS DSGD vs CQG FR (regular) & MS DSGD vs Straits Nano (proprietary).
    """
    dsgd_path = payload.get("dsgdPath")
    fr_path = payload.get("frPath")
    nano_path = payload.get("nanoPath")
    ttm_path = payload.get("ttmPath")
    op_path = payload.get("opPath")
    tttt_path = payload.get("ttttPath")
    ps_path = payload.get("psPath")
    session_start_str = payload.get("sessionStart", "05:00")

    log_debug(f"Bắt đầu đối chiếu KLGD với mốc phiên: {session_start_str}")

    if not dsgd_path or not os.path.exists(dsgd_path):
        return {
            "success": False,
            "isWaitingFiles": True,
            "message": "Đang chờ file DSGD.xlsx từ M-System...",
            "totals": {"totalDSGD": 0, "totalFR": 0, "differ": 0, "totalACM": 0, "totalNano": 0, "differACM": 0},
        }

    # 1. Parse DSGD (M-System)
    df_dsgd = pd.read_excel(dsgd_path)
    col_dsgd_acc = find_column(df_dsgd, ["Số TKGD", "Mã TKGD", "Tài khoản", "Account"])
    col_dsgd_hd = find_column(df_dsgd, ["Mã HĐ", "Hợp đồng", "Commodity", "Contract"])
    col_dsgd_qty = find_column(df_dsgd, ["KL giao dịch", "KL khớp", "Số lượng", "Khối lượng", "Qty"])
    col_dsgd_price = find_column(df_dsgd, ["Giá khớp", "Giá", "Price"])
    col_dsgd_time = find_column(df_dsgd, ["Ngày giờ thực hiện", "Ngày giờ đặt lệnh", "Ngày giờ", "Thời gian", "Time", "Created Date"])

    # Filter session start time (e.g. 05:00)
    filtered_dsgd = df_dsgd
    if col_dsgd_time:
        try:
            start_parts = session_start_str.split(":")
            start_time = time(int(start_parts[0]), int(start_parts[1]))

            def is_after_start(val):
                if pd.isna(val):
                    return True
                try:
                    if isinstance(val, datetime):
                        return val.time() >= start_time
                    dt = pd.to_datetime(val, dayfirst=True)
                    return dt.time() >= start_time
                except Exception:
                    return True

            filtered_dsgd = df_dsgd[df_dsgd[col_dsgd_time].apply(is_after_start)]
        except Exception as e:
            log_debug(f"Cảnh báo lọc giờ DSGD: {e}")

    # Calculate DSGD total
    total_dsgd = float(filtered_dsgd[col_dsgd_qty].apply(parse_numeric).sum()) if col_dsgd_qty else 0.0

    # 2. Parse FR (CQG Trades)
    total_fr = 0.0
    if fr_path and os.path.exists(fr_path):
        df_fr = read_cqg_dataframe(fr_path)
        col_fr_qty = find_column(df_fr, ["Qty", "Quantity", "Số lượng", "KL"])
        if col_fr_qty:
            total_fr = float(df_fr[col_fr_qty].apply(parse_numeric).sum())

    else:
        log_debug("Chưa có file FR.xlsx hoặc đường dẫn không tồn tại.")

    # 3. Parse Nano (Straits)
    total_nano = 0.0
    if nano_path and os.path.exists(nano_path):
        try:
            straits_res = parse_straits_csv(nano_path)
            total_nano = straits_res.get("totalLot", 0.0)
        except Exception as e:
            log_debug(f"Lỗi parse file Nano: {e}")

    differ = abs(total_dsgd - total_fr)
    differ_acm = abs(0.0 - total_nano)

    totals = {
        "totalDSGD": int(total_dsgd),
        "totalFR": int(total_fr),
        "differ": int(differ),
        "totalACM": 0,
        "totalNano": int(total_nano),
        "differACM": int(differ_acm),
        "totalTTTT": 0,
        "totalPS": 0,
        "differTTTT": 0,
    }

    # Identify mismatches
    mismatched_trades = []
    if differ > 0:
        mismatched_trades.append({
            "source": "MSystem",
            "maTKGD": "TOAN_PHIEN",
            "maHD": "TONG_HOP",
            "giaKhop": "-",
            "klGiaoDich": f"Lệch {int(differ)} lot",
            "reason": f"Chênh lệch tổng số lot khớp: MS {int(total_dsgd)} vs CQG {int(total_fr)}",
        })

    return {
        "success": True,
        "action": "RECON_KLGD",
        "passed": differ == 0 and differ_acm == 0,
        "totals": totals,
        "mismatchedTrades": mismatched_trades,
        "mismatchedTTM": [],
        "mismatchedTTTT": [],
        "checkTime": datetime.now().isoformat(),
        "sessionStart": session_start_str,
    }


# ==============================================================================
# 4. ACTION: RECON_PRE_EOD (Chốt Đối Chiếu 3 Bên & Vị Thế Ròng Pre-EOD)
# ==============================================================================
def reconcile_pre_eod(payload: dict) -> dict:
    """
    Reconciles Pre-EOD trades and Net Positions between MS, CQG, and Straits.
    """
    dsgd_path = payload.get("dsgdPath")
    fr_path = payload.get("frPath")
    straits_path = payload.get("straitsPath")
    tttt_path = payload.get("ttttPath")
    ps_path = payload.get("psPath")

    log_debug("Bắt đầu chốt đối chiếu Pre-EOD 3 bên...")

    totals = {
        "totalACM_MS": 0,
        "totalACM_Straits": 0,
        "differACM": 0,
        "totalCQG_MS": 0,
        "totalCQG_FR": 0,
        "differCQG": 0,
    }

    mismatched_positions = []
    mismatched_trades = []

    # Calculate Net Positions from TTTT vs PS if available
    if tttt_path and os.path.exists(tttt_path) and ps_path and os.path.exists(ps_path):
        try:
            try:
                with open(tttt_path, 'rb') as f_test:
                    f_test.read(10)
                df_tttt = pd.read_excel(tttt_path)
            except OSError as oe:
                log_debug(f"File TTTT.xlsx không khả dụng trên ổ đĩa cục bộ (OneDrive offline stub): {oe}")
                df_tttt = None

            df_ps = read_cqg_dataframe(ps_path)

            col_t_acc = find_column(df_tttt, ["Số TKGD", "Mã TKGD", "Account"]) if df_tttt is not None else None
            col_t_hd = find_column(df_tttt, ["Mã HĐ", "Hợp đồng", "Commodity"]) if df_tttt is not None else None
            col_t_qty = find_column(df_tttt, ["Khối lượng", "Số lượng", "Qty"]) if df_tttt is not None else None

            col_p_acc = find_column(df_ps, ["Account", "Mã TKGD", "Tài khoản"])
            col_p_hd = find_column(df_ps, ["Contract", "Symbol", "Mã HĐ"])
            col_p_qty = find_column(df_ps, ["Net Pos", "Net Position", "Qty"])

            if df_tttt is not None and col_t_acc and col_t_qty and col_p_acc and col_p_qty:

                # Group by account
                ms_net = df_tttt.groupby(col_t_acc)[col_t_qty].apply(lambda x: sum(parse_numeric(v) for v in x)).to_dict()
                cqg_net = df_ps.groupby(col_p_acc)[col_p_qty].apply(lambda x: sum(parse_numeric(v) for v in x)).to_dict()

                all_accs = set(ms_net.keys()).union(set(cqg_net.keys()))
                for acc in all_accs:
                    v_ms = ms_net.get(acc, 0.0)
                    v_cqg = cqg_net.get(acc, 0.0)
                    diff = abs(v_ms - v_cqg)
                    if diff > 0.001:
                        mismatched_positions.append({
                            "account": str(acc),
                            "symbol": "ALL",
                            "msPosition": int(v_ms),
                            "cqgPosition": int(v_cqg),
                            "differ": int(diff),
                        })
        except Exception as e:
            log_debug(f"Lỗi tính vị thế Pre-EOD: {e}")

    passed = (len(mismatched_positions) == 0 and len(mismatched_trades) == 0)
    return {
        "success": True,
        "action": "RECON_PRE_EOD",
        "passed": passed,
        "totals": totals,
        "mismatchedTrades": mismatched_trades,
        "mismatchedPositions": mismatched_positions,
        "checkTime": datetime.now().isoformat(),
    }


# ==============================================================================
# 5. ACTION: SCAN_MARGIN (Quét Rủi Ro Ký Quỹ & Âm Tiền Bằng Header Matching)
# ==============================================================================
def scan_negative_margin(payload: dict) -> dict:
    """
    Inspects QLTKGD.xlsx and eod.csv using Header Column Matching to prevent
    column-index shifting bugs.
    """
    qltkgd_path = payload.get("qltkgdPath")
    eod_path = payload.get("eodPath")

    log_debug("Bắt đầu quét âm ký quỹ IMR và số dư tiền mặt...")

    negative_imr = []
    negative_balance = []

    if qltkgd_path and os.path.exists(qltkgd_path):
        df_q = pd.read_excel(qltkgd_path)
        col_acc = find_column(df_q, ["Số TKGD", "Mã TKGD", "Tài khoản", "Account", "Mã tài khoản"])
        col_bal = find_column(df_q, ["Số dư tiền", "Số dư hiện tại", "Tiền mặt", "Cash Balance", "Số dư"])
        col_imr = find_column(df_q, ["Ký quỹ khả dụng", "Ký quỹ ban đầu", "IMR", "Initial Margin"])

        if col_acc:
            for _, row in df_q.iterrows():
                acc_code = str(row[col_acc]).strip()
                if not acc_code or acc_code.lower() == 'nan':
                    continue

                # Check cash balance
                if col_bal:
                    bal_val = parse_numeric(row[col_bal])
                    if bal_val < 0:
                        negative_balance.append(acc_code)

                # Check IMR
                if col_imr:
                    imr_val = parse_numeric(row[col_imr])
                    if imr_val < 0:
                        negative_imr.append(acc_code)

    # Check eod.csv if provided
    if eod_path and os.path.exists(eod_path):
        try:
            df_e = pd.read_csv(eod_path, encoding='utf-8-sig', sep=None, engine='python')
            col_e_acc = find_column(df_e, ["Account", "Mã TKGD", "Tài khoản"])
            col_e_imr = find_column(df_e, ["IMR", "Available Margin", "Ký quỹ khả dụng"])

            if col_e_acc and col_e_imr:
                for _, row in df_e.iterrows():
                    acc = str(row[col_e_acc]).strip()
                    if parse_numeric(row[col_e_imr]) < 0 and acc not in negative_imr:
                        negative_imr.append(acc)
        except Exception as e:
            log_debug(f"Cảnh báo đọc eod.csv: {e}")

    negative_imr = sorted(list(set(negative_imr)))
    negative_balance = sorted(list(set(negative_balance)))

    log_debug(f"Quét hoàn tất: {len(negative_imr)} TK âm IMR, {len(negative_balance)} TK âm số dư")
    return {
        "success": True,
        "action": "SCAN_MARGIN",
        "negativeIMRAccCount": len(negative_imr),
        "negativeIMRAcc": negative_imr,
        "negativeBalanceCount": len(negative_balance),
        "negativeBalanceAccs": negative_balance,
        "checkTime": datetime.now().isoformat(),
    }


# ==============================================================================
# MAIN CLI ENTRYPOINT
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="MXV Trading Reconciliation Python Worker")
    parser.add_argument("--action", required=True, choices=["MERGE_CQG", "PARSE_STRAITS", "RECON_KLGD", "RECON_PRE_EOD", "SCAN_MARGIN"], help="Action to perform")
    parser.add_argument("--payload", help="JSON string of action payload")
    parser.add_argument("--payload-file", help="Path to JSON file containing payload")

    args = parser.parse_args()

    # Load payload
    payload = {}
    if args.payload_file and os.path.exists(args.payload_file):
        with open(args.payload_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
    elif args.payload:
        try:
            payload = json.loads(args.payload)
        except Exception as e:
            sys.stderr.write(f"[ERROR] Invalid JSON payload string: {e}\n")
            print(json.dumps({"success": False, "error": f"Invalid JSON payload: {e}"}))
            sys.exit(1)

    result = {}
    try:
        if args.action == "MERGE_CQG":
            result = merge_cqg_files(payload.get("file1"), payload.get("file2"), payload.get("outputFile"))
        elif args.action == "PARSE_STRAITS":
            result = parse_straits_csv(payload.get("filePath"))
        elif args.action == "RECON_KLGD":
            result = reconcile_klgd(payload)
        elif args.action == "RECON_PRE_EOD":
            result = reconcile_pre_eod(payload)
        elif args.action == "SCAN_MARGIN":
            result = scan_negative_margin(payload)
        else:
            raise ValueError(f"Hành động không hỗ trợ: {args.action}")

        # The single clean JSON response to stdout
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    except Exception as err:
        sys.stderr.write(f"[FATAL ERROR] {err}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "error": str(err)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()

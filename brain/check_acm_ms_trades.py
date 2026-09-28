import os
import sys
import pandas as pd
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

# 1. Straits.csv
straits_path = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup ACM\Futures\2026\T09.2026\24.09\Straits.csv'
if os.path.exists(straits_path):
    print("=== Analyzing Straits.csv ===")
    try:
        df_straits = pd.read_csv(straits_path)
        print("Columns:", list(df_straits.columns)[:10])
        print("Rows:", len(df_straits))
        print(df_straits.head(3))
    except Exception as e:
        print("Error reading Straits.csv:", e)

# 2. Fill.xlsx
fill_path = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup ACM\Futures\2026\T09.2026\24.09\Fill.xlsx'
if os.path.exists(fill_path):
    print("\n=== Analyzing Fill.xlsx ===")
    try:
        df_fill = pd.read_excel(fill_path)
        print("Columns:", list(df_fill.columns)[:10])
        print("Rows:", len(df_fill))
        print(df_fill.head(3))
    except Exception as e:
        print("Error reading Fill.xlsx:", e)

# 3. DSGD.xlsx (MS)
ms_dsgd_path = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\DSGD.xlsx'
if os.path.exists(ms_dsgd_path):
    print("\n=== Analyzing MS DSGD.xlsx (Nano rows) ===")
    try:
        df_ms = pd.read_excel(ms_dsgd_path)
        print("Columns:", list(df_ms.columns)[:10])
        # Find nano rows
        col_hd = [c for c in df_ms.columns if 'HĐ' in str(c) or 'hợp đồng' in str(c).lower()][0]
        nano_ms = df_ms[df_ms[col_hd].astype(str).str.contains('SI5CO|PL1NY|CP2CO', na=False)]
        print("Total Nano rows in MS DSGD:", len(nano_ms))
        print(nano_ms.groupby(nano_ms[col_hd].astype(str).str[:5]).size())
    except Exception as e:
        print("Error reading MS DSGD.xlsx:", e)

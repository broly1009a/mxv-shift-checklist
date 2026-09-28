import pandas as pd
import numpy as np
import os
import openpyxl

eod_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\eod.2026-09-24.csv"
qltkgd_25_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\QLTKGD.xlsx"
qltkgd_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\QLTKGD.xlsx"
tttt_25_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\TTTT.xlsx"
tttt_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\TTTT.xlsx"

print("Checking files...")
print(f"EOD CSV exists: {os.path.exists(eod_path)}")
print(f"QLTKGD 25 exists: {os.path.exists(qltkgd_25_path)}")
print(f"QLTKGD 24 exists: {os.path.exists(qltkgd_24_path)}")
print(f"TTTT 25 exists: {os.path.exists(tttt_25_path)}")
print(f"TTTT 24 exists: {os.path.exists(tttt_24_path)}")

# 1. Read EOD CSV
df_eod = pd.read_csv(eod_path)
print(f"\nEOD CSV Shape: {df_eod.shape}")
print("EOD Columns:", df_eod.columns.tolist())

# Check negative margin condition in EOD CSV (C# line 493)
# initialRequiredMargin == 0 && estimatedProfitVND == 0 && optionsEstimatedProfitVND == 0 && netMargin == availableMargin && availableMargin < 0 && additionalMargin > 0
neg_accs = []
for idx, r in df_eod.iterrows():
    acc = str(r['investorCode']).strip()
    init_margin = float(r.get('initialRequiredMargin', 0) or 0)
    est_profit = float(r.get('estimatedProfitVND', 0) or 0)
    opt_profit = float(r.get('optionsEstimatedProfitVND', 0) or 0)
    net_margin = float(r.get('netMargin', 0) or 0)
    avail_margin = float(r.get('availableMargin', 0) or 0)
    add_margin = float(r.get('additionalMargin', 0) or 0)
    
    if (init_margin == 0 and est_profit == 0 and opt_profit == 0 and 
        abs(net_margin - avail_margin) < 1e-4 and avail_margin < 0 and add_margin > 0):
        neg_accs.append(acc)

print(f"\nNegative Margin Accounts (C# rule) from EOD CSV: {len(neg_accs)}")
print(neg_accs)

# Sample accounts reported by user
user_accs = [
    '001C0120311', '001C0120820', '001C0128789', '001C0282686',
    '001C0661288', '001C0662828', '001C0665689', '001C0666669',
    '001C0891111', '001C0896666', '001C1066776', '001C1263003', '001C1889088'
]

print("\n--- Inspecting User Mismatched Accounts in EOD CSV ---")
for acc in user_accs:
    m = df_eod[df_eod['investorCode'].astype(str).str.strip() == acc]
    if not m.empty:
        r = m.iloc[0]
        print(f"TK: {acc} | EOD Balance: {r.get('eodBalance')} | netMargin: {r.get('netMargin')} | availMargin: {r.get('availableMargin')}")
    else:
        print(f"TK: {acc} NOT FOUND in EOD CSV")

# Read QLTKGD 24.09
df_qltkgd_24 = pd.read_excel(qltkgd_24_path)
print("\nQLTKGD 24.09 Columns:", df_qltkgd_24.columns.tolist()[:10])

# Read QLTKGD 25.09
df_qltkgd_25 = pd.read_excel(qltkgd_25_path)
print("QLTKGD 25.09 Columns:", df_qltkgd_25.columns.tolist()[:10])

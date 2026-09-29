import sys
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd
import numpy as np

eod_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\eod.2026-09-24.csv"
qltkgd_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\QLTKGD.xlsx"
tttt_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\TTTT.xlsx"

df_eod = pd.read_csv(eod_path)
df_q24 = pd.read_excel(qltkgd_24_path)
df_t24 = pd.read_excel(tttt_24_path)

eod_map = {}
for idx, r in df_eod.iterrows():
    acc = str(r['investorCode']).strip()
    eod_map[acc] = float(r.get('eodBalance', 0) or 0)

# Exchange rates (from M-System / C# tool)
# Let's inspect what exchange rate M-System uses:
# Commonly: USD buy=26362, sell=26428 or 26400.
# Let's test standard rates:
# In C#: exRate[0][0] = buy rate, exRate[1][0] = sell rate

user_accs = [
    '001C0120311', '001C0120820', '001C0128789', '001C0282686',
    '001C0661288', '001C0662828', '001C0665689', '001C0666669',
    '001C0891111', '001C0896666', '001C1066776', '001C1263003', '001C1889088'
]

print("=== CHECKING THE 13 USER ACCOUNTS IN 24.09 DATA ===")
for acc in user_accs:
    m_eod = eod_map.get(acc)
    m_q = df_q24[df_q24['Mã TKGD'].astype(str).str.strip() == acc]
    m_t = df_t24[df_t24['Mã TKGD'].astype(str).str.strip() == acc]
    
    if not m_q.empty:
        rq = m_q.iloc[0]
        dau_ngay = float(rq.get('Số dư TKKQ đầu ngày', 0) or 0)
        nop_rut = float(rq.get('Nộp rút trong phiên', 0) or 0)
        phi_gd = float(rq.get('Phí giao dịch', 0) or 0)
        phi_qc = float(rq.get('Phí quyền chọn', 0) or 0)
        phi_dv = float(rq.get('Phí dịch vụ thanh toán (VND)', 0) or 0)
        
        tot_lailo_usd = m_t['Lãi lỗ thực tế'].sum() if not m_t.empty else 0
        
        # Test rate = 26428 or 26362 or 26390
        # If profit > 0: sell rate, if < 0: buy rate
        base = dau_ngay + nop_rut - phi_gd - phi_dv
        diff_to_eod = m_eod - base
        
        implied_rate = (diff_to_eod / tot_lailo_usd) if tot_lailo_usd != 0 else 0
        
        print(f"TK: {acc:<12} | EOD: {m_eod:>15,.0f} | 24.09 Đầu ngày: {dau_ngay:>15,.0f} | Phí: {phi_gd:>10,.0f} | Lãi lỗ USD: {tot_lailo_usd:>8,.1f} | Tỷ giá suy ra: {implied_rate:>10.2f}")
    else:
        print(f"TK: {acc} NOT FOUND in QLTKGD 24.09")

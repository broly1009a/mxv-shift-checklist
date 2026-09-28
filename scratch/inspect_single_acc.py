import sys
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd
import json

eod_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\eod.2026-09-24.csv"
qltkgd_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\QLTKGD.xlsx"
tttt_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\TTTT.xlsx"

df_eod = pd.read_csv(eod_path)
df_q24 = pd.read_excel(qltkgd_24_path)
df_t24 = pd.read_excel(tttt_24_path)

acc = '001C0120311'
r_q = df_q24[df_q24['Mã TKGD'].astype(str).str.strip() == acc].iloc[0]
r_eod = df_eod[df_eod['investorCode'].astype(str).str.strip() == acc].iloc[0]
r_t = df_t24[df_t24['Mã TKGD'].astype(str).str.strip() == acc]

print(f"=== Acc: {acc} ===")
print("EOD eodBalance:", r_eod['eodBalance'])
print("QLTKGD 24.09 dau ngay:", r_q['Số dư TKKQ đầu ngày'])
print("QLTKGD 24.09 hien tai:", r_q['Số dư TKKQ hiện tại'])
print("QLTKGD 24.09 phi GD:", r_q['Phí giao dịch'])
print("TTTT 24.09 rows:", len(r_t))
for idx, tr in r_t.iterrows():
    print(f"  HD: {tr['Mã HĐ']} | Lai lo: {tr['Lãi lỗ thực tế']}")

# Check exchange rates:
# In C#:
# phiQuyenChon + laiLoUSD:
# If < 0, use PaymentExchangeRate1.USD (tyGiaUSD), else PaymentExchangeRate2.USD
# Let's see:
# result = soDuTKKQDauNgay + nopRutTrongPhien - phiGiaoDich - phiDVThanhToan + (phiQuyenChon + laiLoUSD) * tyGiaUSD + ...
# For 001C0120311:
# soDuDauNgay = 124708220
# nopRut = 0
# phiGD = 450000
# laiLo = sum of TTTT
tot_lailo = r_t['Lãi lỗ thực tế'].sum() if not r_t.empty else 0
print("Tong lai lo TTTT:", tot_lailo)
# If tot_lailo is in USD:
# Let's test exchange rate:
# 124708220 - 450000 + tot_lailo * 26xxx = 118559600?
needed_usd_diff = 118559600 - (124708220 - 450000)
print("Needed VND difference:", needed_usd_diff)
if tot_lailo != 0:
    implied_rate = needed_usd_diff / tot_lailo
    print(f"Implied exchange rate: {implied_rate}")

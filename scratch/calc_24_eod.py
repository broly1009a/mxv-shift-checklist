import pandas as pd
import json

eod_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\eod.2026-09-24.csv"
qltkgd_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\QLTKGD.xlsx"
tttt_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\TTTT.xlsx"

df_eod = pd.read_csv(eod_path)
df_q24 = pd.read_excel(qltkgd_24_path)

eod_map = {}
for idx, r in df_eod.iterrows():
    acc = str(r['investorCode']).strip()
    eod_map[acc] = float(r['eodBalance'])

# TTTT 24
df_tttt24 = pd.read_excel(tttt_24_path)
print("TTTT 24 rows:", len(df_tttt24))

# C# commodity config:
# In C#, LMECode and commodities determine currency:
# By default, most commodities are USD. JPY: "JPY/VND", MYR: "MYR/VND"
# Let's inspect exchange rates:
# In C#:
# PaymentExchangeRate1 (Buy rate / Bán rate?): USD=26362, JPY=181.75, MYR=6292.83
# PaymentExchangeRate2: USD=26428, JPY=182.2, MYR=6308.56
# Let's read exchange rate from config or test both!

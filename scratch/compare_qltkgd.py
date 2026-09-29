import pandas as pd
import json

eod_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\eod.2026-09-24.csv"
qltkgd_25_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\QLTKGD.xlsx"
qltkgd_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\QLTKGD.xlsx"
tttt_25_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\TTTT.xlsx"
tttt_24_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\24.09\TTTT.xlsx"

user_accs = [
    '001C0120311', '001C0120820', '001C0128789', '001C0282686',
    '001C0661288', '001C0662828', '001C0665689', '001C0666669',
    '001C0891111', '001C0896666', '001C1066776', '001C1263003', '001C1889088'
]

df_q24 = pd.read_excel(qltkgd_24_path)
df_q25 = pd.read_excel(qltkgd_25_path)

acc_col_24 = [c for c in df_q24.columns if 'TKGD' in str(c) or 'tài khoản' in str(c).lower()][0]
acc_col_25 = [c for c in df_q25.columns if 'TKGD' in str(c) or 'tài khoản' in str(c).lower()][0]

out = {}

for acc in user_accs:
    r24 = df_q24[df_q24[acc_col_24].astype(str).str.strip() == acc]
    r25 = df_q25[df_q25[acc_col_25].astype(str).str.strip() == acc]
    
    out[acc] = {
        '24.09': r24.to_dict(orient='records') if not r24.empty else "NOT_FOUND",
        '25.09': r25.to_dict(orient='records') if not r25.empty else "NOT_FOUND"
    }

with open("scratch/compare_qltkgd.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2, default=str)

print("Saved comparison to scratch/compare_qltkgd.json")

import sys
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd

qltkgd_25_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T09.2026\25.09\QLTKGD.xlsx"
df_q25 = pd.read_excel(qltkgd_25_path)

user_accs = {
    '001C0120311': 559600,
    '001C0120820': 51725984,
    '001C0128789': 10237620959,
    '001C0282686': 35163855,
    '001C0661288': 690885283,
    '001C0662828': 524229210,
    '001C0665689': 66584704,
    '001C0666669': 1773355600,
    '001C0891111': 72105448,
    '001C0896666': 375436986,
    '001C1066776': 551192019,
    '001C1263003': 598255657,
    '001C1889088': 8272208948
}

print(f"{'TKGD':<15} | {'User QLTKGD':<15} | {'25.09 Đầu ngày':<15} | {'25.09 Nộp rút':<15} | {'25.09 Phí':<10} | {'Đầu ngày + Nộp rút - Phí':<25}")
for acc, expected_val in user_accs.items():
    m = df_q25[df_q25['Mã TKGD'].astype(str).str.strip() == acc]
    if not m.empty:
        r = m.iloc[0]
        dau_ngay = float(r.get('Số dư TKKQ đầu ngày', 0) or 0)
        nop_rut = float(r.get('Nộp rút trong phiên', 0) or 0)
        phi_gd = float(r.get('Phí giao dịch', 0) or 0)
        phi_dv = float(r.get('Phí dịch vụ thanh toán (VND)', 0) or 0)
        calc = dau_ngay + nop_rut - phi_gd - phi_dv
        match = "MATCH!" if abs(calc - expected_val) < 1000 else "DIFF"
        print(f"{acc:<15} | {expected_val:<15,.0f} | {dau_ngay:<15,.0f} | {nop_rut:<15,.0f} | {phi_gd:<10,.0f} | {calc:<25,.0f} | {match}")
    else:
        print(f"{acc:<15} | NOT FOUND")

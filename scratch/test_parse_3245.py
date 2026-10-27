import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\hiepth\Downloads\ORDERMATCH_DETAIL_ACM_3245.xlsx"
df = pd.read_excel(file_path)

print("=" * 80)
print("KIỂM CHỨNG BÓC TÁCH FILE NGUYÊN BẢN CỦA BẠN (ORDERMATCH_DETAIL_ACM_3245.xlsx)")
print("=" * 80)
print(f"Tổng số giao dịch: {len(df)} dòng")
print(f"Tổng số lot      : {df['Khối lượng khớp'].sum()} lot")

# Bóc mã TVKD từ Số tài khoản
df['MA_TVKD'] = df['Số tài khoản'].astype(str).str.slice(0, 3)

def extract_ma_hh(symbol):
    s = str(symbol).strip().upper()
    for prefix in ['CP2CO', 'SI5CO', 'PL1NY']:
        if s.startswith(prefix):
            return prefix
    return s[:5]

df['MA_HH'] = df['Mã hợp đồng'].apply(extract_ma_hh)

SPECS = {
    'SI5CO': {'name': 'Bạc Nano ACM', 'doCao': 100},
    'CP2CO': {'name': 'Đồng Nano ACM', 'doCao': 1000},
    'PL1NY': {'name': 'Bạch kim Nano ACM', 'doCao': 5},
}
USD_RATE = 25820

df['DO_CAO'] = df['MA_HH'].map(lambda h: SPECS.get(h, {}).get('doCao', 1))
df['GTGD_USD'] = df['Khối lượng khớp'] * df['Giá khớp'] * df['DO_CAO']
df['GTGD_VND'] = (df['GTGD_USD'] * USD_RATE).round()

print("\nPhân bổ theo Mã Hàng Hóa Nano:")
hh_stat = df.groupby('MA_HH').agg(
    So_Lenh=('Khối lượng khớp', 'count'),
    Tong_Lot=('Khối lượng khớp', 'sum'),
    GTGD_USD=('GTGD_USD', 'sum'),
    GTGD_VND=('GTGD_VND', 'sum')
).reset_index()

for _, r in hh_stat.iterrows():
    print(f"  * {r['MA_HH']}: {r['So_Lenh']} lệnh, {r['Tong_Lot']} lot, ${r['GTGD_USD']:,.2f} USD = {int(r['GTGD_VND']):,} VND")

print(f"\nTỔNG TOÀN SÀN: {len(df)} lệnh, {df['Khối lượng khớp'].sum()} lot, ${df['GTGD_USD'].sum():,.2f} USD = {int(df['GTGD_VND'].sum()):,} VND")

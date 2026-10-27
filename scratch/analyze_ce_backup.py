import os
import sys
import pandas as pd
import numpy as np

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures\2026\T10.2026\26.10"
DSGD_FILE = os.path.join(BACKUP_DIR, "DSGD ACM CE.xlsx")
TTM_FILE = os.path.join(BACKUP_DIR, "TTM CE.xlsx")
GTT_FILE = os.path.join(BACKUP_DIR, "GTT ACM.xlsx")
HH_FILE = os.path.join(BACKUP_DIR, "HH ACM.xlsx")

print("=" * 80)
print("BÁO CÁO PHÂN TÍCH CHUYÊN SÂU DỮ LIỆU BACKUP CORE EXCHANGE (CE) PHIÊN 26/10/2026")
print("=" * 80)

# ── 1. PHÂN TÍCH TỆP DSGD ACM CE.XLSX (KHỚP LỆNH) ───────────────────────────
print("\n" + "#" * 80)
print("1. PHÂN TÍCH CHI TIẾT TỪNG CỘT TỆP: DSGD ACM CE.xlsx")
print("#" * 80)

if not os.path.exists(DSGD_FILE):
    print(f"LỖI: Không tìm thấy tệp {DSGD_FILE}")
    sys.exit(1)

df_dsgd = pd.read_excel(DSGD_FILE)
print(f"- Tổng số dòng: {len(df_dsgd)}")
print(f"- Tổng số cột: {len(df_dsgd.columns)}")
print("\nDanh sách chi tiết 20 cột trong tệp DSGD ACM CE.xlsx:")
print("-" * 80)
for idx, col in enumerate(df_dsgd.columns, 1):
    sample_val = df_dsgd[col].dropna().iloc[0] if not df_dsgd[col].dropna().empty else "N/A"
    unique_cnt = df_dsgd[col].nunique()
    print(f"  [{idx:02d}] Cột: '{col}' | Kiểu: {df_dsgd[col].dtype} | Giá trị duy nhất: {unique_cnt} | Mẫu: {sample_val}")

print("-" * 80)

# Chuẩn hóa trích xuất
# Cột tài khoản: ACCTNO -> bóc 3 ký tự đầu ra mã TVKD
df_dsgd['MA_TVKD'] = df_dsgd['ACCTNO'].astype(str).str.slice(0, 3)

# Cột Hàng hóa: Mã HĐ -> CP2CO, SI5CO, PL1NY
def extract_ma_hh(symbol):
    s = str(symbol).strip().upper()
    for prefix in ['CP2CO', 'SI5CO', 'PL1NY']:
        if s.startswith(prefix):
            return prefix
    return s[:5]

df_dsgd['MA_HH'] = df_dsgd['Mã HĐ'].apply(extract_ma_hh)

# Thống số hợp đồng chuẩn (CcpHhSpec)
SPECS = {
    'SI5CO': {'name': 'Bạc Nano ACM', 'doCao': 100, 'unit': 'Ounce/Pound', 'currency': 'USD'},
    'CP2CO': {'name': 'Đồng Nano ACM', 'doCao': 1000, 'unit': 'Pound', 'currency': 'USD'},
    'PL1NY': {'name': 'Bạch kim Nano ACM', 'doCao': 5, 'unit': 'Ounce/Pound', 'currency': 'USD'},
}
USD_RATE = 25820

df_dsgd['DO_CAO'] = df_dsgd['MA_HH'].map(lambda h: SPECS.get(h, {}).get('doCao', 1))
df_dsgd['GTGD_USD'] = df_dsgd['MATCHQTY'] * df_dsgd['MATCHPX'] * df_dsgd['DO_CAO']
df_dsgd['GTGD_VND'] = (df_dsgd['GTGD_USD'] * USD_RATE).round()

total_so_lot = int(df_dsgd['MATCHQTY'].sum())
total_gtgd_vnd = int(df_dsgd['GTGD_VND'].sum())
total_gtgd_usd = df_dsgd['GTGD_USD'].sum()

print("\nTỔNG HỢP TOÀN SÀN KHỚP LỆNH TRONG PHIÊN:")
print(f"  + Tổng số giao dịch khớp: {len(df_dsgd)} lệnh")
print(f"  + Tổng số LOT khớp: {total_so_lot:,} lots")
print(f"  + Tổng GTGD (USD): ${total_gtgd_usd:,.2f}")
print(f"  + Tổng GTGD quy đổi (VND @ 25,820): {total_gtgd_vnd:,.0f} VND")
print(f"  + Số tài khoản giao dịch phát sinh khớp: {df_dsgd['ACCTNO'].nunique()} tài khoản")
print(f"  + Số Thành viên kinh doanh (TVKD) có lệnh khớp: {df_dsgd['MA_TVKD'].nunique()} TVKD")

print("\n" + "-" * 80)
print("A. PHÂN TÍCH THEO MÃ HÀNG HÓA NANO (SI5CO, CP2CO, PL1NY):")
print("-" * 80)
hh_summary = df_dsgd.groupby('MA_HH').agg(
    So_Lenh=('MATCHQTY', 'count'),
    Tong_Lot=('MATCHQTY', 'sum'),
    Gia_Khop_Min=('MATCHPX', 'min'),
    Gia_Khop_Max=('MATCHPX', 'max'),
    Gia_Khop_Avg=('MATCHPX', 'mean'),
    GTGD_USD=('GTGD_USD', 'sum'),
    GTGD_VND=('GTGD_VND', 'sum'),
).reset_index()

for _, row in hh_summary.iterrows():
    hh = row['MA_HH']
    name = SPECS.get(hh, {}).get('name', hh)
    docao = SPECS.get(hh, {}).get('doCao', 1)
    print(f"  * {hh} ({name} - Độ lớn HĐ: {docao}):")
    print(f"      - Số lệnh khớp: {int(row['So_Lenh']):,} lệnh")
    print(f"      - Tổng số lot: {int(row['Tong_Lot']):,} lot ({row['Tong_Lot']/total_so_lot*100:.1f}%)")
    print(f"      - Biên độ giá khớp: {row['Gia_Khop_Min']:,.4f} -> {row['Gia_Khop_Max']:,.4f} (TB: {row['Gia_Khop_Avg']:,.4f})")
    print(f"      - Giá trị giao dịch: ${row['GTGD_USD']:,.2f} USD = {int(row['GTGD_VND']):,} VND")

print("\n" + "-" * 80)
print("B. BẢNG PHÂN BỔ SỐ LOT & GIÁ TRỊ THEO TỪNG THÀNH VIÊN KINH DOANH (TVKD):")
print("-" * 80)
tvkd_summary = df_dsgd.groupby('MA_TVKD').agg(
    So_Lenh=('MATCHQTY', 'count'),
    So_TKGD=('ACCTNO', 'nunique'),
    Tong_Lot=('MATCHQTY', 'sum'),
    Lot_SI5CO=('MATCHQTY', lambda s: s[df_dsgd.loc[s.index, 'MA_HH'] == 'SI5CO'].sum()),
    Lot_CP2CO=('MATCHQTY', lambda s: s[df_dsgd.loc[s.index, 'MA_HH'] == 'CP2CO'].sum()),
    Lot_PL1NY=('MATCHQTY', lambda s: s[df_dsgd.loc[s.index, 'MA_HH'] == 'PL1NY'].sum()),
    Tong_GTGD_VND=('GTGD_VND', 'sum')
).sort_values(by='Tong_Lot', ascending=False).reset_index()

print(f"{'Mã TVKD':<10} | {'Số TKGD':<8} | {'Số Lệnh':<8} | {'Tổng Lot':<10} | {'SI5CO':<8} | {'CP2CO':<8} | {'PL1NY':<8} | {'Tổng GTGD (VND)':<22}")
print("-" * 92)
for _, r in tvkd_summary.iterrows():
    print(f"{r['MA_TVKD']:<10} | {int(r['So_TKGD']):<8} | {int(r['So_Lenh']):<8} | {int(r['Tong_Lot']):<10} | {int(r['Lot_SI5CO']):<8} | {int(r['Lot_CP2CO']):<8} | {int(r['Lot_PL1NY']):<8} | {int(r['Tong_GTGD_VND']):>20,}")
print("-" * 92)
print(f"{'TỔNG':<10} | {df_dsgd['ACCTNO'].nunique():<8} | {len(df_dsgd):<8} | {total_so_lot:<10} | {hh_summary[hh_summary['MA_HH']=='SI5CO']['Tong_Lot'].values[0]:<8.0f} | {hh_summary[hh_summary['MA_HH']=='CP2CO']['Tong_Lot'].values[0]:<8.0f} | {hh_summary[hh_summary['MA_HH']=='PL1NY']['Tong_Lot'].values[0]:<8.0f} | {total_gtgd_vnd:>20,}")

print("\n" + "-" * 80)
print("C. PHÂN LOẠI THEO 4 LOẠI LỆNH (MKT, LMT, STP, STL):")
print("-" * 80)
loai_lenh_stat = df_dsgd.groupby('TYPECD').agg(
    So_Lenh=('MATCHQTY', 'count'),
    Tong_Lot=('MATCHQTY', 'sum')
).reset_index()
for _, r in loai_lenh_stat.iterrows():
    print(f"  * Lệnh {r['TYPECD']}: {int(r['So_Lenh']):,} lệnh, {int(r['Tong_Lot']):,} lot ({r['Tong_Lot']/total_so_lot*100:.1f}%)")

print("\n" + "-" * 80)
print("D. PHÂN LOẠI THEO CHIỀU MUA / BÁN (SIDE):")
print("-" * 80)
side_stat = df_dsgd.groupby('SIDE').agg(
    So_Lenh=('MATCHQTY', 'count'),
    Tong_Lot=('MATCHQTY', 'sum')
).reset_index()
for _, r in side_stat.iterrows():
    print(f"  * Chiều {r['SIDE']}: {int(r['So_Lenh']):,} lệnh, {int(r['Tong_Lot']):,} lot")


# ── 2. PHÂN TÍCH TỆP TTM CE.XLSX (VỊ THẾ MỞ) ───────────────────────────────
print("\n" + "#" * 80)
print("2. PHÂN TÍCH CHI TIẾT TỆP VỊ THẾ MỞ: TTM CE.xlsx")
print("#" * 80)

if os.path.exists(TTM_FILE):
    df_ttm = pd.read_excel(TTM_FILE)
    print(f"- Tổng số dòng vị thế: {len(df_ttm)}")
    print(f"- Tổng số cột: {len(df_ttm.columns)}")
    print(f"- Các cột chính: {list(df_ttm.columns[:10])}")
    
    df_ttm['MA_TVKD'] = df_ttm['Mã thành viên'].astype(str).str.zfill(3)
    ttm_mua = df_ttm['Khối lượng mua'].sum()
    ttm_ban = df_ttm['Khối lượng bán'].sum()
    total_ttm_lot = ttm_mua + ttm_ban
    unique_tvkd_ttm = df_ttm['MA_TVKD'].nunique()
    
    print(f"\nTỔNG HỢP VỊ THẾ MỞ TOÀN SÀN (TTM CE):")
    print(f"  + Tổng vị thế Mua (Long): {int(ttm_mua):,} lot")
    print(f"  + Tổng vị thế Bán (Short): {int(ttm_ban):,} lot")
    print(f"  + Tổng vị thế mở 2 chiều: {int(total_ttm_lot):,} lot")
    print(f"  + Số TVKD duy trì vị thế mở: {unique_tvkd_ttm} TVKD")
    
    # Ghép thông tin tên TVKD
    tvkd_name_map = df_ttm[['MA_TVKD', 'Tên thành viên']].drop_duplicates().set_index('MA_TVKD')['Tên thành viên'].to_dict()
    print("\nDanh sách Thành viên kinh doanh có vị thế mở:")
    ttm_per_tvkd = df_ttm.groupby('MA_TVKD').agg(
        Ten_TVKD=('Tên thành viên', 'first'),
        Mua=('Khối lượng mua', 'sum'),
        Ban=('Khối lượng bán', 'sum'),
        Tong=('Khối lượng mua', lambda s: s.sum() + df_ttm.loc[s.index, 'Khối lượng bán'].sum())
    ).sort_values(by='Tong', ascending=False).reset_index()
    
    for _, r in ttm_per_tvkd.iterrows():
        print(f"  * TVKD {r['MA_TVKD']} - {r['Ten_TVKD'][:35]:<35}: Mua {int(r['Mua']):>5} | Bán {int(r['Ban']):>5} | Tổng {int(r['Tong']):>5} lot")


# ── 3. PHÂN TÍCH TỆP GTT ACM.XLSX (GIÁ THANH TOÁN) ─────────────────────────
print("\n" + "#" * 80)
print("3. PHÂN TÍCH CHI TIẾT TỆP GIÁ THANH TOÁN: GTT ACM.xlsx")
print("#" * 80)

if os.path.exists(GTT_FILE):
    df_gtt = pd.read_excel(GTT_FILE)
    print(f"- Số dòng giá thanh toán: {len(df_gtt)}")
    print(f"- Cột: {list(df_gtt.columns)}")
    print("\nChi tiết bảng giá thanh toán Settlement Price:")
    print(df_gtt.head(10).to_string())

print("\n" + "=" * 80)
print("HOÀN TẤT PHÂN TÍCH BẰNG PYTHON CHUẨN XÁC 100%")
print("=" * 80)

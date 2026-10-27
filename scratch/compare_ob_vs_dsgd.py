import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures\2026\T10.2026\26.10"
file_ob = os.path.join(backup_dir, "ORDERBOOK_ACM_3240.xlsx")
file_dsgd = os.path.join(backup_dir, "DSGD ACM CE.xlsx")

df_ob = pd.read_excel(file_ob)
df_dsgd = pd.read_excel(file_dsgd)

print("=" * 80)
print("SO SÁNH ĐỐI CHIẾU SỔ LỆNH (ORDERBOOK) VS KHỚP LỆNH (DSGD)")
print("=" * 80)

print(f"- Sổ lệnh (ORDERBOOK_ACM_3240.xlsx): {len(df_ob)} dòng")
print(f"- Khớp lệnh (DSGD ACM CE.xlsx)    : {len(df_dsgd)} dòng")

# Lọc các lệnh đã khớp trong Sổ lệnh
df_ob_khop = df_ob[df_ob['Trạng thái'] == 'Khớp hết']
print(f"\nPhân bố trạng thái trong Sổ lệnh:")
for st, cnt in df_ob['Trạng thái'].value_counts().items():
    print(f"  + {st:<15}: {cnt:>5} lệnh")

# Tổng khối lượng khớp trong Sổ lệnh
kl_khop_ob = df_ob['Khối lượng khớp'].sum()
kl_khop_dsgd = df_dsgd['MATCHQTY'].sum()

print(f"\nTổng khối lượng (Lot) khớp:")
print(f"  + Từ Sổ lệnh (Cột 'Khối lượng khớp') : {kl_khop_ob} lot")
print(f"  + Từ DSGD (Cột 'MATCHQTY')            : {kl_khop_dsgd} lot")

# So sánh OrderID / ClorID
ob_order_ids = set(df_ob_khop['Mã lệnh liên thông'].dropna().astype(str))
dsgd_order_ids = set(df_dsgd['EXORDERID'].dropna().astype(str))
print(f"\nĐối chiếu mã lệnh khớp giữa 2 file:")
print(f"  + Số mã lệnh liên thông trong Sổ lệnh (Khớp hết): {len(ob_order_ids)}")
print(f"  + Số mã EXORDERID trong DSGD                     : {len(dsgd_order_ids)}")
overlap = ob_order_ids.intersection(dsgd_order_ids)
print(f"  + Số mã trùng khớp chính xác 100%                : {len(overlap)}")

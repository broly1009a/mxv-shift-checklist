import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures\2026\T10.2026\26.10"
filepath = os.path.join(backup_dir, "ORDERBOOK_ACM_3240.xlsx")

print("Kiểm tra file:", filepath)
if not os.path.exists(filepath):
    print("KHÔNG TÌM THẤY FILE!")
    # Tìm xem có file nào chứa ORDERBOOK trong thư mục không
    files = [f for f in os.listdir(backup_dir) if 'ORDER' in f.upper()]
    print("Các file chứa ORDER trong thư mục:", files)
    sys.exit(1)

df = pd.read_excel(filepath)
print(f"Kích thước: {df.shape[0]} dòng, {df.shape[1]} cột")
print("-" * 80)
print("DANH SÁCH TẤT CẢ CÁC CỘT:")
for idx, col in enumerate(df.columns):
    sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else "RỖNG"
    print(f"  [{idx:02d}] '{col}' | Kiểu: {df[col].dtype} | Mẫu: {sample}")

print("-" * 80)
print("Phân loại trạng thái lệnh (nếu có):")
status_col = None
for c in df.columns:
    if 'trạng thái' in c.lower() or 'status' in c.lower() or 'lệnh' in c.lower():
        print(f"Cột tiềm năng: '{c}' -> Giá trị unique: {df[c].value_counts().to_dict()}")

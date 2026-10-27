import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

CCP_DIR = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\26.10"

print("=" * 80)
print("KIỂM TRA CẤU TRÚC VÀ CỘT CÁC TỆP DỮ LIỆU CCP TẠI:")
print(CCP_DIR)
print("=" * 80)

def inspect_file(filename):
    filepath = os.path.join(CCP_DIR, filename)
    if not os.path.exists(filepath):
        print(f"\n[KHÔNG TÌM THẤY] {filename}")
        return
    print(f"\n" + "-" * 80)
    print(f"FILE: {filename}")
    print("-" * 80)
    try:
        df = pd.read_excel(filepath)
        print(f"Kích thước: {df.shape[0]} dòng, {df.shape[1]} cột")
        print("Danh sách cột:")
        for idx, col in enumerate(df.columns):
            sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else "RỖNG"
            print(f"  Col [{idx:02d}]: '{col}' | Kiểu: {df[col].dtype} | Mẫu: {sample}")
    except Exception as e:
        print(f"Lỗi khi đọc file {filename}: {e}")

inspect_file("DSGD CCP.xlsx")
inspect_file("TTM CCP.xlsx")
inspect_file("TTTT.xlsx")
inspect_file("Tỷ giá CCP.xlsx")
inspect_file("GTT CCP.xlsx")

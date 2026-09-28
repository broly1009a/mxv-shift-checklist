import os
import shutil
from datetime import datetime
import openpyxl

ccp_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/output"
ms_lot_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
ms_val_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke gia tri giao dich"

backup_dir = os.path.join(ccp_dir, "Backup_Templates_20260925")
os.makedirs(backup_dir, exist_ok=True)

# Danh sách 8 file cần thay template chuẩn từ MS
mappings = [
    # 1. Lot Thường
    {
        "ccp_file": "Thong ke so lot giao dich 2026.xlsx",
        "ms_dir": ms_lot_dir,
        "ms_file": "Thong ke so lot giao dich 2026 2.xlsx",
        "type": "lot",
        "has_tonghop": True
    },
    # 2. Lot LME
    {
        "ccp_file": "Thong ke so lot giao dich LME 2026.xlsx",
        "ms_dir": ms_lot_dir,
        "ms_file": "Thong ke so lot giao dich LME 2026.xlsx",
        "type": "lot",
        "has_tonghop": True
    },
    # 3. Lot Options
    {
        "ccp_file": "Thong ke so lot giao dich Options 2026.xlsx",
        "ms_dir": ms_lot_dir,
        "ms_file": "Thong ke so lot giao dich Options 2026.xlsx",
        "type": "lot",
        "has_tonghop": True
    },
    # 4. Lot Spread
    {
        "ccp_file": "Thong ke so lot giao dich Spread 2026.xlsx",
        "ms_dir": ms_lot_dir,
        "ms_file": "Thong ke so lot giao dich Spread 2026.xlsx",
        "type": "lot",
        "has_tonghop": True
    },
    # 5. Giá trị Thường
    {
        "ccp_file": "Thong ke gia tri giao dich 2026.xlsx",
        "ms_dir": ms_val_dir,
        "ms_file": "Thong ke gia tri giao dich 2026 1.xlsx",
        "type": "val",
        "has_tonghop": True
    },
    # 6. Giá trị LME
    {
        "ccp_file": "Thong ke gia tri giao dich LME 2026.xlsx",
        "ms_dir": ms_val_dir,
        "ms_file": "Thong ke gia tri giao dich LME 2026.xlsx",
        "type": "val",
        "has_tonghop": True
    },
    # 7. Giá trị Options
    {
        "ccp_file": "Thong ke gia tri giao dich Options 2026.xlsx",
        "ms_dir": ms_val_dir,
        "ms_file": "Thong ke gia tri giao dich Options 2026.xlsx",
        "type": "val",
        "has_tonghop": True
    },
    # 8. Giá trị Spread
    {
        "ccp_file": "Thong ke gia tri giao dich Spread 2026.xlsx",
        "ms_dir": ms_val_dir,
        "ms_file": "Thong ke gia tri giao dich Spread 2026.xlsx",
        "type": "val",
        "has_tonghop": True
    },
]

print("=== BƯỚC 1: KIỂM TRA SỰ TỒN TẠI CỦA CÁC FILE NGUỒN MS VÀ ĐÍCH CCP ===")
for m in mappings:
    ms_p = os.path.join(m["ms_dir"], m["ms_file"])
    ccp_p = os.path.join(ccp_dir, m["ccp_file"])
    print(f"File: {m['ccp_file']}")
    print(f"  MS Source  : {'OK' if os.path.exists(ms_p) else 'MISSING'} ({ms_p})")
    print(f"  CCP Target : {'OK' if os.path.exists(ccp_p) else 'MISSING'} ({ccp_p})")
    if os.path.exists(ccp_p):
        stat = os.stat(ccp_p)
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
        print(f"  CCP MTime  : {mtime} | Size: {stat.st_size} bytes")

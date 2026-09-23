import os
import sys
from verify_ccp_statistics import dsgd_rows

sys.stdout.reconfigure(encoding='utf-8')

print("| STT | Mã TKGD | TVKD | Mã HĐ | Chiều | Lệnh | KL | Giá Khớp | Độ Cao | Trị Giá (USD) | GTGD (VND - 25.920) | GTGD (VND - 26.000) |")
print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")

for idx, r in enumerate(dsgd_rows, 1):
    print(f"| {idx:2d} | `{r['maTKGD']}` | `{r['tvkd']}` | `{r['maHD']}` | {r['muaBan']} | `{r['loaiLenh']}` | {r['klKhop']:.0f} | {r['giaKhop']:.3f} | {r['doCao']:.0f} | ${r['gtgd_raw_usd']:,.2f} | {r['gtgd_25920']:,} đ | {r['gtgd_26000']:,} đ |")

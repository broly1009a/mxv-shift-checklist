import sys
sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import try_decode_mrz

back_img = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936/CCCD PHAN SƠN HƯNG_AUTO_TEMP_AUTO_BACK.jpg"
front_img = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936/CCCD PHAN SƠN HƯNG_AUTO_TEMP_AUTO_FRONT.jpg"

print("--- TRY DECODE MRZ ON BACK ---")
mrz_b = try_decode_mrz(back_img)
print("MRZ Back:", mrz_b)

print("\n--- TRY DECODE MRZ ON FRONT ---")
mrz_f = try_decode_mrz(front_img)
print("MRZ Front:", mrz_f)

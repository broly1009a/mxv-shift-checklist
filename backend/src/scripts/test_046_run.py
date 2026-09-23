import sys
import os
import json

sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import rasterize_cccd_pdf, process_account_files, extract_pdf_contract

folder = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936"
cccd_pdf = f"{folder}/CCCD PHAN SƠN HƯNG.pdf"
hd_pdf = f"{folder}/HĐ + PL01 046C0002936.pdf"

print("1. TEST rasterize_cccd_pdf:")
f, b = rasterize_cccd_pdf(cccd_pdf)
print(f"Front: {f}, Back: {b}")

print("\n2. TEST extract_pdf_contract on HD:")
hd_res = extract_pdf_contract(hd_pdf)
print("HD res:", json.dumps(hd_res, ensure_ascii=False, indent=2))

print("\n3. TEST process_account_files:")
res = process_account_files(hopdong=hd_pdf, phuluc=None, front=cccd_pdf, back=None, code="046C0002936", name="PHAN SƠN HƯNG")
print("Process res:", json.dumps(res, ensure_ascii=False, indent=2))

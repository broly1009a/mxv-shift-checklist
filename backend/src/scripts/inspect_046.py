import fitz # PyMuPDF
import sys

dir_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936"
cccd_pdf = f"{dir_path}/CCCD PHAN SƠN HƯNG.pdf"
hd_pdf = f"{dir_path}/HĐ + PL01 046C0002936.pdf"

print("=== 1. KIEM TRA CCCD PHAN SƠN HƯNG.pdf ===")
try:
    doc = fitz.open(cccd_pdf)
    print(f"So trang CCCD PDF: {len(doc)}")
    for i, page in enumerate(doc):
        text = page.get_text()
        print(f"--- Trang {i+1} text length: {len(text)} ---")
        print(repr(text[:200]))
        images = page.get_images()
        print(f"So luong anh nhung trang {i+1}: {len(images)}")
        for img in images:
            print("Image:", img)
except Exception as e:
    print("Loi doc CCCD PDF:", e)

print("\n=== 2. KIEM TRA HĐ + PL01 046C0002936.pdf ===")
try:
    doc = fitz.open(hd_pdf)
    print(f"So trang HD PDF: {len(doc)}")
    for i in range(min(3, len(doc))):
        page = doc[i]
        text = page.get_text()
        print(f"--- Trang {i+1} text sample: ---")
        print(repr(text[:300]))
except Exception as e:
    print("Loi doc HD PDF:", e)

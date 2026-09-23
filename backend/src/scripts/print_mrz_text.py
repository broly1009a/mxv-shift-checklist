import pytesseract
import cv2

back_img = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936/CCCD PHAN SƠN HƯNG_AUTO_TEMP_AUTO_BACK.jpg"
img = cv2.imread(back_img)
h, w = img.shape[:2]
# Crop bottom 30% for MRZ
bottom = img[int(h*0.7):, :]
text = pytesseract.image_to_string(bottom, config='--oem 1 --psm 6')
print("--- RAW MRZ OCR TEXT ---")
print(repr(text))
print("Lines:")
for line in text.splitlines():
    print(repr(line))

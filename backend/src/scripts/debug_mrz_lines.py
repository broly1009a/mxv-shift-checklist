import cv2
import pytesseract
import re

back_img = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002936/CCCD PHAN SƠN HƯNG_AUTO_TEMP_AUTO_BACK.jpg"
img = cv2.imread(back_img)
h, w = img.shape[:2]
custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

for angle in [0, 90, 180, 270]:
    if angle == 0: rot = img
    elif angle == 90: rot = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180: rot = cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270: rot = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    
    gray = cv2.cvtColor(rot, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray, config=custom_config)
    lines = [l.strip() for l in text.split('\n') if len(l.strip()) >= 8]
    print(f"=== Angle {angle} ===")
    for l in lines:
        print("  Line:", repr(l))

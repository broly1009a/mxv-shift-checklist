import os
import sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

def test_cccd_images():
    base_dir = r"C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\POC\TKGD-Automation\inputs\mail-outlook"
    
    # Kiểm tra pyzbar
    has_pyzbar = False
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode
        has_pyzbar = True
        print("✅ Thư viện pyzbar đã sẵn sàng!")
    except Exception as e:
        print(f"⚠️ pyzbar chưa dùng được: {e}")

    # Kiểm tra pytesseract
    has_tesseract = False
    try:
        import pytesseract
        has_tesseract = True
        print("✅ Thư viện pytesseract đã sẵn sàng!")
    except Exception as e:
        print(f"⚠️ pytesseract chưa dùng được: {e}")

    for sample in ["mẫu 1", "mẫu 2"]:
        sample_path = os.path.join(base_dir, sample)
        print("\n" + "="*60)
        print(f"KIỂM TRA ẢNH CCCD: {sample}")
        print("="*60)
        for f in os.listdir(sample_path):
            if "CCCD" in f and f.lower().endswith((".jpg", ".png", ".jpeg")):
                img_path = os.path.join(sample_path, f)
                print(f"\n🔍 Đang xử lý file: {f}")
                
                # Thử đọc QR code nếu là mặt trước
                if has_pyzbar:
                    try:
                        img = Image.open(img_path)
                        decoded = pyzbar_decode(img)
                        if decoded:
                            for d in decoded:
                                qr_data = d.data.decode('utf-8', errors='ignore')
                                print(f"  🎯 [QR Code Tìm Thấy!]: {qr_data}")
                        else:
                            print("  ℹ️ Không phát hiện QR code qua pyzbar")
                    except Exception as e:
                        print(f"  ❌ Lỗi pyzbar: {e}")

                # Thử đọc Tesseract OCR
                if has_tesseract:
                    try:
                        img = Image.open(img_path)
                        text = pytesseract.image_to_string(img, lang='vie+eng')
                        print(f"  📝 [Tesseract Text ({len(text)} ký tự)]:")
                        print("     " + "\n     ".join(text.splitlines()[:10]))
                    except Exception as e:
                        print(f"  ℹ️ Tesseract chưa chạy được (cần cài binary): {e}")

if __name__ == "__main__":
    test_cccd_images()

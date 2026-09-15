import os
import sys
import pypdf
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

def inspect_sample_files():
    base_dir = r"C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\POC\TKGD-Automation\inputs\mail-outlook"
    for sample in ["mẫu 1", "mẫu 2"]:
        sample_path = os.path.join(base_dir, sample)
        print("="*60)
        print(f"KIỂM TRA THƯ MỤC: {sample}")
        print("="*60)
        for f in os.listdir(sample_path):
            file_path = os.path.join(sample_path, f)
            if f.endswith(".pdf"):
                try:
                    reader = pypdf.PdfReader(file_path)
                    print(f"\n📄 [PDF] {f}: Tổng {len(reader.pages)} trang")
                    for p_idx, page in enumerate(reader.pages):
                        txt = page.extract_text() or ""
                        print(f"   Trang {p_idx + 1}: {len(txt)} ký tự text")
                        if txt:
                            print(f"   --> Trích đoạn text:\n{txt[:300].strip()}\n")
                except Exception as e:
                    print(f"    Lỗi đọc PDF {f}: {e}")
            elif f.lower().endswith((".jpg", ".png", ".jpeg")):
                try:
                    img = Image.open(file_path)
                    print(f"\n🖼️ [ẢNH] {f}: Kích thước {img.size}, Format: {img.format}")
                except Exception as e:
                    print(f"    Lỗi đọc ảnh {f}: {e}")

if __name__ == "__main__":
    inspect_sample_files()

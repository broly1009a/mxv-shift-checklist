import os
import sys
import pypdf

sys.stdout.reconfigure(encoding='utf-8')

def test_pdf_details():
    base_dir = r"C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\POC\TKGD-Automation\inputs\mail-outlook"
    
    files_to_check = [
        ("mẫu 1", "NGO-DUC-HAI-mxv.pdf"),
        ("mẫu 1", "NGO-DUC-HAI-PL01.pdf"),
        ("mẫu 2", "NGUYEN-ANH-KHOA-mxv.pdf"),
    ]

    for sample, filename in files_to_check:
        file_path = os.path.join(base_dir, sample, filename)
        print("="*70)
        print(f"📄 CHI TIẾT FILE: {sample} / {filename}")
        print("="*70)
        reader = pypdf.PdfReader(file_path)
        for i, p in enumerate(reader.pages):
            text = p.extract_text()
            print(f"\n--- TRANG {i+1} ({len(text)} ký tự) ---")
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            for line in lines:
                # In ra các dòng chứa thông tin quan trọng
                keywords = ["Họ và tên", "Mã TKGD", "Số:", "CCCD", "CMND", "Ngày sinh", "Ngày cấp", "Nơi cấp", "Cá nhân", "Doanh nghiệp", "Chữ ký", "Đã ký", "Ký", "ngày", "tháng", "năm"]
                if any(kw.lower() in line.lower() for kw in keywords):
                    print(f"  📌 {line}")

if __name__ == "__main__":
    test_pdf_details()

"""
Module 4: PDF Extractor — Trích xuất dữ liệu từ PDF Hợp đồng & PL01
---------------------------------------------------------------------
Xử lý:
  - *-mxv.pdf: Hợp đồng mở TKGD (kiểm tra chữ ký, con dấu, tên KH)
  - *-PL01.pdf: Phụ lục 01 đăng ký tiểu khoản ACM (kiểm tra đầy đủ)

Dependencies:
  pip install pdfplumber pymupdf
"""

import re
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class PDFExtractResult:
    """Kết quả trích xuất từ 1 file PDF."""
    file_type: str           # 'hop_dong' hoặc 'pl01'
    file_path: str
    total_pages: int = 0
    
    # Thông tin trích xuất được
    tenKH_in_pdf: Optional[str] = None
    maTKGD_in_pdf: Optional[str] = None
    so_hop_dong: Optional[str] = None
    
    # Kiểm tra pháp lý
    has_signature_area: bool = False    # Phát hiện vùng chữ ký
    has_stamp_area: bool = False        # Phát hiện vùng con dấu
    has_filled_content: bool = False    # PDF có nội dung text (không trống)
    
    # Status
    extraction_success: bool = False
    extraction_method: str = ''  # 'pdfplumber' | 'pymupdf' | 'failed'
    warning: Optional[str] = None


def extract_text_pdfplumber(pdf_path: str) -> str:
    """Trích xuất text từ PDF bằng pdfplumber."""
    try:
        import pdfplumber
        full_text = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text.append(text)
        return '\n'.join(full_text)
    except ImportError:
        return None
    except Exception as e:
        print(f"    ⚠️ pdfplumber error: {e}")
        return None


def extract_text_pymupdf(pdf_path: str) -> str:
    """Trích xuất text từ PDF bằng PyMuPDF (fitz)."""
    try:
        import fitz  # pymupdf
        full_text = []
        doc = fitz.open(pdf_path)
        for page in doc:
            full_text.append(page.get_text())
        doc.close()
        return '\n'.join(full_text)
    except ImportError:
        return None
    except Exception as e:
        print(f"    ⚠️ pymupdf error: {e}")
        return None


def count_pdf_pages(pdf_path: str) -> int:
    """Đếm số trang PDF."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        n = len(doc)
        doc.close()
        return n
    except:
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                return len(pdf.pages)
        except:
            return 0


def detect_signature_stamp(text: str, pdf_path: str = None) -> tuple:
    """
    Phát hiện vùng chữ ký và con dấu trong PDF.
    
    Returns: (has_signature, has_stamp)
    
    Chiến lược:
    1. Tìm từ khóa chữ ký/con dấu trong text
    2. Kiểm tra image objects trong PDF (ảnh nhúng = thường là chữ ký/dấu)
    """
    has_sig = False
    has_stamp = False
    
    # Tìm từ khóa trong text
    sig_keywords = ['chữ ký', 'ký tên', 'Signature', 'signed', 'ký xác nhận', 'người ký']
    stamp_keywords = ['con dấu', 'đóng dấu', 'dấu mộc', 'stamp', 'Seal']
    
    text_lower = text.lower()
    has_sig = any(kw.lower() in text_lower for kw in sig_keywords)
    has_stamp = any(kw.lower() in text_lower for kw in stamp_keywords)
    
    # Kiểm tra số lượng hình ảnh nhúng trong PDF (chữ ký scan thường là image)
    if pdf_path and not (has_sig and has_stamp):
        try:
            import fitz
            doc = fitz.open(pdf_path)
            total_images = sum(len(page.get_images()) for page in doc)
            doc.close()
            # Nếu có ít nhất 1 ảnh nhúng, rất có thể có chữ ký/dấu scan
            if total_images >= 2:
                has_sig = True
            if total_images >= 3:
                has_stamp = True
        except:
            pass
    
    return has_sig, has_stamp


def extract_from_hop_dong(pdf_path: str) -> PDFExtractResult:
    """
    Trích xuất thông tin từ file Hợp đồng mở TKGD (*-mxv.pdf).
    
    Các thông tin cần lấy:
    - Tên khách hàng trong hợp đồng (so sánh với mail + CCCD)
    - Mã TKGD trong hợp đồng
    - Có chữ ký + con dấu đủ không
    """
    result = PDFExtractResult(
        file_type='hop_dong',
        file_path=pdf_path,
        total_pages=count_pdf_pages(pdf_path)
    )
    
    print(f"\n  📄 Đang đọc Hợp đồng: {Path(pdf_path).name} ({result.total_pages} trang)")
    
    # Trích xuất text
    text = extract_text_pdfplumber(pdf_path)
    if text is None:
        text = extract_text_pymupdf(pdf_path)
        result.extraction_method = 'pymupdf'
    else:
        result.extraction_method = 'pdfplumber'
    
    if not text or len(text.strip()) < 50:
        # PDF có thể là ảnh scan thuần → không có text layer
        result.warning = "PDF dạng scan (không có text layer). Cần OCR PDF nếu muốn trích xuất."
        print(f"    ⚠️ {result.warning}")
        # Vẫn kiểm tra image objects
        sig, stamp = detect_signature_stamp('', pdf_path)
        result.has_signature_area = sig
        result.has_stamp_area = stamp
        result.extraction_success = True  # File đọc được, chỉ không có text
        return result
    
    result.has_filled_content = True
    result.extraction_success = True
    
    # Bóc tách Tên KH từ hợp đồng
    # Pattern: "Họ và tên: NGUYỄN VĂN A" hoặc "Bên A: NGUYỄN VĂN A"
    m = re.search(
        r'(?:Họ và tên|Tên khách hàng|Bên A|NĐT)\s*[:\-]\s*(.+?)(?:\n|$)',
        text, re.IGNORECASE
    )
    if m:
        result.tenKH_in_pdf = m.group(1).strip()
    
    # Bóc tách Mã TKGD trong hợp đồng
    m = re.search(r'(\d{3}[A-Z]\d{7}(?:-[ALMS])?)', text)
    if m:
        result.maTKGD_in_pdf = m.group(1).strip()
    
    # Bóc tách Số hợp đồng
    m = re.search(r'(?:Số hợp đồng|Contract No\.?|Hợp đồng số)\s*[:\-/]\s*(.+?)(?:\n|$)',
                  text, re.IGNORECASE)
    if m:
        result.so_hop_dong = m.group(1).strip()
    
    # Kiểm tra chữ ký + con dấu
    result.has_signature_area, result.has_stamp_area = detect_signature_stamp(text, pdf_path)
    
    print(f"    Tên KH trong HĐ: {result.tenKH_in_pdf}")
    print(f"    Mã TK trong HĐ:  {result.maTKGD_in_pdf}")
    print(f"    Chữ ký: {'✅' if result.has_signature_area else '⚠️ Không phát hiện'}")
    print(f"    Con dấu: {'✅' if result.has_stamp_area else '⚠️ Không phát hiện'}")
    
    return result


def extract_from_pl01(pdf_path: str) -> PDFExtractResult:
    """
    Trích xuất thông tin từ Phụ lục PL01 đăng ký tiểu khoản ACM.
    
    Kiểm tra:
    - Đây có đúng là PL01 không (kiểm tra tiêu đề)
    - Có tên KH và Mã TK ACM không
    - Có đầy đủ chữ ký + dấu không
    """
    result = PDFExtractResult(
        file_type='pl01',
        file_path=pdf_path,
        total_pages=count_pdf_pages(pdf_path)
    )
    
    print(f"\n  📄 Đang đọc PL01: {Path(pdf_path).name} ({result.total_pages} trang)")
    
    text = extract_text_pdfplumber(pdf_path)
    if text is None:
        text = extract_text_pymupdf(pdf_path)
        result.extraction_method = 'pymupdf'
    else:
        result.extraction_method = 'pdfplumber'
    
    if not text or len(text.strip()) < 50:
        result.warning = "PL01 PDF dạng scan thuần."
        print(f"    ⚠️ {result.warning}")
        sig, stamp = detect_signature_stamp('', pdf_path)
        result.has_signature_area = sig
        result.has_stamp_area = stamp
        result.extraction_success = True
        return result
    
    result.has_filled_content = True
    result.extraction_success = True
    
    # Kiểm tra đây có đúng là Phụ lục 01 không
    is_pl01 = bool(re.search(
        r'Ph[uụ] l[uụ]c\s*(s[oố]\s*)?01|PL[\s-]?01|đăng ký.*ti[eê]u kho[aả]n ACM',
        text, re.IGNORECASE
    ))
    if not is_pl01:
        result.warning = "Không phát hiện tiêu đề Phụ lục 01 trong PDF này"
        print(f"    ⚠️ {result.warning}")
    
    # Bóc tách tên KH và Mã TK ACM
    m = re.search(
        r'(?:Họ và tên|Tên khách hàng)\s*[:\-]\s*(.+?)(?:\n|$)',
        text, re.IGNORECASE
    )
    if m:
        result.tenKH_in_pdf = m.group(1).strip()
    
    m = re.search(r'(\d{3}[A-Z]\d{7}-[ALMS])', text)
    if m:
        result.maTKGD_in_pdf = m.group(1).strip()
    
    result.has_signature_area, result.has_stamp_area = detect_signature_stamp(text, pdf_path)
    
    print(f"    Tên KH trong PL01: {result.tenKH_in_pdf}")
    print(f"    Mã TK ACM:         {result.maTKGD_in_pdf}")
    print(f"    Chữ ký: {'✅' if result.has_signature_area else '⚠️ Không phát hiện'}")
    
    return result


def extract_pdf(pdf_path: str, file_type: str = None) -> PDFExtractResult:
    """
    Hàm tổng hợp: tự động phát hiện loại PDF và extract.
    
    Args:
        pdf_path: Đường dẫn file PDF
        file_type: 'hop_dong' | 'pl01' | None (tự phát hiện từ tên file)
    """
    if not file_type:
        fn = Path(pdf_path).name.lower()
        if '-pl01' in fn or 'pl01' in fn:
            file_type = 'pl01'
        else:
            file_type = 'hop_dong'
    
    if file_type == 'pl01':
        return extract_from_pl01(pdf_path)
    else:
        return extract_from_hop_dong(pdf_path)

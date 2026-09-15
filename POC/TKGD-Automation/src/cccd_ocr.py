"""
Module 3: CCCD OCR — Trích xuất thông tin từ ảnh Căn cước Công dân
--------------------------------------------------------------------
Chiến lược 3 lớp (từ cao xuống thấp):
  Lớp 1: Giải mã QR Code mặt trước (chính xác 100%, chuẩn Bộ Công An)
  Lớp 2: Giải mã dòng MRZ mặt sau  (ICAO standard, có checksum)
  Lớp 3: OCR Text thuần (fallback, dùng khi QR/MRZ không đọc được)

Dependencies:
  pip install pyzbar pillow pytesseract opencv-python

QR Code format (Bộ Công An VN):
  [SoCCCD]|[SoCMNDCu]|[HoTen]|[NgaySinhDDMMYYYY]|[GioiTinh]|[DiaChi]|[NgayCapDDMMYYYY]
  VD: "040187030831|041873123|NGUYỄN THỊ YẾN|26031987|Nữ|Số 25, Phường Láng Hạ, Đống Đa, HN|20102022"

MRZ format (ICAO Type ID / TD1):
  Line 1: IDVNM[12 so CCCD][checksum]...
  Line 2: [YYMMDD][checksum][Sex][YYMMDD][checksum][Quoc Gia]
  Line 3: [HO<<TEN<LOT<TEN<<<<<<<<<<<<<<<<]
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional
from pathlib import Path


@dataclass
class CCCDData:
    """Dữ liệu trích xuất từ CCCD."""
    soCCCD: Optional[str] = None          # 12 số định danh
    soCMNDCu: Optional[str] = None        # 9 số CMND cũ (nếu có)
    hoTen: Optional[str] = None           # Họ tên có dấu
    hoTenKhongDau: Optional[str] = None   # Họ tên không dấu (từ MRZ)
    ngaySinh: Optional[str] = None        # DD/MM/YYYY
    gioiTinh: Optional[str] = None        # Nam / Nữ / Khác
    diaChi: Optional[str] = None          # Địa chỉ thường trú
    ngayCap: Optional[str] = None         # DD/MM/YYYY
    noiCap: Optional[str] = None          # Nơi cấp
    
    # Nguồn dữ liệu
    qr_success: bool = False
    mrz_success: bool = False
    ocr_success: bool = False
    
    # Mức độ tin cậy
    @property
    def confidence(self) -> str:
        if self.qr_success:
            return 'HIGH (QR Code)'
        if self.mrz_success:
            return 'HIGH (MRZ)'
        if self.ocr_success:
            return 'MEDIUM (OCR)'
        return 'FAILED'
    
    @property
    def needsManualCheck(self) -> bool:
        return not (self.qr_success or self.mrz_success) and self.soCCCD is None


# ─────────────────────────────────────────────
# Lớp 1: Giải mã QR Code
# ─────────────────────────────────────────────

def decode_qr_code(image_path: str) -> Optional[CCCDData]:
    """
    Giải mã QR Code trên mặt trước CCCD gắn chip.
    
    QR format: [CCCD]|[CMND]|[HoTen]|[NgaySinh DDMMYYYY]|[GioiTinh]|[DiaChi]|[NgayCap DDMMYYYY]
    
    Returns CCCDData nếu thành công, None nếu không có QR hoặc lỗi.
    """
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode
        from PIL import Image
        import cv2
        import numpy as np
        
        # Thử nhiều phương pháp đọc QR để tăng tỷ lệ thành công
        qr_text = None
        
        # Method 1: pyzbar trực tiếp
        img = Image.open(image_path)
        decoded = pyzbar_decode(img)
        if decoded:
            qr_text = decoded[0].data.decode('utf-8', errors='ignore')
        
        # Method 2: OpenCV nếu pyzbar thất bại
        if not qr_text:
            img_cv = cv2.imread(image_path)
            if img_cv is not None:
                # Tăng contrast và làm sắc nét
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                # Thử QRCodeDetector của OpenCV
                qr_detector = cv2.QRCodeDetector()
                data, _, _ = qr_detector.detectAndDecode(gray)
                if data:
                    qr_text = data
        
        # Method 3: Với ảnh nghiêng, thử perspective correction
        if not qr_text:
            print(f"     QR: Không giải mã được từ {Path(image_path).name}")
            return None
        
        # Parse chuỗi QR Bộ Công An
        parts = qr_text.strip().split('|')
        if len(parts) < 6:
            print(f"     QR: Format không nhận dạng được: {qr_text[:50]}")
            return None
        
        data = CCCDData()
        data.soCCCD = parts[0].strip() if len(parts) > 0 else None
        data.soCMNDCu = parts[1].strip() if len(parts) > 1 else None
        data.hoTen = parts[2].strip() if len(parts) > 2 else None
        
        # Ngày sinh: DDMMYYYY → DD/MM/YYYY
        if len(parts) > 3 and parts[3]:
            raw_dob = parts[3].strip()
            if len(raw_dob) == 8:
                data.ngaySinh = f"{raw_dob[0:2]}/{raw_dob[2:4]}/{raw_dob[4:8]}"
        
        # Giới tính
        if len(parts) > 4:
            sex_raw = parts[4].strip()
            if sex_raw in ('Nam', 'M', 'Male'):
                data.gioiTinh = 'Nam'
            elif sex_raw in ('Nữ', 'F', 'Female', 'Nu'):
                data.gioiTinh = 'Nữ'
            else:
                data.gioiTinh = sex_raw
        
        data.diaChi = parts[5].strip() if len(parts) > 5 else None
        
        # Ngày cấp: DDMMYYYY → DD/MM/YYYY
        if len(parts) > 6 and parts[6]:
            raw_cap = parts[6].strip()
            if len(raw_cap) == 8:
                data.ngayCap = f"{raw_cap[0:2]}/{raw_cap[2:4]}/{raw_cap[4:8]}"
        
        data.qr_success = True
        print(f"     QR: {data.soCCCD} | {data.hoTen} | {data.ngaySinh}")
        return data
        
    except ImportError:
        print("     pyzbar/cv2 chưa cài. Chạy: pip install pyzbar opencv-python pillow")
        return None
    except Exception as e:
        print(f"     QR Error: {e}")
        return None


# ─────────────────────────────────────────────
# Lớp 2: Giải mã MRZ mặt sau CCCD
# ─────────────────────────────────────────────

def decode_mrz_from_image(image_path: str) -> Optional[CCCDData]:
    """
    Đọc và giải mã dòng MRZ (Machine Readable Zone) từ mặt sau CCCD.
    
    MRZ CCCD VN dạng TD1 (3 dòng x 30 ký tự):
    Line 1: IDVNM[Doc No 9c][Check1][Optional][Check2]
    Line 2: [YYMMDD][Check][Sex][YYMMDD][Check][Nationality][<<<][Check9]
    Line 3: [LastName<<FirstName<<<<<<<<<<<<]
    
    VD:
    IDVNM040187030831<<5
    8703260F2703268VNM<<<<<<<<<<<8
    NGUYEN<<THI<YEN<<<<<<<<<<<<<<<<
    """
    try:
        # Bước 1: OCR khu vực MRZ bằng pytesseract với config đặc biệt
        from PIL import Image
        import pytesseract
        import cv2
        import numpy as np
        
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        # Crop phần dưới ảnh (MRZ thường ở 30-40% dưới cùng)
        h, w = img.shape[:2]
        mrz_region = img[int(h * 0.6):, :]  # Lấy 40% dưới
        
        # Thử nhiều phương pháp tiền xử lý ảnh để vượt qua hoa văn bảo an của thẻ Căn cước mới 2024
        # 1. Otsu thresholding
        gray = cv2.cvtColor(mrz_region, cv2.COLOR_BGR2GRAY)
        _, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # 2. Adaptive thresholding (khử hoa văn chìm)
        thresh2 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
        
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
        
        for thresh_img in [thresh1, thresh2]:
            mrz_text = pytesseract.image_to_string(thresh_img, config=custom_config)
            lines = [l.strip() for l in mrz_text.split('\n') if len(l.strip()) >= 15]
            if len(lines) >= 2:
                parsed = parse_mrz_lines(lines)
                if parsed and parsed.mrz_success:
                    return parsed
        
        print(f"     MRZ: Không nhận dạng được MRZ trong {Path(image_path).name}")
        return None
        
    except ImportError:
        print("     pytesseract/cv2 chưa cài. Chạy: pip install pytesseract opencv-python")
        return None
    except Exception as e:
        print(f"     MRZ Error: {e}")
        return None


def parse_mrz_lines(lines: list) -> Optional[CCCDData]:
    """Parse các dòng MRZ đã OCR thành CCCDData hỗ trợ thẻ Căn Cước 2024 & CCCD 2021."""
    try:
        data = CCCDData()
        
        # Tìm dòng 1: Thẻ cũ IDVNM, thẻ mới có thể bị OCR thành LDVNM, TDVNM hoặc ID...
        line1 = next((l for l in lines if re.match(r'^[IDLT]DVNM|^ID', l)), None)
        line2 = None
        line3 = None
        
        for i, l in enumerate(lines):
            if l is line1 and i + 1 < len(lines):
                line2 = lines[i + 1]
                if i + 2 < len(lines):
                    line3 = lines[i + 2]
                break
        
        if not line2:
            # Heuristic: dòng có chữ F hoặc M ở giữa kèm các cụm ngày tháng
            line2 = next((l for l in lines if re.search(r'\d{6}[0-9]?[FM]', l)), None)
        
        # Parse Line 1: Số CCCD 12 số
        if line1:
            m1 = re.search(r'[IDLT]DVNM([0-9<]{9,15})', line1)
            if m1:
                raw_num = m1.group(1).replace('<', '')
                if len(raw_num) == 12:
                    data.soCCCD = raw_num
                elif len(raw_num) >= 9:
                    data.soCCCD = raw_num[:12] if len(raw_num) >= 12 else raw_num
            else:
                m12 = re.search(r'(\d{12})', line1)
                if m12:
                    data.soCCCD = m12.group(1)
        
        # Parse Line 2: Ngày sinh, giới tính
        dob_match = None
        if line2:
            dob_match = re.search(r'(\d{6})\d?([MF])', line2)
            if dob_match:
                dob_raw = dob_match.group(1)  # YYMMDD
                sex_char = dob_match.group(2)
                data.gioiTinh = 'Nữ' if sex_char == 'F' else 'Nam'
                yy = int(dob_raw[0:2])
                year = 1900 + yy if yy > 30 else 2000 + yy
                data.ngaySinh = f"{dob_raw[4:6]}/{dob_raw[2:4]}/{year}"
        
        # Suy luận toán học chuẩn từ 12 số CCCD Bộ Công An:
        # Cấu trúc: [3 số tỉnh][1 số thế kỷ/giới tính][2 số năm sinh][6 số ngẫu nhiên]
        # Thế kỷ 20 (1900-1999): 0 Nam, 1 Nữ
        # Thế kỷ 21 (2000-2099): 2 Nam, 3 Nữ
        # Thế kỷ 22 (2100-2199): 4 Nam, 5 Nữ
        if data.soCCCD and len(data.soCCCD) == 12:
            century_gender = data.soCCCD[3]
            birth_year_short = data.soCCCD[4:6]
            
            if not data.gioiTinh:
                if century_gender in ('0', '2', '4', '6', '8'):
                    data.gioiTinh = 'Nam'
                elif century_gender in ('1', '3', '5', '7', '9'):
                    data.gioiTinh = 'Nữ'
            
            century_base = 1900
            if century_gender in ('2', '3'):
                century_base = 2000
            elif century_gender in ('4', '5'):
                century_base = 2100
            full_year = century_base + int(birth_year_short)
            
            if dob_match:
                dob_raw = dob_match.group(1)
                data.ngaySinh = f"{dob_raw[4:6]}/{dob_raw[2:4]}/{full_year}"
            elif not data.ngaySinh:
                # Nếu không đọc được ngày tháng, giữ năm sinh
                data.ngaySinh = f"01/01/{full_year}"

        # Parse Line 3: Họ tên không dấu
        if line3:
            name_clean = line3.replace('<', ' ').strip()
            parts = line3.split('<<')
            if len(parts) >= 2:
                ho = parts[0].replace('<', ' ').strip()
                ten = parts[1].replace('<', ' ').strip()
                data.hoTenKhongDau = f"{ho} {ten}".strip()
            else:
                data.hoTenKhongDau = name_clean
        
        if data.soCCCD:
            data.mrz_success = True
            # Mặc định nơi cấp của thẻ Căn cước mới theo Luật 2023
            if not data.noiCap:
                data.noiCap = "BỘ CÔNG AN"
            print(f"     MRZ: {data.soCCCD} | {data.hoTenKhongDau} | {data.ngaySinh} | {data.gioiTinh} | {data.noiCap}")
            return data
        
        return None
        
    except Exception as e:
        print(f"     MRZ Parse Error: {e}")
        return None


# ─────────────────────────────────────────────
# Lớp 3: OCR Text thuần (fallback)
# ─────────────────────────────────────────────

def ocr_cccd_text(image_path: str) -> Optional[CCCDData]:
    """
    OCR toàn bộ text từ ảnh CCCD và bóc tách thông tin bằng Regex.
    Dùng làm fallback khi QR/MRZ không thành công.
    """
    try:
        from PIL import Image
        import pytesseract
        import cv2
        
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        # Preprocess
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Tăng contrast
        gray = cv2.equalizeHist(gray)
        # Sharpen
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
        gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        
        # OCR với tiếng Việt
        text = pytesseract.image_to_string(
            gray, 
            lang='vie+eng',
            config='--psm 6'
        )
        
        data = CCCDData()
        
        # Bóc tách số CCCD (12 số)
        m = re.search(r'\b(\d{12})\b', text)
        if m:
            data.soCCCD = m.group(1)
        
        # Bóc tách Họ tên
        m = re.search(r'(?:Họ và tên|Họ tên|Full name)\s*[:\n]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if m:
            data.hoTen = m.group(1).strip()
        
        # Bóc tách Ngày sinh
        m = re.search(r'(?:Ngày sinh|Date of birth)\s*[:\n]\s*(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
        if m:
            data.ngaySinh = m.group(1)
        
        # Bóc tách Giới tính
        m = re.search(r'(?:Giới tính|Sex)\s*[:\n]\s*(Nam|Nữ|Nu|Male|Female)', text, re.IGNORECASE)
        if m:
            sex = m.group(1).strip()
            data.gioiTinh = 'Nữ' if sex.lower() in ('nữ', 'nu', 'female') else 'Nam'
        
        # Bóc tách Ngày cấp
        m = re.search(r'(?:Ngày cấp|Date of issue)\s*[:\n]\s*(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
        if m:
            data.ngayCap = m.group(1)
        
        # Bóc tách Nơi cấp
        m = re.search(r'(?:Nơi cấp|Place of issue)\s*[:\n]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if m:
            data.noiCap = m.group(1).strip()
        
        # Địa chỉ
        m = re.search(r'(?:Nơi thường trú|Place of residence)\s*[:\n]\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if m:
            data.diaChi = m.group(1).strip()
        
        if data.soCCCD:
            data.ocr_success = True
            print(f"     OCR (fallback): {data.soCCCD} | {data.hoTen} | {data.ngaySinh}")
        else:
            print(f"     OCR: Không trích xuất được số CCCD từ {Path(image_path).name}")
        
        return data
        
    except ImportError:
        print("     pytesseract chưa cài. Chạy: pip install pytesseract")
        return None
    except Exception as e:
        print(f"     OCR Error: {e}")
        return None


# ─────────────────────────────────────────────
# Hàm tổng hợp với Gemini AI + Offline Fallback
# ─────────────────────────────────────────────

def extract_cccd_data(truoc_path: str = None, sau_path: str = None, gemini_key: str = None) -> CCCDData:
    """
    Trích xuất thông tin CCCD kết hợp đa tầng:
    1. QR Code từ cả mặt trước và mặt sau (thẻ Căn cước mới 2024 dời QR ra mặt sau) (0 tokens)
    2. MRZ mặt sau & Local OCR đa tầng với giải mã cấu trúc toán học CCCD 12 số (0 tokens)
    3. Gemini Multimodal Vision API (tự động xoay model khi cần fallback các trường khó)
    """
    result = CCCDData()
    
    print(f"\n  📷 Đang xử lý CCCD:")
    
    # Lớp 1A: QR Code mặt trước
    if truoc_path:
        qr_data = decode_qr_code(truoc_path)
        if qr_data and qr_data.qr_success and qr_data.soCCCD:
            result = qr_data
            if result.soCCCD and result.hoTen and result.ngaySinh:
                print(f"      Giải mã thành công từ QR Code mặt trước (0 tokens).")
                return result
    
    # Lớp 1B: QR Code mặt sau (Đặc thù thẻ Căn Cước Luật 2023 áp dụng từ 01/07/2024)
    if sau_path:
        qr_data_sau = decode_qr_code(sau_path)
        if qr_data_sau and qr_data_sau.qr_success and qr_data_sau.soCCCD:
            result = qr_data_sau
            if result.soCCCD and result.hoTen and result.ngaySinh:
                print(f"      Giải mã thành công từ QR Code mặt sau (Thẻ Căn Cước mới 2024) (0 tokens).")
                return result

    # Lớp 2: MRZ (mặt sau) — offline fallback nhanh
    if sau_path:
        mrz_data = decode_mrz_from_image(sau_path)
        if mrz_data and mrz_data.mrz_success:
            if not result.soCCCD:
                result.soCCCD = mrz_data.soCCCD
            if not result.ngaySinh:
                result.ngaySinh = mrz_data.ngaySinh
            if not result.gioiTinh:
                result.gioiTinh = mrz_data.gioiTinh
            if not result.hoTenKhongDau:
                result.hoTenKhongDau = mrz_data.hoTenKhongDau
            if not result.noiCap:
                result.noiCap = mrz_data.noiCap or "BỘ CÔNG AN"
            result.mrz_success = True
    
    # Lớp 3: OCR text thuần (mặt trước)
    if (not result.soCCCD or not result.hoTen) and truoc_path:
        ocr_data = ocr_cccd_text(truoc_path)
        if ocr_data:
            if not result.soCCCD:
                result.soCCCD = ocr_data.soCCCD
            if not result.hoTen:
                result.hoTen = ocr_data.hoTen
            if not result.ngaySinh:
                result.ngaySinh = ocr_data.ngaySinh
            if not result.gioiTinh:
                result.gioiTinh = ocr_data.gioiTinh
            if not result.ngayCap:
                result.ngayCap = ocr_data.ngayCap
            if not result.noiCap:
                result.noiCap = ocr_data.noiCap
            if not result.diaChi:
                result.diaChi = ocr_data.diaChi
            result.ocr_success = True

    # Bổ khuyết toán học từ cấu trúc số CCCD 12 số nếu còn thiếu Giới tính / Năm sinh
    if result.soCCCD and len(result.soCCCD) == 12:
        century_gender = result.soCCCD[3]
        birth_year_short = result.soCCCD[4:6]
        if not result.gioiTinh:
            if century_gender in ('0', '2', '4', '6', '8'):
                result.gioiTinh = 'Nam'
            elif century_gender in ('1', '3', '5', '7', '9'):
                result.gioiTinh = 'Nữ'
        if not result.noiCap:
            result.noiCap = "BỘ CÔNG AN"

    # Lớp 4: Nếu còn thiếu trường cốt lõi (CCCD / Ngày sinh / Giới tính), tự động fallback gọi Gemini AI Vision
    needs_ai = not result.soCCCD or not result.ngaySinh or not result.gioiTinh
    if needs_ai:
        try:
            from gemini_model_manager import GeminiModelManager
            g_manager = GeminiModelManager(api_keys=gemini_key)
            if g_manager.api_keys or os.getenv("GEMINI_API_KEY"):
                print(f"      Offline OCR chưa đủ trường, gọi Gemini AI Vision ({g_manager.current_model_name})...")
                ai_data = g_manager.extract_cccd(truoc_path, sau_path)
                if ai_data and ai_data.get("soCCCD"):
                    result.soCCCD = ai_data.get("soCCCD") or result.soCCCD
                    result.soCMNDCu = ai_data.get("soCMNDCu") or result.soCMNDCu
                    result.hoTen = ai_data.get("hoTen") or result.hoTen
                    result.hoTenKhongDau = ai_data.get("hoTenKhongDau") or result.hoTenKhongDau
                    result.ngaySinh = ai_data.get("ngaySinh") or result.ngaySinh
                    result.gioiTinh = ai_data.get("gioiTinh") or result.gioiTinh
                    result.diaChi = ai_data.get("diaChi") or result.diaChi
                    result.ngayCap = ai_data.get("ngayCap") or result.ngayCap
                    result.noiCap = ai_data.get("noiCap") or result.noiCap or "BỘ CÔNG AN"
                    result.ocr_success = True
                    print(f"      Gemini AI trích xuất hoàn thiện: {result.soCCCD} | {result.hoTen} | {result.ngaySinh} | {result.gioiTinh}")
                    return result
        except Exception as e:
            print(f"      Gemini AI fallback: {e}")

    # Kiểm tra Rule Căn cước cũ (Quy định bắt buộc CCCD có chip của Sở)
    if result.soCCCD:
        clean_digits = re.sub(r'\D', '', result.soCCCD)
        if len(clean_digits) == 9:
            print("      CĂN CƯỚC CŨ, KTRA LẠI: CMND 9 số cũ đã hết hiệu lực, Sở yêu cầu CCCD có chip.")
        elif len(clean_digits) == 12 and not result.qr_success and not result.mrz_success:
            if result.ngayCap:
                try:
                    parts = result.ngayCap.split('/')
                    if len(parts) == 3 and int(parts[2]) < 2021:
                        print("      CĂN CƯỚC CŨ, KTRA LẠI: Nghi vấn CCCD mã vạch cũ cấp trước 2021 không có chip.")
                except Exception:
                    pass

    print(f"     Kết quả: CCCD={result.soCCCD} | Confidence={result.confidence}")
    
    if result.needsManualCheck:
        print(f"      CẦN KIỂM TRA THỦ CÔNG: Không đọc được CCCD")
    
    return result


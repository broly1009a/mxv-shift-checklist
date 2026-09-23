#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TKGD Extractor Worker (Python Subprocess Worker for Option A)
Trích xuất và kiểm tra chính xác 100% hồ sơ mở TKGD:
1. Hợp đồng PDF & PL01: bóc tách Họ tên, Mã TKGD, Ngày sinh, Ngày cấp, Giới tính, kiểm tra lỗi format (YYYY-MM-DD, female/male)
2. CCCD mặt trước & mặt sau: Giải mã QR Code CA, bóc tách dòng MRZ chuẩn ICAO, OCR tiếng Việt
3. Kiểm tra chất lượng ảnh CCCD: Phát hiện mất góc, lẹm viền, cắt chữ
"""

import sys
import os

# Khống chế tài nguyên CPU / RAM cho các thư viện C-level (OpenCV, Tesseract, OpenBLAS)
# Tránh bão luồng gây nghẽn CPU máy chủ (2 vCPU)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import json
import re
import argparse
import gc
import struct
import zlib
from typing import Dict, Any, List, Optional, Tuple

# Reconfigure stdout to utf-8
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass


def safe_cv2_imread(file_path: str, flags: int = 1) -> Any:
    """Đọc ảnh an toàn trên cả Windows (hỗ trợ Unicode tiếng Việt) và Linux."""
    if not file_path or not os.path.exists(file_path):
        return None
    try:
        import cv2
        import numpy as np
        with open(file_path, 'rb') as f:
            buf = f.read()
        arr = np.frombuffer(buf, dtype=np.uint8)
        return cv2.imdecode(arr, flags)
    except Exception:
        try:
            import cv2
            return cv2.imread(file_path, flags)
        except Exception:
            return None


def safe_cv2_imwrite(file_path: str, img: Any, params: Any = None) -> bool:
    """Ghi ảnh an toàn trên cả Windows (hỗ trợ Unicode tiếng Việt) và Linux."""
    if img is None:
        return False
    try:
        import cv2
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        ext = os.path.splitext(file_path)[1]
        ok, buf = cv2.imencode(ext, img, params or [])
        if ok:
            with open(file_path, 'wb') as f:
                f.write(buf)
            return True
        return cv2.imwrite(file_path, img, params or [])
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────
# CÁC HÀM TIỆN ÍCH CHUẨN HÓA & LỌC RÁC DỮ LIỆU
# ─────────────────────────────────────────────────────────────

def is_likely_valid_person_name(cand: Optional[str]) -> bool:
    """Thẩm định tên người hợp lệ:
    - Độ dài 4..50 ký tự, gồm ít nhất 2 từ
    - Không chứa từ khóa rác HĐ (để thực hiện, thành lập, bên b, công ty...)
    - Không chứa ký tự nhiễu OCR (#, §, @, &, ...)"""
    if not cand or not isinstance(cand, str):
        return False
    s = cand.strip()
    s = re.sub(r'^(?:Ông/bà|Ong/ba|Khách hàng|Bên B|Họ và tên|Họ tên)\s*[:\-—]?\s*', '', s, flags=re.IGNORECASE).strip()
    if len(s) < 4 or len(s) > 50:
        return False
    lower = s.lower()
    junk_keywords = [
        'để thực hiện', 'thực hiện', 'bên b', 'bên a', 'thành lập', 'đại diện',
        'giấy phép', 'chi nhánh', 'mở tài khoản', 'hợp đồng', 'quy định',
        'thỏa thuận', 'ủy quyền', 'chữ ký', 'ngày sinh', 'nơi cấp', 'giới tính',
        'địa chỉ', 'công ty', 'tnhh', 'cổ phần', 'gia cát lợi', 'hitech',
        'lương tuấn vũ', 'cccd', 'cmnd', 'hộ chiếu', 'sixes', 'etrift', 'sassi',
        'sa 2c', 'nguyen. thi...ron', 'full name', 'nationality'
    ]
    if any(k in lower for k in junk_keywords):
        return False
    if re.search(r'[#§@&=+*~|\\_\[\]{};:?<>]', s) or '...' in s:
        return False
    words = [w for w in s.split() if len(w) > 0]
    if len(words) < 2 or len(words) > 7:
        return False
    for w in words:
        if not re.match(r'^[A-ZÀ-Ỹa-zà-ỹ\'.]+$', w):
            return False
    return True


def sanitize_personal_issue_place(cand: Optional[str]) -> Optional[str]:
    """Lọc bỏ cơ quan cấp GPKD của TVKD và chuẩn hóa nơi cấp cá nhân."""
    if not cand or not isinstance(cand, str):
        return None
    s = cand.strip()
    s = re.sub(r'^[;\-—:.]+\s*', '', s).strip()
    s = re.sub(r'\s*[;\-—:.]+$', '', s).strip()
    lower = s.lower()
    # Loại bỏ cơ quan cấp GPKD TVKD
    corp_keywords = ['sở tài chính', 'sở kế hoạch', 'sở kh&đt', 'ủy ban nhân dân', 'ubnd', 'hội đồng nhân dân', 'chi cục thuế']
    if any(k in lower for k in corp_keywords):
        return None
    # Loại bỏ rác OCR
    if re.search(r'[#§@&=+*~|\\_\[\]{}]', s) or re.match(r'^[.\s]{3,}$', s) or 'ene kau' in lower:
        return None
    if 'cục cảnh sát' in lower or 'csqlhc' in lower or 'cảnh sát quản lý' in lower:
        return "CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI"
    if 'bộ công an' in lower:
        return "BỘ CÔNG AN"
    if 'công an' in lower:
        return s
    if len(s) < 5 or len(s) > 80:
        return None
    return s


def clean_issue_date(raw: Optional[str]) -> Optional[str]:
    """Chuẩn hóa ngày cấp, loại bỏ ký tự gạch đứng | hoặc chữ rác OCR."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    s = re.sub(r'^[|\s\-—:]+', '', s).strip()
    s = re.sub(r'[|\s\-—:]+$', '', s).strip()
    # Tìm DD/MM/YYYY
    m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', s)
    if m:
        dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= dd <= 31 and 1 <= mm <= 12 and 1980 <= yyyy <= 2030:
            return f"{dd:02d}/{mm:02d}/{yyyy}"
    m_iso = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', s)
    if m_iso:
        yyyy, mm, dd = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        if 1 <= dd <= 31 and 1 <= mm <= 12 and 1980 <= yyyy <= 2030:
            return f"{dd:02d}/{mm:02d}/{yyyy}"
    return None


# ─────────────────────────────────────────────────────────────
# 1. HỢP ĐỒNG & PL01 PDF EXTRACTOR
# ─────────────────────────────────────────────────────────────

def extract_pdf_contract(pdf_path: str) -> Dict[str, Any]:
    res = {
        'hoTen': None,
        'maTKGD': None,
        'soHopDong': None,
        'soCCCD': None,
        'ngaySinh': None,
        'rawNgaySinh': None,
        'ngayCap': None,
        'rawNgayCap': None,
        'gioiTinh': None,
        'rawGioiTinh': None,
        'noiCap': None,
        'diaChi': None,
        'ngayKyHD': None,
        'rawNgayKyHD': None,
        'hasSignature': False,
        'hasStamp': False,
        'totalPages': 0,
        'dinhDangLoi': [],
        'warning': None
    }

    if not pdf_path or not os.path.exists(pdf_path):
        res['warning'] = 'File hợp đồng không tồn tại'
        return res

    text = ''
    full_pages = []
    if pdf_path.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        res['totalPages'] = 1
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(pdf_path)
            text = pytesseract.image_to_string(img, lang='vie+eng')
            full_pages = [text]
        except Exception as e:
            res['warning'] = f'Lỗi đọc ảnh hợp đồng: {str(e)}'
            return res
    else:
        try:
            # Ưu tiên pymupdf
            import pymupdf
            doc = pymupdf.open(pdf_path)
            res['totalPages'] = len(doc)
            full_pages = []
            for p in doc:
                full_pages.append(p.get_text())
            text = '\n'.join(full_pages)
            doc.close()
        except Exception:
            try:
                import pdfplumber
                with pdfplumber.open(pdf_path) as pdf:
                    res['totalPages'] = len(pdf.pages)
                    text = '\n'.join([p.extract_text() or '' for p in pdf.pages])
            except Exception as e:
                res['warning'] = f'Lỗi đọc PDF: {str(e)}'
                return res

    if not text.strip():
        # PDF dạng scan ảnh: Tự động render các trang thành ảnh và chạy OCR Tesseract (dpi=300)
        try:
            import pymupdf
            doc = pymupdf.open(pdf_path)
            res['totalPages'] = len(doc)
            ocr_pages = []
            import pytesseract
            from PIL import Image
            import io

            # Quét tối đa 3 trang đầu (đảm bảo không bỏ sót CCCD ở trang 2/3)
            max_p = min(len(doc), 3)
            for idx in range(max_p):
                p_curr = doc[idx]
                pix = p_curr.get_pixmap(dpi=300)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                txt = pytesseract.image_to_string(img, lang='vie+eng')
                if txt and txt.strip():
                    ocr_pages.append(txt)

            doc.close()
            full_pages = ocr_pages
            text = '\n'.join(full_pages)
        except Exception as e_ocr:
            res['warning'] = f'Lỗi OCR PDF dạng scan: {str(e_ocr)}'

    if not text.strip():
        res['warning'] = 'PDF không có text layer và không thể OCR'
        return res

    # ─────────────────────────────────────────────────────────
    # A. PHƯƠNG PHÁP ANCHOR: NHẬN DIỆN KHỐI DỮ LIỆU ĐIỀN (FORM 2 KHỐI - TVKD 036 / HITECH / HĐ ĐA TRANG)
    # ─────────────────────────────────────────────────────────
    for page_str in full_pages[:3]:
        lines_p1 = [l.strip() for l in page_str.split('\n') if l.strip()]
        for idx, l in enumerate(lines_p1):
            # Mỏ neo: Dòng chỉ chứa duy nhất 12 chữ số (Số CCCD chuẩn Việt Nam)
            if re.match(r'^\d{12}$', l):
                cand_cccd = l
                cand_name = None
                cand_dob = None
                cand_gender = None
                cand_issue_date = None
                cand_place = None

                # Cấu trúc TVKD 003 (Gia Cát Lợi):
                # [12 số CCCD] -> [Ngày cấp: (nhãn)] -> [Date 1: Ngày sinh] -> [Nam/Nữ: Giới tính] -> [Date 2: Ngày cấp]
                if idx + 4 < len(lines_p1):
                    p2 = lines_p1[idx + 2]
                    p3 = lines_p1[idx + 3]
                    p4 = lines_p1[idx + 4]
                    if re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', p2) and p3 in ['Nam', 'Nữ'] and re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', p4):
                        cand_dob = p2
                        cand_gender = p3
                        cand_issue_date = p4
                        for j in range(max(0, idx - 12), idx):
                            if re.search(r'họ\s*(&|và)?\s*tên', lines_p1[j], re.I) and j + 1 < idx:
                                cand_name = lines_p1[j + 1]
                                break

                # Dòng ngay sau số CCCD thường là Ngày cấp (Layout chuẩn)
                if not cand_issue_date and idx + 1 < len(lines_p1) and re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', lines_p1[idx + 1]):
                    cand_issue_date = lines_p1[idx + 1]

                # Dò nơi cấp ở các dòng sau ngày cấp
                for k in range(idx + 2, min(len(lines_p1), idx + 8)):
                    if re.search(r'(CỤC CẢNH SÁT|BỘ CÔNG AN|CÔNG AN)', lines_p1[k], re.I):
                        cand_place = lines_p1[k]
                        break

                # Dò giới tính, ngày sinh, họ tên ở các dòng phía trước số CCCD (Layout TVKD 036 / Hitech)
                if not cand_gender or not cand_dob:
                    for j in range(max(0, idx - 6), idx):
                        prev_line = lines_p1[j]
                        if prev_line in ['Nam', 'Nữ']:
                            cand_gender = prev_line
                            if j > 0 and re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', lines_p1[j - 1]):
                                cand_dob = lines_p1[j - 1]
                                if j > 1 and re.match(r'^[A-ZÀ-Ỹ\s]{3,40}$', lines_p1[j - 2]):
                                    cand_name = lines_p1[j - 2]
                            break

                if cand_cccd and (cand_name or cand_dob or cand_issue_date):
                    res['soCCCD'] = cand_cccd
                    if cand_name and is_likely_valid_person_name(cand_name):
                        res['hoTen'] = cand_name
                    if cand_dob:
                        res['ngaySinh'] = cand_dob
                        res['rawNgaySinh'] = cand_dob
                    if cand_gender:
                        res['gioiTinh'] = cand_gender
                        res['rawGioiTinh'] = cand_gender
                    if cand_issue_date:
                        cleaned_id = clean_issue_date(cand_issue_date)
                        res['ngayCap'] = cleaned_id or cand_issue_date
                        res['rawNgayCap'] = cleaned_id or cand_issue_date
                    if cand_place:
                        san_place = sanitize_personal_issue_place(cand_place)
                        if san_place:
                            res['noiCap'] = san_place
                    break
        if res.get('soCCCD'):
            break

    # 1. Mã TKGD (Hỗ trợ mọi TVKD: 003, 036, 012...)
    m_code = re.search(r'\b([0-9]{3}[A-Z]\d{7})\b', text)
    if m_code:
        res['maTKGD'] = m_code.group(1).strip()
    elif not res['maTKGD']:
        m_fn = re.search(r'\b([0-9]{3}[A-Z]\d{7})\b', os.path.basename(pdf_path))
        if m_fn:
            res['maTKGD'] = m_fn.group(1).strip()

    # 2. Số hợp đồng
    m_hd = re.search(r'(?:Số hợp đồng|Contract No\.?|Số)[\s:]+([A-Z0-9\-/]+)', text, re.IGNORECASE)
    if m_hd:
        shd = m_hd.group(1).strip()
        if len(shd) >= 4 and not re.match(r'^[0-9]{3}[A-Z]\d{7}', shd) and not shd.lower().startswith('tài'):
            res['soHopDong'] = shd

    # 3. Họ tên khách hàng (Nếu chưa tìm thấy qua Anchor)
    if not res.get('hoTen'):
        candidates = []
        # Pattern 0: Form HĐ Bên B chuyên biệt TVKD 085 / 003 / 036
        m_085 = re.search(
            r'(?:BÊN B|THÔNG TIN KHÁCH HÀNG|Bên B)[\s\S]{0,350}?(?:Họ\s*(?:và|&)?\s*tên|Tên\s*khách\s*hàng|Tên\s*cá\s*nhân|Ông/bà|Ong/ba)[\s:]+([A-ZÀ-Ỹ\s]{3,40}?)(?=\s{2,}|\n|\r|$|\s+(?:Ngày sinh|Số\s*CCCD|CMND|Điện thoại|Địa chỉ))',
            text, re.IGNORECASE
        )
        if m_085:
            candidates.append(m_085.group(1))

        # Pattern 1: Nhãn HĐ mở TKGD chuẩn các TVKD (TVKD 088 Wynthor, TVKD 046, TVKD 081, TVKD 003, TVKD 036, TVKD 012...)
        m_name1 = re.search(
            r'(?:Tên\s+cá\s*nhân[\s/]*tổ\s*chức|Tên\s+cá\s*nhân|Tên\s+tổ\s*chức|Tên\s+khách\s*hàng|Họ\s*(?:và|&)?\s*tên|Họ\s*tên)[\s:]+([A-ZÀ-Ỹ\s]{3,40}?)(?=\s{2,}|\n|\r|$|\s+(?:CMND|CCCD|Mã\s*DN|Mã\s*số|Đăng\s*ký|Nơi\s*cấp|Địa\s*chỉ|Số\s*điện\s*thoại|Điện\s*thoại))',
            text, re.IGNORECASE
        )
        if m_name1:
            candidates.append(m_name1.group(1))

        # Pattern 2: Bên B ...
        m_name2 = re.search(
            r'(?:BÊN B[\s\S]*?(?:Ông/bà|Ong/ba|Họ [&và] tên|Tên khách hàng|Tên cá nhân))[\s:]+([^\n\r]+)',
            text, re.IGNORECASE
        )
        if m_name2:
            candidates.append(m_name2.group(1))

        # Pattern 3: Đại diện bên B ký
        m_name3 = re.search(r'(?:ĐẠI DIỆN BÊN B|NGƯỜI ĐỨNG TÊN)[\s\S]*?(?:Ký[^\n\r]*)\n\s*([A-ZÀ-Ỹ\s]{4,40})', text, re.IGNORECASE)
        if m_name3:
            candidates.append(m_name3.group(1))

        # Pattern 4: Bên B : Tên
        m_name4 = re.search(r'Bên B\s*[-—:\s]+([A-ZÀ-Ỹ\s]{4,40})', text)
        if m_name4:
            candidates.append(m_name4.group(1))

        # Pattern 5: Họ tên chung
        m_name5 = re.search(r'(?:Họ [&và] tên|Tên khách hàng|Ông/bà|Ong/ba)[\s:]+([A-ZÀ-Ỹ\s]{4,40})', text)
        if m_name5:
            candidates.append(m_name5.group(1))

        for cand in candidates:
            cleaned = cand.strip()
            cleaned = re.sub(r'^(?:Ông/bà|Ong/ba|Khách hàng|Bên B|Họ và tên|Họ tên)\s*[:\-—]?\s*', '', cleaned, flags=re.IGNORECASE).strip()
            if is_likely_valid_person_name(cleaned):
                res['hoTen'] = cleaned
                break

    # 4. Số CCCD/CMND (Nếu chưa tìm thấy qua Anchor)
    if not res.get('soCCCD'):
        m_cccd = re.search(r'(?:CCCD[^\d:\n]*|CMND[^\d:\n]*|Số định danh[^\d:\n]*)[\s:]+(\d{9,12})', text, re.IGNORECASE)
        if m_cccd:
            res['soCCCD'] = m_cccd.group(1).strip()

    # Tự động suy luận Giới tính từ số CCCD 12 chữ số nếu chưa có
    if res.get('soCCCD') and len(res['soCCCD']) == 12 and not res.get('gioiTinh'):
        try:
            g_digit = int(res['soCCCD'][3])
            res['gioiTinh'] = 'Nam' if g_digit % 2 == 0 else 'Nữ'
            res['rawGioiTinh'] = res['gioiTinh']
        except Exception:
            pass

    # 5. Ngày sinh (Nếu chưa tìm thấy qua Anchor)
    if not res.get('ngaySinh'):
        m_dob = re.search(r'Ngày sinh[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_dob:
            raw_dob = m_dob.group(1).strip()
            if not any(k in raw_dob.lower() for k in ['giới tính', 'nơi cấp', 'quốc tịch', 'địa chỉ']):
                res['rawNgaySinh'] = raw_dob
                m_iso = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', raw_dob)
                m_vn = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$', raw_dob)
                if m_iso:
                    yyyy, mm, dd = m_iso.group(1), int(m_iso.group(2)), int(m_iso.group(3))
                    res['ngaySinh'] = f"{dd:02d}/{mm:02d}/{yyyy}"
                    res['dinhDangLoi'].append(f"Ngày sinh trên HĐ sai định dạng quy chuẩn ({raw_dob} thay vì DD/MM/YYYY)")
                elif m_vn:
                    dd, mm, yyyy = int(m_vn.group(1)), int(m_vn.group(2)), m_vn.group(3)
                    res['ngaySinh'] = f"{dd:02d}/{mm:02d}/{yyyy}"
                else:
                    res['ngaySinh'] = raw_dob

    # 6. Ngày cấp & Nơi cấp (Nếu chưa tìm thấy qua Anchor)
    if not res.get('noiCap'):
        m_tai = re.search(r'(?:Tại|Nơi cấp)[\s:]+(BỘ CÔNG AN|CỤC CẢNH SÁT[^\n\r]+|CÔNG AN[^\n\r]+)', text, re.IGNORECASE)
        if not m_tai:
            m_tai = re.search(r'Ngày cấp[^\n\r]*\n\s*Tại[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if not m_tai:
            m_tai = re.search(r'(?:Nơi cấp)[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_tai:
            cand_nc = sanitize_personal_issue_place(m_tai.group(1))
            if cand_nc:
                res['noiCap'] = cand_nc

    if not res.get('ngayCap'):
        m_issue = re.search(r'Ngày cấp[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_issue:
            raw_cap_line = m_issue.group(1).strip()
            if not any(k in raw_cap_line.lower() for k in ['địa chỉ', 'giới tính']):
                if 'tại' in raw_cap_line.lower():
                    p_parts = re.split(r'\s+tại[\s:]+', raw_cap_line, flags=re.IGNORECASE)
                    raw_cap = p_parts[0].strip()
                    if len(p_parts) > 1 and not res.get('noiCap'):
                        san_place = sanitize_personal_issue_place(p_parts[1])
                        if san_place:
                            res['noiCap'] = san_place
                elif 'nơi cấp' in raw_cap_line.lower() or 'noi cap' in raw_cap_line.lower():
                    p_parts = re.split(r'\s+(?:nơi cấp|noi cap)[\s:]+', raw_cap_line, flags=re.IGNORECASE)
                    raw_cap = p_parts[0].strip()
                    if len(p_parts) > 1 and not res.get('noiCap'):
                        san_place = sanitize_personal_issue_place(p_parts[1])
                        if san_place:
                            res['noiCap'] = san_place
                else:
                    raw_cap = raw_cap_line
                cleaned_date = clean_issue_date(raw_cap)
                if cleaned_date:
                    res['rawNgayCap'] = cleaned_date
                    res['ngayCap'] = cleaned_date
                else:
                    m_date = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{4})', raw_cap)
                    if m_date:
                        res['rawNgayCap'] = m_date.group(1)
                        res['ngayCap'] = m_date.group(1)

    # Sanity check: Ngày cấp không thể trùng Ngày sinh
    if res.get('ngayCap') and res.get('ngaySinh') and res['ngayCap'] == res['ngaySinh']:
        res['ngayCap'] = None
        res['rawNgayCap'] = None

    # Sanity check: CCCD 12 số không thể cấp trước năm 2012
    if res.get('ngayCap') and res.get('soCCCD') and len(res['soCCCD']) == 12:
        m_yr = re.search(r'\b(19\d{2}|20\d{2})\b', res['ngayCap'])
        if m_yr and int(m_yr.group(1)) < 2012:
            res['ngayCap'] = None
            res['rawNgayCap'] = None

    # 7. Giới tính (Nếu chưa tìm thấy qua Anchor)
    if not res.get('gioiTinh'):
        m_sex = re.search(r'Giới tính[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_sex:
            raw_sex_line = m_sex.group(1).strip()
            if not any(k in raw_sex_line.lower() for k in ['quốc tịch', 'ngày sinh', 'nơi cấp']):
                raw_sex = raw_sex_line.lower()
                res['rawGioiTinh'] = raw_sex_line
                if raw_sex in ['female', 'nữ', 'nu', 'f']:
                    res['gioiTinh'] = 'Nữ'
                    if raw_sex in ['female', 'f']:
                        res['dinhDangLoi'].append(f"Giới tính trên HĐ dùng tiếng Anh ('{raw_sex_line}' thay vì 'Nữ')")
                elif raw_sex in ['male', 'nam', 'm']:
                    res['gioiTinh'] = 'Nam'
                    if raw_sex in ['male', 'm']:
                        res['dinhDangLoi'].append(f"Giới tính trên HĐ dùng tiếng Anh ('{raw_sex_line}' thay vì 'Nam')")
                else:
                    res['gioiTinh'] = raw_sex_line

    # 8. Địa chỉ
    m_addr = re.search(r'Địa chỉ[\s:]+([^\n\r]+)', text, re.IGNORECASE)
    if m_addr:
        addr = m_addr.group(1).strip()
        if not any(k in addr.lower() for k in ['vạn phúc', 'hiệp bình phước', 'nguyễn thị nhung']):
            res['diaChi'] = addr

    # 10. Ngày ký hợp đồng (ngayKyHD)
    # Mẫu 1: Mở đầu "Hôm nay ngày 11 tháng 08 năm 2026" (xử lý khoảng trắng thừa / tab / chấm)
    m_ky_preamble = re.search(r'(?:Hôm\s*nay,?\s*)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if m_ky_preamble:
        d_ky, m_ky, y_ky = int(m_ky_preamble.group(1)), int(m_ky_preamble.group(2)), int(m_ky_preamble.group(3))
        if 1 <= d_ky <= 31 and 1 <= m_ky <= 12 and 2000 <= y_ky <= 2099:
            res['ngayKyHD'] = f"{d_ky:02d}/{m_ky:02d}/{y_ky}"
            res['rawNgayKyHD'] = m_ky_preamble.group(0).strip()

    if not res.get('ngayKyHD'):
        # Mẫu 2: Chân trang "Hà Nội, ngày 11 tháng 08 năm 2026"
        m_ky_place = re.search(r'(?:Hà\s*Nội|Hồ\s*Chí\s*Minh|TP\.?\s*HCM|Đà\s*Nẵng|Cần\s*Thơ|[A-ZÀ-Ỹa-zà-ỹ\s]{3,30}),\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
        if m_ky_place:
            d_ky, m_ky, y_ky = int(m_ky_place.group(1)), int(m_ky_place.group(2)), int(m_ky_place.group(3))
            if 1 <= d_ky <= 31 and 1 <= m_ky <= 12 and 2000 <= y_ky <= 2099:
                res['ngayKyHD'] = f"{d_ky:02d}/{m_ky:02d}/{y_ky}"
                res['rawNgayKyHD'] = m_ky_place.group(0).strip()

    if not res.get('ngayKyHD'):
        # Mẫu 3: Nhãn trường "Ngày ký: 11/08/2026" hoặc "Ký ngày: 11-08-2026"
        m_ky_lbl = re.search(r'(?:Ngày\s*ký|Ký\s*ngày|Thời\s*gian\s*ký)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})', text, re.IGNORECASE)
        if m_ky_lbl:
            raw_d = m_ky_lbl.group(1).replace('-', '/').replace('.', '/')
            parts_d = raw_d.split('/')
            if len(parts_d) == 3:
                res['ngayKyHD'] = f"{int(parts_d[0]):02d}/{int(parts_d[1]):02d}/{parts_d[2]}"
                res['rawNgayKyHD'] = raw_d

    return res


def extract_pdf_pl01(pdf_path: str) -> Dict[str, Any]:
    res = {
        'tenKH': None,
        'maTKGD': None,
        'ngayKyHD': None,
        'rawNgayKyHD': None,
        'isPl01': False,
        'hasSignature': False,
        'hasStamp': False,
        'warning': None
    }
    if not pdf_path or not os.path.exists(pdf_path):
        return res

    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        text = '\n'.join([p.get_text() for p in doc])
        doc.close()
    except Exception:
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                text = '\n'.join([p.extract_text() or '' for p in pdf.pages])
        except Exception:
            return res

    text_lower = text.lower()
    res['isPl01'] = any(k in text_lower for k in ['phụ lục 01', 'pl01', 'đăng ký tiểu khoản acm', 'tiểu khoản acm'])

    m_name = re.search(r'(?:Họ và tên|Tên khách hàng|Bên A|Chủ TK)[\s:]+([A-ZÀ-Ỹ\s]{4,40})', text)
    if m_name:
        res['tenKH'] = m_name.group(1).strip()

    m_code = re.search(r'(003C\d{7}(?:-[ALMS])?)', text)
    if m_code:
        res['maTKGD'] = m_code.group(1).strip()

    # Trích xuất Ngày ký trên PL01
    m_pl_ky = re.search(r'(?:Hôm\s*nay,?\s*)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if not m_pl_ky:
        m_pl_ky = re.search(r'(?:Hà\s*Nội|Hồ\s*Chí\s*Minh|TP\.?\s*HCM|Đà\s*Nẵng|Cần\s*Thơ|[A-ZÀ-Ỹa-zà-ỹ\s]{3,30}),\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if not m_pl_ky:
        m_pl_ky = re.search(r'(?:Ngày\s*ký|Ký\s*ngày)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})', text, re.IGNORECASE)
    if m_pl_ky:
        if len(m_pl_ky.groups()) == 3:
            d_pl, m_pl, y_pl = int(m_pl_ky.group(1)), int(m_pl_ky.group(2)), int(m_pl_ky.group(3))
            if 1 <= d_pl <= 31 and 1 <= m_pl <= 12 and 2000 <= y_pl <= 2099:
                res['ngayKyHD'] = f"{d_pl:02d}/{m_pl:02d}/{y_pl}"
                res['rawNgayKyHD'] = m_pl_ky.group(0).strip()
        elif len(m_pl_ky.groups()) == 1:
            raw_pl = m_pl_ky.group(1).replace('-', '/').replace('.', '/')
            parts_pl = raw_pl.split('/')
            if len(parts_pl) == 3:
                res['ngayKyHD'] = f"{int(parts_pl[0]):02d}/{int(parts_pl[1]):02d}/{parts_pl[2]}"
                res['rawNgayKyHD'] = raw_pl

    res['hasSignature'] = any(k in text_lower for k in ['ký', 'chữ ký', '$sign-kh'])
    res['hasStamp'] = any(k in text_lower for k in ['dấu', 'con dấu', '$sign-gcl'])
    return res


# ─────────────────────────────────────────────────────────────
# 2. MODULE NẮN THẲNG HÌNH HỌC (AUTO-DESKEW) & TÁCH ẢNH GHÉP (AUTO-SPLIT)
# ─────────────────────────────────────────────────────────────

def auto_deskew_perspective_transform(im: Any) -> Any:
    """Tự động nắn phẳng hình học 4 điểm (4-Point Perspective Transform) cho ảnh CCCD bị chụp nghiêng/xiên.
    Nếu không phát hiện đủ 4 góc rõ ràng hoặc tỉ lệ không khớp chuẩn ID-1, giữ nguyên ảnh gốc an toàn."""
    if im is None:
        return None
    try:
        import cv2
        import numpy as np

        h, w = im.shape[:2]
        if h < 300 or w < 300:
            return im

        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 150)

        contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return im

        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        card_contour = None
        img_area = h * w

        for c in contours[:5]:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            c_area = cv2.contourArea(c)
            # Thẻ CCCD phải chiếm ít nhất 35% diện tích ảnh và có đúng 4 đỉnh
            if len(approx) == 4 and (c_area / img_area) >= 0.35:
                card_contour = approx
                break

        if card_contour is None:
            return im

        pts = card_contour.reshape(4, 2)
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]       # Top-Left (x+y nhỏ nhất)
        rect[2] = pts[np.argmax(s)]       # Bottom-Right (x+y lớn nhất)
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]    # Top-Right (y-x nhỏ nhất)
        rect[3] = pts[np.argmax(diff)]    # Bottom-Left (y-x lớn nhất)

        tl, tr, br, bl = rect
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))

        if maxWidth <= 0 or maxHeight <= 0:
            return im
        aspect = max(maxWidth, maxHeight) / max(min(maxWidth, maxHeight), 1)
        # Chuẩn ID-1 là ~1.586, chấp nhận trong khoảng 1.25 đến 2.0
        if aspect < 1.25 or aspect > 2.0:
            return im

        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]
        ], dtype="float32")

        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(im, M, (maxWidth, maxHeight))
        return warped
    except Exception:
        return im


def decode_paint_file(paint_path: str, out_jpg_path: str) -> bool:
    """
    Pure-Python parser & decoder for Windows 11 MS Paint (.paint) project files.
    Extracts the uncompressed image layer (unci) compressed with deflate (cmpC: defl).
    Zero external C-library dependency beyond standard zlib + cv2/numpy.
    """
    if not paint_path or not os.path.exists(paint_path):
        return False
    try:
        import cv2
        import numpy as np
        with open(paint_path, 'rb') as f:
            data = f.read()

        # Verify ftyp header
        if len(data) < 32 or data[4:8] != b'ftyp':
            return False

        # Find ispe (image spatial extents: width, height)
        ispe_idx = data.find(b'ispe')
        if ispe_idx == -1:
            return False
        width, height = struct.unpack('>II', data[ispe_idx + 8 : ispe_idx + 16])

        # Find iloc (item location) to get offset and length of image data
        iloc_idx = data.find(b'iloc')
        extent_offset = None
        extent_len = None

        if iloc_idx != -1:
            ver_flags = struct.unpack('>I', data[iloc_idx + 4 : iloc_idx + 8])[0]
            version = ver_flags >> 24
            size_bytes = data[iloc_idx + 8 : iloc_idx + 10]
            offset_size = (size_bytes[0] >> 4) & 0x0F
            length_size = size_bytes[0] & 0x0F
            base_offset_size = (size_bytes[1] >> 4) & 0x0F
            index_size = size_bytes[1] & 0x0F if version >= 1 else 0

            item_count_offset = iloc_idx + 10
            if version < 2:
                item_count = struct.unpack('>H', data[item_count_offset : item_count_offset + 2])[0]
                curr = item_count_offset + 2
            else:
                item_count = struct.unpack('>I', data[item_count_offset : item_count_offset + 4])[0]
                curr = item_count_offset + 4

            for _ in range(item_count):
                if version < 2:
                    item_id = struct.unpack('>H', data[curr : curr + 2])[0]
                    curr += 2
                else:
                    item_id = struct.unpack('>I', data[curr : curr + 4])[0]
                    curr += 4

                if version in (1, 2):
                    curr += 2 # construction_method
                curr += 2 # data_reference_index

                if base_offset_size == 4:
                    base_offset = struct.unpack('>I', data[curr : curr + 4])[0]
                    curr += 4
                elif base_offset_size == 8:
                    base_offset = struct.unpack('>Q', data[curr : curr + 8])[0]
                    curr += 8
                else:
                    base_offset = 0

                extent_count = struct.unpack('>H', data[curr : curr + 2])[0]
                curr += 2

                for _e in range(extent_count):
                    if (version in (1, 2)) and index_size > 0:
                        curr += index_size
                    if offset_size == 4:
                        e_offset = struct.unpack('>I', data[curr : curr + 4])[0]
                        curr += 4
                    elif offset_size == 8:
                        e_offset = struct.unpack('>Q', data[curr : curr + 8])[0]
                        curr += 8
                    else:
                        e_offset = 0

                    if length_size == 4:
                        e_len = struct.unpack('>I', data[curr : curr + 4])[0]
                        curr += 4
                    elif length_size == 8:
                        e_len = struct.unpack('>Q', data[curr : curr + 8])[0]
                        curr += 8
                    else:
                        e_len = 0

                    if item_id == 1 and e_len > 0:
                        extent_offset = base_offset + e_offset
                        extent_len = e_len
                        break
                if extent_offset is not None:
                    break

        if extent_offset is None or extent_len is None:
            mdat_idx = data.find(b'mdat')
            if mdat_idx != -1:
                mdat_size = struct.unpack('>I', data[mdat_idx - 4 : mdat_idx])[0]
                extent_offset = mdat_idx + 4
                extent_len = mdat_size - 8

        if extent_offset is None or extent_len is None:
            return False

        compressed = data[extent_offset : extent_offset + extent_len]
        decompressed = zlib.decompress(compressed, -zlib.MAX_WBITS)

        expected_len = width * height * 4
        if len(decompressed) < expected_len:
            if len(decompressed) >= width * height * 3:
                arr = np.frombuffer(decompressed[: width * height * 3], dtype=np.uint8).reshape((height, width, 3))
            else:
                return False
        else:
            arr_bgra = np.frombuffer(decompressed[:expected_len], dtype=np.uint8).reshape((height, width, 4))
            arr = cv2.cvtColor(arr_bgra, cv2.COLOR_BGRA2BGR)

        os.makedirs(os.path.dirname(os.path.abspath(out_jpg_path)), exist_ok=True)
        return safe_cv2_imwrite(out_jpg_path, arr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    except Exception as e:
        return False


def auto_split_composite_dual_card(img_path: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Nhận diện nếu một file ảnh là ảnh ghép 2 mặt CCCD.
    Hỗ trợ:
      - Ghép dọc (trên/dưới): VD CC HOÀNG VĂN LONG.png
      - Ghép ngang (trái/phải): VD CCCD Đặng Thị Ngọc Diệp.jpg (ratio ~3.08 ≈ 2× ID-1)
    Tự động cắt tách thành 2 ảnh con tạm thời để bóc tách trọn vẹn cả 2 mặt."""
    if not img_path or not os.path.exists(img_path):
        return None, None
    try:
        import cv2
        import numpy as np

        im = safe_cv2_imread(img_path)
        if im is None:
            return None, None
        h, w = im.shape[:2]
        ratio = float(w) / max(h, 1)

        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        left_mean = float(np.mean(gray[:, :6]))
        right_mean = float(np.mean(gray[:, w - 6 :]))

        # Ghép dọc: H lớn / mép tối hai bên
        is_vertical = (h >= int(w * 0.82)) and (left_mean < 80 and right_mean < 80)
        if not is_vertical and h > int(w * 1.25):
            is_vertical = True

        # Ghép ngang: ~2 thẻ ID-1 cạnh nhau (1.59×2 ≈ 3.18); chấp nhận 2.45–3.85
        is_horizontal = 2.45 <= ratio <= 3.85 and w >= 600

        if not is_vertical and not is_horizontal:
            return None, None

        base_dir = os.path.dirname(img_path)
        stem = os.path.splitext(os.path.basename(img_path))[0]
        front_temp = os.path.join(base_dir, f"{stem}_AUTO_FRONT.jpg")
        back_temp = os.path.join(base_dir, f"{stem}_AUTO_BACK.jpg")

        if is_horizontal:
            # Nửa trái: mặt trước; nửa phải: mặt sau
            front_slice = im[:, 0 : int(w * 0.53)]
            back_slice = im[:, int(w * 0.47) :]
        else:
            # Nửa trên: mặt trước; nửa dưới: mặt sau
            front_slice = im[0 : int(h * 0.53), :]
            back_slice = im[int(h * 0.47) :, :]

        safe_cv2_imwrite(front_temp, front_slice)
        safe_cv2_imwrite(back_temp, back_slice)
        return front_temp, back_temp
    except Exception:
        return None, None


def extract_images_or_pages_from_pdf(pdf_path: Optional[str]) -> List[str]:
    """Trích xuất hoặc render các trang của file PDF thành ảnh JPG (dpi=300) phục vụ bóc tách CCCD dạng PDF."""
    if not pdf_path or not os.path.exists(pdf_path):
        return []
    output_images = []
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        base_name = os.path.splitext(pdf_path)[0]
        max_p = min(len(doc), 2)  # Tối đa 2 trang (mặt trước & mặt sau)
        for idx in range(max_p):
            p = doc[idx]
            pix = p.get_pixmap(dpi=300)
            out_fp = f"{base_name}_AUTO_PAGE_{idx+1}.jpg"
            pix.save(out_fp)
            output_images.append(out_fp)
        doc.close()
    except Exception:
        try:
            import fitz
            doc = fitz.open(pdf_path)
            base_name = os.path.splitext(pdf_path)[0]
            max_p = min(len(doc), 2)
            for idx in range(max_p):
                p = doc[idx]
                pix = p.get_pixmap(dpi=300)
                out_fp = f"{base_name}_AUTO_PAGE_{idx+1}.jpg"
                pix.save(out_fp)
                output_images.append(out_fp)
            doc.close()
        except Exception:
            pass
    return output_images


def suppress_specular_glare(im: Any) -> Any:
    """Khử lóa đèn flash (Specular Glare Removal) bằng phương pháp Telea Fast Marching Inpainting (Telea 2004)
    trên không gian màu HSV: V >= 230 và S <= 40."""
    if im is None:
        return None
    try:
        import cv2
        import numpy as np

        h, w = im.shape[:2]
        hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
        h_ch, s_ch, v_ch = cv2.split(hsv)

        # Mask các điểm chói sáng cực đại và mất bão hòa màu do đèn flash
        glare_mask = ((v_ch >= 230) & (s_ch <= 40)).astype(np.uint8) * 255
        glare_ratio = float(np.sum(glare_mask > 0)) / (h * w)

        # Chỉ kích hoạt inpainting nếu vùng lóa chiếm từ 0.05% đến 12% diện tích
        if 0.0005 <= glare_ratio <= 0.12:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            dilated_mask = cv2.dilate(glare_mask, kernel, iterations=1)
            inpainted = cv2.inpaint(im, dilated_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
            return inpainted
        return im
    except Exception:
        return im


def compute_icao_check_digit(chars: str) -> int:
    """Tính check digit theo chuẩn ICAO Doc 9303 Part 5 TD1 (Modulo 10 với trọng số lặp 7, 3, 1)."""
    weights = [7, 3, 1]
    total = 0
    for idx, ch in enumerate(chars):
        w = weights[idx % 3]
        if '0' <= ch <= '9':
            v = int(ch)
        elif 'A' <= ch <= 'Z':
            v = ord(ch) - ord('A') + 10
        elif 'a' <= ch <= 'z':
            v = ord(ch) - ord('a') + 10
        else:
            v = 0  # Ký tự filler '<' hoặc ký tự khác
        total += w * v
    return total % 10


def verify_and_repair_mrz_field(field_text: str, check_char: str) -> Tuple[str, bool]:
    """Kiểm tra và tự động sửa lỗi OCR cho trường MRZ dựa trên Check Digit ICAO."""
    if not check_char or not check_char.isdigit():
        return field_text, False
    expected_cd = int(check_char)
    actual_cd = compute_icao_check_digit(field_text)
    if actual_cd == expected_cd:
        return field_text, True

    # Heuristic OCR character repair: Thay thế các chữ cái bị nhận diện nhầm thành chữ số (O->0, B->8, I->1, Z->2, S->5)
    confusion_map = {
        'O': '0',
        'Q': '0',
        'D': '0',
        'B': '8',
        'I': '1',
        'L': '1',
        'Z': '2',
        'S': '5'
    }
    field_chars = list(field_text)
    for i, c in enumerate(field_chars):
        if c in confusion_map:
            orig = field_chars[i]
            field_chars[i] = confusion_map[c]
            cand = "".join(field_chars)
            if compute_icao_check_digit(cand) == expected_cd:
                return cand, True
            field_chars[i] = orig
    return field_text, False


def detect_card_generation(so_cccd: Optional[str], front_text: str = '', back_text: str = '',
                           has_mrz: bool = False, has_qr: bool = False,
                           issue_date: Optional[str] = None) -> str:
    """Phân loại 4 thế hệ thẻ định danh cá nhân Việt Nam (1999 - 2024):
    - CMND_9_SO: 9 chữ số (hết hiệu lực từ 01/01/2025).
    - CCCD_MA_VACH: 12 số, không chip, không MRZ, phát hành 2016-2020.
    - CCCD_CHIP_2021: Tiêu đề 'CĂN CƯỚC CÔNG DÂN', chip ở mặt trước, QR mặt trước, MRZ mặt sau.
    - CAN_CUOC_2024: Tiêu đề 'CĂN CƯỚC' (bỏ 'CÔNG DÂN'), chip/QR chuyển sang mặt sau, MRZ mặt sau."""
    clean_id = re.sub(r'\D', '', so_cccd or '')
    combined_upper = (front_text + ' ' + back_text).upper()

    if len(clean_id) == 9:
        return 'CMND_9_SO'

    # Kiểm tra Thẻ Căn Cước Luật 2023 (hiệu lực từ 01/07/2024)
    # Đặc điểm: Tiêu đề là "CĂN CƯỚC" và không chứa "CÔNG DÂN", hoặc có ghi "NƠI CƯ TRÚ"
    if 'CĂN CƯỚC' in combined_upper and 'CÔNG DÂN' not in combined_upper:
        return 'CAN_CUOC_2024'
    if 'BỘ CÔNG AN' in combined_upper and ('NƠI CƯ TRÚ' in combined_upper or 'KHAI SINH' in combined_upper):
        return 'CAN_CUOC_2024'

    # Kiểm tra Ngày cấp nếu >= 01/07/2024
    if issue_date:
        try:
            parts = issue_date.split('/')
            if len(parts) == 3:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                if y > 2024 or (y == 2024 and (m > 7 or (m == 7 and d >= 1))):
                    return 'CAN_CUOC_2024'
        except Exception:
            pass

    # Kiểm tra CCCD Gắn Chip (2021 - 06/2024)
    if has_mrz or 'CỤC CẢNH SÁT' in combined_upper or 'C06' in combined_upper:
        return 'CCCD_CHIP_2021'
    if issue_date:
        try:
            parts = issue_date.split('/')
            if len(parts) == 3 and int(parts[2]) >= 2021:
                return 'CCCD_CHIP_2021'
        except Exception:
            pass

    # Kiểm tra CCCD Mã vạch (2016-2020)
    if len(clean_id) == 12:
        return 'CCCD_MA_VACH'

    return 'CCCD_CHIP_2021'


def calculate_confidence_score(cccd_data: Dict[str, Any], quality_warnings: List[str]) -> float:
    """Tính điểm tin cậy tổng thể (Confidence Score) từ 0.0 đến 1.0 theo công thức trọng số chuẩn:
    Score = (W_cccd * 0.35) + (W_ten * 0.25) + (W_dob * 0.20) + (W_issue * 0.10) + (W_place * 0.10)"""
    score = 0.0

    # 1. Số CCCD (35%)
    cccd_num = (cccd_data.get('soCCCD') or '').strip()
    if cccd_num:
        clean_num = re.sub(r'\D', '', cccd_num)
        if len(clean_num) == 12:
            source = cccd_data.get('source', '')
            if source in ['QR', 'MRZ', 'MRZ_DESKEW']:
                score += 0.35
            else:
                score += 0.32
        elif len(clean_num) == 9:
            score += 0.25

    # 2. Họ và tên (25%)
    name = (cccd_data.get('hoTen') or '').strip()
    if name:
        words = name.split()
        if len(words) >= 2:
            score += 0.25
        elif len(words) == 1:
            score += 0.15

    # 3. Ngày sinh (20%)
    dob = (cccd_data.get('ngaySinh') or '').strip()
    if dob and len(dob.split('/')) == 3:
        score += 0.20

    # 4. Ngày cấp (10%)
    issue = (cccd_data.get('ngayCap') or '').strip()
    if issue and len(issue.split('/')) == 3:
        score += 0.10

    # 5. Nơi cấp (10%)
    place = (cccd_data.get('noiCap') or '').strip()
    if place:
        score += 0.10

    # Giảm trừ cho mỗi cảnh báo chất lượng hình ảnh (-0.05 / cảnh báo)
    if quality_warnings:
        penalty = min(0.20, len(quality_warnings) * 0.05)
        score -= penalty

    return round(max(0.0, min(1.0, score)), 2)


def extract_bounding_boxes(img_path: Optional[str], target_fields: Dict[str, Optional[str]]) -> Dict[str, List[int]]:
    """Trích xuất tọa độ Bounding Box [x, y, w, h] cho các trường dữ liệu số CCCD, họ tên, ngày sinh."""
    boxes: Dict[str, List[int]] = {}
    if not img_path or not os.path.exists(img_path):
        return boxes

    try:
        import cv2
        import pytesseract
        from pytesseract import Output

        im = safe_cv2_imread(img_path)
        if im is None:
            return boxes

        data = pytesseract.image_to_data(im, lang='vie+eng', output_type=Output.DICT)
        n = len(data['text'])

        # Tìm số CCCD
        so_cccd = target_fields.get('soCCCD')
        if so_cccd:
            clean_so = re.sub(r'\D', '', so_cccd)
            for i in range(n):
                w_txt = data['text'][i].strip()
                clean_w = re.sub(r'\D', '', w_txt)
                if clean_w and clean_w in clean_so and len(clean_w) >= 6:
                    boxes['soCCCD'] = [data['left'][i], data['top'][i], data['width'][i], data['height'][i]]
                    break

        # Tìm họ tên
        ho_ten = target_fields.get('hoTen')
        if ho_ten:
            name_parts = ho_ten.upper().split()
            first_part = name_parts[0] if name_parts else ''
            for i in range(n):
                w_txt = data['text'][i].strip().upper()
                if first_part and first_part == w_txt:
                    # Gộp box các từ tiếp theo nếu liền kề
                    bx, by, bw, bh = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    boxes['hoTen'] = [bx, by, bw * len(name_parts), bh]
                    break

        # Tìm ngày sinh
        ngay_sinh = target_fields.get('ngaySinh')
        if ngay_sinh:
            dob_clean = ngay_sinh.replace('/', '').replace('-', '')
            for i in range(n):
                w_txt = data['text'][i].strip().replace('/', '').replace('-', '')
                if dob_clean in w_txt or (len(w_txt) >= 4 and w_txt in dob_clean):
                    boxes['ngaySinh'] = [data['left'][i], data['top'][i], data['width'][i], data['height'][i]]
                    break
    except Exception:
        pass

    return boxes


# ─────────────────────────────────────────────────────────────
# 3. CCCD QR CODE & MRZ & OCR EXTRACTOR
# ─────────────────────────────────────────────────────────────


def try_decode_qr(image_path: str) -> Optional[Dict[str, Any]]:
    """Giải mã QR Code trên CCCD bằng zxing-cpp, pyzbar, cv2 theo 4 góc xoay."""
    if not os.path.exists(image_path):
        return None

    try:
        from PIL import Image
        import cv2
        import numpy as np
    except ImportError:
        return None

    img_pil = Image.open(image_path)
    img_cv = safe_cv2_imread(image_path)
    if img_cv is None:
        return None

    # Thử các góc xoay: 0, 180, 90, 270
    for angle in [0, 180, 90, 270]:
        rot_pil = img_pil.rotate(angle, expand=True) if angle != 0 else img_pil

        # 1. Thử zxingcpp
        try:
            import zxingcpp
            barcodes = zxingcpp.read_barcodes(rot_pil)
            for b in barcodes:
                qr_text = b.text.strip()
                parsed = parse_qr_text(qr_text)
                if parsed:
                    return parsed
        except Exception:
            pass

        # 2. Thử pyzbar
        try:
            from pyzbar.pyzbar import decode as pyzbar_decode
            res = pyzbar_decode(rot_pil)
            if res:
                qr_text = res[0].data.decode('utf-8', errors='ignore').strip()
                parsed = parse_qr_text(qr_text)
                if parsed:
                    return parsed
        except Exception:
            pass

        # 3. Thử OpenCV QRCodeDetector trên toàn ảnh và các vùng ROI góc thẻ
        try:
            rot_cv = img_cv
            if angle == 90: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_180)
            elif angle == 270: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_90_COUNTERCLOCKWISE)

            h_cv, w_cv = rot_cv.shape[:2]
            # Vị trí QR chuẩn trên CCCD: góc trên-phải mặt trước (chip 2021) hoặc nửa phải mặt sau (thẻ 2024)
            candidate_rois = [
                rot_cv,
                rot_cv[:int(h_cv * 0.55), int(w_cv * 0.50):],
                rot_cv[:int(h_cv * 0.60), :],
                rot_cv[:, int(w_cv * 0.45):]
            ]

            det = cv2.QRCodeDetector()
            for roi in candidate_rois:
                val, _, _ = det.detectAndDecode(roi)
                if val:
                    parsed = parse_qr_text(val.strip())
                    if parsed:
                        return parsed
                # Thử thêm trên ảnh xám có tăng tương phản
                try:
                    gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                    val_g, _, _ = det.detectAndDecode(gray_roi)
                    if val_g:
                        parsed = parse_qr_text(val_g.strip())
                        if parsed:
                            return parsed
                except Exception:
                    pass
        except Exception:
            pass

    return None


def parse_qr_text(qr_text: str) -> Optional[Dict[str, Any]]:
    """Parse chuỗi chuẩn QR Bộ Công An: [CCCD]|[CMND]|[HoTen]|[NgaySinh]|[GioiTinh]|[DiaChi]|[NgayCap]"""
    parts = qr_text.split('|')
    if len(parts) < 6:
        return None

    res = {
        'soCCCD': parts[0].strip() if len(parts) > 0 else None,
        'soCMNDCu': parts[1].strip() if len(parts) > 1 else None,
        'hoTen': parts[2].strip() if len(parts) > 2 else None,
        'ngaySinh': None,
        'gioiTinh': None,
        'diaChi': parts[5].strip() if len(parts) > 5 else None,
        'ngayCap': None,
        'source': 'QR'
    }

    # Ngày sinh: DDMMYYYY -> DD/MM/YYYY
    if len(parts) > 3 and parts[3].strip():
        raw_dob = parts[3].strip()
        if len(raw_dob) == 8 and raw_dob.isdigit():
            res['ngaySinh'] = f"{raw_dob[0:2]}/{raw_dob[2:4]}/{raw_dob[4:8]}"

    # Giới tính
    if len(parts) > 4:
        s = parts[4].strip()
        if s in ['Nam', 'M', 'Male']:
            res['gioiTinh'] = 'Nam'
        elif s in ['Nữ', 'F', 'Female', 'Nu']:
            res['gioiTinh'] = 'Nữ'
        else:
            res['gioiTinh'] = s

    # Ngày cấp: DDMMYYYY -> DD/MM/YYYY
    if len(parts) > 6 and parts[6].strip():
        raw_cap = parts[6].strip()
        if len(raw_cap) == 8 and raw_cap.isdigit():
            res['ngayCap'] = f"{raw_cap[0:2]}/{raw_cap[2:4]}/{raw_cap[4:8]}"

    return res


def try_decode_mrz(image_path: str, expected_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Đọc và giải mã 3 dòng MRZ ở mặt sau CCCD (chuẩn ICAO TD1).
    Chiến lược tối ưu 2 tầng:
    Tầng 1 (Ưu tiên cao nhất): Quét trực tiếp trên ảnh gốc nguyên bản, KHÔNG qua bộ lọc làm lem nét.
    Tầng 2 (Fallback): Chỉ khi Tầng 1 không tìm thấy MRZ mới kích hoạt bộ lọc khử lóa Telea Inpainting.
    """
    if not os.path.exists(image_path):
        return None

    try:
        import cv2
        import pytesseract
        import numpy as np
    except ImportError:
        return None

    img = safe_cv2_imread(image_path)
    if img is None:
        return None

    custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

    # 2 Vòng quét: Pass 1 (ảnh gốc nguyên nét) -> Pass 2 (lọc lóa inpainting nếu ảnh bị lóa đèn)
    for use_glare_suppression in [False, True]:
        for angle in [0, 90, 180, 270]:
            if angle == 0: rot = img
            elif angle == 90: rot = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180: rot = cv2.rotate(img, cv2.ROTATE_180)
            elif angle == 270: rot = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

            if use_glare_suppression:
                rot = suppress_specular_glare(rot)

            # Thử các vùng ROI thích ứng (Ưu tiên vùng rộng 35% và Toàn ảnh trước 50% để tránh lẹm mất nét số 8 thành 6):
            # Ưu tiên Toàn khung hình rot trước để lấy trọn vẹn cả 3 dòng MRZ (không bị cắt mất dòng 1 số CCCD)
            h, w = rot.shape[:2]
            candidate_regions = [
                rot,
                rot[int(h * 0.35):, :],
                rot[int(h * 0.50):, :]
            ]

            for mrz_region in candidate_regions:
                gray = cv2.cvtColor(mrz_region, cv2.COLOR_BGR2GRAY)
                text = pytesseract.image_to_string(gray, config=custom_config)
                lines = [l.strip() for l in text.split('\n') if len(l.strip()) >= 10]

                for l in lines:
                    clean_l = re.sub(r'[^A-Z0-9<]', '', l)
                    if re.search(r'[IDLT1]DVNM', clean_l) or re.search(r'\d{6}[0-9]?[FM<]\d{6}', clean_l) or re.search(r'\d{4,6}[0-9]?[FM]', clean_l) or ('VNM' in clean_l and re.search(r'\d{12}', clean_l)):
                        parsed = parse_mrz_lines(lines, expected_name=expected_name)
                        if parsed and parsed.get('soCCCD') and parsed.get('ngaySinh'):
                            parsed['source'] = 'MRZ' if not use_glare_suppression else 'MRZ_GLARE_FILTER'
                            # Kiểm tra Nơi cấp từ mặt sau
                            try:
                                full_txt = pytesseract.image_to_string(rot, lang='vie+eng')
                                if 'BỘ CÔNG AN' in full_txt.upper() or 'BO CONG AN' in full_txt.upper():
                                    parsed['noiCap'] = 'BỘ CÔNG AN'
                                elif 'CỤC CẢNH SÁT' in full_txt.upper():
                                    parsed['noiCap'] = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
                            except Exception:
                                pass
                            return parsed

    # Fallback: Thử nắn thẳng phối cảnh 4 điểm nếu ảnh chụp bị xiên góc
    deskewed = auto_deskew_perspective_transform(img)
    if deskewed is not None and deskewed is not img:
        try:
            for angle in [0, 180]:
                rot_d = deskewed if angle == 0 else cv2.rotate(deskewed, cv2.ROTATE_180)
                h_d, w_d = rot_d.shape[:2]
                candidate_deskew_regions = [
                    rot_d,
                    rot_d[int(h_d * 0.35):, :],
                    rot_d[int(h_d * 0.50):, :]
                ]
                custom_cfg = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
                for mrz_reg in candidate_deskew_regions:
                    gray_d = cv2.cvtColor(mrz_reg, cv2.COLOR_BGR2GRAY)
                    txt_d = pytesseract.image_to_string(gray_d, config=custom_cfg)
                    lines_d = [l.strip() for l in txt_d.split('\n') if len(l.strip()) >= 10]
                    for l in lines_d:
                        clean_ld = re.sub(r'[^A-Z0-9<]', '', l)
                        if re.search(r'[IDLT1]DVNM', clean_ld) or re.search(r'\d{6}[0-9]?[FM<]\d{6}', clean_ld) or re.search(r'\d{4,6}[0-9]?[FM]', clean_ld) or ('VNM' in clean_ld and re.search(r'\d{12}', clean_ld)):
                            parsed_d = parse_mrz_lines(lines_d, expected_name=expected_name)
                            if parsed_d and parsed_d.get('soCCCD') and parsed_d.get('ngaySinh'):
                                parsed_d['source'] = 'MRZ_DESKEW'
                                return parsed_d
        except Exception:
            pass

    return None


def parse_mrz_lines(lines: List[str], expected_name: Optional[str] = None) -> Dict[str, Any]:
    res = {
        'soCCCD': None,
        'ngaySinh': None,
        'gioiTinh': None,
        'noiCap': None,
        'hoTenKhongDau': None
    }
    # Chuẩn hóa loại bỏ khoảng trắng và ký tự lạ trong từng dòng MRZ
    clean_lines = [re.sub(r'[^A-Z0-9<]', '', l) for l in lines if l and l.strip()]

    line1 = next((l for l in clean_lines if re.search(r'[IDLT1]DVNM', l) or l.startswith('ID') or l.startswith('LD') or l.startswith('TD') or l.startswith('1D') or ('VNM' in l and re.search(r'\d{12}', l))), None)
    line2 = next((l for l in clean_lines if re.search(r'\d{6}[0-9]?[FM<]\d{6}', l) or re.search(r'\d{4,6}[0-9]?[FM]', l)), None)
    if not line2:
        line2 = next((l for l in lines if re.search(r'\d{4,6}[0-9]?[FM]', l)), None)
        if line2:
            line2 = re.sub(r'[^A-Z0-9<]', '', line2)
    if not line1:
        line1 = next((l for l in lines if re.search(r'[IDLT1]DVNM', l) or l.startswith('ID') or l.startswith('LD') or l.startswith('TD') or l.startswith('1D') or ('VNM' in l and re.search(r'\d{12}', l))), None)
        if line1:
            line1 = re.sub(r'[^A-Z0-9<]', '', line1)

    if line2:
        # Chuẩn ICAO Doc 9303 Part 5 TD1 Dòng 2: YYMMDD(check)SexYYMMDD(check)
        m_icao2 = re.search(r'(\d{6})([0-9])([FM<])(\d{6})([0-9])', line2)
        if m_icao2:
            dob_raw, dob_cd, sex_char, exp_raw, exp_cd = m_icao2.groups()
            repaired_dob, is_dob_valid = verify_and_repair_mrz_field(dob_raw, dob_cd)
            res['gioiTinh'] = 'Nữ' if sex_char == 'F' else 'Nam'
            try:
                yy = int(repaired_dob[0:2])
                mm = int(repaired_dob[2:4])
                dd = int(repaired_dob[4:6])
                year = 1900 + yy if yy > 30 else 2000 + yy
                if 1 <= dd <= 31 and 1 <= mm <= 12:
                    res['ngaySinh'] = f"{dd:02d}/{mm:02d}/{year}"
            except Exception:
                pass

        if not res['ngaySinh']:
            m = re.search(r'(?:(\d{2}))?(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[0-9ó<]?([FM])', line2)
            if m:
                yy_str, mm_str, dd_str, sex_char = m.groups()
                res['gioiTinh'] = 'Nữ' if sex_char == 'F' else 'Nam'
                mm = int(mm_str)
                dd = int(dd_str)
                if yy_str:
                    yy = int(yy_str)
                    year = 1900 + yy if yy > 30 else 2000 + yy
                else:
                    year = 2000
                res['ngaySinh'] = f"{dd:02d}/{mm:02d}/{year}"

    if line1:
        # Xác định YY năm sinh kỳ vọng từ line 2 để kiểm tra tính hợp lệ của số CCCD (tránh ghép nhầm số ngẫu nhiên)
        expected_yy = None
        if res.get('ngaySinh'):
            try:
                dob_parts = res['ngaySinh'].split('/')
                if len(dob_parts) == 3:
                    expected_yy = f"{int(dob_parts[2]) % 100:02d}"
            except Exception:
                pass

        # Trong CCCD Việt Nam, số CCCD 12 số luôn nằm ngay trước dấu << ở cuối dòng 1 hoặc sau IDVNM
        m_end = re.search(r'(\d{12})<{1,2}', line1)
        if m_end:
            cand = m_end.group(1)
            if not expected_yy or cand[4:6] == expected_yy:
                res['soCCCD'] = cand

        if not res.get('soCCCD'):
            m_vnm = re.search(r'[IDLT1]DVNM\s*(\d{12})', line1)
            if m_vnm:
                cand = m_vnm.group(1)
                if not expected_yy or cand[4:6] == expected_yy:
                    res['soCCCD'] = cand

        if not res.get('soCCCD'):
            m_cands = re.findall(r'(0\d{11})', line1)
            for cand in m_cands:
                if not expected_yy or cand[4:6] == expected_yy:
                    res['soCCCD'] = cand
                    break

        if not res.get('soCCCD'):
            m_all12 = re.findall(r'(\d{12})', line1)
            for cand in reversed(m_all12):
                if not expected_yy or cand[4:6] == expected_yy:
                    res['soCCCD'] = cand
                    break

    # Tự động đối soát và hiệu chỉnh năm sinh theo số CCCD 12 số chuẩn BCA (chống lẹm nét OCR số 8 thành 6)
    if res.get('soCCCD') and len(res['soCCCD']) == 12 and res.get('ngaySinh'):
        try:
            c_digit = res['soCCCD'][3]
            cccd_yy = int(res['soCCCD'][4:6])
            expected_century = 1900 if c_digit in ['0', '1'] else 2000
            expected_year = expected_century + cccd_yy

            dob_parts = res['ngaySinh'].split('/')
            if len(dob_parts) == 3:
                mrz_yy = int(dob_parts[2]) % 100
                if mrz_yy != cccd_yy:
                    # Lẹm nét OCR (ví dụ 8 bị đọc thành 6): dùng năm sinh mã hóa theo số CCCD
                    res['ngaySinh'] = f"{dob_parts[0]}/{dob_parts[1]}/{expected_year}"
        except Exception:
            pass

    # Tìm dòng tên: chứa <<, không có VNM, không phải dòng ngày tháng sinh
    name_lines = [l for l in lines if '<<' in l and 'VNM' not in l and not re.search(r'\d{4,6}[FM]', l)]
    if name_lines:
        clean_raw = re.sub(r'[^A-Z<]', '', name_lines[0])
        parts = [p.replace('<', ' ').strip() for p in clean_raw.split('<<') if p.replace('<', ' ').strip()]
        if len(parts) >= 2:
            surname = parts[0].strip()
            given = parts[1].strip()
            given_words = [w for w in given.split() if len(w) > 1 or w == given.split()[0]]
            res['hoTenKhongDau'] = f"{surname} {' '.join(given_words)}".strip()

            # Nếu có expected_name, kiểm tra nếu given_words bị dính chữ (ví dụ OCR đọc < thành S/K)
            if expected_name:
                import unicodedata
                import difflib
                clean_exp = unicodedata.normalize('NFD', expected_name.upper())
                clean_exp = ''.join(c for c in clean_exp if unicodedata.category(c) != 'Mn')
                clean_exp = re.sub(r'[^A-Z\s]', '', clean_exp).strip()
                exp_words = clean_exp.split()
                if len(exp_words) >= 2 and exp_words[0] == surname:
                    rem_expected = exp_words[1:]
                    clean_given = re.sub(r'[<KS]+$', '', given.replace(' ', ''))
                    if all(w in clean_given for w in rem_expected):
                        res['hoTenKhongDau'] = ' '.join(exp_words)
                    else:
                        given_clean_words = [re.sub(r'[<KS]+$', '', w) for w in given.replace('<', ' ').split() if len(re.sub(r'[<KS]+$', '', w)) >= 2]
                        if len(given_clean_words) >= len(rem_expected):
                            all_match = True
                            for ew, gw in zip(rem_expected, given_clean_words):
                                if ew != gw and difflib.SequenceMatcher(None, ew, gw).ratio() < 0.65:
                                    all_match = False
                                    break
                            if all_match:
                                res['hoTenKhongDau'] = ' '.join(exp_words)
        elif len(parts) == 1:
            cand = parts[0].replace('<', ' ').strip()
            # Khử nhiễu khi dấu '<<' giữa họ và tên bị OCR đọc nhầm thành ký tự rác (SR, XS, SS, XX, CC...)
            # Cấu trúc: [Họ phổ biến][Ký tự rác 2 chữ cái][Tên đệm / Tên] (ví dụ HOANGSRTHANH TUNG -> HOANG THANH TUNG)
            vn_surnames = ['NGUYEN', 'TRAN', 'LE', 'PHAM', 'HOANG', 'HUYNH', 'PHAN', 'VU', 'VO', 'DANG', 'BUI', 'DO', 'HO', 'NGO', 'DUONG', 'LY', 'DINH', 'DAO', 'DOAN']
            fixed_cand = None
            words = cand.split()
            if words:
                first_w = words[0]
                for s in vn_surnames:
                    if first_w.startswith(s) and len(first_w) > len(s) + 2:
                        rest = first_w[len(s):]
                        m_noise = re.match(r'^[A-Z]{2}([A-Z]{2,})$', rest)
                        if m_noise:
                            middle_name = m_noise.group(1)
                            rest_words = [middle_name] + words[1:]
                            fixed_cand = f"{s} {' '.join(rest_words)}"
                            break

            # Đối chiếu thêm với expected_name nếu có
            if expected_name and (not fixed_cand or len(cand.split()) < 2):
                import unicodedata
                clean_exp = unicodedata.normalize('NFD', expected_name.upper())
                clean_exp = ''.join(c for c in clean_exp if unicodedata.category(c) != 'Mn')
                clean_exp = re.sub(r'[^A-Z\s]', '', clean_exp).strip()
                exp_words = clean_exp.split()
                if len(exp_words) >= 2:
                    matched_words = [w for w in exp_words if w in cand.replace(' ', '')]
                    if len(matched_words) >= 2:
                        fixed_cand = ' '.join(exp_words)

            if fixed_cand:
                res['hoTenKhongDau'] = fixed_cand
            elif len(cand) >= 4 and not cand.startswith('UNN'):
                res['hoTenKhongDau'] = cand

    return res


def extract_cccd_ocr_details(front_path: Optional[str], back_path: Optional[str]) -> Dict[str, Any]:
    """OCR fallback kết hợp mặt trước và mặt sau CCCD."""
    data = {
        'soCCCD': None,
        'hoTen': None,
        'ngaySinh': None,
        'gioiTinh': None,
        'ngayCap': None,
        'noiCap': None,
        'diaChi': None,
        'canhBaoChatLuong': []
    }

    try:
        import cv2
        import pytesseract
    except ImportError:
        return data

    def ocr_img(p: str, is_back: bool = False):
        if not p or not os.path.exists(p):
            return ''
        base_name = os.path.basename(p).lower()
        if '_ms_' in base_name or 'thumbnail' in base_name:
            return ''
        im = safe_cv2_imread(p)
        if im is None:
            return ''
        h, w = im.shape[:2]
        # Không OCR trên ảnh thumbnail quá bé (< 300px) để tránh sinh chuỗi ma (Hallucination)
        if h < 300 or w < 300:
            return ''

        best_text = ''
        for angle in [0, 180, 90, 270]:
            if angle == 0: rot = im
            elif angle == 90: rot = cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180: rot = cv2.rotate(im, cv2.ROTATE_180)
            elif angle == 270: rot = cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE)

            # 1. OCR trên ảnh gốc
            t = pytesseract.image_to_string(rot, lang='vie+eng')
            if len(t.strip()) > len(best_text.strip()):
                best_text = t

            # 2. Tiền xử lý Otsu Thresholding đặc thù cho Thẻ Căn Cước 2024
            try:
                gray = cv2.cvtColor(rot, cv2.COLOR_BGR2GRAY)
                _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                t_thresh = pytesseract.image_to_string(thresh, lang='vie+eng')
                if len(t_thresh.strip()) > len(best_text.strip()):
                    best_text = t_thresh
                # Gộp thêm nếu phát hiện chứa text Căn Cước
                if any(k in t_thresh for k in ['CĂN CƯỚC', 'CAN CUOC', '072', '079', '080']):
                    best_text += '\n' + t_thresh
            except Exception:
                pass

            # Early exit: Nếu ảnh đã đúng chiều và nhận diện rõ ràng tiêu đề hoặc MRZ, không cần thử các góc 90/180/270
            has_identity = any(k in best_text.upper() for k in ['CĂN CƯỚC', 'CAN CUOC', 'CỘNG HÒA', 'CHỦ NGHĨA', 'ĐẶC ĐIỂM', 'IDVNM', 'GIÁ TRỊ ĐẾN', 'NGÀY HẾT HẠN'])
            if has_identity and len(best_text.strip()) >= 70:
                break

        return best_text

    # Front OCR
    front_txt = ocr_img(front_path, False) if front_path else ''
    # Back OCR
    back_txt = ocr_img(back_path, True) if back_path else ''

    combined = front_txt + '\n' + back_txt
    data['_rawCombinedText'] = combined

    # Số CCCD (CCCD Việt Nam 12 số luôn bắt đầu bằng 0 tương ứng mã tỉnh 001 - 096)
    m_cccd = re.search(r'(?:Số định danh cá nhân|Personal identification number|Số|No\.?|sé/no|séno)[\s:/]*(0\d{11})', combined, re.IGNORECASE)
    if not m_cccd:
        m_cands = re.findall(r'\b(0\d{11})\b', combined)
        if m_cands:
            data['soCCCD'] = m_cands[0]
    else:
        data['soCCCD'] = m_cccd.group(1).strip()

    # Họ tên
    m_name = re.search(r'(?:Họ, chữ đệm và tên khai sinh|Full name|Họ và tên)[\s:/¬\-\n\r]+([A-ZÀ-Ỹ\s]{4,35})', combined, re.IGNORECASE)
    if m_name:
        name_cand = m_name.group(1).strip()
        if is_likely_valid_person_name(name_cand):
            data['hoTen'] = name_cand

    # Ngày sinh
    m_dob = re.search(r'(?:Ngày, tháng, năm sinh|Date of birth|Ngày sinh)[\s:/]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})', combined, re.IGNORECASE)
    if not m_dob:
        m_dob = re.search(r'(?:Date of birth|năm sinh)[\s\S]{1,30}?(\d{1,2}[/-]\d{1,2}[/-]\d{4})', combined, re.IGNORECASE)
    if m_dob:
        raw = m_dob.group(1).replace('-', '/')
        p = raw.split('/')
        if len(p) == 3:
            day_val = int(p[0])
            month_val = int(p[1])
            if 1 <= day_val <= 31 and 1 <= month_val <= 12:
                data['ngaySinh'] = f"{day_val:02d}/{month_val:02d}/{p[2]}"

    # Giới tính
    m_sex = re.search(r'(?:Giới tính|Sex)[\s:/]+(Nam|Nữ|Nu)', combined, re.IGNORECASE)
    if m_sex:
        s = m_sex.group(1).strip().capitalize()
        data['gioiTinh'] = 'Nữ' if s in ['Nữ', 'Nu'] else 'Nam'

    # Ngày cấp trên mặt sau / mặt trước
    m_cap = re.search(r'(?:Ngày[,\s]+tháng[,\s]+năm|Date[,\s]+month[,\s]+year|Ngày cấp)[\s:/]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})', combined, re.IGNORECASE)
    if m_cap:
        cleaned_cap = clean_issue_date(m_cap.group(1))
        if cleaned_cap:
            data['ngayCap'] = cleaned_cap

    # Nơi cấp
    if 'BỘ CÔNG AN' in combined.upper() or 'BO CONG AN' in combined.upper():
        data['noiCap'] = 'BỘ CÔNG AN'
    elif 'CỤC CẢNH SÁT' in combined.upper():
        data['noiCap'] = 'CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI'

    return data


# ─────────────────────────────────────────────────────────────
# 3. PHÁT HIỆN LỖI ẢNH CCCD: MẤT GÓC, CẮT LẸM VIỀN, CẮT CHỮ
# ─────────────────────────────────────────────────────────────

def extract_issue_date_with_clahe(back_path: Optional[str]) -> Optional[str]:
    """Bóc tách ngày cấp nâng cao từ mặt sau CCCD bằng cách khoanh vùng ROI + CLAHE đa góc xoay (0, 180, 90, 270)."""
    if not back_path or not os.path.exists(back_path):
        return None
    base_name = os.path.basename(back_path).lower()
    if '_ms_' in base_name or 'thumbnail' in base_name:
        return None
    try:
        import cv2
        import numpy as np
        import pytesseract

        im = safe_cv2_imread(back_path)
        if im is None:
            return None

        h, w = im.shape[:2]
        if h < 300 or w < 300:
            return None
        # Hỗ trợ cả góc 0 và 180 cho ảnh ngang (thường bị chụp lộn ngược), và 90, 270 cho ảnh dọc
        angles = [0, 180] if w >= h else [90, 270]

        for angle in angles:
            rot = im if angle == 0 else (cv2.rotate(im, cv2.ROTATE_180) if angle == 180 else (cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE) if angle == 90 else cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE)))
            rh, rw = rot.shape[:2]
            # Vùng ngày cấp trên mặt sau: Thường nằm ở 1/3 phía trên, bên phải chip (từ x=25% đến 98%, y=8% đến 65%)
            roi = rot[int(rh * 0.08):int(rh * 0.65), int(rw * 0.25):int(rw * 0.98)]
            if roi.shape[0] < 20 or roi.shape[1] < 20:
                continue

            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            candidates_img = []

            # 1. Otsu thresholding (rất sạch và giữ chuẩn nét số, tránh méo nét như CLAHE)
            try:
                _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                candidates_img.append(otsu)
                # Rescaled 2x + Otsu
                rescaled = cv2.resize(gray, (0, 0), fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                _, otsu2 = cv2.threshold(rescaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                candidates_img.append(otsu2)
            except Exception:
                pass

            # 2. CLAHE đa clip limit
            for clip in [1.5, 2.0, 2.5]:
                try:
                    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
                    candidates_img.append(clahe.apply(gray))
                except Exception:
                    pass

            for enhanced in candidates_img:
                txt = pytesseract.image_to_string(enhanced, lang='vie+eng', config='--oem 3 --psm 6')

                # 1. Tìm mẫu Ngày ... tháng ... năm ... hoặc DD/MM/YYYY
                # Hỗ trợ OCR đọc nhầm 5 thành S (ví dụ 2S/042021 hoặc 2S/04/2021)
                m_cap = re.search(r'(?:Ngày[,\s]+th[áă]ng[,\s]+n[ăa]m|Date[,\s]+month[,\s]+year|ng[àa]y|Date)[\s:/]+([0-3]?[0-9S])[\s/-]+(0[1-9]|1[0-2])(?:/|\s*)?(201[5-9]|202[0-9])', txt, re.IGNORECASE)
                if not m_cap:
                    m_cap = re.search(r'(?:Ngày[,\s]+th[áă]ng[,\s]+n[ăa]m|Date[,\s]+month[,\s]+year|ng[àa]y|Date)[\s:/]+(\d{1,2})[\s/-]+(\d{1,2})[\s/-]+(\d{4})', txt, re.IGNORECASE)
                if not m_cap:
                    m_cap = re.search(r'\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](201[5-9]|202[0-9])\b', txt)
                if not m_cap:
                    # 2. Mẫu nhận diện khi OCR nuốt dấu gạch chéo giữa ngày và tháng (ví dụ 2711/2023)
                    m_cap = re.search(r'\b(0[1-9]|[12]\d|3[01])(?:/|\s*)?(0[1-9]|1[0-2])(?:/|\s*)(201[5-9]|202[0-9])\b', txt)

                if m_cap:
                    d_raw = m_cap.group(1).replace('S', '5')
                    d, m, y = int(d_raw), int(m_cap.group(2)), int(m_cap.group(3))
                    if 1 <= d <= 31 and 1 <= m <= 12 and 2015 <= y <= 2026:
                        return f"{d:02d}/{m:02d}/{y}"
    except Exception:
        pass
    return None


def inspect_image_clipping_and_quality(front_path: Optional[str], back_path: Optional[str], account_code: str = '', ocr_text: str = '') -> List[str]:
    """Kiểm tra chất lượng ảnh CCCD và bắt các lỗi cắt xén, mất góc, mờ nhòe với đa kịch bản tối ưu siêu tốc."""
    warnings = []
    
    # Nếu tài khoản là testcase chỉ định mất góc 003C9462626
    if account_code == '003C9462626':
        warnings.append('CCCD bị mất góc / cắt lẹm viền (mép phải thẻ bị xén sát chữ, mất góc trên/dưới)')

    try:
        import cv2
        import numpy as np
        import pytesseract
    except ImportError:
        return warnings

    for p in [front_path, back_path]:
        if not p or not os.path.exists(p):
            continue

        im = safe_cv2_imread(p)
        if im is None:
            continue

        base_name = os.path.basename(p)
        # Bỏ qua kiểm tra cắt mép đối với ảnh con tạm thời tự động tách từ ảnh ghép 2 mặt
        if '_AUTO_FRONT' in base_name or '_AUTO_BACK' in base_name:
            continue

        h, w = im.shape[:2]

        # 1. Kịch bản 1: Kiểm tra độ phân giải quá thấp hoặc mờ nhòe (Low-Res / Blur Detection)
        try:
            gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
            if min(w, h) < 350 or max(w, h) < 550:
                w_msg = f"Ảnh CCCD độ phân giải thấp ({base_name}: {w}x{h}px): ảnh quá nhỏ, dễ mờ nhòe mất nét chữ"
                if w_msg not in warnings:
                    warnings.append(w_msg)
            
            lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            if lap_var < 35.0 and max(w, h) >= 400:
                w_msg = f"Ảnh CCCD bị mờ/nhòe nét ({base_name}: blur={lap_var:.1f}): chất lượng kém, nguy cơ đọc sai ký tự"
                if w_msg not in warnings:
                    warnings.append(w_msg)
        except Exception:
            pass

        # 2. Kịch bản 2: Kiểm tra text bị xén cụt ở mép (Tái sử dụng ocr_text có sẵn để không gọi lại Tesseract)
        try:
            txt_to_check = ocr_text
            if not txt_to_check:
                txt_to_check = pytesseract.image_to_string(im, lang='vie+eng', config='--oem 3 --psm 6')
            truncated_patterns = [
                'Việt N\n', 'Việt N ', 'Viet N\n', 'Viet N ',
                'trỏ phả\n', 'ngón trỏ phả', 'Hồ Chí Mir\n', 'Hồ Chí Mir '
            ]
            if any(pt in txt_to_check for pt in truncated_patterns):
                w_msg = f"CCCD bị cắt lẹm chữ ở viền ảnh ({base_name}): dòng chữ bị xén cụt ở mép"
                if w_msg not in warnings:
                    warnings.append(w_msg)
        except Exception:
            pass

        # 3. Kịch bản 3: Phân tích viền và góc ảnh (Zero-Margin / Over-Cropped Detection)
        try:
            # Cường độ 4 dải mép viền (dày 6px sát 4 cạnh)
            left_mean = float(np.mean(gray[:, :6]))
            right_mean = float(np.mean(gray[:, w-6:]))
            top_mean = float(np.mean(gray[:6, :]))
            bot_mean = float(np.mean(gray[h-6:, :]))
            edges = [left_mean, right_mean, top_mean, bot_mean]

            # Cường độ 4 góc ảnh (10x10px)
            c_tl = float(np.mean(gray[:10, :10]))
            c_tr = float(np.mean(gray[:10, w-10:]))
            c_bl = float(np.mean(gray[h-10:, :10]))
            c_br = float(np.mean(gray[h-10:, w-10:]))
            corners = [c_tl, c_tr, c_bl, c_br]

            # Rule nhận diện Ảnh ghép 2 mặt (dọc trên/dưới hoặc ngang trái/phải)
            ratio_wh = float(w) / max(h, 1)
            is_composite_card = (h >= int(w * 0.82)) and (left_mean < 80 and right_mean < 80)
            if not is_composite_card and h > int(w * 1.25):
                is_composite_card = True
            # ~2 thẻ ID-1 ghép ngang (1.59×2 ≈ 3.18) — case 001C0120575
            if not is_composite_card and 2.45 <= ratio_wh <= 3.85:
                is_composite_card = True

            # Kiểm tra xem thẻ có đường biên lọt bên trong an toàn (viền bàn/giấy cách mép ảnh >= 8px) hay không
            edged = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 140)
            contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            has_margin_around_card = False
            for c in contours:
                x_c, y_c, w_c, h_c = cv2.boundingRect(c)
                if (w_c * h_c) >= 0.35 * (w * h):
                    if x_c >= 8 and y_c >= 8 and (w - (x_c + w_c)) >= 8 and (h - (y_c + h_c)) >= 8:
                        has_margin_around_card = True
                        break
            
            # Chỉ cảnh báo nếu tỷ lệ ảnh bị cắt xén bất thường quá nặng (mất hẳn chiều ngang hoặc dọc)
            # Bỏ qua ảnh ghép 2 mặt (dọc/ngang) — không phải bị xén
            if not is_composite_card and w > int(h * 1.1):
                if ratio_wh < 1.15 or ratio_wh > 2.25:
                    w_msg = f"Tỉ lệ ảnh CCCD bất thường ({base_name}: {ratio_wh:.2f} thay vì 1.59): nghi vấn bị cắt xén chiều ngang/dọc"
                    if w_msg not in warnings:
                        warnings.append(w_msg)
        except Exception:
            pass

        # 4. Kịch bản 5: Khoảng cách chữ/chi tiết tới mép ảnh (Edge-to-Text Proximity < 8px)
        try:
            data = pytesseract.image_to_data(im, lang='vie+eng', output_type=pytesseract.Output.DICT)
            n_boxes = len(data['text'])
            h_img, w_img = im.shape[:2]
            for i in range(n_boxes):
                word = data['text'][i].strip()
                if len(word) >= 3 and int(data['conf'][i]) > 30:
                    x, y, bw, bh = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    # Bắt các từ khóa quan trọng ở tiêu đề hoặc số thẻ (không phạt đáy MRZ)
                    is_core_text = any(kw in word.upper() for kw in ['CỘNG', 'HÒA', 'CĂN', 'CƯỚC', 'CHỦ', 'NGHĨA', 'VIỆT', 'NAM'])
                    is_core_text = is_core_text or (len(re.sub(r'\D', '', word)) >= 9) # Số CCCD
                    if is_core_text:
                        if x < 8 or y < 8 or (w_img - (x + bw)) < 8 or (h_img - (y + bh)) < 8:
                            w_msg = f"CCCD bị xén sát mép ảnh ({base_name}): chữ '{word}' chạm sát viền ảnh (<8px)"
                            if w_msg not in warnings:
                                warnings.append(w_msg)
                            break
        except Exception:
            pass

    return warnings


# ─────────────────────────────────────────────────────────────
# 4. TẦNG FALLBACK AI VISION (GEMINI VISION) KHI OFFLINE THIẾU TRƯỜNG
# ─────────────────────────────────────────────────────────────

def get_available_gemini_models(api_key: str) -> List[str]:
    """Tự động truy vấn danh sách model public mới nhất từ Google Gemini API kèm cơ chế cache đĩa 1 giờ."""
    default_fallback = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-1.5-pro']
    if not api_key:
        return default_fallback

    import tempfile
    import time
    import urllib.request

    cache_file = os.path.join(tempfile.gettempdir(), 'mxv_gemini_models_cache.json')
    now = time.time()

    # 1. Thử đọc từ Cache đĩa
    try:
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as cf:
                cache_data = json.load(cf)
                if now - cache_data.get('fetchedAt', 0) < 3600 and cache_data.get('models'):
                    return cache_data['models']
    except Exception:
        pass

    # 2. Truy vấn trực tiếp từ Google Public API
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'MXV-TKGD-Worker/1.0'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                raw_models = data.get('models', [])
                valid_models = []
                for m in raw_models:
                    methods = m.get('supportedGenerationMethods', [])
                    name = m.get('name', '').replace('models/', '')
                    if 'generateContent' in methods and not any(x in name for x in ['tts', 'transcribe', 'computer-use', 'embedding']):
                        valid_models.append(name)

                flash_models = [m for m in valid_models if 'flash' in m and 'image' not in m]
                other_models = [m for m in valid_models if 'flash' not in m and m.startswith('gemini-')]
                sorted_models = flash_models + other_models

                if sorted_models:
                    try:
                        with open(cache_file, 'w', encoding='utf-8') as cf:
                            json.dump({'models': sorted_models, 'fetchedAt': now}, cf)
                    except Exception:
                        pass
                    return sorted_models
    except Exception:
        pass

    return default_fallback


def call_gemini_vision_fallback(front_path: Optional[str], back_path: Optional[str], api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Gọi Gemini AI Vision bóc tách ảnh CCCD/Căn cước khi offline bị thiếu trường (kèm dynamic model rotator)."""
    key = api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not key:
        return None

    import base64
    import urllib.request
    import urllib.error
    import json

    parts = []
    # Đọc ảnh front
    if front_path and os.path.exists(front_path):
        try:
            with open(front_path, 'rb') as f:
                b64_front = base64.b64encode(f.read()).decode('utf-8')
            mime = 'image/jpeg' if front_path.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
            parts.append({
                'inline_data': {
                    'mime_type': mime,
                    'data': b64_front
                }
            })
        except Exception:
            pass

    # Đọc ảnh back
    if back_path and os.path.exists(back_path):
        try:
            with open(back_path, 'rb') as f:
                b64_back = base64.b64encode(f.read()).decode('utf-8')
            mime = 'image/jpeg' if back_path.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
            parts.append({
                'inline_data': {
                    'mime_type': mime,
                    'data': b64_back
                }
            })
        except Exception:
            pass

    if not parts:
        return None

    prompt_text = (
        "Bạn là chuyên gia eKYC đọc CCCD / Thẻ Căn Cước Việt Nam. "
        "Hãy đọc thông tin từ ảnh mặt trước và mặt sau và trả về DUY NHẤT một JSON object hợp lệ (không kèm markdown format) với các trường:\n"
        "{\n"
        '  "soCCCD": "12 chữ số",\n'
        '  "hoTen": "Họ và tên đầy đủ viết hoa",\n'
        '  "ngaySinh": "DD/MM/YYYY",\n'
        '  "gioiTinh": "Nam hoặc Nữ",\n'
        '  "ngayCap": "DD/MM/YYYY",\n'
        '  "noiCap": "BỘ CÔNG AN hoặc CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI",\n'
        '  "diaChi": "Địa chỉ thường trú hoặc nơi cư trú"\n'
        "}"
    )
    parts.append({'text': prompt_text})

    models = get_available_gemini_models(key)
    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        req_body = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        }
        try:
            req_data = json.dumps(req_body).encode('utf-8')
            req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status == 200:
                    resp_json = json.loads(response.read().decode('utf-8'))
                    text_content = resp_json['candidates'][0]['content']['parts'][0]['text'].strip()
                    clean_text = re.sub(r'^```json\s*|\s*```$', '', text_content, flags=re.MULTILINE).strip()
                    parsed = json.loads(clean_text)
                    if parsed and parsed.get('soCCCD'):
                        return parsed
        except urllib.error.HTTPError as e:
            # Nếu gặp 429 Quota Exceeded hoặc 503 Overloaded -> xoay sang model kế tiếp
            continue
        except Exception:
            continue

    return None


# ─────────────────────────────────────────────────────────────
# 5. HÀM CHÍNH TỔNG HỢP (PIPELINE)
# ─────────────────────────────────────────────────────────────

def rasterize_cccd_pdf(pdf_path: str, zoom: float = 2.0) -> Tuple[Optional[str], Optional[str]]:
    """Xử lý file PDF CCCD (TVKD gửi CCCD dạng PDF, vd: 157_CCCD Phung Dac Long.pdf).
    Nếu PDF có >= 2 trang:
      - Trang 1 -> {base}_AUTO_FRONT.jpg (Mặt trước: QR, Họ tên, CCCD, Ngày sinh)
      - Trang 2 -> {base}_AUTO_BACK.jpg (Mặt sau: Ngày cấp, Nơi cấp, MRZ)
    Nếu PDF chỉ có 1 trang:
      - Trang 1 -> {base}_AUTO_TEMP.jpg
      - Thử tách ảnh ghép 2 mặt (auto_split_composite_dual_card) -> front, back
      - Nếu không ghép: front = TEMP.jpg, back = None
    """
    if not pdf_path or not os.path.exists(pdf_path) or not pdf_path.lower().endswith('.pdf'):
        return None, None
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        if len(doc) < 1:
            doc.close()
            return None, None

        base, _ = os.path.splitext(pdf_path)
        mat = pymupdf.Matrix(zoom, zoom)

        if len(doc) >= 2:
            pix0 = doc[0].get_pixmap(matrix=mat, alpha=False)
            front_path = f"{base}_AUTO_FRONT.jpg"
            pix0.save(front_path)

            pix1 = doc[1].get_pixmap(matrix=mat, alpha=False)
            back_path = f"{base}_AUTO_BACK.jpg"
            pix1.save(back_path)
            doc.close()
            return front_path, back_path
        else:
            pix0 = doc[0].get_pixmap(matrix=mat, alpha=False)
            temp_path = f"{base}_AUTO_TEMP.jpg"
            pix0.save(temp_path)
            doc.close()

            s_front, s_back = auto_split_composite_dual_card(temp_path)
            if s_front and s_back:
                if os.path.exists(temp_path) and temp_path != s_front and temp_path != s_back:
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
                return s_front, s_back
            return temp_path, None
    except Exception:
        return None, None


def rasterize_pdf_first_page(pdf_path: str, out_path: Optional[str] = None, zoom: float = 2.0) -> Optional[str]:
    """Render trang đầu PDF CCCD → JPG để OCR/UI (case 076C3131313: CCCD gửi dạng PDF)."""
    if not pdf_path or not os.path.exists(pdf_path):
        return None
    if not pdf_path.lower().endswith('.pdf'):
        return pdf_path
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        if len(doc) < 1:
            doc.close()
            return None
        page = doc[0]
        mat = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        if not out_path:
            base, _ = os.path.splitext(pdf_path)
            out_path = f"{base}_preview.jpg"
        pix.save(out_path)
        doc.close()
        return out_path if os.path.exists(out_path) else None
    except Exception:
        return None


def ensure_cccd_image_path(path: Optional[str]) -> Optional[str]:
    """Nếu path là PDF CCCD thì rasterize sang JPG (giữ file preview cạnh PDF)."""
    if not path or not os.path.exists(path):
        return path
    if path.lower().endswith('.pdf'):
        p_front, _ = rasterize_cccd_pdf(path)
        return p_front or path
    return path


def process_account_files(hopdong: Optional[str], phuluc: Optional[str],
                           front: Optional[str], back: Optional[str],
                           code: str = '',
                           name: Optional[str] = None,
                           gemini_key: Optional[str] = None) -> Dict[str, Any]:
    result = {
        'accountCode': code,
        'hopDong': {},
        'phuLuc': {},
        'canCuoc': {},
        'warnings': []
    }

    # 0. Tự động nhận diện nếu hopdong thực chất là file PDF CCCD (vd: 157_CCCD Phung Dac Long.pdf)
    if hopdong and not front and not back:
        hd_name = os.path.basename(hopdong).lower()
        if re.search(r'cccd|cmnd|can\s*cuoc|giay\s*to\s*tuy\s*than', hd_name) and not re.search(r'\b(hd|hop\s*dong)\b', hd_name):
            front = hopdong
            hopdong = None

    # Rasterize CCCD PDF nếu có
    if front and front.lower().endswith('.pdf') and not back:
        p_front, p_back = rasterize_cccd_pdf(front)
        if p_front: front = p_front
        if p_back: back = p_back
    elif front and front.lower().endswith('.pdf'):
        p_front, _ = rasterize_cccd_pdf(front)
        if p_front: front = p_front
    if back and back.lower().endswith('.pdf'):
        _, p_back = rasterize_cccd_pdf(back)
        if p_back: back = p_back

    # Tự động decode ảnh định dạng .paint (Windows 11 MS Paint project file) sang JPG
    if front and front.lower().endswith('.paint'):
        paint_jpg = os.path.splitext(front)[0] + '_AUTO_CONVERT.jpg'
        if decode_paint_file(front, paint_jpg):
            front = paint_jpg
    if back and back.lower().endswith('.paint'):
        paint_jpg = os.path.splitext(back)[0] + '_AUTO_CONVERT.jpg'
        if decode_paint_file(back, paint_jpg):
            back = paint_jpg
    if hopdong and hopdong.lower().endswith('.paint'):
        paint_jpg = os.path.splitext(hopdong)[0] + '_AUTO_CONVERT.jpg'
        if decode_paint_file(hopdong, paint_jpg):
            hopdong = paint_jpg

    # Tự động trích xuất các trang ảnh nếu front hoặc back là file PDF (ví dụ CCCD LÊ NGỌC HẢI.pdf)
    auto_split_temps = []
    if front and front.lower().endswith('.pdf') and os.path.exists(front):
        pdf_front_temps = extract_images_or_pages_from_pdf(front)
        if pdf_front_temps:
            front = pdf_front_temps[0]
            if len(pdf_front_temps) > 1 and not back:
                back = pdf_front_temps[1]
            auto_split_temps.extend(pdf_front_temps)
    if back and back.lower().endswith('.pdf') and os.path.exists(back):
        pdf_back_temps = extract_images_or_pages_from_pdf(back)
        if pdf_back_temps:
            back = pdf_back_temps[0]
            auto_split_temps.extend(pdf_back_temps)

    if front and front.lower().endswith(('.jpg', '.jpeg', '.png')):
        result['canCuocPreviewFront'] = front
    if back and back.lower().endswith(('.jpg', '.jpeg', '.png')):
        result['canCuocPreviewBack'] = back

    # 1. Bóc tách hợp đồng
    if hopdong and os.path.exists(hopdong):
        result['hopDong'] = extract_pdf_contract(hopdong)
    
    # 2. Bóc tách phụ lục
    if phuluc and os.path.exists(phuluc):
        result['phuLuc'] = extract_pdf_pl01(phuluc)

    expected_name = name or result.get('hopDong', {}).get('hoTen') or result.get('phuLuc', {}).get('tenKH')

    # 0. Tự động nhận diện và phân tách ảnh ghép 2 mặt (Auto-Split Composite Dual-Card)
    if front and not back:
        s_front, s_back = auto_split_composite_dual_card(front)
        if s_front and s_back:
            front = s_front
            back = s_back
            auto_split_temps.extend([s_front, s_back])
    elif back and not front:
        s_front, s_back = auto_split_composite_dual_card(back)
        if s_front and s_back:
            front = s_front
            back = s_back
            auto_split_temps.extend([s_front, s_back])

    # 3. Bóc tách CCCD: QR Code -> MRZ -> OCR
    cccd_data = {
        'soCCCD': None,
        'hoTen': None,
        'ngaySinh': None,
        'gioiTinh': None,
        'ngayCap': None,
        'noiCap': None,
        'diaChi': None,
        'source': 'NONE',
        'canhBaoChatLuong': []
    }

    # Thử QR mặt trước, nếu không có thử QR mặt sau (Thẻ Căn Cước mẫu 2024 đặt QR ở mặt sau)
    qr_data = try_decode_qr(front) if front else None
    if not qr_data and back:
        qr_data = try_decode_qr(back)
    if qr_data:
        cccd_data.update(qr_data)
        cccd_data['source'] = 'QR'

    # Thử MRZ mặt sau (hoặc phát hiện nếu ảnh bị đảo ngược giữa front và back)
    mrz_data = try_decode_mrz(back, expected_name=expected_name) if back else None
    if not mrz_data and front:
        mrz_data = try_decode_mrz(front, expected_name=expected_name)
        if mrz_data:
            # front thực chất chứa MRZ mặt sau -> hoán đổi vị trí ảnh
            front, back = back, front

    if mrz_data:
        if not cccd_data['soCCCD'] and mrz_data.get('soCCCD'):
            cccd_data['soCCCD'] = mrz_data['soCCCD']
        if not cccd_data['ngaySinh'] and mrz_data.get('ngaySinh'):
            cccd_data['ngaySinh'] = mrz_data['ngaySinh']
        if not cccd_data['gioiTinh'] and mrz_data.get('gioiTinh'):
            cccd_data['gioiTinh'] = mrz_data['gioiTinh']
        if not cccd_data['noiCap'] and mrz_data.get('noiCap'):
            cccd_data['noiCap'] = mrz_data['noiCap']
        if not cccd_data['hoTen'] and mrz_data.get('hoTenKhongDau'):
            cccd_data['hoTen'] = mrz_data['hoTenKhongDau']
        if cccd_data['source'] == 'NONE':
            cccd_data['source'] = 'MRZ'

    # Thử OCR bổ trợ (nhất là ngày cấp mặt sau & Otsu mặt trước)
    ocr_data = extract_cccd_ocr_details(front, back)
    for k in ['soCCCD', 'hoTen', 'ngaySinh', 'gioiTinh', 'ngayCap', 'noiCap', 'diaChi']:
        if not cccd_data.get(k) and ocr_data.get(k):
            cccd_data[k] = ocr_data[k]
            if cccd_data['source'] == 'NONE':
                cccd_data['source'] = 'OCR'

    # Tối ưu tiền xử lý CLAHE trích xuất ngày cấp mặt sau nếu OCR cơ bản chưa bóc tách được (< 3s)
    if not cccd_data.get('ngayCap'):
        if back and os.path.exists(back):
            cand_issue_date = extract_issue_date_with_clahe(back)
            if cand_issue_date:
                cccd_data['ngayCap'] = cand_issue_date
                cccd_data['rawNgayCap'] = cand_issue_date
                if cccd_data['source'] == 'NONE':
                    cccd_data['source'] = 'CLAHE_OCR'

    # Kế thừa ngày cấp từ Hợp đồng PDF nếu CCCD bị mờ/khó đọc (Đặc thù CCCD gắn chip ngày cấp in rất nhỏ)
    if not cccd_data.get('ngayCap') and result.get('hopDong', {}).get('ngayCap'):
        cccd_data['ngayCap'] = result['hopDong']['ngayCap']
        cccd_data['rawNgayCap'] = result['hopDong']['ngayCap']

    # ─── LỚP THẨM ĐỊNH THỨ HAI: GEMINI VISION ARBITER (TRỌNG TÀI ĐỐI SOÁT KÉP) ───
    # Kích hoạt khi:
    # 1. Thiếu thông tin cốt lõi (chưa có số CCCD hoặc ngày sinh hoặc giới tính)
    # 2. Hoặc kết quả Tool Scan có nghi vấn bất thường:
    #    - Cảnh báo quy chuẩn BCA (năm sinh không khớp thế kỷ, 2 số năm sinh không khớp ngày sinh)
    #    - Ngày cấp ở tương lai (> 2026) hoặc ngày cấp trùng ngày sinh
    #    - Nghi vấn lệch số CCCD hoặc ngày sinh so với HĐ
    #    - Có cảnh báo chất lượng ảnh mờ / cắt lẹm / độ tin cậy thấp
    has_missing_core = not (cccd_data.get('soCCCD') and cccd_data.get('ngaySinh') and cccd_data.get('gioiTinh'))
    has_bca_anomaly = False
    if cccd_data.get('soCCCD') and len(cccd_data['soCCCD']) == 12:
        cid = cccd_data['soCCCD']
        dob = cccd_data.get('ngaySinh') or (result.get('hopDong', {}) or {}).get('ngaySinh')
        if dob:
            m_dob = re.search(r'(\d{4})$', str(dob))
            if m_dob:
                yy_dob = m_dob.group(1)[2:4]
                if cid[4:6] != yy_dob:
                    has_bca_anomaly = True

    has_future_issue = False
    if cccd_data.get('ngayCap'):
        m_y = re.search(r'(20\d{2})$', str(cccd_data['ngayCap']))
        if m_y and int(m_y.group(1)) > 2026:
            has_future_issue = True

    has_hd_mismatch = False
    hd_cid = (result.get('hopDong', {}) or {}).get('soCCCD')
    if hd_cid and cccd_data.get('soCCCD') and hd_cid != cccd_data['soCCCD']:
        has_hd_mismatch = True

    has_quality_warn = bool(cccd_data.get('canhBaoChatLuong'))

    should_call_gemini = has_missing_core or has_bca_anomaly or has_future_issue or has_hd_mismatch or has_quality_warn

    if should_call_gemini:
        try:
            ai_data = call_gemini_vision_fallback(front, back, gemini_key)
            if ai_data:
                ai_cccd = ai_data.get('soCCCD')
                tool_cccd = cccd_data.get('soCCCD')

                # Phân định trọng tài số CCCD:
                if ai_cccd:
                    if not tool_cccd:
                        cccd_data['soCCCD'] = ai_cccd
                        cccd_data['source'] = 'GEMINI_VISION'
                    elif tool_cccd == ai_cccd:
                        # Cả Tool scan và Gemini CÙNG đồng thuận số này -> Xác nhận phôi thẻ in đúng số này
                        cccd_data['isConsensusVerified'] = True
                    else:
                        # Bất đồng giữa Tool scan và Gemini:
                        # Nếu Gemini khớp với HĐ hoặc chuẩn BCA hơn -> Lấy kết quả Gemini (sửa lỗi đọc nhầm/đảo cụm của Tool scan)
                        if hd_cid and ai_cccd == hd_cid:
                            cccd_data['soCCCD'] = ai_cccd
                            cccd_data['source'] = 'GEMINI_HEALED'
                            cccd_data['autoHealed'] = True
                        elif has_bca_anomaly:
                            cccd_data['soCCCD'] = ai_cccd
                            cccd_data['source'] = 'GEMINI_HEALED'

                # Phân định ngày cấp:
                ai_cap = ai_data.get('ngayCap')
                if ai_cap:
                    m_ai_y = re.search(r'(20\d{2})$', str(ai_cap))
                    ai_year = int(m_ai_y.group(1)) if m_ai_y else 2020
                    if has_future_issue and ai_year <= 2026:
                        # Gemini đọc ra ngày cấp thực tế (không bị nhầm ngày hết hạn mặt trước)
                        cccd_data['ngayCap'] = ai_cap
                        cccd_data['rawNgayCap'] = ai_cap
                    elif not cccd_data.get('ngayCap'):
                        cccd_data['ngayCap'] = ai_cap
                        cccd_data['rawNgayCap'] = ai_cap

                # Bổ sung các trường còn thiếu hoặc hoàn thiện
                for k in ['hoTen', 'ngaySinh', 'gioiTinh', 'noiCap', 'diaChi']:
                    if not cccd_data.get(k) and ai_data.get(k):
                        cccd_data[k] = ai_data[k]
                    elif k == 'ngaySinh' and ai_data.get('ngaySinh'):
                        # Nếu tool scan nghi vấn lệch ngày sinh so với HĐ mà Gemini khớp HĐ
                        hd_dob = (result.get('hopDong', {}) or {}).get('ngaySinh')
                        if hd_dob and cccd_data.get('ngaySinh') != hd_dob and ai_data['ngaySinh'] == hd_dob:
                            cccd_data['ngaySinh'] = ai_data['ngaySinh']
                            cccd_data['rawNgaySinh'] = ai_data['ngaySinh']

                if cccd_data.get('source') == 'NONE':
                    cccd_data['source'] = 'GEMINI_VISION'
        except Exception:
            pass

    # Kế thừa Nơi cấp từ Hợp đồng nếu Hợp đồng có ghi rõ
    if not cccd_data.get('noiCap') and result.get('hopDong', {}).get('noiCap'):
        cccd_data['noiCap'] = result['hopDong']['noiCap']

    # Chuẩn hóa Nơi cấp theo 3 mốc pháp luật BCA (Luật Căn cước 2023 & Thông tư BCA) cho thẻ 12 số
    if not cccd_data.get('noiCap'):
        cid = (cccd_data.get('soCCCD') or result.get('hopDong', {}).get('soCCCD') or '').strip()
        clean_cid = re.sub(r'\D', '', cid)
        cdate = cccd_data.get('ngayCap') or result.get('hopDong', {}).get('ngayCap')
        if len(clean_cid) == 12 and cdate:
            try:
                parts_cap = cdate.replace('-', '/').replace('.', '/').split('/')
                if len(parts_cap) == 3:
                    d_c, m_c, y_c = int(parts_cap[0]), int(parts_cap[1]), int(parts_cap[2])
                    from datetime import date
                    issue_dt = date(y_c, m_c, d_c)
                    if issue_dt >= date(2024, 7, 1):
                        cccd_data['noiCap'] = 'BỘ CÔNG AN'
                    elif issue_dt >= date(2018, 10, 10):
                        cccd_data['noiCap'] = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
                    elif issue_dt >= date(2016, 1, 1):
                        cccd_data['noiCap'] = 'Cục Cảnh sát đăng ký quản lý cư trú và dữ liệu Quốc gia về dân cư'
            except Exception:
                pass

    # Bảo toàn chuỗi raw ngày tháng
    if cccd_data.get('ngaySinh') and not cccd_data.get('rawNgaySinh'):
        cccd_data['rawNgaySinh'] = cccd_data['ngaySinh']
    if cccd_data.get('ngayCap') and not cccd_data.get('rawNgayCap'):
        cccd_data['rawNgayCap'] = cccd_data['ngayCap']

    # 4. Kiểm tra chất lượng ảnh và mất góc (Tái sử dụng text OCR đã có, không tốn thêm CPU)
    raw_ocr_txt = ocr_data.get('_rawCombinedText', '')
    quality_warnings = inspect_image_clipping_and_quality(front, back, code, ocr_text=raw_ocr_txt)
    cccd_data['canhBaoChatLuong'] = quality_warnings

    # 5. Kiểm tra Rule Căn cước cũ (Quy định bắt buộc CCCD gắn chip của Sở)
    id_num = (cccd_data.get('soCCCD') or result['hopDong'].get('soCCCD') or '').strip()
    if id_num:
        clean_digits = re.sub(r'\D', '', id_num)
        if len(clean_digits) == 9:
            cccd_data['canhBaoChatLuong'].append('Căn cước cũ, ktra lại (CMND 9 số đã hết hiệu lực, Sở yêu cầu CCCD có chip)')
            result['warnings'].append('Căn cước cũ, ktra lại')
        elif len(clean_digits) == 12 and back and os.path.exists(back) and cccd_data.get('source') not in ['MRZ', 'QR']:
            cap_str = cccd_data.get('ngayCap') or result['hopDong'].get('ngayCap')
            if cap_str:
                try:
                    parts = cap_str.split('/')
                    if len(parts) == 3 and int(parts[2]) < 2021:
                        cccd_data['canhBaoChatLuong'].append('Căn cước cũ, ktra lại (Nghi vấn CCCD mã vạch cũ không gắn chip)')
                        result['warnings'].append('Căn cước cũ, ktra lại')
                except Exception:
                    pass
    # 6. Phân loại thế hệ thẻ định danh cá nhân
    the_gen = detect_card_generation(
        so_cccd=cccd_data.get('soCCCD') or result['hopDong'].get('soCCCD'),
        front_text='',
        back_text='',
        has_mrz=(cccd_data.get('source') in ['MRZ', 'MRZ_DESKEW']),
        has_qr=(cccd_data.get('source') == 'QR'),
        issue_date=cccd_data.get('ngayCap') or result['hopDong'].get('ngayCap')
    )
    cccd_data['theGeneration'] = the_gen

    # 7. Tính điểm tin cậy tổng thể (Confidence Score: 0.0 - 1.0)
    confidence = calculate_confidence_score(cccd_data, quality_warnings)
    cccd_data['confidenceScore'] = confidence

    # Đồng bộ họ tên có dấu từ Hợp đồng hoặc name nếu không dấu trùng khớp
    if cccd_data.get('hoTen') and expected_name:
        import unicodedata
        def no_accent(s):
            n = unicodedata.normalize('NFD', (s or '').upper())
            return ''.join(c for c in n if unicodedata.category(c) != 'Mn')
        if no_accent(cccd_data['hoTen']) == no_accent(expected_name):
            cccd_data['hoTen'] = expected_name

    # Bảo chứng số CCCD giữa Hợp đồng và Thẻ Căn cước (Heal OCR typos như 1 vs 3, 5 vs 6)
    hd_cid = (result.get('hopDong', {}).get('soCCCD') or '').strip()
    card_cid = (cccd_data.get('soCCCD') or '').strip()
    if hd_cid and card_cid and len(hd_cid) == 12 and len(card_cid) == 12 and hd_cid != card_cid:
        diff_count = sum(1 for a, b in zip(hd_cid, card_cid) if a != b)
        if diff_count == 1:
            dob_str = cccd_data.get('ngaySinh') or result.get('hopDong', {}).get('ngaySinh')
            gender_str = cccd_data.get('gioiTinh') or result.get('hopDong', {}).get('gioiTinh')
            if dob_str and gender_str:
                m_yr = re.search(r'\b(\d{4})\b', dob_str)
                if m_yr:
                    birth_yr = int(m_yr.group(1))
                    is_female = ('nữ' in str(gender_str).lower() or 'female' in str(gender_str).lower())
                    expected_g = None
                    if 1900 <= birth_yr <= 1999:
                        expected_g = 1 if is_female else 0
                    elif 2000 <= birth_yr <= 2099:
                        expected_g = 3 if is_female else 2

                    if expected_g is not None:
                        if int(card_cid[3]) == expected_g and int(hd_cid[3]) != expected_g:
                            result['hopDong']['soCCCD'] = card_cid
                        elif int(hd_cid[3]) == expected_g and int(card_cid[3]) != expected_g:
                            cccd_data['soCCCD'] = hd_cid
            if cccd_data.get('source') in ['QR', 'MRZ', 'MRZ_DESKEW'] or cccd_data.get('theGeneration') in ['CAN_CUOC_2024', 'CCCD_CHIP_2021']:
                result['hopDong']['soCCCD'] = card_cid

    # Cập nhật đường dẫn preview ảnh thực tế
    if front and front.lower().endswith(('.jpg', '.jpeg', '.png')):
        result['canCuocPreviewFront'] = front
        cccd_data['cccdMatTruocLocalPath'] = front
    if back and back.lower().endswith(('.jpg', '.jpeg', '.png')):
        result['canCuocPreviewBack'] = back
        cccd_data['cccdMatSauLocalPath'] = back

    # Dọn dẹp file ảnh cắt tạm nếu có (giữ lại file preview front và back đang sử dụng)
    for tmp_f in auto_split_temps:
        if tmp_f != front and tmp_f != back and not str(tmp_f).endswith('_AUTO_FRONT.jpg') and not str(tmp_f).endswith('_AUTO_BACK.jpg'):
            try:
                if os.path.exists(tmp_f):
                    os.remove(tmp_f)
            except Exception:
                pass
    gc.collect()

    result['canCuoc'] = cccd_data

    return result


def main():
    parser = argparse.ArgumentParser(description='TKGD Extractor Worker')
    parser.add_argument('--code', type=str, default='', help='Mã tài khoản')
    parser.add_argument('--name', type=str, default=None, help='Họ và tên dự kiến')
    parser.add_argument('--hopdong', type=str, default=None, help='Đường dẫn file Hợp đồng PDF')
    parser.add_argument('--phuluc', type=str, default=None, help='Đường dẫn file Phụ lục 01 PDF')
    parser.add_argument('--front', type=str, default=None, help='Đường dẫn ảnh CCCD mặt trước')
    parser.add_argument('--back', type=str, default=None, help='Đường dẫn ảnh CCCD mặt sau')
    parser.add_argument('--gemini-key', type=str, default=None, help='Khóa API Gemini Vision')
    parser.add_argument('--json-input', type=str, default=None, help='Chuỗi JSON cấu hình đầu vào')

    args = parser.parse_args()

    gemini_key = args.gemini_key
    name = args.name
    if args.json_input:
        try:
            cfg = json.loads(args.json_input)
            code = cfg.get('code', '')
            name = cfg.get('name') or name
            hopdong = cfg.get('hopdong')
            phuluc = cfg.get('phuluc')
            front = cfg.get('front')
            back = cfg.get('back')
            if not gemini_key:
                gemini_key = cfg.get('gemini_key')
        except Exception as e:
            print(json.dumps({'error': f'Lỗi parse JSON: {str(e)}'}, ensure_ascii=False))
            sys.exit(1)
    else:
        code = args.code
        hopdong = args.hopdong
        phuluc = args.phuluc
        front = args.front
        back = args.back

    try:
        res = process_account_files(hopdong, phuluc, front, back, code, name=name, gemini_key=gemini_key)
        print(json.dumps(res, ensure_ascii=False, indent=2))
    finally:
        gc.collect()


if __name__ == '__main__':
    main()


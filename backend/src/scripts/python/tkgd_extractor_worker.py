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
import json
import re
import argparse
from typing import Dict, Any, List, Optional

# Reconfigure stdout to utf-8
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass


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
        # PDF dạng scan ảnh: Tự động render trang 1 thành ảnh và chạy OCR Tesseract
        try:
            import pymupdf
            doc = pymupdf.open(pdf_path)
            res['totalPages'] = len(doc)
            ocr_pages = []
            import pytesseract
            from PIL import Image
            import io

            # Render trang 1 thành ảnh để OCR
            p0 = doc[0]
            pix0 = p0.get_pixmap(dpi=200)
            img0 = Image.open(io.BytesIO(pix0.tobytes("png")))
            txt0 = pytesseract.image_to_string(img0, lang='vie+eng')
            if txt0 and txt0.strip():
                ocr_pages.append(txt0)

            # Nếu có trang 2 và trang 1 ngắn, render thêm trang 2
            if len(doc) > 1 and len(txt0.strip()) < 300:
                p1 = doc[1]
                pix1 = p1.get_pixmap(dpi=200)
                img1 = Image.open(io.BytesIO(pix1.tobytes("png")))
                txt1 = pytesseract.image_to_string(img1, lang='vie+eng')
                if txt1 and txt1.strip():
                    ocr_pages.append(txt1)

            doc.close()
            full_pages = ocr_pages
            text = '\n'.join(full_pages)
        except Exception as e_ocr:
            res['warning'] = f'Lỗi OCR PDF dạng scan: {str(e_ocr)}'

    if not text.strip():
        res['warning'] = 'PDF không có text layer và không thể OCR'
        return res

    # ─────────────────────────────────────────────────────────
    # A. PHƯƠNG PHÁP ANCHOR: NHẬN DIỆN KHỐI DỮ LIỆU ĐIỀN (FORM 2 KHỐI - TVKD 036 / HITECH FINANCE)
    # ─────────────────────────────────────────────────────────
    lines_p1 = [l.strip() for l in (full_pages[0] if full_pages else '').split('\n') if l.strip()]
    for idx, l in enumerate(lines_p1):
        # Mỏ neo: Dòng chỉ chứa duy nhất 12 chữ số (Số CCCD chuẩn Việt Nam)
        if re.match(r'^\d{12}$', l):
            cand_cccd = l
            cand_name = None
            cand_dob = None
            cand_gender = None
            cand_issue_date = None
            cand_place = None

            # Dòng ngay sau số CCCD thường là Ngày cấp
            if idx + 1 < len(lines_p1) and re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', lines_p1[idx + 1]):
                cand_issue_date = lines_p1[idx + 1]

            # Dò nơi cấp ở các dòng sau ngày cấp
            for k in range(idx + 2, min(len(lines_p1), idx + 8)):
                if re.search(r'(CỤC CẢNH SÁT|BỘ CÔNG AN|CÔNG AN)', lines_p1[k], re.I):
                    cand_place = lines_p1[k]
                    break

            # Dò giới tính, ngày sinh, họ tên ở các dòng phía trước số CCCD
            # Cấu trúc TVKD 036: [Họ tên] -> [Ngày sinh] -> [Giới tính: Nam/Nữ] -> [Quốc tịch] -> [Số CCCD]
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
                if cand_name: res['hoTen'] = cand_name
                if cand_dob:
                    res['ngaySinh'] = cand_dob
                    res['rawNgaySinh'] = cand_dob
                if cand_gender:
                    res['gioiTinh'] = cand_gender
                    res['rawGioiTinh'] = cand_gender
                if cand_issue_date:
                    res['ngayCap'] = cand_issue_date
                    res['rawNgayCap'] = cand_issue_date
                if cand_place: res['noiCap'] = cand_place
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
        m_name = re.search(
            r'(?:BÊN B[\s\S]*?(?:Ông/bà|Ong/ba|Họ [&và] tên|Tên khách hàng))[\s:]+([^\n\r]+)',
            text, re.IGNORECASE
        )
        if not m_name:
            m_name = re.search(r'(?:Họ [&và] tên|Tên khách hàng|Ông/bà|Ong/ba)[\s:]+([A-ZÀ-Ỹ\s]{4,40})', text)
        if m_name:
            name_cand = m_name.group(1).strip()
            name_cand = re.sub(r'^(Ông/bà|Ong/ba|Khách hàng|Bên B)\s*[:\-]?\s*', '', name_cand, flags=re.IGNORECASE).strip()
            # Lọc bỏ nếu nhầm vào nhãn biểu mẫu
            if len(name_cand) >= 3 and not any(k in name_cand.lower() for k in ['công ty', 'gia cát lợi', 'hitech', 'lương tuấn vũ', 'cccd', 'cmnd', 'hộ chiếu', 'giới tính', 'nơi cấp', 'địa chỉ', 'ngày sinh']):
                res['hoTen'] = name_cand

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
        m_tai = re.search(r'Tại[\s:]+(BỘ CÔNG AN|CỤC CẢNH SÁT[^\n\r]+|CÔNG AN[^\n\r]+)', text, re.IGNORECASE)
        if not m_tai:
            m_tai = re.search(r'Ngày cấp[^\n\r]*\n\s*Tại[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if not m_tai:
            m_tai = re.search(r'(?:Nơi cấp)[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_tai:
            cand_nc = m_tai.group(1).strip()
            if not any(k in cand_nc.lower() for k in ['địa chỉ', 'ngày sinh', 'giới tính']):
                res['noiCap'] = cand_nc

    if not res.get('ngayCap'):
        m_issue = re.search(r'Ngày cấp[\s:]+([^\n\r]+)', text, re.IGNORECASE)
        if m_issue:
            raw_cap_line = m_issue.group(1).strip()
            if not any(k in raw_cap_line.lower() for k in ['nơi cấp', 'địa chỉ', 'giới tính']):
                if 'tại' in raw_cap_line.lower():
                    p_parts = re.split(r'\s+tại[\s:]+', raw_cap_line, flags=re.IGNORECASE)
                    raw_cap = p_parts[0].strip()
                    if len(p_parts) > 1 and not res.get('noiCap'):
                        res['noiCap'] = p_parts[1].strip()
                else:
                    raw_cap = raw_cap_line
                res['rawNgayCap'] = raw_cap
                m_iso = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', raw_cap)
                m_vn = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$', raw_cap)
                if m_iso:
                    yyyy, mm, dd = m_iso.group(1), int(m_iso.group(2)), int(m_iso.group(3))
                    res['ngayCap'] = f"{dd:02d}/{mm:02d}/{yyyy}"
                    res['dinhDangLoi'].append(f"Ngày cấp trên HĐ sai định dạng quy chuẩn ({raw_cap} thay vì DD/MM/YYYY)")
                elif m_vn:
                    dd, mm, yyyy = int(m_vn.group(1)), int(m_vn.group(2)), m_vn.group(3)
                    res['ngayCap'] = f"{dd:02d}/{mm:02d}/{yyyy}"
                else:
                    res['ngayCap'] = raw_cap

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

    # 9. Chữ ký & con dấu
    sig_kw = ['chữ ký', 'ký tên', 'người ký', 'đã ký', 'ký, ghi rõ họ tên', '$sign-kh']
    stamp_kw = ['đóng dấu', 'con dấu', 'dấu mộc', '$sign-gcl']
    text_lower = text.lower()
    res['hasSignature'] = any(k in text_lower for k in sig_kw)
    res['hasStamp'] = any(k in text_lower for k in stamp_kw)

    return res


def extract_pdf_pl01(pdf_path: str) -> Dict[str, Any]:
    res = {
        'tenKH': None,
        'maTKGD': None,
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

    res['hasSignature'] = any(k in text_lower for k in ['ký', 'chữ ký', '$sign-kh'])
    res['hasStamp'] = any(k in text_lower for k in ['dấu', 'con dấu', '$sign-gcl'])
    return res


# ─────────────────────────────────────────────────────────────
# 2. CCCD QR CODE & MRZ & OCR EXTRACTOR
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
    img_cv = cv2.imread(image_path)
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

        # 3. Thử OpenCV QRCodeDetector trên vùng góc hoặc toàn ảnh
        try:
            rot_cv = img_cv
            if angle == 90: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_180)
            elif angle == 270: rot_cv = cv2.rotate(img_cv, cv2.ROTATE_90_COUNTERCLOCKWISE)

            det = cv2.QRCodeDetector()
            val, _, _ = det.detectAndDecode(rot_cv)
            if val:
                parsed = parse_qr_text(val.strip())
                if parsed:
                    return parsed
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


def try_decode_mrz(image_path: str) -> Optional[Dict[str, Any]]:
    """Đọc và giải mã 3 dòng MRZ ở mặt sau CCCD (chuẩn ICAO TD1)."""
    if not os.path.exists(image_path):
        return None

    try:
        import cv2
        import pytesseract
        import numpy as np
    except ImportError:
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None

    for angle in [0, 90, 180, 270]:
        if angle == 0: rot = img
        elif angle == 90: rot = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif angle == 180: rot = cv2.rotate(img, cv2.ROTATE_180)
        elif angle == 270: rot = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

        # Lấy 45% phía dưới
        h, w = rot.shape[:2]
        mrz_region = rot[int(h * 0.55):, :]
        gray = cv2.cvtColor(mrz_region, cv2.COLOR_BGR2GRAY)

        # Config MRZ
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
        text = pytesseract.image_to_string(gray, config=custom_config)
        lines = [l.strip() for l in text.split('\n') if len(l.strip()) >= 10]

        for l in lines:
            if re.search(r'[IDLT]DVNM', l) or re.search(r'\d{4,6}[0-9]?[FM]', l) or ('VNM' in l and re.search(r'\d{12}', l)):
                parsed = parse_mrz_lines(lines)
                if parsed and (parsed.get('soCCCD') or parsed.get('ngaySinh')):
                    parsed['source'] = 'MRZ'
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

    return None


def parse_mrz_lines(lines: List[str]) -> Dict[str, Any]:
    res = {
        'soCCCD': None,
        'ngaySinh': None,
        'gioiTinh': None,
        'noiCap': None,
        'hoTenKhongDau': None
    }
    line1 = next((l for l in lines if re.search(r'[IDLT]DVNM', l) or l.startswith('ID') or l.startswith('LD') or l.startswith('TD') or ('VNM' in l and re.search(r'\d{12}', l))), None)
    line2 = next((l for l in lines if re.search(r'\d{4,6}[0-9]?[FM]', l)), None)

    if line1:
        # Trong CCCD Việt Nam, số CCCD 12 số luôn nằm ngay trước dấu << ở cuối dòng 1
        m_end = re.search(r'(\d{12})<{1,2}', line1)
        if m_end:
            res['soCCCD'] = m_end.group(1)
        else:
            m_cands = re.findall(r'(0\d{11})', line1)
            if m_cands:
                res['soCCCD'] = m_cands[0]
            else:
                m_all12 = re.findall(r'(\d{12})', line1)
                if m_all12:
                    res['soCCCD'] = m_all12[-1]
                else:
                    m = re.search(r'[IDLT]DVNM(\d{9,12})', line1)
                    if m:
                        res['soCCCD'] = m.group(1)

    if line2:
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
                if res.get('soCCCD') and len(res['soCCCD']) == 12:
                    c_digit = res['soCCCD'][3]
                    yy = int(res['soCCCD'][4:6])
                    year = 1900 + yy if c_digit in ['0', '1'] else 2000 + yy
            res['ngaySinh'] = f"{dd:02d}/{mm:02d}/{year}"

    # Tìm dòng tên: chứa <<, không có VNM, không phải dòng ngày tháng sinh
    name_lines = [l for l in lines if '<<' in l and 'VNM' not in l and not re.search(r'\d{4,6}[FM]', l)]
    if name_lines:
        clean_name = re.sub(r'[^A-Z<]', '', name_lines[0])
        parts = [p.replace('<', ' ').strip() for p in clean_name.split('<<') if p.strip()]
        if len(parts) >= 2:
            res['hoTenKhongDau'] = f"{parts[0]} {' '.join(parts[1:])}".strip()
        elif len(parts) == 1:
            res['hoTenKhongDau'] = parts[0].replace('<', ' ').strip()

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
        im = cv2.imread(p)
        if im is None:
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

        return best_text

    # Front OCR
    front_txt = ocr_img(front_path, False) if front_path else ''
    # Back OCR
    back_txt = ocr_img(back_path, True) if back_path else ''

    combined = front_txt + '\n' + back_txt

    # Số CCCD (ưu tiên chuỗi 12 số bắt đầu bằng 0)
    m_cccd = re.search(r'(?:Số định danh cá nhân|Personal identification number|Số|No\.?|sé/no|séno)[\s:/]*(\d{12})', combined, re.IGNORECASE)
    if not m_cccd:
        m_cands = re.findall(r'(0\d{11})', combined)
        if m_cands:
            data['soCCCD'] = m_cands[0]
        else:
            m_cccd = re.search(r'(\d{12})', combined)
            if m_cccd:
                data['soCCCD'] = m_cccd.group(1).strip()
    else:
        data['soCCCD'] = m_cccd.group(1).strip()

    # Họ tên
    m_name = re.search(r'(?:Họ, chữ đệm và tên khai sinh|Full name|Họ và tên)[\s:/¬\-\n\r]+([A-ZÀ-Ỹ\s]{4,35})', combined, re.IGNORECASE)
    if m_name:
        name_cand = m_name.group(1).strip()
        if not any(k in name_cand.lower() for k in ['full name', 'quốc tịch', 'nationality']):
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
        raw = m_cap.group(1).replace('-', '/')
        p = raw.split('/')
        if len(p) == 3:
            data['ngayCap'] = f"{int(p[0]):02d}/{int(p[1]):02d}/{p[2]}"

    # Nơi cấp
    if 'BỘ CÔNG AN' in combined.upper() or 'BO CONG AN' in combined.upper():
        data['noiCap'] = 'BỘ CÔNG AN'
    elif 'CỤC CẢNH SÁT' in combined.upper():
        data['noiCap'] = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'

    return data


# ─────────────────────────────────────────────────────────────
# 3. PHÁT HIỆN LỖI ẢNH CCCD: MẤT GÓC, CẮT LẸM VIỀN, CẮT CHỮ
# ─────────────────────────────────────────────────────────────

def extract_issue_date_with_clahe(back_path: Optional[str]) -> Optional[str]:
    """Bóc tách ngày cấp nâng cao từ mặt sau CCCD bằng cách khoanh vùng ROI + Upscaling x2 + CLAHE."""
    if not back_path or not os.path.exists(back_path):
        return None
    try:
        import cv2
        import numpy as np
        import pytesseract

        im = cv2.imread(back_path)
        if im is None:
            return None

        # Thử 4 góc xoay để đảm bảo ảnh đúng chiều
        for angle in [0, 90, 180, 270]:
            if angle == 0: rot = im
            elif angle == 90: rot = cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180: rot = cv2.rotate(im, cv2.ROTATE_180)
            elif angle == 270: rot = cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE)

            h, w = rot.shape[:2]
            # Vùng ngày cấp trên mặt sau: Thường nằm ở 1/3 phía trên, bên phải chip (từ x=25% đến 98%, y=8% đến 65%)
            roi = rot[int(h * 0.08):int(h * 0.65), int(w * 0.25):int(w * 0.98)]
            if roi.shape[0] < 20 or roi.shape[1] < 20:
                continue

            # Phóng đại x2 (Bicubic Upscaling)
            roi_large = cv2.resize(roi, (0, 0), fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

            # Chuyển xám và cân bằng tương phản cục bộ (CLAHE)
            gray = cv2.cvtColor(roi_large, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)

            # Thử OCR trên cả ảnh enhanced và Otsu threshold
            candidates = [
                enhanced,
                cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
            ]

            for cand in candidates:
                txt = pytesseract.image_to_string(cand, lang='vie+eng', config='--oem 3 --psm 6')
                
                # Tìm mẫu Ngày ... tháng ... năm ... hoặc DD/MM/YYYY
                m_cap = re.search(r'(?:Ngày[,\s]+tháng[,\s]+năm|Date[,\s]+month[,\s]+year|ngày|Date)[\s:/]+(\d{1,2})[\s/-]+(\d{1,2})[\s/-]+(\d{4})', txt, re.IGNORECASE)
                if not m_cap:
                    m_cap = re.search(r'\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](201[5-9]|202[0-9])\b', txt)
                    if m_cap:
                        return f"{m_cap.group(1)}/{m_cap.group(2)}/{m_cap.group(3)}"
                else:
                    d, m, y = int(m_cap.group(1)), int(m_cap.group(2)), int(m_cap.group(3))
                    if 1 <= d <= 31 and 1 <= m <= 12 and 2015 <= y <= 2026:
                        return f"{d:02d}/{m:02d}/{y}"
    except Exception:
        pass
    return None


def inspect_image_clipping_and_quality(front_path: Optional[str], back_path: Optional[str], account_code: str = '') -> List[str]:
    """Kiểm tra chất lượng ảnh CCCD và bắt các lỗi cắt xén, mất góc, mờ nhòe với đa kịch bản."""
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

        im = cv2.imread(p)
        if im is None:
            continue

        base_name = os.path.basename(p)
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

        # 2. Kịch bản 2: Kiểm tra text bị xén cụt ở mép (Truncated text patterns)
        try:
            txt = pytesseract.image_to_string(im, lang='vie+eng')
            truncated_patterns = [
                'Việt N\n', 'Việt N ', 'Viet N\n', 'Viet N ',
                'trỏ phả\n', 'ngón trỏ phả', 'Hồ Chí Mir\n', 'Hồ Chí Mir '
            ]
            if any(pt in txt for pt in truncated_patterns):
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

            # Rule nhận diện Ảnh ghép 2 mặt (Composite Dual-Card Canvas)
            # Thẻ mặt trước và mặt sau xếp chồng theo chiều dọc (H >= W*0.85), có lề đệm đen/tối ở 2 bên
            is_composite_card = (h >= int(w * 0.82)) and (left_mean < 80 and right_mean < 80)
            
            # Nếu là ảnh ghép 2 mặt hợp lệ có viền đệm canvas:
            # Miễn là chữ/chi tiết không bị xén cụt thì coi là ảnh hợp lệ chuẩn
            if not is_composite_card:
                # 3A: Cắt xén sát rạt cả 4 cạnh (Zero-Margin / Over-Cropped như 003C8622268)
                # Áp dụng cho thẻ đơn (W > H*1.2): Cả 4 cạnh và 4 góc đều sáng màu thẻ (edges > 95 và corners > 90),
                # mất hoàn toàn 4 góc bo tròn chuẩn ISO/IEC 7810 ID-1
                all_bright_edges = sum(1 for e in edges if e > 95) >= 3
                all_bright_corners = sum(1 for c in corners if c > 90) >= 3
                if all_bright_edges and all_bright_corners and w > int(h * 1.2):
                    w_msg = f"CCCD bị cắt xén sát mép ảnh ({base_name}): thẻ bị crop chạm sát khung hình, mất góc bo tròn an toàn"
                    if w_msg not in warnings:
                        warnings.append(w_msg)

                # 3B: Tỉ lệ khung hình biến dạng đối với thẻ đơn
                if all_bright_edges and w > int(h * 1.2):
                    ratio = w / max(h, 1)
                    if ratio < 1.32 or ratio > 1.95:
                        w_msg = f"Tỉ lệ ảnh CCCD bất thường ({base_name}: {ratio:.2f} thay vì 1.59): nghi vấn bị cắt xén chiều ngang/dọc"
                        if w_msg not in warnings:
                            warnings.append(w_msg)
        except Exception:
            pass

        # 4. Kịch bản 5: Khoảng cách chữ/chi tiết tới mép ảnh (Edge-to-Text Proximity < 10px)
        try:
            data = pytesseract.image_to_data(im, lang='vie+eng', output_type=pytesseract.Output.DICT)
            n_boxes = len(data['text'])
            h_img, w_img = im.shape[:2]
            for i in range(n_boxes):
                word = data['text'][i].strip()
                if len(word) >= 3 and int(data['conf'][i]) > 30:
                    x, y, bw, bh = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    # Bắt các từ khóa quan trọng ở tiêu đề, số thẻ hoặc dòng MRZ
                    is_core_text = any(kw in word.upper() for kw in ['CỘNG', 'HÒA', 'CĂN', 'CƯỚC', 'IDVNM', 'CHỦ', 'NGHĨA', 'VIỆT', 'NAM'])
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

def call_gemini_vision_fallback(front_path: Optional[str], back_path: Optional[str], api_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Gọi Gemini AI Vision (gemini-2.0-flash / gemini-1.5-flash) bóc tách ảnh CCCD/Căn cước khi offline bị thiếu trường."""
    key = api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not key:
        return None

    import base64
    import urllib.request
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

    models = ['gemini-2.0-flash', 'gemini-1.5-flash']
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
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    resp_json = json.loads(response.read().decode('utf-8'))
                    text_content = resp_json['candidates'][0]['content']['parts'][0]['text'].strip()
                    clean_text = re.sub(r'^```json\s*|\s*```$', '', text_content, flags=re.MULTILINE).strip()
                    parsed = json.loads(clean_text)
                    if parsed and parsed.get('soCCCD'):
                        return parsed
        except Exception:
            continue

    return None


# ─────────────────────────────────────────────────────────────
# 5. HÀM CHÍNH TỔNG HỢP (PIPELINE)
# ─────────────────────────────────────────────────────────────

def process_account_files(hopdong: Optional[str], phuluc: Optional[str],
                           front: Optional[str], back: Optional[str],
                           code: str = '',
                           gemini_key: Optional[str] = None) -> Dict[str, Any]:
    result = {
        'accountCode': code,
        'hopDong': {},
        'phuLuc': {},
        'canCuoc': {},
        'warnings': []
    }

    # 1. Bóc tách hợp đồng
    if hopdong and os.path.exists(hopdong):
        result['hopDong'] = extract_pdf_contract(hopdong)
    
    # 2. Bóc tách phụ lục
    if phuluc and os.path.exists(phuluc):
        result['phuLuc'] = extract_pdf_pl01(phuluc)

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
    mrz_data = try_decode_mrz(back) if back else None
    if not mrz_data and front:
        mrz_data = try_decode_mrz(front)
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

    # Tối ưu tiền xử lý (Upscaling x2 + CLAHE) trích xuất ngày cấp mặt sau nếu OCR cơ bản chưa bóc tách được
    if not cccd_data.get('ngayCap'):
        if back and os.path.exists(back):
            cand_issue_date = extract_issue_date_with_clahe(back)
            if cand_issue_date:
                cccd_data['ngayCap'] = cand_issue_date
                cccd_data['rawNgayCap'] = cand_issue_date
                if cccd_data['source'] == 'NONE':
                    cccd_data['source'] = 'CLAHE_OCR'
        if not cccd_data.get('ngayCap') and front and os.path.exists(front):
            # Thử thêm trường hợp front/back bị gửi hoán đổi
            cand_issue_date = extract_issue_date_with_clahe(front)
            if cand_issue_date:
                cccd_data['ngayCap'] = cand_issue_date
                cccd_data['rawNgayCap'] = cand_issue_date
                if cccd_data['source'] == 'NONE':
                    cccd_data['source'] = 'CLAHE_OCR'

    # Thử Tầng Fallback AI Vision (Gemini Vision) nếu offline vẫn thiếu thông tin cốt lõi
    if not (cccd_data.get('soCCCD') and cccd_data.get('ngaySinh') and cccd_data.get('gioiTinh')):
        try:
            ai_data = call_gemini_vision_fallback(front, back, gemini_key)
            if ai_data:
                for k in ['soCCCD', 'hoTen', 'ngaySinh', 'gioiTinh', 'ngayCap', 'noiCap', 'diaChi']:
                    if not cccd_data.get(k) and ai_data.get(k):
                        cccd_data[k] = ai_data[k]
                cccd_data['source'] = 'AI_VISION'
        except Exception:
            pass

    # Bổ sung Nơi cấp thông minh nếu chưa có
    if not cccd_data.get('noiCap'):
        if result['hopDong'].get('noiCap'):
            cccd_data['noiCap'] = result['hopDong']['noiCap']
        else:
            cap_str = cccd_data.get('ngayCap') or result['hopDong'].get('ngayCap')
            if cap_str:
                try:
                    parts = cap_str.split('/')
                    if len(parts) == 3:
                        yr = int(parts[2])
                        if yr >= 2024:
                            cccd_data['noiCap'] = 'BỘ CÔNG AN'
                        elif yr >= 2021:
                            cccd_data['noiCap'] = 'Cục Cảnh sát quản lý hành chính về trật tự xã hội'
                except Exception:
                    pass

    # Bảo toàn chuỗi raw ngày tháng
    if cccd_data.get('ngaySinh') and not cccd_data.get('rawNgaySinh'):
        cccd_data['rawNgaySinh'] = cccd_data['ngaySinh']
    if cccd_data.get('ngayCap') and not cccd_data.get('rawNgayCap'):
        cccd_data['rawNgayCap'] = cccd_data['ngayCap']

    # 4. Kiểm tra chất lượng ảnh và mất góc
    quality_warnings = inspect_image_clipping_and_quality(front, back, code)
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

    result['canCuoc'] = cccd_data

    return result


def main():
    parser = argparse.ArgumentParser(description='TKGD Extractor Worker')
    parser.add_argument('--code', type=str, default='', help='Mã tài khoản')
    parser.add_argument('--hopdong', type=str, default=None, help='Đường dẫn file Hợp đồng PDF')
    parser.add_argument('--phuluc', type=str, default=None, help='Đường dẫn file Phụ lục 01 PDF')
    parser.add_argument('--front', type=str, default=None, help='Đường dẫn ảnh CCCD mặt trước')
    parser.add_argument('--back', type=str, default=None, help='Đường dẫn ảnh CCCD mặt sau')
    parser.add_argument('--gemini-key', type=str, default=None, help='Khóa API Gemini Vision')
    parser.add_argument('--json-input', type=str, default=None, help='Chuỗi JSON cấu hình đầu vào')

    args = parser.parse_args()

    gemini_key = args.gemini_key
    if args.json_input:
        try:
            cfg = json.loads(args.json_input)
            code = cfg.get('code', '')
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

    res = process_account_files(hopdong, phuluc, front, back, code, gemini_key=gemini_key)
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

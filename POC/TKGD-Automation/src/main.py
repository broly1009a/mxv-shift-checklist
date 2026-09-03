"""
Module 5: Main Orchestrator — Chạy toàn bộ pipeline xử lý hồ sơ TKGD
-----------------------------------------------------------------------
Quy trình:
  1. Đọc mail (local folder hoặc Graph API)
  2. Parse body mail → bóc tách Mã TK, Tên, trạng thái ACM
  3. OCR ảnh CCCD (QR → MRZ → OCR text)
  4. Extract PDF Hợp đồng + PL01
  5. (Tùy chọn) Scrape M-System lấy chi tiết TK
  6. So khớp 3 chiều và xuất Excel

Usage:
  python main.py --mode local --mail-folder inputs/mail-outlook
  python main.py --mode graph --config config.json
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, List
from datetime import datetime

# Import các module
from outlook_reader import read_mails_from_local_folder, GraphMailReader
from mail_parser import process_mail, ParsedMailData
from cccd_ocr import extract_cccd_data, CCCDData
from pdf_extractor import extract_pdf


# ─────────────────────────────────────────────
# Data Model tổng hợp
# ─────────────────────────────────────────────

@dataclass
class RecordResult:
    """Kết quả đối chiếu đầy đủ cho 1 mail / 1 hồ sơ TKGD."""
    
    # ── Thông tin từ Mail ──────────────────────
    mailId: str = ''
    receivedTime: str = ''
    senderEmail: str = ''
    
    maTKGDFutures: Optional[str] = None
    maTKGDACM: Optional[str] = None
    tenTK_mail: Optional[str] = None
    maTVKD: Optional[str] = None
    hasACMRequest: bool = False
    
    # ── Thông tin từ CCCD (OCR) ───────────────
    soCCCD_ocr: Optional[str] = None
    hoTen_ocr: Optional[str] = None
    ngaySinh_ocr: Optional[str] = None
    gioiTinh_ocr: Optional[str] = None
    diaChi_ocr: Optional[str] = None
    ngayCap_ocr: Optional[str] = None
    cccd_confidence: str = 'FAILED'
    
    # ── Thông tin từ PDF ──────────────────────
    tenKH_hopdong: Optional[str] = None
    maTK_hopdong: Optional[str] = None
    hopDong_hasSig: bool = False
    hopDong_hasStamp: bool = False
    pl01_valid: bool = False
    
    # ── Thông tin từ M-System ─────────────────
    ms_tenKH: Optional[str] = None
    ms_soCCCD: Optional[str] = None
    ms_ngaySinh: Optional[str] = None
    ms_ngayCap: Optional[str] = None
    ms_noiCap: Optional[str] = None
    ms_diaChi: Optional[str] = None
    ms_trangThai: Optional[str] = None
    ms_crawled: bool = False
    
    # ── Kết quả Đối chiếu ─────────────────────
    match_ten: Optional[bool] = None      # Tên mail = tên MS
    match_cccd: Optional[bool] = None     # CCCD OCR = CCCD MS
    match_ngaySinh: Optional[bool] = None
    ho_so_day_du: bool = False
    thieu_tai_lieu: str = ''
    
    # ── Kết luận cuối cùng ────────────────────
    ket_luan: str = 'CHUA_XU_LY'
    # Các giá trị: KHOP, LECH_TEN, LECH_CCCD, THIEU_HO_SO, THIEU_PL01, CHUA_TREN_MS, CHUA_XU_LY, CAN_KIEM_TRA
    
    ghi_chu: str = ''
    
    # ── Link mở file ──────────────────────────
    link_cccd_truoc: str = ''
    link_cccd_sau: str = ''
    link_hop_dong: str = ''
    link_pl01: str = ''


def derive_conclusion(record: RecordResult) -> RecordResult:
    """Tính toán kết luận đối chiếu dựa trên tất cả dữ liệu."""
    
    issues = []
    
    # 1. Kiểm tra hồ sơ đầy đủ
    if not record.link_hop_dong:
        issues.append("THIẾU_HĐ")
    if not record.link_cccd_truoc or not record.link_cccd_sau:
        issues.append("THIẾU_CCCD")
    if record.hasACMRequest and not record.link_pl01:
        issues.append("THIẾU_PL01")
    
    record.ho_so_day_du = len(issues) == 0
    record.thieu_tai_lieu = ', '.join(issues)
    
    # 2. Kiểm tra chữ ký/con dấu
    if not record.hopDong_hasSig or not record.hopDong_hasStamp:
        issues.append("THIEU_CHU_KY_DAU")
    
    # 3. Kiểm tra M-System
    if not record.ms_crawled:
        record.ket_luan = 'CHUA_XU_LY_MS'
        record.ghi_chu = 'Chưa kiểm tra M-System'
        return record
    
    if not record.ms_tenKH:
        record.ket_luan = 'CHUA_TREN_MS'
        record.ghi_chu = f"Mã TKGD {record.maTKGDFutures} chưa có trên M-System"
        return record
    
    # 4. So khớp Tên
    if record.tenTK_mail and record.ms_tenKH:
        from mail_parser import normalize_name
        record.match_ten = normalize_name(record.tenTK_mail) == normalize_name(record.ms_tenKH)
    
    # 5. So khớp CCCD
    if record.soCCCD_ocr and record.ms_soCCCD:
        record.match_cccd = record.soCCCD_ocr.strip() == record.ms_soCCCD.strip()
    elif record.soCCCD_ocr and not record.ms_soCCCD:
        record.match_cccd = None  # MS không có CCCD để so
    
    # 6. So khớp Ngày sinh
    if record.ngaySinh_ocr and record.ms_ngaySinh:
        def normalize_date(d):
            return re.sub(r'[^0-9]', '', d) if d else ''
        record.match_ngaySinh = normalize_date(record.ngaySinh_ocr) == normalize_date(record.ms_ngaySinh)
    
    # 7. Kết luận
    if issues:
        record.ket_luan = 'THIEU_HO_SO' if any('THIEU' in i for i in issues) else 'THIEU_CHU_KY'
        record.ghi_chu = ', '.join(issues)
    elif record.match_cccd is False:
        record.ket_luan = 'LECH_CCCD'
        record.ghi_chu = f"CCCD OCR={record.soCCCD_ocr} ≠ MS={record.ms_soCCCD}"
    elif record.match_ten is False:
        record.ket_luan = 'LECH_TEN'
        record.ghi_chu = f"Tên mail={record.tenTK_mail} ≠ MS={record.ms_tenKH}"
    elif record.cccd_confidence == 'FAILED':
        record.ket_luan = 'CAN_KIEM_TRA'
        record.ghi_chu = 'OCR CCCD không đọc được, cần kiểm tra thủ công'
    else:
        record.ket_luan = 'KHOP'
        record.ghi_chu = '✅ Hồ sơ hợp lệ, sẵn sàng phê duyệt'
    
    return record


import re


def process_single_mail(raw_mail, msystem_scraper=None) -> RecordResult:
    """Xử lý đầy đủ 1 mail → trả về RecordResult."""
    
    record = RecordResult(
        mailId=raw_mail.mail_id,
        receivedTime=raw_mail.received_time,
        senderEmail=raw_mail.sender_email,
    )
    
    print(f"\n{'='*60}")
    print(f"XỬ LÝ: {raw_mail.mail_id}")
    print('='*60)
    
    # ── Bước 1: Parse body mail ────────────────────────────────
    print("\n[1] Phân tích Body Mail...")
    parsed = process_mail(raw_mail)
    
    record.maTKGDFutures = parsed.maTKGDFutures
    record.maTKGDACM = parsed.maTKGDACM
    record.tenTK_mail = parsed.tenTK
    record.maTVKD = parsed.maTVKD
    record.hasACMRequest = parsed.hasACMRequest
    record.link_hop_dong = parsed.hopDongFile or ''
    record.link_pl01 = parsed.pl01File or ''
    record.link_cccd_truoc = parsed.cccdTruocFile or ''
    record.link_cccd_sau = parsed.cccdSauFile or ''
    
    # ── Bước 2: OCR CCCD ───────────────────────────────────────
    print("\n[2] OCR Căn cước công dân...")
    cccd = extract_cccd_data(parsed.cccdTruocFile, parsed.cccdSauFile)
    
    record.soCCCD_ocr = cccd.soCCCD
    record.hoTen_ocr = cccd.hoTen or cccd.hoTenKhongDau
    record.ngaySinh_ocr = cccd.ngaySinh
    record.gioiTinh_ocr = cccd.gioiTinh
    record.diaChi_ocr = cccd.diaChi
    record.ngayCap_ocr = cccd.ngayCap
    record.cccd_confidence = cccd.confidence
    
    # ── Bước 3: Extract PDF ────────────────────────────────────
    print("\n[3] Trích xuất PDF...")
    if parsed.hopDongFile:
        hd_result = extract_pdf(parsed.hopDongFile, 'hop_dong')
        record.tenKH_hopdong = hd_result.tenKH_in_pdf
        record.maTK_hopdong = hd_result.maTKGD_in_pdf
        record.hopDong_hasSig = hd_result.has_signature_area
        record.hopDong_hasStamp = hd_result.has_stamp_area
    
    if parsed.pl01File:
        pl01_result = extract_pdf(parsed.pl01File, 'pl01')
        record.pl01_valid = pl01_result.extraction_success
    
    # ── Bước 4: Scrape M-System (nếu có scraper) ──────────────
    if msystem_scraper and record.maTKGDFutures:
        print(f"\n[4] Truy vấn M-System: {record.maTKGDFutures}...")
        ms_data = msystem_scraper.get_account_detail(record.maTKGDFutures)
        if ms_data:
            record.ms_tenKH = ms_data.get('tenKH')
            record.ms_soCCCD = ms_data.get('soCCCD')
            record.ms_ngaySinh = ms_data.get('ngaySinh')
            record.ms_ngayCap = ms_data.get('ngayCap')
            record.ms_noiCap = ms_data.get('noiCap')
            record.ms_diaChi = ms_data.get('diaChi')
            record.ms_trangThai = ms_data.get('trangThai')
            record.ms_crawled = True
    
    # ── Bước 5: Kết luận đối chiếu ────────────────────────────
    print("\n[5] Tính kết luận đối chiếu...")
    record = derive_conclusion(record)
    
    print(f"\n  🎯 KẾT LUẬN: {record.ket_luan}")
    print(f"     Ghi chú: {record.ghi_chu}")
    
    return record


def run_batch(mail_folder: str, output_excel: str = None, 
              config_path: str = None, skip_msystem: bool = True):
    """
    Chạy toàn bộ pipeline cho tất cả mail trong thư mục.
    
    Args:
        mail_folder: Đường dẫn thư mục chứa các mẫu mail
        output_excel: Đường dẫn file Excel đầu ra
        config_path: Config file JSON (cho Graph API + M-System)
        skip_msystem: True = bỏ qua bước scrape M-System (dev mode)
    """
    
    print(f"\n{'='*60}")
    print("🚀 TKGD AUTOMATION - BẮT ĐẦU XỬ LÝ")
    print(f"   Mail folder: {mail_folder}")
    print(f"   Output: {output_excel or 'Auto-generate'}")
    print('='*60)
    
    # Đọc mail
    print(f"\n📬 Đang đọc mail từ: {mail_folder}")
    raw_mails = read_mails_from_local_folder(mail_folder)
    print(f"   Tổng cộng: {len(raw_mails)} mail")
    
    if not raw_mails:
        print("❌ Không có mail nào để xử lý!")
        return []
    
    # Xử lý từng mail
    records = []
    for mail in raw_mails:
        try:
            record = process_single_mail(mail, msystem_scraper=None)
            records.append(record)
        except Exception as e:
            print(f"\n❌ Lỗi xử lý mail {mail.mail_id}: {e}")
            import traceback
            traceback.print_exc()
    
    # Xuất Excel
    if not output_excel:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_excel = f"output/DOI_CHIEU_TKGD_{ts}.xlsx"
    
    os.makedirs(os.path.dirname(output_excel) if os.path.dirname(output_excel) else '.', exist_ok=True)
    
    print(f"\n📊 Xuất Excel: {output_excel}")
    from excel_exporter import export_to_excel
    export_to_excel(records, output_excel)
    
    # Tổng kết
    print(f"\n{'='*60}")
    print("📋 TỔNG KẾT")
    print('='*60)
    total = len(records)
    khop = sum(1 for r in records if r.ket_luan == 'KHOP')
    lech = sum(1 for r in records if r.ket_luan in ('LECH_TEN', 'LECH_CCCD'))
    thieu = sum(1 for r in records if 'THIEU' in r.ket_luan)
    chua_ms = sum(1 for r in records if 'MS' in r.ket_luan)
    
    print(f"  Tổng mail xử lý:     {total}")
    print(f"  ✅ KHỚP hoàn toàn:   {khop}")
    print(f"  🔴 LỆCH thông tin:   {lech}")
    print(f"  🟡 THIẾU hồ sơ:     {thieu}")
    print(f"  🟠 Chưa trên MS:     {chua_ms}")
    print(f"\n  📁 File Excel: {output_excel}")
    
    return records


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='TKGD Automation — Xử lý hồ sơ mở tài khoản')
    parser.add_argument('--mail-folder', default='../inputs/mail-outlook',
                        help='Thư mục chứa mail mẫu (local mode)')
    parser.add_argument('--output', default=None,
                        help='Đường dẫn file Excel đầu ra')
    parser.add_argument('--skip-msystem', action='store_true', default=True,
                        help='Bỏ qua bước scrape M-System')
    
    args = parser.parse_args()
    
    # Xác định đường dẫn tương đối từ thư mục src/
    script_dir = Path(__file__).parent
    mail_folder = args.mail_folder
    if not os.path.isabs(mail_folder):
        mail_folder = str(script_dir / mail_folder)
    
    output_excel = args.output
    if not output_excel:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = script_dir.parent / 'output'
        output_excel = str(output_dir / f'DOI_CHIEU_TKGD_{ts}.xlsx')
    
    records = run_batch(
        mail_folder=mail_folder,
        output_excel=output_excel,
        skip_msystem=args.skip_msystem
    )

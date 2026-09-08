"""
Module 2: Mail Parser — Trích xuất dữ liệu có cấu trúc từ Body Mail
--------------------------------------------------------------------
Áp dụng Regex đã xác nhận từ 2 mail mẫu thực tế của TVKD 003.
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParsedMailData:
    """Dữ liệu đã bóc tách từ body mail."""
    # Thông tin tài khoản
    maTKGDFutures: Optional[str] = None
    maTKGDACM: Optional[str] = None
    tenTK: Optional[str] = None
    maTVKD: Optional[str] = None
    
    # Trạng thái hồ sơ (phân tích từ nội dung body)
    hasACMRequest: bool = False     # Mail có đề cập yêu cầu mở ACM không
    hasPL01Mention: bool = False    # Body có nhắc đến PL01 không
    
    # Thông tin file đính kèm (phân tích từ tên file thực tế)
    hopDongFile: Optional[str] = None   # Path file *-mxv.pdf
    pl01File: Optional[str] = None      # Path file *-PL01.pdf
    cccdTruocFile: Optional[str] = None # Path ảnh CCCD mặt trước
    cccdSauFile: Optional[str] = None   # Path ảnh CCCD mặt sau
    
    # Kiểm tra tính đầy đủ hồ sơ
    @property
    def isComplete(self) -> bool:
        has_hop_dong = self.hopDongFile is not None
        has_cccd = self.cccdTruocFile is not None and self.cccdSauFile is not None
        if self.hasACMRequest:
            return has_hop_dong and has_cccd and self.pl01File is not None
        return has_hop_dong and has_cccd
    
    @property
    def missingDocs(self) -> list:
        missing = []
        if not self.hopDongFile:
            missing.append("Hợp đồng mở TKGD (*-mxv.pdf)")
        if not self.cccdTruocFile:
            missing.append("CCCD mặt trước")
        if not self.cccdSauFile:
            missing.append("CCCD mặt sau")
        if self.hasACMRequest and not self.pl01File:
            missing.append("Phụ lục PL01 (*-PL01.pdf)")
        return missing


def normalize_name(name: str) -> str:
    """Chuẩn hóa tên: bỏ dấu, in hoa, xóa khoảng trắng thừa."""
    if not name:
        return ''
    # NFC normalize
    name = unicodedata.normalize('NFC', name)
    # Bỏ dấu
    nfkd = unicodedata.normalize('NFKD', name)
    ascii_name = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    return ' '.join(ascii_name.upper().split())


def parse_mail_body(body_text: str) -> ParsedMailData:
    """
    Trích xuất thông tin TKGD từ body mail.
    
    Đã test với 2 mail mẫu thực tế của TVKD 003:
    - Mẫu 1: NGO-DUC-HAI → 003C2333888 + ACM 003C2333888-A
    - Mẫu 2: NGUYEN-ANH-KHOA → 003C0656625 (chỉ Futures)
    """
    result = ParsedMailData()
    text = body_text or ''
    
    # ─── 1. Mã TKGD Futures ───────────────────────────────────────────────
    # Chiến lược: tìm trong đoạn "Tài khoản giao dịch Futures" trước
    # Pattern: 3 số + C/P/E/F/I + 7 số, KHÔNG có hậu tố -A/-L/-M/-S
    m = re.search(
        r'Tài khoản giao dịch Futures[^\n]*\n.*?Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})\b(?![\s]*-[ALMS])',
        text, re.DOTALL | re.IGNORECASE
    )
    if not m:
        # Fallback: lấy bất kỳ mã nào không có hậu tố
        m = re.search(
            r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})\b(?![\s]*-[ALMS])',
            text, re.IGNORECASE
        )
    result.maTKGDFutures = m.group(1).strip() if m else None
    
    # ─── 2. Mã TKGD ACM ───────────────────────────────────────────────────
    m = re.search(
        r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7}-[ALMS])\b',
        text, re.IGNORECASE
    )
    result.maTKGDACM = m.group(1).strip() if m else None
    
    # ─── 3. Tên tài khoản ─────────────────────────────────────────────────
    # Lấy tên đầu tiên xuất hiện sau "Tên tài khoản:"
    m = re.search(r'Tên tài khoản\s*:\s*(.+?)(?:\r?\n|$)', text, re.IGNORECASE)
    result.tenTK = m.group(1).strip() if m else None
    
    # ─── 4. Mã TVKD ───────────────────────────────────────────────────────
    if result.maTKGDFutures:
        result.maTVKD = result.maTKGDFutures[:3]
    
    # ─── 5. Phát hiện yêu cầu ACM ────────────────────────────────────────
    result.hasACMRequest = bool(re.search(
        r'Ti[eê]u kho[aả]n ACM|tài kho[aả]n.*?ACM|TKGD.*?ACM|ACM.*?TKGD',
        text, re.IGNORECASE | re.DOTALL
    )) or result.maTKGDACM is not None
    
    # ─── 6. Phát hiện đề cập PL01 ────────────────────────────────────────
    result.hasPL01Mention = bool(re.search(
        r'Ph[uụ] l[uụ]c\s*(s[oố]\s*01|01)|PL[\s-]?01|ph[uụ] l[uụ]c.*ti[eê]u kho[aả]n',
        text, re.IGNORECASE
    ))
    
    return result


def match_attachments(parsed: ParsedMailData, attachments: list) -> ParsedMailData:
    """
    Gán đường dẫn file đính kèm vào ParsedMailData dựa trên loại file
    đã được classify_attachment() phân loại.
    
    Args:
        parsed: ParsedMailData đã có thông tin từ body
        attachments: list[MailAttachment] từ outlook_reader
    Returns:
        ParsedMailData đã được cập nhật đường dẫn file
    """
    for att in attachments:
        if att.file_type == 'hop_dong' and not parsed.hopDongFile:
            parsed.hopDongFile = att.local_path
        elif att.file_type == 'pl01' and not parsed.pl01File:
            parsed.pl01File = att.local_path
        elif att.file_type == 'cccd_truoc' and not parsed.cccdTruocFile:
            parsed.cccdTruocFile = att.local_path
        elif att.file_type == 'cccd_sau' and not parsed.cccdSauFile:
            parsed.cccdSauFile = att.local_path
    
    # Nếu vẫn chưa phân loại được CCCD (từ img_other), heuristic theo tên file
    unclassified_imgs = [a for a in attachments if a.file_type == 'img_other']
    for att in unclassified_imgs:
        fn = att.filename.lower()
        if any(k in fn for k in ['truoc', 'front', '1', 'a']):
            if not parsed.cccdTruocFile:
                parsed.cccdTruocFile = att.local_path
        elif any(k in fn for k in ['sau', 'back', '2', 'b']):
            if not parsed.cccdSauFile:
                parsed.cccdSauFile = att.local_path
    
    return parsed


def process_mail(raw_mail) -> ParsedMailData:
    """
    Hàm tổng hợp: Parse body + gán attachments cho 1 mail.
    
    Args:
        raw_mail: RawMail từ outlook_reader
    Returns:
        ParsedMailData đầy đủ
    """
    # Parse body
    parsed = parse_mail_body(raw_mail.body_text)
    
    # Gán file đính kèm
    parsed = match_attachments(parsed, raw_mail.attachments)
    
    print(f"\n   Mail: {raw_mail.mail_id}")
    print(f"     Futures: {parsed.maTKGDFutures}")
    print(f"     ACM:     {parsed.maTKGDACM}")
    print(f"     Tên TK:  {parsed.tenTK}")
    print(f"     TVKD:    {parsed.maTVKD}")
    print(f"     Hợp đồng:{parsed.hopDongFile}")
    print(f"     PL01:    {parsed.pl01File}")
    print(f"     CCCD trước: {parsed.cccdTruocFile}")
    print(f"     CCCD sau:   {parsed.cccdSauFile}")
    
    if not parsed.isComplete:
        print(f"  ⚠️  THIẾU HỒ SƠ: {', '.join(parsed.missingDocs)}")
    else:
        print(f"  ✅ Hồ sơ đầy đủ")
    
    return parsed

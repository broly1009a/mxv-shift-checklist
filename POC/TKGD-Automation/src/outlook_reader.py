"""
Module 1: Outlook Reader — Đọc mail từ Microsoft 365 Graph API
------------------------------------------------------------------
Hỗ trợ 2 mode:
  - GRAPH API: Đọc từ server mailbox qua OAuth2 (cần Azure AD App)
  - LOCAL FOLDER: Đọc từ thư mục chứa file content.md + attachments
    (dùng cho dev/test khi chưa có Azure AD)
"""

import os
import re
import json
import requests
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# ─────────────────────────────────────────────
# Data Model
# ─────────────────────────────────────────────

@dataclass
class MailAttachment:
    filename: str
    local_path: str
    file_type: str   # 'hop_dong' | 'pl01' | 'cccd_truoc' | 'cccd_sau' | 'other'

@dataclass
class RawMail:
    mail_id: str
    subject: str
    sender_email: str
    sender_name: str
    received_time: str
    body_text: str
    attachments: list = field(default_factory=list)  # List[MailAttachment]


# ─────────────────────────────────────────────
# Attachment classifier
# ─────────────────────────────────────────────

def classify_attachment(filename: str) -> str:
    """Phân loại file đính kèm dựa trên tên file."""
    fn = filename.lower()
    if fn.endswith('-pl01.pdf') or 'pl01' in fn:
        return 'pl01'
    if fn.endswith('-mxv.pdf') or ('hop' in fn and '.pdf' in fn):
        return 'hop_dong'
    if 'truoc' in fn or 'front' in fn or 'mat-truoc' in fn:
        return 'cccd_truoc'
    if 'sau' in fn or 'back' in fn or 'mat-sau' in fn:
        return 'cccd_sau'
    if fn.endswith('.pdf'):
        return 'pdf_other'
    if fn.endswith(('.jpg', '.jpeg', '.png')):
        return 'img_other'
    return 'other'


# ─────────────────────────────────────────────
# Mode A: Đọc từ thư mục local (dev/test)
# ─────────────────────────────────────────────

def read_mails_from_local_folder(folder_path: str) -> list:
    """
    Đọc các mail từ cấu trúc thư mục:
    folder/
      mẫu 1/
        content.md   ← body mail
        sender.md    ← email người gửi
        subject.md   ← tiêu đề
        *.pdf        ← file đính kèm
        *.jpg        ← ảnh CCCD
      mẫu 2/
        ...
    """
    mails = []
    root = Path(folder_path)
    
    for sample_dir in sorted(root.iterdir()):
        if not sample_dir.is_dir():
            continue
        
        content_file = sample_dir / 'content.md'
        if not content_file.exists():
            continue
        
        body = content_file.read_text(encoding='utf-8')
        
        # Đọc sender
        sender_email = ''
        sender_file = sample_dir / 'sender.md'
        if sender_file.exists():
            sender_email = sender_file.read_text(encoding='utf-8').strip()
        
        # Đọc subject  
        subject = 'Yêu cầu mở TKGD'
        subject_file = sample_dir / 'subject.md'
        if subject_file.exists():
            subject = subject_file.read_text(encoding='utf-8').strip()
        
        # Trích xuất thông tin từ header trong content.md
        m_from = re.search(r'^From:\s*(.+?)\s*<(.+?)>', body, re.MULTILINE)
        sender_name = m_from.group(1).strip() if m_from else ''
        if not sender_email and m_from:
            sender_email = m_from.group(2).strip()
        
        m_sent = re.search(r'^Sent:\s*(.+)$', body, re.MULTILINE)
        received_time = m_sent.group(1).strip() if m_sent else ''
        
        m_subj = re.search(r'^Subject:\s*(.+)$', body, re.MULTILINE)
        if m_subj:
            subject = m_subj.group(1).strip()
        
        # Thu thập attachments
        attachments = []
        for f in sorted(sample_dir.iterdir()):
            if f.suffix.lower() in ['.pdf', '.jpg', '.jpeg', '.png']:
                att = MailAttachment(
                    filename=f.name,
                    local_path=str(f),
                    file_type=classify_attachment(f.name)
                )
                attachments.append(att)
        
        mail = RawMail(
            mail_id=sample_dir.name,
            subject=subject,
            sender_email=sender_email,
            sender_name=sender_name,
            received_time=received_time,
            body_text=body,
            attachments=attachments
        )
        mails.append(mail)
        print(f"  [LOCAL] Đã đọc: {sample_dir.name} | {len(attachments)} attachments")
    
    return mails


# ─────────────────────────────────────────────
# Mode B: Đọc từ Microsoft 365 Graph API
# ─────────────────────────────────────────────

class GraphMailReader:
    """
    Đọc mail từ mailbox Microsoft 365 qua Graph API.
    
    Cần cấu hình Azure AD App với quyền Mail.Read (Application permission).
    Thông tin cấu hình trong config.json hoặc biến môi trường.
    """
    
    def __init__(self, client_id: str, client_secret: str, tenant_id: str,
                 mailbox_email: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.mailbox_email = mailbox_email
        self._access_token = None
    
    def authenticate(self) -> bool:
        """Lấy OAuth2 access token."""
        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        resp = requests.post(token_url, data={
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': 'https://graph.microsoft.com/.default',
            'grant_type': 'client_credentials'
        })
        if resp.status_code == 200:
            self._access_token = resp.json()['access_token']
            print(f"  [GRAPH] Xác thực thành công cho mailbox: {self.mailbox_email}")
            return True
        else:
            print(f"  [GRAPH ERROR] Xác thực thất bại: {resp.text}")
            return False
    
    @property
    def _headers(self):
        return {'Authorization': f'Bearer {self._access_token}',
                'Content-Type': 'application/json'}
    
    def fetch_mails(self, subject_filter: str = "Yêu cầu mở TKGD",
                    sender_filter: str = "", hours_back: int = 24,
                    max_count: int = 100, download_dir: str = './downloads') -> list:
        """
        Lấy danh sách mail theo bộ lọc.
        
        Args:
            subject_filter: Lọc theo tiêu đề (chứa chuỗi này)
            sender_filter: Lọc theo email người gửi (để trống = không lọc)
            hours_back: Lấy mail trong N giờ gần nhất
            max_count: Tối đa số mail lấy về
            download_dir: Thư mục lưu file đính kèm
        """
        from datetime import datetime, timedelta, timezone
        
        if not self._access_token:
            if not self.authenticate():
                return []
        
        # Tạo filter OData
        since_time = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).isoformat()
        
        filter_parts = [f"receivedDateTime ge {since_time}"]
        if subject_filter:
            filter_parts.append(f"contains(subject,'{subject_filter}')")
        if sender_filter:
            filter_parts.append(f"from/emailAddress/address eq '{sender_filter}'")
        
        odata_filter = ' and '.join(filter_parts)
        
        url = (
            f"https://graph.microsoft.com/v1.0/users/{self.mailbox_email}/messages"
            f"?$filter={requests.utils.quote(odata_filter)}"
            f"&$select=id,subject,from,receivedDateTime,body"
            f"&$top={max_count}"
            f"&$orderby=receivedDateTime desc"
        )
        
        resp = requests.get(url, headers=self._headers)
        if not resp.ok:
            print(f"  [GRAPH ERROR] Không thể lấy danh sách mail: {resp.text}")
            return []
        
        messages = resp.json().get('value', [])
        print(f"  [GRAPH] Tìm thấy {len(messages)} mail khớp bộ lọc")
        
        mails = []
        for msg in messages:
            # Lấy body dạng text
            body_content = msg.get('body', {}).get('content', '')
            # Strip HTML nếu cần
            body_text = re.sub(r'<[^>]+>', ' ', body_content)
            body_text = re.sub(r'\s+', ' ', body_text)
            
            mail_id = msg['id']
            received = msg.get('receivedDateTime', '')
            subject = msg.get('subject', '')
            sender_addr = msg.get('from', {}).get('emailAddress', {})
            
            # Tải attachments
            att_dir = os.path.join(download_dir, mail_id[:16].replace('/', '_'))
            os.makedirs(att_dir, exist_ok=True)
            attachments = self._download_attachments(mail_id, att_dir)
            
            mail = RawMail(
                mail_id=mail_id,
                subject=subject,
                sender_email=sender_addr.get('address', ''),
                sender_name=sender_addr.get('name', ''),
                received_time=received,
                body_text=body_text,
                attachments=attachments
            )
            mails.append(mail)
        
        return mails
    
    def _download_attachments(self, message_id: str, save_dir: str) -> list:
        """Tải tất cả file đính kèm của 1 mail về thư mục local."""
        url = (
            f"https://graph.microsoft.com/v1.0/users/{self.mailbox_email}"
            f"/messages/{message_id}/attachments"
        )
        resp = requests.get(url, headers=self._headers)
        if not resp.ok:
            return []
        
        attachments = []
        for att in resp.json().get('value', []):
            if att.get('@odata.type') != '#microsoft.graph.fileAttachment':
                continue
            
            filename = att.get('name', 'unknown')
            content_b64 = att.get('contentBytes', '')
            
            if not content_b64:
                continue
            
            import base64
            file_data = base64.b64decode(content_b64)
            local_path = os.path.join(save_dir, filename)
            
            with open(local_path, 'wb') as f:
                f.write(file_data)
            
            attachment = MailAttachment(
                filename=filename,
                local_path=local_path,
                file_type=classify_attachment(filename)
            )
            attachments.append(attachment)
            print(f"    ↳ Tải: {filename} ({len(file_data)//1024}KB)")
        
        return attachments


# ─────────────────────────────────────────────
# Factory function
# ─────────────────────────────────────────────

def get_mail_reader(mode: str = 'local', config: dict = None):
    """
    mode='local': Đọc từ thư mục local inputs/mail-outlook/
    mode='graph': Đọc từ Microsoft 365 Graph API
    """
    if mode == 'graph':
        if not config:
            raise ValueError("Cần truyền config cho Graph API mode")
        return GraphMailReader(
            client_id=config['client_id'],
            client_secret=config['client_secret'],
            tenant_id=config['tenant_id'],
            mailbox_email=config['mailbox_email']
        )
    return None  # local mode dùng hàm read_mails_from_local_folder()

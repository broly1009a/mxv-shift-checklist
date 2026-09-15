# Phân tích Pattern Regex từ Mail Mẫu TVKD 003

## Kết quả phân tích 2 mail mẫu thực tế

### Mẫu 1 — NGO-DUC-HAI (Mở TKGD + ACM)
```
From: CÔNG TY CỔ PHẦN GIAO DỊCH HÀNG HÓA GIA CÁT LỢI <dautuhanghoa@giacatloi.vn>
Mã TKGD Futures: 003C2333888
Mã TKGD ACM:     003C2333888-A
Tên TK:          Ngô Đức Hải
PL01:            Có (Phụ lục số 01 đăng ký mở bổ sung tiểu khoản)
File đính kèm:   NGO-DUC-HAI-mxv.pdf, NGO-DUC-HAI-PL01.pdf, CCCD x2
```

### Mẫu 2 — NGUYEN-ANH-KHOA (Mở TKGD Futures only)
```
From: CÔNG TY CỔ PHẦN GIAO DỊCH HÀNG HÓA GIA CÁT LỢI <dautuhanghoa@giacatloi.vn>
Mã TKGD Futures: 003C0656625
Mã TKGD ACM:     Không có
Tên TK:          NGUYỄN ANH KHOA
PL01:            Không có
File đính kèm:   NGUYEN-ANH-KHOA-mxv.pdf, CCCD x2
```

---

## REGEX PATTERNS ĐÃ XÁC NHẬN

### Pattern 1: Mã TKGD Futures
```python
# Format: 3 số + C + 7 số (không có hậu tố)
PATTERN_FUTURES = r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})(?!\s*-)'
# Hoặc rộng hơn để bắt cả dòng tiêu đề Futures:
PATTERN_FUTURES_V2 = r'Tài khoản giao dịch Futures[:\s]*.*?Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})'

# Test với mẫu: "Mã TKGD: 003C2333888" → "003C2333888" 
# Test với mẫu: "Mã TKGD: 003C0656625" → "003C0656625" 
```

### Pattern 2: Mã TKGD ACM
```python
# Format: 3 số + C + 7 số + -A (hoặc -M, -L, -S)
PATTERN_ACM = r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7}-[ALMS])'
# Hoặc theo đoạn "Tài khoản giao dịch ACM":
PATTERN_ACM_V2 = r'Tài khoản giao dịch ACM[:\s]*.*?Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7}-[ALMS])'

# Test với mẫu: "Mã TKGD: 003C2333888-A" → "003C2333888-A" 
# Mẫu 2 không có ACM → None 
```

### Pattern 3: Tên Tài Khoản
```python
# Theo sau mỗi Mã TKGD
PATTERN_TEN_TK = r'Tên tài khoản\s*:\s*(.+?)(?:\r?\n|$)'

# Test: "Tên tài khoản: Ngô Đức Hải" → "Ngô Đức Hải" 
# Test: "Tên tài khoản: NGUYỄN ANH KHOA" → "NGUYỄN ANH KHOA" 
```

### Pattern 4: Mã TVKD (từ mã TK)
```python
# 3 ký tự đầu của investorCode
PATTERN_TVKD_FROM_CODE = r'^(\d{3})'  # Apply on maTKGD

# "003C2333888" → "003" → TVKD 003 
```

### Pattern 5: Phát hiện có ACM không
```python
# Nếu body mail có chứa chuỗi này → có yêu cầu mở ACM
HAS_ACM_PATTERN = r'Tiểu khoản ACM|tài khoản.*ACM|TKGD.*ACM'
# Mẫu 1: "mở TKGD + Tiểu khoản ACM" → True 
# Mẫu 2: không có → False 
```

### Pattern 6: Phát hiện có PL01 không
```python
# Kiểm tra body mail đề cập PL01
HAS_PL01_MENTION = r'Phụ lục số 01|PL01|phụ lục.*tiểu khoản'
# Mẫu 1: "Phụ lục số 01 đăng ký mở bổ sung tiểu khoản" → True 
# Mẫu 2: không có → False 

# Kiểm tra file đính kèm có PL01 không
HAS_PL01_ATTACHMENT = r'PL01\.(pdf|PDF)$'
```

### Pattern 7: Tên file đính kèm chuẩn
```python
# Format tên file: [TEN-KHONG-DAU]-[LOAI].[ext]
# Loại: mxv (hợp đồng), PL01 (phụ lục)
ATTACHMENT_HOP_DONG = r'^(.+)-mxv\.(pdf|PDF)$'
ATTACHMENT_PL01     = r'^(.+)-PL01\.(pdf|PDF)$'
ATTACHMENT_CCCD     = r'(CCCD|cccd|truoc|sau|front|back)\.(jpg|png|jpeg|JPG|PNG)$'
```

---

## HÀM PARSER HOÀN CHỈNH

```python
import re
from typing import Optional

def parse_mail_body(body: str) -> dict:
    """
    Trích xuất dữ liệu có cấu trúc từ body email mở TKGD của TVKD 003.
    
    Returns:
        {
            "maTKGDFutures": "003C2333888",
            "maTKGDACM": "003C2333888-A" | None,
            "tenTK": "Ngô Đức Hải",
            "maTVKD": "003",
            "hasACM": True | False,
            "hasPL01Mention": True | False,
        }
    """
    result = {}
    
    # 1. Bóc tách Mã TK Futures
    # Tìm dòng "Mã TKGD: 003CXXXXXXX" không theo sau bởi "-"
    m_futures = re.search(
        r'Tài khoản giao dịch Futures.*?Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})(?!\s*-)',
        body, re.DOTALL | re.IGNORECASE
    )
    if not m_futures:
        # Fallback: lấy mã không có hậu tố
        m_futures = re.search(
            r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7})(?!\s*-)',
            body, re.IGNORECASE
        )
    result['maTKGDFutures'] = m_futures.group(1).strip() if m_futures else None
    
    # 2. Bóc tách Mã TK ACM
    m_acm = re.search(
        r'Mã TKGD\s*:\s*(\d{3}[A-Z]\d{7}-[ALMS])',
        body, re.IGNORECASE
    )
    result['maTKGDACM'] = m_acm.group(1).strip() if m_acm else None
    
    # 3. Bóc tách Tên tài khoản (ưu tiên tên Futures)
    # Lấy tên xuất hiện đầu tiên sau "Tên tài khoản:"
    m_ten = re.search(
        r'Tên tài khoản\s*:\s*(.+?)(?:\r?\n|$)',
        body, re.IGNORECASE
    )
    result['tenTK'] = m_ten.group(1).strip() if m_ten else None
    
    # 4. Mã TVKD từ 3 số đầu mã TK
    if result.get('maTKGDFutures'):
        result['maTVKD'] = result['maTKGDFutures'][:3]
    else:
        result['maTVKD'] = None
    
    # 5. Phát hiện có ACM không
    result['hasACM'] = bool(re.search(
        r'Ti[eê]u kho[aả]n ACM|tài kho[aả]n.*ACM|TKGD.*ACM',
        body, re.IGNORECASE
    ))
    
    # 6. Phát hiện mention PL01 trong body
    result['hasPL01Mention'] = bool(re.search(
        r'Ph[uụ] l[uụ]c s[oố] 01|PL01|ph[uụ] l[uụ]c.*ti[eê]u kho[aả]n',
        body, re.IGNORECASE
    ))
    
    return result
```

---

## KẾT QUẢ PARSE 2 MẪU THỰC TẾ

| Trường | Mẫu 1 (NGO-DUC-HAI) | Mẫu 2 (NGUYEN-ANH-KHOA) |
|--------|----------------------|--------------------------|
| `maTKGDFutures` | `003C2333888` | `003C0656625` |
| `maTKGDACM` | `003C2333888-A` | `None` |
| `tenTK` | `Ngô Đức Hải` | `NGUYỄN ANH KHOA` |
| `maTVKD` | `003` | `003` |
| `hasACM` | `True` | `False` |
| `hasPL01Mention` | `True` | `False` |

---

## PHÁT HIỆN ATTACHMENT PATTERN TỪ TÊN FILE THỰC TẾ

```
mẫu 1/NGO-DUC-HAI-mxv.pdf      → Hợp đồng (mxv)
mẫu 1/NGO-DUC-HAI-PL01.pdf     → Phụ lục ACM (PL01)
mẫu 1/NGO-DUC-HAI-CCCD-truoc.jpg → CCCD mặt trước
mẫu 1/NGO-DUC-HAI-CCCD-sau.jpg   → CCCD mặt sau

mẫu 2/NGUYEN-ANH-KHOA-mxv.pdf    → Hợp đồng (mxv)
mẫu 2/NGUYEN-ANH-KHOA-CCCD-truoc.jpg → CCCD mặt trước
mẫu 2/NGUYEN-ANH-KHOA-CCCD-sau.jpg   → CCCD mặt sau
```

**Quy tắc đặt tên:** `[TEN-KH-VIET-HOA-TUNG-TU]-[LOAI].[ext]`
- LOAI: `mxv` = Hợp đồng, `PL01` = Phụ lục, `CCCD-truoc` = CCCD trước, `CCCD-sau` = CCCD sau

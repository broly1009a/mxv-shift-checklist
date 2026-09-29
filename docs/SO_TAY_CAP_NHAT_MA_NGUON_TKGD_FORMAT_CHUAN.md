# SỔ TAY KỸ THUẬT: HƯỚNG DẪN CẬP NHẬT MÃ NGUỒN TKGD THEO FORMAT EMAIL CHUẨN HÓA
*(DEVELOPER PLAYBOOK & STEP-BY-STEP REFACTORING GUIDE FOR TKGD RECONCILIATION)*

> **Mục đích tài liệu**: Tài liệu này đóng vai trò là **"Kim chỉ nam kỹ thuật" (Developer Playbook)** chi tiết đến từng file, từng hàm và từng dòng code. Khi Lãnh đạo và User nghiệp vụ chính thức bàn giao mẫu Format Email chuẩn đã thống nhất với các TVKD, lập trình viên (hoặc AI Assistant) chỉ cần mở tài liệu này ra và thực hiện cập nhật theo đúng từng bước mà không cần phải đọc lại toàn bộ dự án hay phỏng đoán mò mẫm.

---

## MỤC LỤC

1. [Kiến Trúc Tổng Thể & Luồng Dữ Liệu End-to-End](#1-kiến-trúc-tổng-thể--luồng-dữ-liệu-end-to-end)
2. [Bản Đồ Phân Công Trách Nhiệm Từng File (File Responsibility Map)](#2-bản-đồ-phân-công-trách-nhiệm-từng-file)
3. [Checklist Sửa Đổi Chi Tiết Từng File (Exact Modification Guide)](#3-checklist-sửa-đổi-chi-tiết-từng-file)
   - [3.1 Backend Mail Parser: `tkgd-mail-parser.helper.ts`](#31-backend-mail-parser-tkgd-mail-parserhelperts)
   - [3.2 Backend Mail Ingestion: `tkgd-mail-ingest.service.ts`](#32-backend-mail-ingest-tkgd-mail-ingestservicets)
   - [3.3 Python OCR Worker: `tkgd_extractor_worker.py`](#33-python-ocr-worker-tkgd_extractor_workerpy)
   - [3.4 Backend Reconcile Engine: `tkgd-reconcile-rules.helper.ts`](#34-backend-reconcile-engine-tkgd-reconcile-ruleshelperts)
   - [3.5 Database Schema: `clean-account-record.schema.ts`](#35-database-schema-clean-account-recordschemats)
   - [3.6 Frontend Types & Components: `tkgd.types.ts`, `TkgdRecordsTable.tsx`](#36-frontend-types--components)
4. [Bộ Test Fixtures Mẫu & Trường Hợp Biên (Standard Test Payloads)](#4-bộ-test-fixtures-mẫu--trường-hợp-biên)
5. [Quy Trình Kiểm Thử, Build & Deploy Lên Ubuntu Server](#5-quy-trình-kiểm-thử-build--deploy-lên-ubuntu-server)

---

## 1. KIẾN TRÚC TỔNG THỂ & LUỒNG DỮ LIỆU END-TO-END

Hệ thống đối soát TKGD vận hành qua 6 giai đoạn tuần tự từ khi nhận Email đến khi hiển thị kết quả trên Web UI:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE ĐỐI SOÁT TKGD THEO CHUẨN MỚI                           │
│                                                                                        │
│  [GIAI ĐOẠN 1: INGESTION]                                                              │
│  Outlook Graph API / Disk Scan ──► Raw Mail Body + Attachments                         │
│                                       │                                                │
│  [GIAI ĐOẠN 2: PARSE & DISPATCH]     ▼                                                │
│  tkgd-mail-parser.helper.ts ──► Assert Subject + Bóc Key-Value Body                   │
│                                 (Nhận diện CCCD_truoc, CCCD_sau, HD_MoTK theo TÊN)     │
│                                       │                                                │
│  [GIAI ĐOẠN 3: OCR & TEXT EXTRACTION]▼                                                │
│  tkgd_extractor_worker.py ────► OCR Mặt trước + MRZ Mặt sau                            │
│  tkgd-doc-extractor.helper.ts ─► Đọc trực tiếp Layer Text PDF Hợp đồng (Fast path)    │
│                                       │                                                │
│  [GIAI ĐOẠN 4: M-SYSTEM SCRAPING]     ▼                                                │
│  msystem-scraper.helper.ts ───► Cào thông tin NĐT từ màn hình Chi Tiết TKGD trên MS    │
│                                       │                                                │
│  [GIAI ĐOẠN 5: RECONCILE ENGINE]      ▼                                                │
│  tkgd-reconcile-rules.helper.ts ─► So khớp tất định 5 Tiêu chí (Assert 1-1)            │
│                                       │                                                │
│  [GIAI ĐOẠN 6: PERSISTENCE & UI]      ▼                                                │
│  MongoDB (clean_account_records) ──► NestJS REST API ──► Next.js Frontend Dashboard    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. BẢN ĐỒ PHÂN CÔNG TRÁCH NHIỆM TỪNG FILE

Khi cần sửa đổi hoặc nâng cấp theo format chuẩn mới, toàn bộ các file liên quan nằm tại các vị trí cố định sau:

| STT | Đường Dẫn File | Vai Trò & Trách Nhiệm Chính |
| :---: | :--- | :--- |
| **1** | [backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts) | **Phân tích cú pháp Email**: Bóc tách Subject, tách thông tin Key-Value trong Body, phân loại các file đính kèm (`CCCD_truoc`, `CCCD_sau`, `HD_MoTK`). |
| **2** | [backend/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts) | **Dịch vụ nạp Mail**: Kết nối Microsoft Graph API (hoặc thư mục quét đĩa), tải attachments, điều phối luồng gọi parser và lưu `clean_account_records`. |
| **3** | [backend/src/scripts/python/tkgd_extractor_worker.py](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/python/tkgd_extractor_worker.py) | **Worker OCR Python**: OCR mặt trước thẻ CCCD lấy họ tên, số CCCD; OCR giải mã dòng MRZ mặt sau lấy ngày cấp, ngày sinh, giới tính; đọc text PDF hợp đồng. |
| **4** | [backend/src/modules/bot-engine/helpers/tkgd-doc-extractor.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-doc-extractor.helper.ts) | **Bóc tách PDF TypeScript**: Sử dụng `pdf-parse` để đọc nhanh thông tin số hợp đồng, ngày ký từ văn bản PDF. |
| **5** | [backend/src/modules/bot-engine/helpers/msystem-scraper.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/msystem-scraper.helper.ts) | **RPA Playwright M-System**: Đăng nhập M-System, tìm kiếm mã tài khoản, cào dữ liệu chi tiết NĐT (Họ tên, CCCD, ngày sinh, ngày cấp). |
| **6** | [backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts) | **Quy tắc đối soát (Rule Engine)**: So sánh 3 nguồn dữ liệu (Hợp đồng, CCCD, M-System). Xuất ra `KHOP`, `LECH` hoặc `CAN_KIEM_TRA`. |
| **7** | [backend/src/schemas/clean-account-record.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/schemas/clean-account-record.schema.ts) | **Mongoose Schema**: Cấu trúc dữ liệu lưu trữ kết quả phân tích trong MongoDB collection `clean_account_records`. |
| **8** | [frontend/src/features/tkgd/types/tkgd.types.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/types/tkgd.types.ts) | **TypeScript Types (FE)**: Khai báo kiểu dữ liệu tài khoản, trạng thái đối soát và danh sách cảnh báo cho Frontend. |
| **9** | [frontend/src/features/tkgd/components/TkgdRecordsTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/frontend/src/features/tkgd/components/TkgdRecordsTable.tsx) | **Bảng giao diện hiển thị**: Hiển thị danh sách tài khoản, badge trạng thái `KHỚP`, `LỆCH`, `VI PHẠM QUY CHUẨN EMAIL`. |
| **10** | [backend/src/scripts/tkgd_case_inspector.js](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/scripts/tkgd_case_inspector.js) | **Công cụ CLI Kiểm thử chuẩn**: Dùng để chạy thử nghiệm bóc tách, inspect và reparse tài khoản trên terminal mà không cần gọi UI. |

---

## 3. CHECKLIST SỬA ĐỔI CHI TIẾT TỪNG FILE

Khi đã có format chuẩn, developer mở từng file theo thứ tự dưới đây và thực hiện cập nhật:

### 3.1 Backend Mail Parser: `tkgd-mail-parser.helper.ts`
* **Đường dẫn**: `backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts`
* **Mục tiêu**: Xóa bỏ các regex phỏng đoán tên file và đoán text HTML. Chuyển sang so khớp tên file tuyệt đối và bóc tách Key-Value.

#### A. Hàm cần sửa: `parseAccountOpeningEmailMulti(bodyRawText: string)`
* **Vị trí hiện tại**: Khoảng dòng 600 – 720.
* **Logic cũ**: Chạy hàng chục regex để dò tìm số tài khoản `0xxC...` rải rác trong văn bản tự do.
* **Logic mới cần cập nhật**:
  1. Kiểm tra tiêu đề / body có chứa cấu trúc Form Key-Value chuẩn không.
  2. Bóc tách từng trường theo nhãn rõ ràng:
     - `Họ và tên` $\rightarrow$ `tenTaiKhoan`
     - `Số CCCD` $\rightarrow$ `soCCCD`
     - `Mã TKGD` $\rightarrow$ `maTKGDFutures` / `maTKGDBase`
     - `Tiểu khoản` $\rightarrow$ `hasACMRequest`, `hasLMERequest`, `hasSpreadRequest`
     - `Ngày sinh`, `Ngày cấp`, `Giới tính`
  3. Nếu không đúng định dạng $\rightarrow$ trả về cờ `isFormatViolation: true`.

```typescript
// MẪU CODE CHUẨN CHO PARSER KEY-VALUE:
export interface ParsedStandardAccountMail {
  maTVKD: string;
  tenTaiKhoan: string;
  soCanCuoc: string;
  ngaySinh?: string;
  gioiTinh?: string;
  ngayCap?: string;
  noiCap?: string;
  maTKGDBase: string;
  maTKGDFutures: string;
  hasACMRequest: boolean;
  hasLMERequest: boolean;
  hasSpreadRequest: boolean;
  ngayKyHD?: string;
  isFormatViolation?: boolean;
  formatViolationReason?: string;
}

export function parseStandardKeyValBody(bodyText: string): ParsedStandardAccountMail | null {
  const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
  const data: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^(\d+\.|\-|\*|)\s*([^:]+)\s*:\s*(.+)$/);
    if (match) {
      const key = match[2].trim().toLowerCase();
      const val = match[3].trim();
      data[key] = val;
    }
  }

  // So khớp trường
  const hoTen = data['họ và tên'] || data['họ tên khách hàng'] || data['tên tài khoản'];
  const maTk = data['mã tkgd'] || data['mã tkgd futures'] || data['tài khoản giao dịch'];
  const soCccd = data['số cccd'] || data['số căn cước'] || data['cccd / hộ chiếu'] || data['số cccd / hộ chiếu'];

  if (!hoTen || !maTk) {
    return null; // Không phải format chuẩn
  }

  const cleanMaTk = maTk.replace(/\D/g, '').length === 10 ? maTk.trim() : maTk.match(/0\d{2}C\d{7}/i)?.[0] || maTk.trim();
  const baseCode = cleanMaTk.split('-')[0].trim();
  const tieuKhoanStr = (data['tiểu khoản đăng ký'] || data['tiểu khoản'] || '').toLowerCase();

  return {
    maTVKD: baseCode.substring(0, 3),
    tenTaiKhoan: hoTen.toUpperCase(),
    soCanCuoc: soCccd ? soCccd.replace(/\D/g, '') : '',
    ngaySinh: data['ngày sinh'],
    gioiTinh: data['giới tính'],
    ngayCap: data['ngày cấp'] || data['ngày cấp cccd'],
    noiCap: data['nơi cấp'] || data['nơi cấp cccd'],
    maTKGDBase: baseCode,
    maTKGDFutures: baseCode,
    hasACMRequest: tieuKhoanStr.includes('acm') || tieuKhoanStr.includes('-a'),
    hasLMERequest: tieuKhoanStr.includes('lme') || tieuKhoanStr.includes('-l'),
    hasSpreadRequest: tieuKhoanStr.includes('spread') || tieuKhoanStr.includes('-s'),
    ngayKyHD: data['ngày ký hợp đồng'] || data['ngày ký hd'],
  };
}
```

#### B. Các hàm phân loại File đính kèm cần đơn giản hóa:
* **Xóa bỏ các hàm phức tạp**:
  - `probeImageDimensions` ([L262-L323](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L262-L323))
  - `isDecorativeOrLogoAttachment` ([L224-L257](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L224-L257))
  - `isLikelyCccdAspect` ([L329-L348](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L329-L348))
  - `pickCccdImagePaths` Pass 3 ([L507-L546](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts#L507-L546))
* **Thay bằng bộ nhận diện tên file chuẩn**:
```typescript
export function classifyStandardAttachmentFile(fileName: string): 'CCCD_FRONT' | 'CCCD_BACK' | 'CONTRACT' | 'PL01' | 'PL02' | 'UNKNOWN' {
  const fn = fileName.trim().toLowerCase();
  if (/^cccd[-_]truoc\.(jpg|jpeg|png)$/i.test(fn)) return 'CCCD_FRONT';
  if (/^cccd[-_]sau\.(jpg|jpeg|png)$/i.test(fn)) return 'CCCD_BACK';
  if (/^hd[-_]motk\.pdf$/i.test(fn) || /^hopdong.*\.pdf$/i.test(fn)) return 'CONTRACT';
  if (/^pl01[-_]acm\.pdf$/i.test(fn) || /^phuluc.*acm.*\.pdf$/i.test(fn)) return 'PL01';
  if (/^pl02[-_]lme\.pdf$/i.test(fn) || /^phuluc.*lme.*\.pdf$/i.test(fn)) return 'PL02';
  return 'UNKNOWN';
}
```

---

### 3.2 Backend Mail Ingestion: `tkgd-mail-ingest.service.ts`
* **Đường dẫn**: `backend/src/modules/tkgd-automation/services/tkgd-mail-ingest.service.ts`
* **Mục tiêu**: Lọc email theo cú pháp tiêu đề chuẩn `[MỞ TKGD]` và kiểm tra điều kiện tiên quyết trước khi nạp.

#### A. Hàm cần sửa: `syncMailOpeningAccounts`
* **Vị trí**: Khoảng dòng 170 – 210.
* **Thay đổi bộ lọc Subject Graph API**:
```typescript
// Chỉ nhận diện các email bắt đầu bằng "[MỞ TKGD]" hoặc "[MO TKGD]"
const isStandardSubject = /^\[(MỞ TKGD|MO TKGD)\]\s*-\s*\d{3}\s*-\s*.+\s*-\s*0\d{2}C\d{7}/i.test(msg.subject || '');
```
* **Gắn cờ vi phạm quy chuẩn ngay tại thời điểm nạp mail**:
Nếu subject hoặc file đính kèm không đúng quy cách:
```typescript
if (!hasCccdFront || !hasCccdBack || !hasContract) {
  record.ketLuan = {
    trangThai: 'VI_PHAM_QUY_CHUAN',
    danhSachLoi: ['Thiếu file đính kèm bắt buộc (yêu cầu đủ: CCCD_truoc.jpg, CCCD_sau.jpg, HD_MoTK.pdf)'],
    reconciledAt: new Date(),
  };
}
```

---

### 3.3 Python OCR Worker: `tkgd_extractor_worker.py`
* **Đường dẫn**: `backend/src/scripts/python/tkgd_extractor_worker.py`
* **Mục tiêu**: Xóa bỏ các nhánh code giải mã file dị biệt `.paint`, lọc từ khóa rác HĐ. Tập trung vào 2 mục tiêu OCR chính xác.

#### A. Các phần cần loại bỏ:
* Khối giải nén zlib cho định dạng `.paint` của Samsung/iPhone (không còn cần thiết vì TVKD chỉ được phép gửi JPG/PNG).
* Vòng lặp xoay góc 90°/180°/270° dự phòng quá đà khi ảnh đã đạt chuẩn thẳng góc.

#### B. Hai cổng OCR trọng tâm:
1. **OCR Mặt Trước (`CCCD_truoc.jpg`)**:
   - Trích xuất: Họ và tên (`hoVaTen`), Số CCCD 12 số (`soCanCuoc`), Ngày sinh (`ngaySinh`), Nơi thường trú.
   - Thẩm định tính hợp lệ: 3 số đầu là Mã Tỉnh/Thành phố, số thứ 4 là Giới tính/Thế kỷ, 2 số tiếp theo là Năm sinh.
2. **OCR Dòng MRZ Mặt Sau (`CCCD_sau.jpg`)**:
   - Trích xuất dòng MRZ thứ 2: `YYMMDD` (ngày sinh), `M/F` (giới tính), `YYMMDD` (ngày hết hạn).
   - Kiểm tra chéo với dòng 1: Khẳng định 100% số CCCD không bị phantom/mờ nhòe.
3. **Đọc PDF Hợp Đồng (`HD_MoTK.pdf`)**:
   - Sử dụng `pdfplumber` hoặc `pypdf` đọc trực tiếp text layer (thời gian chạy < 0.2s thay vì OCR scan tốn 5s).

---

### 3.4 Backend Reconcile Engine: `tkgd-reconcile-rules.helper.ts`
* **Đường dẫn**: `backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts`
* **Mục tiêu**: Bỏ hoàn toàn thuật toán phỏng đoán hoán vị cụm số (Chunk Swap) và Luật đồng thuận 2/3. Áp dụng **Bộ 5 Tiêu Chí Đối Soát Tuyệt Đối**.

#### A. Hàm cần sửa: `evaluateRecordReconciliationRule(record: any)`
* **Vị trí**: Khoảng dòng 144 – 350.
* **Thay thế toàn bộ logic đối chiếu bằng 5 quy tắc Assert**:

```typescript
export function evaluateStandardReconciliation(record: any): ReconciliationResult {
  const criticalErrors: string[] = [];
  const softWarnings: string[] = [];
  const ms = record?.ms || {};
  const hd = record?.hopDong || {};
  const cccd = record?.canCuoc || {};
  const mail = record?.noiDungMail || {};

  // TIÊU CHÍ 1: M-System phải tồn tại tài khoản và có đầy đủ CCCD
  if (!ms.isFoundOnMS) {
    criticalErrors.push('Tài khoản chưa được tạo trên M-System');
    return { finalStatus: 'LECH', finalErrors: criticalErrors, criticalErrors, softWarnings, autoHealedNotes: [] };
  }
  if (!ms.soCMND_HoChieu && !ms.cccdOcr_soCanCuoc) {
    criticalErrors.push('M-System chưa được TVKD nhập số CCCD/Hộ chiếu');
  }

  // TIÊU CHÍ 2: Số CCCD phải trùng khớp 100% giữa HĐ, Ảnh CCCD và M-System
  const cccdHD = (hd.soCanCuoc || '').replace(/\D/g, '');
  const cccdImg = (cccd.soCanCuoc || '').replace(/\D/g, '');
  const cccdMS = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').replace(/\D/g, '');

  if (cccdHD && cccdMS && cccdHD !== cccdMS) {
    criticalErrors.push(`Lệch số CCCD: Hợp đồng (${cccdHD}) != M-System (${cccdMS})`);
  }
  if (cccdImg && cccdMS && cccdImg !== cccdMS) {
    criticalErrors.push(`Lệch số CCCD: Ảnh CCCD (${cccdImg}) != M-System (${cccdMS})`);
  }

  // TIÊU CHÍ 3: Họ và tên phải trùng khớp (không phân biệt hoa/thường)
  const nameHD = cleanPersonName(hd.hoVaTen);
  const nameMS = cleanPersonName(ms.hoVaTen || ms.tenTKGD);
  const nameCCCD = cleanPersonName(cccd.hoVaTen);

  if (nameHD && nameMS && !isPersonNameMatch(nameHD, nameMS)) {
    criticalErrors.push(`Lệch họ tên: Hợp đồng (${nameHD}) != M-System (${nameMS})`);
  }
  if (nameCCCD && nameMS && !isPersonNameMatch(nameCCCD, nameMS)) {
    criticalErrors.push(`Lệch họ tên: CCCD (${nameCCCD}) != M-System (${nameMS})`);
  }

  // TIÊU CHÍ 4: Ngày sinh phải trùng khớp
  const nsHD = normalizeDateStr(hd.ngaySinh || hd.rawNgaySinh);
  const nsMS = normalizeDateStr(ms.ngaySinh || ms.rawNgaySinh);
  const nsCCCD = normalizeDateStr(cccd.ngaySinh || cccd.rawNgaySinh);

  if (nsHD && nsMS && nsHD !== nsMS) {
    criticalErrors.push(`Lệch ngày sinh: HĐ (${nsHD}) != MS (${nsMS})`);
  }
  if (nsCCCD && nsMS && nsCCCD !== nsMS) {
    criticalErrors.push(`Lệch ngày sinh: CCCD (${nsCCCD}) != MS (${nsMS})`);
  }

  // TIÊU CHÍ 5: Mã TKGD cơ sở trên Mail, HĐ và M-System phải khớp
  const baseMail = (mail.maTKGD_Futures || record.maTKGDBase || '').trim().toUpperCase();
  const baseMS = (ms.maTKGD || '').split('-')[0].trim().toUpperCase();
  if (baseMail && baseMS && baseMail !== baseMS) {
    criticalErrors.push(`Lệch mã TKGD: Yêu cầu (${baseMail}) != M-System (${baseMS})`);
  }

  const finalStatus = criticalErrors.length === 0 ? 'KHOP' : 'LECH';
  return {
    finalStatus,
    finalErrors: criticalErrors,
    criticalErrors,
    softWarnings,
    autoHealedNotes: [],
  };
}
```

---

### 3.5 Database Schema: `clean-account-record.schema.ts`
* **Đường dẫn**: `backend/src/schemas/clean-account-record.schema.ts`
* **Vị trí**: Trường `trangThai` trong `KetLuanDoiSoat` (Dòng 270).
* **Cập nhật Enum trạng thái chuẩn**:
```typescript
@Prop({
  enum: [
    'KHOP',                  // Khớp 100% cả 5 tiêu chí
    'LECH',                  // Sai lệch dữ liệu giữa HĐ / CCCD / MS
    'CAN_KIEM_TRA',          // Cần kiểm tra (chữ ký mờ, thiếu tài liệu phụ)
    'VI_PHAM_QUY_CHUAN',     // TVKD gửi sai format mail hoặc thiếu file bắt buộc
    'CHUA_CO_TREN_MS',       // Chưa tạo trên M-System
    'CHUA_XU_LY'             // Đang chờ xử lý
  ],
  default: 'CHUA_XU_LY',
  index: true,
})
trangThai: string;
```

---

### 3.6 Frontend Types & Components

#### A. File kiểu dữ liệu: `frontend/src/features/tkgd/types/tkgd.types.ts`
Bổ sung trạng thái `VI_PHAM_QUY_CHUAN` vào `TkgdReconcileStatus`:
```typescript
export type TkgdReconcileStatus = 
  | 'KHOP'
  | 'LECH'
  | 'CAN_KIEM_TRA'
  | 'VI_PHAM_QUY_CHUAN'
  | 'CHUA_CO_TREN_MS'
  | 'CHUA_XU_LY';
```

#### B. Bảng hiển thị: `frontend/src/features/tkgd/components/TkgdRecordsTable.tsx`
Thêm badge màu vàng/cam chuyên biệt cho các hồ sơ vi phạm quy chuẩn email để cán bộ ca trực bấm 1 click gửi email phản hồi TVKD:
```tsx
case 'VI_PHAM_QUY_CHUAN':
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Vi phạm quy chuẩn
    </span>
  );
```

---

## 4. BỘ TEST FIXTURES MẪU & TRƯỜNG HỢP BIÊN

Dưới đây là các mẫu dữ liệu chuẩn dùng để chạy kiểm thử xác thực parser:

### Case 1: Mở Tài khoản Cá nhân Futures chuẩn (1 Tài khoản)
* **Tiêu đề**: `[MỞ TKGD] - 003 - NGUYỄN VĂN AN - 003C1234567`
* **Nội dung email**:
```text
--- THÔNG TIN YÊU CẦU MỞ TÀI KHOẢN GIAO DỊCH ---
1. TVKD              : 003 - Công ty CP Giao dịch Hàng hóa Gia Cát Lợi
2. Họ tên khách hàng : NGUYỄN VĂN AN
3. Số CCCD / Hộ chiếu: 001095012345
4. Ngày sinh         : 15/08/1995
5. Giới tính         : Nam
6. Ngày cấp CCCD     : 20/04/2021
7. Nơi cấp CCCD      : Cục Cảnh sát QLHC về TTXH
8. Mã TKGD Futures   : 003C1234567
9. Tiểu khoản        : Không
10. Ngày ký hợp đồng : 22/09/2026
------------------------------------------------
```
* **Danh sách tệp đính kèm**:
  1. `CCCD_truoc.jpg` (Ảnh mặt trước rõ nét $\ge 1000$px)
  2. `CCCD_sau.jpg` (Ảnh mặt sau rõ mã MRZ)
  3. `HD_MoTK.pdf` (File hợp đồng ký số)

### Case 2: Mở Tài khoản kèm Tiểu khoản ACM & LME
* **Tiêu đề**: `[MỞ TKGD] - 012 - TRẦN THỊ MAI - 012C7654321 (-A, -L)`
* **Nội dung email**:
```text
--- THÔNG TIN YÊU CẦU MỞ TÀI KHOẢN GIAO DỊCH ---
1. TVKD              : 012 - Công ty CP Giao dịch Hàng hóa Đông Nam Á
2. Họ tên khách hàng : TRẦN THỊ MAI
3. Số CCCD / Hộ chiếu: 031198009876
4. Ngày sinh         : 12/03/1998
5. Giới tính         : Nữ
6. Ngày cấp CCCD     : 10/11/2022
7. Nơi cấp CCCD      : Cục Cảnh sát QLHC về TTXH
8. Mã TKGD Futures   : 012C7654321
9. Tiểu khoản        : ACM (-A), LME (-L)
10. Ngày ký hợp đồng : 22/09/2026
------------------------------------------------
```
* **Danh sách tệp đính kèm**:
  1. `CCCD_truoc.jpg`
  2. `CCCD_sau.jpg`
  3. `HD_MoTK.pdf`
  4. `PL01_ACM.pdf`
  5. `PL02_LME.pdf`

---

## 5. QUY TRÌNH KIỂM THỬ, BUILD & DEPLOY LÊN UBUNTU SERVER

Mỗi khi chỉnh sửa xong code theo format mới, thực hiện nghiêm ngặt quy trình kiểm thử theo đúng `AGENTS.md`:

### Bước 1: Kiểm thử độc lập bằng Script CLI chuẩn
Tuyệt đối không viết script tạm. Sử dụng duy nhất công cụ chuẩn hệ thống:
```bash
# 1. Kiểm tra cấu trúc file và bóc tách thử nghiệm với 1 mã tài khoản mẫu
node src/scripts/tkgd_case_inspector.js --inspect 003C1234567

# 2. Chạy test logic bóc tách mới mà không ghi đè DB
node src/scripts/tkgd_case_inspector.js --test 003C1234567

# 3. Sau khi xác nhận đúng, bóc tách chính thức và cập nhật CSDL
node src/scripts/tkgd_case_inspector.js --reparse 003C1234567
```

### Bước 2: Kiểm tra biên dịch (TypeScript Build Check)
Cả Backend và Frontend phải biên dịch thành công 100% không có lỗi Type:
```bash
# Kiểm tra Backend
cd backend
cmd /c "npm run build"

# Kiểm tra Frontend
cd ../frontend
cmd /c "npm run build"
```

### Bước 3: Đồng bộ và Khởi động lại trên Ubuntu Server (10.0.0.26)
Sử dụng script deploy tập trung:
```bash
node backend/src/scripts/_deploy_update_all.js
```
*Script sẽ tự động copy các file đã chỉnh sửa lên `/opt/mxv-checklist/`, chạy `npm run build` trên Ubuntu và reload PM2 (`pm2 reload mxv-backend`).*

---

> **TỔNG KẾT**: Sổ tay này là tài liệu chuẩn mực khép kín. Khi có quyết định chính thức về format email, dev chỉ cần mở Mục 3 ra làm theo từng bước là hệ thống sẽ sạch sẽ, chạy nhanh gấp 5 lần và chấm dứt hoàn toàn các lỗi vặt.

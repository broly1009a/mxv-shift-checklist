# THIẾT KẾ KỸ THUẬT: MỞ RỘNG HỆ THỐNG THỐNG KÊ CORECCP
## Xử Lý Thành Viên Kinh Doanh (TVKD) Mới & Mã Hợp Đồng (Mã HĐ) Mới

---

- **Mã tài liệu**: `MXV-DES-CCP-EXPAND-2026-V1.0`
- **Ngày soạn thảo**: 18/09/2026
- **Trạng thái**: **CHỜ THỰC THI** – Tài liệu thiết kế kỹ thuật chờ giai đoạn chuyển đổi CoreCCP hoàn tất.
- **Tài liệu liên quan**: [`BAN_THIET_KE_GO_LIVE_THONG_KE_CORECCP.md`](./BAN_THIET_KE_GO_LIVE_THONG_KE_CORECCP.md)
- **Hệ thống liên quan**: `NestJS Backend (Node.js)`, `Python openpyxl`, `MongoDB`, `Excel Accumulator Engine`

---

## 1. BỐI CẢNH & MỤC TIÊU

### 1.1. Vấn Đề Đặt Ra

Hệ thống thống kê CCP hiện tại đã được thiết kế theo nguyên tắc **Zero-Hardcoding & Data-Driven** (xem `BAN_THIET_KE_GO_LIVE_THONG_KE_CORECCP.md` – Mục 1.2). Điều này có nghĩa là:

- Tất cả vị trí cột TVKD và cột Hàng hóa được định vị **động** bằng cách quét tiêu đề Row 4 của file Excel tại runtime.
- Bot **không cần sửa code** khi có TVKD mới miễn là tiêu đề cột tương ứng đã tồn tại trong file Excel lũy kế.

Tuy nhiên, khi MXV kết nạp một **Thành viên Kinh doanh (TVKD) hoàn toàn mới** hoặc niêm yết thêm một **Mặt hàng mới toanh chưa có cột** trong file Excel lũy kế, hệ thống cần có một quy trình chuẩn xác để mở rộng cấu trúc file mà không làm hỏng dữ liệu lịch sử.

### 1.2. Phân Biệt 2 Kịch Bản Cần Xử Lý

| Kịch bản | Hành động cần thiết | Mức độ can thiệp |
| :--- | :--- | :--- |
| **Kịch bản A**: TVKD/Mã HĐ mới **đã có cột** trong file Excel (cột tiêu đề đã được thêm từ trước) | Bot tự động ánh xạ và ghi đè số liệu vào đúng cột, không cần can thiệp | Hoàn toàn tự động – Bot xử lý 100% |
| **Kịch bản B**: TVKD/Mã HĐ mới **CHƯA từng có cột** trong file Excel lũy kế | Phải chèn thêm cột mới vào file, căn chỉnh lại công thức `=SUM(...)`, format tiêu đề | Tự động hóa 1-Click có phê duyệt (xem Mục 4) |

> **Lưu ý quan trọng**: Kịch bản A và B xảy ra với tần suất rất khác nhau. Trong vận hành hàng ngày, gần như 100% là Kịch bản A. Kịch bản B là **sự kiện hành chính có kế hoạch từ trước** (MXV kết nạp thành viên mới, niêm yết mặt hàng mới theo Quyết định Ban TGĐ), không bao giờ xảy ra bất ngờ.

---

## 2. BÀI TOÁN KỸ THUẬT CỐT LÕI

### 2.1. Bài Toán 1: Nhận Diện & Ánh Xạ Từ Điển Nghiệp Vụ

**Mô tả**: Khi bot đọc dòng giao dịch từ `DSGD CCP.xlsx`, cần nhận diện mã hàng hóa từ chuỗi `Mã HĐ` (ví dụ: `SI5COZ26`, `SIV0926`, `ZLEZ26`, `CME123`) và ánh xạ về mã chuẩn tương ứng (`SI5CO`, `SIV`, `ZLE`).

**Cơ chế hiện tại (Node.js)** – hàm `getMaHHFromCcpMaHD` trong [`ccp-classifier.helper.ts`](../backend/src/modules/ccp-statistics/helpers/ccp-classifier.helper.ts):

```
[Mã HĐ thô từ CCP, ví dụ: "SI5COZ26"]
        │
        ▼
[Tầng 1: Tra từ điển ALL_KNOWN_COMMODITIES]
  - Duyệt qua 50+ tiền tố đã biết (SI5CO, CP2CO, PL1NY, ZLE, ZCE, SIV, CXR1...)
  - Kiểm tra phần còn lại là mã kỳ hạn hợp lệ (A26, Z26, 0926, 1226...)
  - Nếu khớp → trả về "SI5CO" ngay lập tức
        │ (Nếu không khớp)
        ▼
[Tầng 2: Regex Heuristics phân tích kỳ hạn]
  - Options: /^([CP]\.[A-Z0-9]+?)([A-Z]|\d{2})\d{2}$/
  - Nội địa (tháng số): /^([A-Z0-9_]+?)(?:0[1-9]|1[0-2])\d{2}$/
  - Quốc tế (tháng chữ): /^([A-Z0-9_]+?)[FGHJKMNQUVXZ]\d{2}$/
        │ (Nếu vẫn không khớp)
        ▼
[Tầng 3: Ghi cảnh báo + trả về chuỗi gốc]
  - Ghi log WARNING
  - Gom vào bucket "Mã chưa nhận diện" để báo cáo
```

**Kết quả khi gặp Mã HĐ Mock/Giả lập (ví dụ: `CME123`, `LME456`, `ICE789`)**:
- Bot ghi số lot vào **cột TVKD** đúng tuyệt đối (phân loại TVKD dựa vào hậu tố `-A/-S/-L`, không phụ thuộc Mã HĐ).
- Số lot theo **cột Sản phẩm** không được ghi (cột chưa tồn tại trong template) → **Đúng hành vi, không phải bug**.

### 2.2. Bài Toán 2: Can Thiệp Cấu Trúc File Excel Khi Có Entity Mới

Khi xuất hiện TVKD `099` hoặc hàng hóa mới `ZRE` (Dầu cải), file Excel lũy kế chưa có cột tương ứng. Hệ thống cần:

1. Chèn 1 cột mới (`insert_cols`) vào đúng vị trí trong bảng.
2. Tự động dịch chuyển toàn bộ cột phía sau sang phải 1 vị trí.
3. Tự động sửa lại công thức `=SUM(K17:BU17)` thành `=SUM(K17:BV17)`.
4. Ghi tiêu đề 2 dòng (Row 4: Tên ngắn, Row 5: Mã số) với format, border và merge cell chuẩn.
5. Điền giá trị `0` cho các phiên đã qua trong năm.

---

## 3. TẠI SAO KHÔNG LÀM THỦ CÔNG BẰNG EXCEL?

Việc mở file Excel ra làm thủ công (insert column, gõ lại công thức `=SUM`, kẻ bảng) là **không thể chấp nhận được** đối với hệ thống nghiệp vụ tài chính vì 3 lý do:

1. **Xác suất sai sót rất cao**: Nhầm vị trí cột, quên cập nhật 1 trong 12 file Excel (ACM, Spread, LME, Normal, Options, GTGD tương ứng...).
2. **Không có audit trail**: Không biết ai làm, làm lúc nào, làm đúng chưa.
3. **Không có rollback khi làm sai**: Sai 1 ô công thức có thể kéo hỏng toàn bộ dữ liệu tháng hiện tại.

> **Kết luận**: Toàn bộ quy trình mở rộng cấu trúc Excel **có thể và phải được tự động hóa 100% bằng kỹ thuật hệ thống**.

---

## 4. SO SÁNH PHƯƠNG ÁN: PYTHON vs NODE.JS

| Tiêu chí | **Python (`openpyxl`)** | **Node.js (`ExcelJS`)** |
| :--- | :--- | :--- |
| **Chèn cột Excel (`insert_cols`)** | Rất mạnh & an toàn, `openpyxl` hỗ trợ dịch chuyển ô và tự động điều chỉnh công thức chuẩn xác | Rủi ro cao: ExcelJS hay crash hoặc làm hỏng `sharedFormula` khi thao tác insert column trên bảng tính phức tạp |
| **Nhận diện & map từ điển nghiệp vụ** | Phải viết lại logic, cần pass params qua CLI/JSON | Tích hợp trực tiếp với Mongoose, biến môi trường, cache NestJS |
| **Truy vấn cấu hình từ MongoDB** | Phải qua file JSON hoặc HTTP bridge | Tích hợp native, không cần cầu nối |
| **Hiệu năng tính toán** | Chậm hơn (spawn child process) | Nhanh hơn nhiều (trong bộ nhớ RAM Node.js) |
| **Xử lý Shared Formulas phức tạp** | Xử lý tốt, giữ nguyên XML chuẩn | Phải gọi `fixSharedFormulas()` thủ công, dễ edge case |
| **Bảo trì môi trường runtime** | Phải duy trì Python + pip packages song song Node.js | Thuần 1 runtime Node.js, gọn nhẹ |
| **Tích hợp Web UI (Socket, Notification)** | Không thể trực tiếp | Tích hợp trực tiếp 100% |
| **Chạy offline ngoài giờ (Maintenance)** | Hoàn toàn phù hợp, không cần NestJS server up | Phải có NestJS server đang chạy |

### Kết Luận Phân Vai

```
NODE.JS (NestJS)                    PYTHON (openpyxl)
────────────────                    ─────────────────
• Phân loại TKGD (-A/-S/-L/-M/-O)  • Chèn cột mới vào file Excel lũy kế
• Ánh xạ Mã HĐ → Mã HH             • Kéo dãn công thức =SUM(...)
• Tra từ điển MongoDB               • Copy style / border / merge cell chuẩn
• Tính toán Lot, GTGD hàng ngày     • Sinh Sheet tháng mới
• Ghi số liệu vào cột đã có sẵn    • Chạy dưới dạng Tool bảo trì offline
• Cảnh báo Web UI                   • (Tương tự excel_sheet_cloner.py đã dùng)
• Quản lý Job Queue, Scheduler
```

- **Xử lý Nghiệp vụ Hàng ngày → 100% Node.js** (nhanh, tích hợp, không cần can thiệp).
- **Thay đổi Cấu trúc File Excel → Python 1-Click** (an toàn, chạy offline, có phê duyệt từ Admin).

---

## 5. KIẾN TRÚC GIẢI PHÁP: "TỰ ĐỘNG HÓA 1-CLICK CÓ PHÊ DUYỆT"

### 5.1. Tại Sao Không Để Bot Âm Thầm Tự Chèn Cột Mỗi Ngày?

**Quy tắc bất biến**: Tuyệt đối không để bot tự chèn cột trong lúc đang chạy chốt số cuối ngày.

Lý do:

1. **Rủi ro Dữ liệu Rác**: Nếu nhân viên M-System / CoreCCP nhập nhầm mã TKGD lỗi font → bot tưởng là mã mới và tạo cột rác vĩnh viễn vào file báo cáo chính thức của Sở.

2. **Rủi ro Lệch Công Thức Liên Kết**: File Excel lũy kế thường được Phòng Kế toán / Ban TGĐ tham chiếu cố định theo địa chỉ ô (ví dụ: `'[Thong ke so lot ACM]T09.2026'!$BV$17`). Nếu bot đẩy cột sang phải mà không thông báo, toàn bộ báo cáo liên kết sẽ bị lệch địa chỉ.

3. **TVKD/Hàng Hóa Mới Là "Sự Kiện Hành Chính Có Kế Hoạch"**: Không bao giờ xuất hiện bất ngờ sau một đêm mà luôn có Quyết định chuẩn y của Ban TGĐ từ nhiều ngày trước.

### 5.2. Luồng Xử Lý Đầy Đủ

```
[CoreCCP / M-System: Dữ liệu hàng ngày]
                    │
                    ▼
    ┌───────────────────────────────────┐
    │         NODE.JS RUNTIME           │
    │  ccp-classifier.helper.ts         │
    │  • Phân loại hậu tố TKGD          │
    │  • Gọi getMaHHFromCcpMaHD()       │
    │  • Tra từ điển ALL_KNOWN_COMMODITIES│
    └─────────────┬─────────────────────┘
                  │
     ┌────────────┴────────────────────┐
     ▼                                 ▼
[Mã đã có cột trong file Excel]    [Mã CHƯA từng có cột Excel]
     │                                 │
     ▼                          ┌──────┴──────┐
[Ghi số liệu bình thường]       ▼             ▼
                          Lưu MongoDB:   Không ghi vào
                          pending_       file Excel
                          system_        (tránh cột rác)
                          entities
                                 │
                                 ▼
                     [Cảnh Báo Vàng Web UI]
                     "Phát hiện TVKD/Mã HĐ mới:
                     [099] – Cần cập nhật Template"
                                 │
                                 ▼ (Admin bấm xác nhận)
                     ┌───────────────────────────┐
                     │   PYTHON OPENPYXL CLI      │
                     │   (chạy ngầm nền)          │
                     │  1. Mở bộ file Excel lũy kế│
                     │  2. Tìm vị trí cột "TỔNG"  │
                     │  3. Insert 1 cột mới trước  │
                     │  4. Kéo dãn =SUM(...)       │
                     │  5. Copy border/numFmt/color │
                     │  6. Backfill 0 các phiên cũ │
                     │  7. Lưu file & báo thành công│
                     └─────────────┬─────────────┘
                                   │
                                   ▼
                     [BOT NGÀY HÔM SAU]
                     Node.js quét Row 4, tìm thấy
                     cột mới → ghi số liệu bình thường
                     100% tự động, không cần sửa code
```

---

## 6. THIẾT KẾ PYTHON PROVISIONING TOOL

### 6.1. Script: `ccp_column_provisioner.py`

**Vị trí dự kiến**: `backend/src/modules/lot-statistics/scripts/ccp_column_provisioner.py`

**Cách chạy từ CLI** (Admin tự chạy, hoặc NestJS gọi qua `spawnSync`):

```bash
# Thêm TVKD mới (mã 099, tên "Thành viên ABC")
python3 ccp_column_provisioner.py \
  --file "Thong ke so lot giao dich ACM 2026.xlsx" \
  --type tvkd \
  --code "099" \
  --label "Thanh vien ABC"

# Thêm Hàng hóa mới (mã ZRE, tên "Dau cai")
python3 ccp_column_provisioner.py \
  --file "Thong ke so lot giao dich 2026.xlsx" \
  --type commodity \
  --code "ZRE" \
  --label "Dau cai"

# Chạy thử (dry-run), không ghi thực
python3 ccp_column_provisioner.py --file "..." --code "099" --dry-run
```

**Logic thực thi bên trong**:

```python
def provision_new_column(excel_path, entity_type, code, label):
    wb = openpyxl.load_workbook(excel_path)
    for sheet in [s for s in wb.sheetnames if s.startswith('T')]:
        ws = wb[sheet]
        # 1. Quét Row 4 tìm vị trí cột "TONG" của nhóm tương ứng
        tong_col = find_tong_column(ws, entity_type)
        # 2. Chèn cột mới vào ngay trước cột "TONG"
        ws.insert_cols(tong_col)
        # 3. Ghi tiêu đề 2 tầng (Row 4: Label, Row 5: Code)
        ws.cell(4, tong_col).value = label
        ws.cell(5, tong_col).value = code
        apply_header_format(ws, tong_col)
        # 4. Kéo dãn công thức =SUM(...)
        update_sum_formula(ws, tong_col)
        # 5. Ghi 0 vào các phiên đã qua
        backfill_zeros(ws, tong_col)
        # 6. Ghi numFmt kế toán chuẩn MXV
        apply_accounting_numfmt(ws, tong_col)
    wb.save(excel_path)
```

### 6.2. Cơ Chế Bảo Vệ & Kiến Trúc Xử Lý Lỗi Giữa Chừng (Safe Transactional Atomic Write)

> [!CAUTION]
> **TÍNH SỐNG CÒN CỦA FILE EXCEL LŨY KẾ**:
> File Excel lũy kế (Số lot, Giá trị giao dịch) chứa toàn bộ số liệu tài chính lịch sử của cả năm với hàng chục Sheet và hàng ngàn công thức liên kết. Nếu tiến trình mở file và ghi dở chừng bị ngắt đột ngột (đầy ổ đĩa, cúp điện, treo process, lỗi cú pháp), file gốc có thể bị hỏng (corrupt), mất công thức hoặc trắng dữ liệu.
> Do đó, script Python bắt buộc phải áp dụng mô hình **Giao dịch nguyên tử (Atomic Transaction Write Pattern)**:

```
                  ┌─────────────────────────────────────┐
                  │ 1. PRE-FLIGHT & BACKUP SNAPSHOT     │
                  │ - Kiểm tra dung lượng trống (> 5x)  │
                  │ - Copy: File_2026.xlsx              │
                  │   -> Backup_Snapshots/*.bak         │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 2. WORK ON STAGING (FILE TẠM)       │
                  │ - Copy sang: .staging_xxx.tmp.xlsx  │
                  │ - File gốc: READ-ONLY, KHÔNG ĐỤNG   │
                  │ - openpyxl thao tác trên file tạm   │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 3. INTEGRITY CHECK (KIỂM CHỨNG)     │
                  │ - File size tạm > 0 và hợp lệ?      │
                  │ - Load workbook thử thành công?     │
                  │ - Đủ số sheet, không ô #REF!, #VAL? │
                  └───────┬─────────────────────┬───────┘
                     PASS │                     │ FAIL / EXCEPTION
                          ▼                     ▼
          ┌────────────────────────┐  ┌────────────────────────┐
          │ 4. ATOMIC SWAP         │  │ 5. ROLLBACK & CLEANUP  │
          │ - os.replace(tmp, gốc) │  │ - os.remove(file_tạm)  │
          │   (Mili-giây, an toàn) │  │ - File gốc nguyên vẹn  │
          │ - Cập nhật thành công  │  │ - Báo lỗi chi tiết     │
          └────────────────────────┘  └────────────────────────┘
```

#### Quy trình 5 bước kỹ thuật bất khả xâm phạm:

1. **Bước 1: Pre-flight Check & Snapshot Backup**:
   - Kiểm tra dung lượng ổ đĩa khả dụng (Disk space check): Đảm bảo còn trống ít nhất $5 \times$ kích thước file gốc.
   - Kiểm tra quyền truy cập ghi (write permissions) trên thư mục đích.
   - Tự động sao lưu một bản snapshot nguyên trạng sang thư mục `Backup_Snapshots/` có gắn nhãn thời gian chính xác:
     ```python
     backup_path = f"Backup_Snapshots/{file_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak"
     shutil.copy2(original_file_path, backup_path)
     ```

2. **Bước 2: Work-on-Staging (Cách ly hoàn toàn trên file tạm)**:
   - **Tuyệt đối không mở file gốc ở chế độ ghi trực tiếp**.
   - Tạo một file tạm ẩn trên cùng ổ đĩa (để đảm bảo phép đổi tên sau này là cùng volume):
     ```python
     staging_path = f"{os.path.dirname(original_file_path)}/.staging_{uuid.uuid4().hex[:8]}.tmp.xlsx"
     shutil.copy2(original_file_path, staging_path)
     ```
   - Toàn bộ thao tác thêm cột, cập nhật công thức `=SUM(...)`, gán nhãn, áp định dạng số kế toán được thực hiện và lưu (`wb.save(staging_path)`) trên file tạm này. File gốc hoàn toàn được giữ nguyên vẹn 100%.

3. **Bước 3: Strict Post-Execution Integrity Check (Kiểm tra Toàn vẹn)**:
   - Trước khi bất kỳ thao tác thay thế nào diễn ra, script bắt buộc phải chạy kiểm tra chất lượng file tạm:
     - `os.path.getsize(staging_path) >= os.path.getsize(original_file_path) * 0.9` (Đảm bảo file không bị tụt kích thước bất thường hoặc 0 bytes).
     - Dùng `openpyxl.load_workbook(staging_path, data_only=False)` mở lại kiểm tra:
       - Số lượng Sheet trong file tạm phải khớp chính xác số lượng Sheet của file gốc.
       - Quét kiểm tra công thức ở các ô `TONG` không được chứa lỗi `#REF!`, `#VALUE!`, `#NAME?`.

4. **Bước 4: Atomic Replace (Hoán đổi tức thì cấp hệ điều hành)**:
   - Khi và chỉ khi Bước 3 vượt qua toàn bộ tiêu chí kiểm thử, script mới thực thi hoán đổi nguyên tử:
     ```python
     os.replace(staging_path, original_file_path)
     ```
   - Lệnh `os.replace` trên cả Windows và Linux là một tác vụ Atomic ở cấp File System (System Call), diễn ra trong vài mili-giây. Sẽ không bao giờ có trạng thái "đang ghi một nửa thì bị ngắt".

5. **Bước 5: Fail-Safe Cleanup & Rollback**:
   - Toàn bộ quy trình được bọc trong khối `try...except...finally`:
     ```python
     try:
         # Thao tác trên staging_path...
         # Kiểm tra integrity...
         # os.replace(staging_path, original_file_path)
     except Exception as ex:
         logger.error(f"[PROVISION ERROR] Sự cố khi xử lý file tạm: {str(ex)}")
         if os.path.exists(staging_path):
             os.remove(staging_path) # Hủy file tạm dở dang ngay lập tức
         # File gốc không bị ảnh hưởng vì chưa hề bị ghi đè
         raise
     ```
   - Nếu xảy ra lỗi giữa chừng: File tạm bị xóa ngay lập tức, file gốc vẫn nguyên vẹn như trước khi chạy script.

---

## 7. THIẾT KẾ GIAO DIỆN WEB ADMIN

**Vị trí trên Web Checklist**: Menu Admin → Cấu hình CCP → Quản lý Template Excel

### 7.1. Tính Năng Màn Hình "CCP Template Manager"

```
┌──────────────────────────────────────────────────────────────┐
│  CCP TEMPLATE MANAGER                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PHÁT HIỆN THỰC THỂ MỚI CHƯA CÓ CỘT TRÊN FILE EXCEL       │
│  ──────────────────────────────────────────────────          │
│  [!] TVKD 099 – "Thanh vien ABC"      [18/09/2026 08:32]   │
│      Loại: Futures Thường | Xuất hiện: 47 lần               │
│      [Xem Chi tiet]  [Cap nhat Template]  [Bo qua]          │
│                                                              │
│  [!] Ma hang hoa "ZRE – Dau cai"      [15/09/2026 14:20]   │
│      Loại: Hang hoa nong san | Xuất hiện: 12 lần            │
│      [Xem Chi tiet]  [Cap nhat Template]  [Bo qua]          │
│                                                              │
│  LICH SU CAP NHAT TEMPLATE                                  │
│  ──────────────────────────────────────────────────          │
│  [OK] TVKD 086 – "ABL" da them vao file ACM + Normal       │
│       15/07/2026 09:15 | Admin: hiepth                      │
└──────────────────────────────────────────────────────────────┘
```

### 7.2. Modal Xác Nhận Trước Khi Chèn Cột

Khi Admin bấm `[Cap nhat Template]`, Web UI hiển thị modal:

```
┌──────────────────────────────────────────────────────────────┐
│  XAC NHAN CAP NHAT TEMPLATE EXCEL                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Thực thể cần thêm:  TVKD 099 – "Thanh vien ABC"           │
│                                                              │
│  Các file sẽ được cập nhật:                                  │
│  [v] Thong ke so lot giao dich 2026.xlsx                    │
│  [v] Thong ke so lot giao dich ACM 2026.xlsx                │
│  [v] Thong ke so lot giao dich Spread 2026.xlsx             │
│  [v] Thong ke so lot giao dich LME 2026.xlsx                │
│  [v] Thong ke gia tri giao dich 2026.xlsx                   │
│  [v] Thong ke gia tri giao dich ACM 2026.xlsx               │
│                                                              │
│  Backup tu dong se duoc tao tai: Backup_Snapshots/          │
│                                                              │
│  [Huy]                          [Xac Nhan & Thuc Thi]       │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. TỪ ĐIỂN MÃ HÀNG HÓA & CHIẾN LƯỢC MỞ RỘNG ĐỘNG

### 8.1. Cấu Trúc Từ Điển Hiện Tại (`ALL_KNOWN_COMMODITIES`)

| Nhóm | Ví dụ mã | Ghi chú |
| :--- | :--- | :--- |
| **ACM Nano (Quốc tế)** | `SI5CO`, `CP2CO`, `PL1NY` | Bạc, Đồng, Bạch kim khối lượng Nano |
| **Bạc thỏi niêm yết (-M)** | `SIV`, `SIVE` | Bạc vật chất nội địa |
| **Nông sản nội địa (VN)** | `CXR1`, `CXR2`, `CXA1`, `CXA2`, `DTV`, `TDV`, `CHV` | Cà phê, Điều, Tiêu, Chè |
| **Kim loại LME** | `CAD`, `AHD`, `PBD`, `SND`, `ZDS`, `NID`, `SSC`, `SSR`, `LHC` | Đồng, Nhôm, Chì, Thiếc, Kẽm, Niken, Thép |
| **Nông sản quốc tế (CME)** | `ZCE`, `ZLE`, `ZSE`, `ZRE` | Dầu đậu, Đậu nành, Dầu cải |
| **Options** | `C.ZCE`, `P.ZCE`, `C.ZLE`, `P.ZLE` | Quyền chọn mua/bán |

### 8.2. Cơ Chế Mở Rộng Từ Điển Không Cần Sửa Code (Giai đoạn 4)

**Vấn đề hiện tại**: Khi MXV niêm yết hàng hóa mới, phải sửa thủ công mảng `ALL_KNOWN_COMMODITIES` trong TypeScript và deploy lại backend.

**Giải pháp đề xuất**: Di chuyển từ điển vào MongoDB Collection `ccp_commodity_dictionary`:

```json
{
  "code": "ZRE",
  "label": "Dau cai",
  "labelEn": "Canola Oil",
  "exchange": "CME",
  "currency": "USD",
  "contractSize": 20,
  "monthCodes": "FGHJKMNQUVXZ",
  "active": true,
  "addedAt": "2026-09-01",
  "addedBy": "hiepth"
}
```

Khi có mã mới:
1. Admin thêm 1 bản ghi vào MongoDB qua Web UI.
2. Node.js tự động load lại từ điển từ MongoDB mỗi phiên chạy (`cache TTL: 24h`).
3. Không cần sửa code, không cần deploy lại backend.

---

## 9. QUY TẮC THIẾT KẾ BẮT BUỘC

### 9.1. Tuyệt Đối Không Tự Động Chèn Cột Trong Giờ Chạy Bot

```typescript
// SAI - Vi phạm nghiêm trọng:
if (!columnExists) {
  worksheet.insertColumn(colIdx); // Tự chèn cột trong bot hàng ngày
  writeData(colIdx, value);
}

// DUNG:
if (!columnExists) {
  pendingEntities.push({ code, type, detectedAt: new Date() }); // Chi ghi nhan
  // KHONG ghi so lieu vao file Excel
  // Doi Admin xac nhan va chay tool Python rieng
}
```

### 9.2. Không Hardcode Mã Thực Thể Vào Code

```typescript
// SAI:
const KNOWN_TVKD = ['001', '002', '003', '011', '045', '048', '086', '088'];

// DUNG:
// Doc tu Row 4 cua file Excel tai runtime (hoac tu MongoDB)
const tvkdColMap = buildTvkdMapFromHeaderRow(worksheet.getRow(4));
```

### 9.3. Nguyên Tắc Dữ Liệu TVKD Chuẩn Xác Từ `dstkgd` & Bỏ Qua Khi Chưa Cập Nhật

> [!NOTE]
> **ĐẶC THÙ NGHIỆP VỤ VỀ MÃ TKGD & TVKD**:
> - Dữ liệu TVKD được trích xuất từ 3 ký tự đầu của mã TKGD trong Danh mục tài khoản giao dịch (`dstkgd`) của hệ thống Core / M-System.
> - Toàn bộ tài khoản khi đã xuất hiện trên hệ thống đều đã trải qua quy trình thẩm định, đối soát hồ sơ pháp lý và phê duyệt mở tài khoản rất nghiêm ngặt. Do đó, **dữ liệu TKGD trên hệ thống đã là chính xác tuyệt đối**, gần như không bao giờ có chuyện gõ sai hay phát sinh ký tự lạ.

**Cơ chế xử lý khi Admin chưa cập nhật template Excel**:
- **Về mặt số liệu Excel**: Hệ thống **bỏ qua việc ghi cột cho mã mới này** để tránh làm sai lệch cấu trúc bảng tính, và **tiếp tục xử lý đầy đủ các cột hiện hữu theo đúng luồng cũ**. Số liệu của tất cả TVKD và mã hàng hóa đã có cột vẫn được ghi chép chuẩn xác 100%. Bot không bao giờ bị dừng hay treo giữa chừng (Fail-Safe).
- **Về mặt cảnh báo & Giám sát (BẮT BUỘC GHI LẠI CẢNH BÁO, KHÔNG ĐƯỢC BỎ QUA LẶNG LẼ)**:
  - Bắt buộc ghi log cảnh báo mức độ `WARN` trên Console và đưa vào `jobLogs` của ca trực.
  - Đẩy thông tin mã mới vào danh sách ghi nhận (`pending_system_entities` trong MongoDB) để hiển thị huy hiệu (Badge) cảnh báo màu vàng trên Web Checklist, giúp Admin/Vận hành IT phát hiện ngay và chủ động cập nhật template.

```typescript
// Xử lý khi quét số liệu CoreCCP:
const targetCol = headerMap.get(entityCode);

if (!targetCol) {
  // 1. BẮT BUỘC GHI CẢNH BÁO (KHÔNG ĐƯỢC BỎ QUA LẶNG LẼ):
  logger.warn(`[CCP-EXPAND WARN] Phát hiện mã "${entityCode}" có phát sinh số liệu (${lotValue} lot) nhưng chưa có cột trên template Excel!`);
  jobLogs?.push(`[CCP-WARN] Bỏ qua ghi cột mã "${entityCode}" (chưa cấu hình trên Excel). Cần Admin cập nhật template!`);
  
  // 2. Ghi nhận vào DB để hiển thị Badge cảnh báo trên Web Admin:
  await this.recordPendingEntityWarning({
    entityCode,
    entityType, // 'TVKD' hoặc 'COMMODITY'
    firstDetectedDate: new Date(),
    detectedLots: lotValue
  });

  // 3. Tiếp tục theo luồng cũ cho các cột hợp lệ khác:
  continue; // Skip ghi cột này, không làm gián đoạn toàn bộ phiên
}

// Nếu đã có cột -> Ghi số liệu bình thường theo luồng chuẩn
worksheet.getCell(targetRow, targetCol).value = lotValue;
```

### 9.4. Các Lưu Ý Tối Ưu Kỹ Thuật Bổ Sung (Edge-Case Safeguards & Điểm Cần Hoàn Thiện)

Để đưa kiến trúc đạt mức hoàn thiện tuyệt đối (10/10), nhóm kỹ thuật cần lưu ý 3 điểm mấu chốt sau trong quá trình triển khai:

#### 1. Kiểm soát Khóa File Độc Quyền (Exclusive File Lock Guard trên Windows)
* **Nguy cơ**: File Excel lũy kế nằm trên ổ đĩa mạng hoặc thư mục đồng bộ (OneDrive/SMB). Khi Admin bấm chạy tool cập nhật, có thể có nhân viên vận hành đang mở file trực tiếp bằng Microsoft Excel. Trên hệ điều hành Windows, hệ thống sẽ khóa file độc quyền và gây lỗi `PermissionError: [Errno 13] Permission denied` khi thực hiện `os.replace`.
* **Giải pháp kỹ thuật**:
  - Script Python bắt buộc phải có bước kiểm tra `is_file_locked(file_path)` ngay tại Bước 1 (Pre-flight).
  - Nếu file đang bị khóa (bị ứng dụng khác chiếm giữ): Dừng ngay lập tức và trả thông điệp thân thiện lên Web Admin:  
    *`"[CẢNH BÁO KHÓA FILE] File Excel đang được mở bởi người dùng khác. Vui lòng đóng file Excel trước khi xác nhận cập nhật!"`* (tránh việc tạo file tạm rồi bị lỗi ở bước hoán đổi).

#### 2. Cơ Chế Gom Nhóm & Chống Ngập Lụt Log Cảnh Báo (Alert Aggregation & Debounce)
* **Nguy cơ**: Trong phiên giao dịch, nếu một TVKD mới phát sinh 50 đến 100 giao dịch khớp lệnh, nếu mỗi giao dịch bot đều ghi 1 dòng log WARN thì `jobLogs` của ca trực sẽ bị ngập rác (Log Flooding), làm trôi mất các thông tin đối soát ca trực khác.
* **Giải pháp kỹ thuật**:
  - Trong runtime của Node.js, sử dụng cấu trúc `Map<string, { count: number, totalLots: number }>` để gom nhóm trong bộ nhớ tạm của phiên chạy.
  - Mỗi mã mới chỉ bắn **duy nhất 1 dòng log cảnh báo tổng hợp** ở cuối phiên:  
    *`"[CCP-WARN TỔNG HỢP] Bỏ qua mã TVKD 099 (chưa có cột trên Excel) - Tổng phát sinh trong phiên: 15 giao dịch (480 lots)."`*

#### 3. Hoàn Thiện Lộ Trình Di Chuyển Từ Điển Vào CSDL (Giai đoạn 4)
* **Nguy cơ**: Trong giai đoạn đầu, từ điển hàng hóa vẫn nằm trong file TypeScript `ccp-classifier.helper.ts` (`ALL_KNOWN_COMMODITIES`). Nếu MXV niêm yết thêm mặt hàng mới, vẫn cần lập trình viên vào sửa code và commit git.
* **Mục tiêu hoàn thiện**: Bắt buộc hoàn thành Giai đoạn 4 của Lộ trình (đưa vào MongoDB Collection `ccp_commodity_dictionary`), biến hệ thống thành **100% Zero-Code / Zero-Deployment** qua Web UI.

---

## 10. ACID TEST – 4 CÂU HỎI BẮT BUỘC TRƯỚC KHI TRIỂN KHAI

Bảng đánh giá kiểm chuẩn 4 tiêu chí cốt lõi của giải pháp mở rộng:

| # | Tiêu chí / Câu hỏi Kiểm chuẩn | Kỳ vọng | Cơ chế Kỹ thuật Đảm bảo |
| :--- | :--- | :--- | :--- |
| **1** | Nếu hệ thống xuất hiện TVKD mới (được duyệt từ `dstkgd`) và Admin cập nhật template qua tool, ngày hôm sau bot có tự động ghi số lot vào cột mới mà **không cần sửa code** không? | **CÓ** | **Dynamic Header Mapping**: Bot quét Row 4/5 lúc runtime để lập bản đồ cột động, không hardcode bất kỳ mã TVKD nào trong code. |
| **2** | Có rủi ro dữ liệu CoreCCP gõ sai mã TKGD thành ký tự lạ dẫn đến việc bot **tự ý tạo cột rác** trên file Excel lũy kế không? | **KHÔNG** | 1. Dữ liệu từ `dstkgd` đã qua luồng phê duyệt nghiêm ngặt nên chuẩn xác 100%.<br>2. Bot chỉ đọc và ghi theo các cột đã có trên template, tuyệt đối không tự động chèn cột lúc bot chạy hàng ngày. |
| **3** | Nếu Admin **không cập nhật template** khi phát sinh TVKD hoặc Mã HĐ mới, hệ thống có bị treo hoặc dừng toàn bộ bot không? | **KHÔNG** | **Bỏ qua ghi cột & Duy trì luồng cũ**: Bot vẫn ghi đủ số liệu cho các cột hiện có, bot hoàn thành 100%.<br> **Đồng thời BẮT BUỘC ghi cảnh báo WARN** vào Job Logs và đẩy Badge cảnh báo lên Web Checklist để Admin nhận biết kịp thời (tuyệt đối không bỏ qua lặng lẽ). |
| **4** | Nếu Python provisioner gặp lỗi giữa chừng (đầy ổ đĩa, timeout, tắt ngang máy), file Excel lũy kế có **bị hỏng hoặc mất mát dữ liệu** không? | **KHÔNG** | **Safe Transactional Atomic Write**: Thao tác hoàn toàn trên file tạm `.staging_xxx.tmp.xlsx`, kiểm tra toàn vẹn (Integrity Check) rồi mới hoán đổi tức thì bằng `os.replace`. File gốc luôn được bảo toàn nguyên vẹn 100% kèm bản Backup Snapshot. |

---

## 11. LỘ TRÌNH TRIỂN KHAI (ROADMAP – CHỜ CHUYỂN ĐỔI)

| Giai đoạn | Điều kiện tiên quyết | Nội dung công việc | Thời gian ước tính |
| :--- | :--- | :--- | :--- |
| **Giai đoạn 1** | Đang chạy Go-Live ACM | Bot ghi cảnh báo mã mới vào log. Chưa lưu DB, chưa có Web UI. | **Đã hoàn thành** |
| **Giai đoạn 2** | Sau Go-Live Spread/LME | Lưu `pending_system_entities` vào MongoDB. Hiển thị cảnh báo vàng trên Web Checklist. | 1–2 ngày dev |
| **Giai đoạn 3** | CoreCCP > 3 phân hệ | Viết `ccp_column_provisioner.py`. Tích hợp nút "Cap nhat Template" trên Web Admin. | 3–5 ngày dev |
| **Giai đoạn 4** | Sau Giai đoạn 3 | Di chuyển `ALL_KNOWN_COMMODITIES` vào MongoDB. Admin tự thêm hàng hóa mới qua Web UI không cần deploy. | 2–3 ngày dev |

---

## 12. KẾT LUẬN

1. **Về mặt kỹ thuật, toàn bộ quy trình có thể tự động hóa 100%** – không có bất kỳ bước nào kỹ thuật không giải quyết được.

2. **Con người chỉ cần can thiệp 1 lần duy nhất** (bấm nút "Xac Nhan Cap Nhat") để đảm bảo tính kiểm soát và phê duyệt nghiệp vụ, không phải để "làm thủ công bằng Excel".

3. **Quy trình được thiết kế theo nguyên tắc "Event-Driven Maintenance"**: Thay đổi cấu trúc Excel chỉ xảy ra khi có sự kiện hành chính được phê duyệt, không phải mỗi ngày, không phải realtime trong giờ bot chạy.

4. **Tiền lệ kỹ thuật đã có sẵn**: Script `excel_sheet_cloner.py` đang vận hành thực tế để sinh Sheet tháng mới. Script `ccp_column_provisioner.py` sẽ được xây dựng theo cùng kiến trúc và mô hình đó.

---

*Tài liệu này chờ thực thi sau khi giai đoạn chuyển đổi CoreCCP hoàn tất.*
*Mọi câu hỏi và góp ý, vui lòng liên hệ team Vận hành IT – MXV.*

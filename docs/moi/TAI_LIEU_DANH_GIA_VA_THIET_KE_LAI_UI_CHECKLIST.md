# TÀI LIỆU ĐÁNH GIÁ CHUYÊN SÂU & ĐẶC TẢ THIẾT KẾ LẠI GIAO DIỆN CHECKLIST CA TRỰC

> **Phiên bản:** 1.0  
> **Ngày lập:** 07/10/2026  
> **Đối tượng áp dụng:** Kỹ sư Frontend, Kỹ sư Vận hành Ca trực MXV, Trực ca QLGD, Trưởng bộ phận.  
> **Mục tiêu:** Tối ưu hóa triệt để trải nghiệm người dùng (UX/UI) của màn hình Checklist, đảm bảo tốc độ thao tác **nhanh bằng hoặc vượt trội hơn Excel**, loại bỏ rườm rà, ô nhiễm thị giác và rào cản thao tác.

---

## PHẦN 1: BỐI CẢNH & VẤN ĐỀ CỐT LÕI

Trong thực tế vận hành ca trực tại MXV, nhân viên đã quen với việc theo dõi công việc trên bảng tính Excel:
- **Ưu điểm của Excel:** Mở file là thấy toàn bộ bảng phẳng 20–30 dòng; dùng phím mũi tên và gõ 1 phím (`x`, `OK`) là xong; tốc độ xử lý 5 task chỉ mất ~2–3 giây.
- **Thực trạng màn hình Web hiện tại:** Dù hệ thống có nhiều tính năng tự động (Bot tải file, đối soát, cảnh báo SLA), nhưng **giao diện tương tác trực tiếp (`TaskTable.tsx`) đang bị chậm, rườm rà và nhiều thao tác hơn Excel gấp 5–8 lần**.

Tài liệu này ghi lại chi tiết các bằng chứng kỹ thuật từ mã nguồn hiện tại và đưa ra **Bản thiết kế chuẩn hóa (Blueprint)** để tái cấu trúc giao diện trong một lần duy nhất.

---

## PHẦN 2: BẰNG CHỨNG MÃ NGUỒN VỀ 4 ĐIỂM NGHẼN UX (CODE GROUND TRUTH)

Toàn bộ đánh giá dưới đây được trích xuất trực tiếp từ mã nguồn thực tế tại [TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx):

### 1. Rào cản Layout Master-Detail (2 cột Trái - Phải)
* **Vị trí code:** [TaskTable.tsx#L358-L361](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L358-L361)
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6" style={{ marginTop: '12px', alignItems: 'start' }}>
  ```
* **Vấn đề kỹ thuật:** 
  - Màn hình bị chia cứng thành 2 cột: Cột trái (1 phần) chứa danh sách Card các task cha, Cột phải (1.5 phần) chứa Workspace chi tiết của task đang chọn.
  - Trên các Card ở cột trái ([TaskTable.tsx#L374-L512](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L374-L512)), sự kiện click **chỉ duy nhất là `onClick={() => setSelectedTaskId(item.taskId)}` (dòng 377)**.
  - **Hoàn toàn KHÔNG CÓ nút Checkbox hay nút đổi trạng thái trực tiếp trên Card bên trái**. Người dùng bắt buộc phải click Card bên trái để kích hoạt Cột phải rồi mới làm gì thì làm.

### 2. Thao tác đổi trạng thái bị giấu sâu trong Dropdown
* **Vị trí code:** [TaskTable.tsx#L600-L689](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L600-L689)
* **Vấn đề kỹ thuật:** 
  - Sau khi chọn task bên trái, người dùng phải di chuột sang góc trên cột bên phải để tìm nút bấm mở Dropdown trạng thái:
    ```tsx
    <button onClick={() => setOpenStatusDropdownTaskId(...)}>
    ```
  - Click lần 1 mở Dropdown menu $\rightarrow$ Click lần 2 vào option `PASSED / Đạt` $\rightarrow$ gọi `handleStatusChange(...)`.
  - Để hoàn thành 1 task, người dùng tốn tối thiểu **3 cú click chuột ở 2 vị trí khác nhau trên màn hình** (so với 1 phím gõ trên Excel).

### 3. Khối Log Bot kỹ thuật in thô làm xấu và rối loạn giao diện
* **Vị trí code:** [TaskTable.tsx#L1005-L1048](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L1005-L1048)
  ```tsx
  <div style={{
    background: 'var(--bg-input)',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    borderLeft: selectedTask.status === 'FAILED' ? '4px solid #ef4444' : '4px solid #0284c7',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }}>
    {cleanedMsg || 'Đã kích hoạt tác vụ kiểm tra tự động của Bot'}
  </div>
  ```
* **Vấn đề kỹ thuật:** 
  - In trực tiếp chuỗi JSON kỹ thuật hoặc log console thô (`fontFamily: monospace`) chiếm 1 khoảng diện tích lớn.
  - Người dùng nghiệp vụ chỉ cần biết kết quả: **"Khớp hay Lệch?"**, nhưng giao diện lại bắt họ đọc văn bản kỹ thuật dành cho lập trình viên.
  - Nút bấm xem đối chiếu số liệu (`Xem đối chiếu chi tiết trực quan`) lại bị nhét chìm lấp bên dưới khối log này ([TaskTable.tsx#L1044](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L1044)).

### 4. Ô nhiễm màu sắc (Visual Clutter) & Hộp xếp lồng hộp
* **Vị trí code:**
  - Viền Card bên trái ([TaskTable.tsx#L401-L409](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L401-L409)): Hồng `#ec4899` (Bot-only), Tím `#8b5cf6` (hasChildren), Xanh lá, Xanh dương.
  - Hộp SLA Cam ([TaskTable.tsx#L893-L903](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L893-L903)).
  - Hộp Deadline Đỏ ([TaskTable.tsx#L877-L886](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L877-L886)).
  - Hộp Khung giờ Xanh ([TaskTable.tsx#L909-L919](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L909-L919)).
* **Vấn đề kỹ thuật:** Quá nhiều hộp badge xếp cạnh nhau, viền đậm màu neon gây mỏi mắt trong ca trực kéo dài 8 tiếng.

### 5. Nhập ghi chú (Notes) bắt buộc qua 3 bước và nút Save riêng
* **Vị trí code:** [TaskTable.tsx#L1227-L1271](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L1227-L1271)
* **Vấn đề kỹ thuật:** 
  - `<textarea rows={3} ... value={notesState...} />` nằm ở tận đáy của cột bên phải.
  - Nhập xong bắt buộc phải bấm nút `<button onClick={() => handleSaveNote(...)}> Lưu ghi chú </button>`. Nếu người dùng click sang task khác mà quên bấm nút Lưu thì ghi chú chưa được đồng bộ vào CSDL.
  - Trên Excel: Click vào ô $\rightarrow$ Gõ chữ $\rightarrow$ Enter là tự lưu.

---

## PHẦN 3: SO SÁNH ĐỊNH LƯỢNG THAO TÁC (BENCHMARK)

| Tiêu chí | Excel Sheet | Giao diện TaskTable.tsx Hiện Tại | Giao diện Mới Đề Xuất (Bảng 1-chạm) |
| :--- | :---: | :---: | :---: |
| **Số click để hoàn thành 1 task** | 0 click (1 phím gõ `x`) | **3 click** (chọn card $\rightarrow$ mở menu $\rightarrow$ chọn Đạt) | **1 click** (bấm nút tick ngay trên hàng) |
| **Thời gian hoàn thành 5 task** | **~2 giây** | **~20 – 25 giây** | **~3 – 4 giây** |
| **Số lượng task nhìn thấy cùng lúc** | 20 – 30 task | Chỉ 5 – 6 card (do card quá to) | **18 – 25 task** (bảng compact) |
| **Thao tác ghi chú** | Gõ thẳng vào ô | Cuộn chuột $\rightarrow$ gõ $\rightarrow$ bấm nút Lưu | Gõ trực tiếp trên dòng $\rightarrow$ auto save on blur |
| **Xem chi tiết lệch/đối soát** | Không có (tự mở tool ngoài) | Bị chìm dưới khối log thô | **1 click vào Badge kết quả Bot** |

---

## PHẦN 4: ĐẶC TẢ THIẾT KẾ MỚI: BẢNG TINH GỌN (SPREADSHEET COMPACT VIEW)

### 1. Kiến trúc Bố cục Tổng thể (Layout Architecture)
Chuyển đổi từ mô hình **Master-Detail 2 cột cứng** sang mô hình:
**BẢNG CHÍNH TOÀN MÀN HÌNH (Full-width Data Table) + NGĂN KÉO TRƯỢT (Slide-over Drawer khi cần soi sâu)**.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [🔍 Tìm kiếm tác vụ...]   [Ca: Tất cả ▼]   [Trạng thái: Tất cả ▼]               Tiến độ: 14/18 (78%) [██████░░] │
├────┬───────┬──────────────────────────────┬──────────────┬───────────────┬──────────────┬──────────────┬────────┤
│ STT│ Giờ   │ Tên tác vụ                   │ Trạng thái   │ Kết quả Bot   │ Thao tác     │ Ghi chú      │ Chi tiết│
├────┼───────┼──────────────────────────────┼──────────────┼───────────────┼──────────────┼──────────────┼────────┤
│ 01 │ 05:00 │ Kiểm tra Job Snapshot        │ [✓ ĐÃ ĐẠT]   │ ✓ Mail hợp lệ │ —            │ Bình thường  │ [ ⚙ ]  │
│ 02 │ 06:30 │ Đối chiếu & Chạy EOD MS      │ [⊘ CHỜ LÀM]  │ — Thủ công    │ [Đối soát MS]│ Đang chờ file│ [ ⚙ ]  │
│ 03 │ 07:05 │ Đối chiếu số dư SOD (MS-CQG) │ [⚠ CẦN CHÚ Ý]│ ⚠ Lệch 2 TK   │ [Xem chi tiết]│ Đã báo TVKD  │ [ ⚙ ]  │
│ 04 │ 08:00 │ Thay đổi Ký quỹ hàng hóa     │ [⏳ CHỜ DUYỆT]│ — Maker 4 mắt │ [Gửi duyệt]  │ HĐ ZCE       │ [ ⚙ ]  │
└────┴───────┴──────────────────────────────┴──────────────┴───────────────┴──────────────┴──────────────┴────────┘
```

### 2. Chi tiết từng Cột trên Bảng Tinh Gọn

#### Cột 1: STT & Thời gian (Time & SLA)
- Hiển thị nhỏ gọn, font chuẩn: `#01`, `#02`...
- Khung giờ (`05:00 - 06:00`). Nếu task có SLA cam kết quá hạn $\rightarrow$ Hiện icon đồng hồ đỏ nhỏ kèm số phút trễ.

#### Cột 2: Tên Tác vụ & Phụ thuộc
- Tên tác vụ in đậm, dễ đọc.
- Nếu có phụ thuộc task khác: Hiện tag mini xám `Phụ thuộc: #02 (Đạt)`.
- Nếu có Sub-tasks: Hiện badge nhỏ `(3/3 mục hoàn thành)`.

#### Cột 3: Trạng thái 1-Chạm (Single-Click Status Toggle)
- **Cơ chế:** Nút bấm trạng thái to, rõ ràng:
  - Khi chưa làm: Nút xám mờ `[ ◯ Đánh dấu Đạt ]` $\rightarrow$ Click 1 cái đổi sang `[ ✓ ĐÃ ĐẠT ]` (màu xanh lá dịu).
  - Nút chuyển trạng thái nhanh: Click chuột phải hoặc nút mũi tên nhỏ cạnh nút để chuyển nhanh sang `FAILED (Không đạt)` hoặc `NEEDS_ATTENTION (Cần chú ý)`.

#### Cột 4: Kết quả Bot (Clean Business Badge)
- **Tuyệt đối KHÔNG in log monospace hay JSON thô ra bảng.**
- Chỉ hiển thị 1 Huy hiệu (Badge) nghiệp vụ tinh gọn:
  - Bot thành công: `[ ✓ Khớp 100% ]` (nền xanh lá nhạt, chữ xanh lá).
  - Bot phát hiện lệch: `[ ⚠ Lệch 2 TK ]` (nền cam nhạt, chữ cam). Click thẳng vào badge này mở ngay Modal đối soát chi tiết.
  - Task thủ công: Hiện dấu gạch ngang mờ `—`.

#### Cột 5: Thao tác Nghiệp vụ Nhanh (Quick Actions)
- Chỉ hiển thị các nút hành động tương ứng với task:
  - Task đối chiếu: Nút `[Đối soát]` mở popup đối chiếu MS-CQG.
  - Task báo cáo: Nút `[Báo cáo GD]`.
  - Task OMS: Nút `[Kiểm tra OMS]`.

#### Cột 6: Ghi chú Nhanh (Inline Editable Cell)
- Ô văn bản phẳng như ô Excel.
- Người dùng click vào là gõ được ngay.
- Sự kiện `onBlur` hoặc nhấn `Enter` tự động gọi API `handleSaveNote` ngầm, không cần nút bấm "Lưu ghi chú". Có icon tick xanh mờ báo đã lưu.

#### Cột 7: Nút Chi Tiết [ ⚙ ]
- Bấm vào sẽ mở **Slide-over Drawer** (trượt từ mép phải màn hình) để xem:
  - Toàn bộ danh sách Sub-tasks có checkbox riêng.
  - Đường dẫn tệp đính kèm (`fileLocationSnapshot`).
  - URD tham chiếu.
  - Lịch sử thao tác (Audit Log) của riêng task đó.

---

### 3. Bảng Màu Chuẩn Hóa Doanh Nghiệp (Enterprise Color Palette)

Tuân thủ nghiêm ngặt quy tắc [AGENTS.md (Mục 4 - Điểm 5)](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/.agents/AGENTS.md): **Tuyệt đối không dùng Unicode Emoji thô, chỉ dùng Lucide SVG icon và bảng màu trung tính chuyên nghiệp.**

| Trạng thái | Nền (Background) | Chữ (Text) | Viền (Border) | Icon Lucide |
| :--- | :--- | :--- | :--- | :--- |
| **ĐÃ ĐẠT (PASSED)** | `rgba(16, 185, 129, 0.08)` | `#059669` | `rgba(16, 185, 129, 0.2)` | `<CheckCircle2 size={13} />` |
| **KHÔNG ĐẠT (FAILED)** | `rgba(239, 68, 68, 0.08)` | `#dc2626` | `rgba(239, 68, 68, 0.2)` | `<XCircle size={13} />` |
| **CẦN CHÚ Ý (NEEDS_ATTENTION)**| `rgba(245, 158, 11, 0.08)` | `#d97706` | `rgba(245, 158, 11, 0.2)` | `<AlertTriangle size={13} />` |
| **CHỜ XỬ LÝ (PENDING)** | `rgba(148, 163, 184, 0.08)` | `#64748b` | `rgba(148, 163, 184, 0.2)` | `<Clock size={13} />` |
| **BOT HOÀN TẤT** | `rgba(2, 132, 199, 0.08)` | `#0284c7` | `rgba(2, 132, 199, 0.2)` | `<Bot size={13} />` |

---

## PHẦN 5: KẾ HOẠCH TRIỂN KHAI KỸ THUẬT (ACTIONABLE CHECKLIST)

Khi bắt tay vào code chỉnh sửa lại màn hình này, lập trình viên/AI cần thực hiện theo các bước sau:

- [ ] **Bước 1: Dọn dẹp sạch khối Bot Result Log cũ trong [TaskTable.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/components/TaskTable.tsx#L976-L1049)**
  - Gỡ bỏ thẻ bọc có `fontFamily: monospace` và `borderLeft` thô.
  - Chuyển `cleanedMsg` và nút `onOpenBotLogViewer` thành một Badge kết quả mini gọn gàng.
- [ ] **Bước 2: Xây dựng Component `TaskTableViewMode` (Bảng Compact)**
  - Tạo cấu trúc thẻ `<table>` hoặc Grid phẳng 1 hàng cho mỗi task.
  - Đưa nút đổi trạng thái nhanh trực tiếp lên hàng của task (`inline status button`).
  - Đưa ô nhập ghi chú trực tiếp lên hàng (`inline note input with auto-save`).
- [ ] **Bước 3: Tách Workspace chi tiết thành Drawer (`TaskDetailDrawer.tsx`)**
  - Chuyển toàn bộ phần chi tiết phức tạp (Subtasks checklist, Metadata URD, File location) vào Drawer trượt từ bên phải.
  - Khi người dùng bấm nút `[Chi tiết]` hoặc click đúp dòng thì mới mở Drawer này.
- [ ] **Bước 4: Kiểm thử hiệu năng & Độ mượt thao tác**
  - Đảm bảo người dùng có thể tick liên tiếp 5 task mà không bị giật lag giao diện (Optimistic UI update).
  - Chạy kiểm tra build Frontend: `npm run build` hoặc `npx tsc --noEmit`.
- [ ] **Bước 5: Ghi vết thay đổi vào [CHANGELOG_AI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/CHANGELOG_AI.md)** theo đúng quy tắc kiểm toán thay đổi.

---

## PHẦN 6: KẾT LUẬN

Tài liệu này là căn cứ kỹ thuật thống nhất giữa người dùng và đội ngũ phát triển. Khi áp dụng bản thiết kế này, hệ thống sẽ giữ trọn vẹn sức mạnh của **Bot tự động & Bằng chứng kiểm toán**, đồng thời mang lại trải nghiệm thao tác **nhẹ nhàng, tức thì và trực quan ngang ngửa hoặc vượt trội hơn bảng tính Excel**.

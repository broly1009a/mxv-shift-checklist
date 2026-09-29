# TÀI LIỆU THIẾT KẾ: TÍNH NĂNG CHỌN CHECKBOX "CHECK LẠI" TINH GỌN & NGUỒN GỐC DỮ LIỆU (DATA PROVENANCE TOOLTIP)

**Dự án**: Hệ thống Thẩm định & Giám sát Mở Tài Khoản Giao Dịch (MXV Account Opening Reconciler)  
**Phân hệ**: Giao diện Quản lý Hồ sơ Mở TKGD (`frontend/src/features/tkgd`)  
**Tác giả**: MXV Engineering & IT Operation  
**Cập nhật lần cuối**: 24/09/2026  
**Trạng thái**: Đã nghiệm thu & Triển khai thực tế  

---

## 1. BỐI CẢNH & PHÂN TÍCH TIẾP THU Ý KIẾN NGƯỜI DÙNG

### 1.1. Phê Bình Thiết Kế Ban Đầu (Dev-Centric vs. User-Centric)
Trong phiên bản thiết kế sơ khai, thanh thao tác hàng loạt (Bulk Action Bar) và thanh công cụ (Toolbar) bị quá tải bởi các thuật ngữ và tư duy kỹ thuật của lập trình viên:

* ❌ **Quá nhiều nút bấm kỹ thuật phân mảnh**:
  - `[Chạy Lại Toàn Trình E2E]`
  - `[Chỉ Cào Lại M-System]`
  - `[Chỉ Tái Thẩm Định Luật Mới]`
  - `[Chế Độ Bóc Tách: Nhanh (Text) / Đầy Đủ (Tệp/Ảnh)]`
  - `[Khắc Phục Bug (Dev)]`
* ❌ **Thuật ngữ gây bối rối, máy móc cho cán bộ nghiệp vụ**:
  - Cán bộ nghiệp vụ ca trực tại Sở Giao dịch (QLGD, TTBT) không phải là kỹ sư phần mềm. Việc bắt người dùng phân biệt giữa *"E2E"*, *"Cào M-System"*, *"Tái thẩm định"* hay *"Bóc tách Heuristic"* tạo cảm giác hệ thống khó dùng, phức tạp và thiếu tự tin khi bấm nút.
  - Người dùng ca trực chỉ có **một nhu cầu nghiệp vụ duy nhất và trực diện**: Khi phát hiện dữ liệu của 1 hoặc nhiều tài khoản chưa khớp, hoặc TVKD vừa gửi mail đính kèm mới, người dùng chỉ muốn **"Kiểm tra lại" (Check lại)** các tài khoản đó để xem đã khớp hay chưa.

### 1.2. Nguyên Tắc Thiết Kế Mới: Đơn Giản Hóa Triệt Để (Simplicity First)
1. **Nút bấm trực diện, thuần nghiệp vụ**:
   - Trên Toolbar chính: Đổi nút dài dòng *"Quét & Chạy Ngay"* / *"Chạy Tự Động Toàn Bộ"* thành một chữ duy nhất: **`[Check]`**.
   - Trên Floating Bulk Action Bar: Thay thế 3 nút kỹ thuật rời rạc bằng **DUY NHẤT 1 NÚT: `[Check lại]`**.
2. **Ẩn (Comment-out) các tính năng debug của Dev**:
   - Các nút chạy từng bước riêng lẻ (Quét mail riêng, Cào MS riêng), chế độ bóc tách nhanh/đầy đủ và công cụ khắc phục bug được **comment ẩn bằng JSX `{/* ... */}` trong mã nguồn**.
   - **Tuyệt đối không xóa code**: Giữ lại toàn bộ logic xử lý để phục vụ cứu hộ kỹ thuật khi cần, nhưng ẩn khỏi mắt người dùng vận hành hằng ngày để giao diện thoáng đãng, chuyên nghiệp.
3. **"Dưới mui xe" thông minh (Smart Under-The-Hood)**:
   - Khi người dùng bấm **`[Check lại]`**, hệ thống tự động kích hoạt chuỗi tác vụ tối ưu: Quét lại mail/tệp đính kèm $\rightarrow$ Cập nhật thông tin mới nhất trên M-System $\rightarrow$ Đối soát chéo theo bộ luật thẩm định chuẩn. Người dùng không cần quan tâm hệ thống phải qua bao nhiêu bước kỹ thuật.

---

## 2. THIẾT KẾ CỘT CHECKBOX & FLOATING BULK ACTION BAR TINH GỌN

```
┌───┬──────────────┬──────────────────┬──────┬──────────────┬──────────────┐
│ ☑ │   MÃ TKGD    │ HỌ VÀ TÊN KH     │ TVKD │ TRẠNG THÁI   │   THAO TÁC   │
├───┼──────────────┼──────────────────┼──────┼──────────────┼──────────────┤
│ ☑ │ 003C2886699  │ HOÀNG THANH TÙNG │ 003  │ 🔴 Cần kiểm tra│ [Xem chi tiết]
│ ☑ │ 038C1234567  │ NGUYỄN VĂN AN    │ 038  │ 🟢 Đã khớp    │ [Xem chi tiết]
└───┴──────────────┴──────────────────┴──────┴──────────────┴──────────────┘

                          ┌────────────────────────────────────────────────────────┐
                          │ 🔵 2 Tài khoản được chọn  │  🔄 [Check lại]  │ Bỏ chọn │
                          └────────────────────────────────────────────────────────┘
                                            (Floating Action Bar)
```

### 2.1. Cột Checkbox Bảng Danh Sách (`TkgdRecordsTable.tsx`)
* **Checkbox Header**: Cho phép "Chọn tất cả" / "Bỏ chọn tất cả" trên trang hiện tại.
* **Checkbox từng hàng**: Click chọn/bỏ chọn từng hồ sơ độc lập. Có hiệu ứng highlight dòng được chọn (`bg-blue-50/40` hoặc `rgba(59, 130, 246, 0.08)`).

### 2.2. Thanh Công Cụ Nổi (Floating Bulk Action Bar)
* **Vị trí**: Ghim cố định ở giữa đáy màn hình (`position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)`).
* **Hiệu ứng**: Xuất hiện mượt mà (Fade/Slide-up) khi có ít nhất 1 tài khoản được tick chọn.
* **Thành phần giao diện**:
  1. **Badge đếm số lượng**: Vòng tròn xanh hiển thị số tài khoản đã chọn (ví dụ: `2 Tài khoản được chọn`).
  2. **Nút `[Check lại]`**: Thiết kế nổi bật (Gradient xanh dương đậm `#2563eb` $\rightarrow$ `#1d4ed8`, icon `RefreshCw`, font bold).
  3. **Nút `[Bỏ chọn]`**: Nút dạng link/text tinh tế, click để xóa sạch danh sách chọn.
  4. **Trạng thái tiến trình (Real-time Status)**: Khi đang chạy, tự động chuyển thành icon xoay `Loader2` kèm thông báo: `Đang kiểm tra lại cho X tài khoản...`. Khi xong, hiển thị tích xanh `CheckCircle2` thông báo hoàn tất và tự động làm mới bảng dữ liệu.

### 2.3. Mã Nguồn Triển Khai Thực Tế

```tsx
{/* =========================================================================
 * FLOATING BULK ACTION BAR (THANH CÔNG CỤ NỔI KHI TICK CHỌN CHECKBOX)
 * ========================================================================= */}
{(selectedIds.length > 0 || isBulkRunning || bulkStatusMsg) && (
  <div
    style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      color: '#ffffff',
      padding: '12px 20px',
      borderRadius: '16px',
      boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 65, 85, 0.8)',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      backdropFilter: 'blur(12px)',
      maxWidth: '90vw',
      flexWrap: 'wrap',
    }}
  >
    {/* Badge đếm số lượng */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '14px', borderRight: '1px solid #334155' }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#ffffff' }}>
        {selectedIds.length}
      </span>
      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tài khoản được chọn</span>
    </div>

    {/* Trạng thái tiến trình */}
    {isBulkRunning ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}>
        <Loader2 size={16} className="animate-spin" />
        <span>{bulkStatusMsg || 'Đang kiểm tra lại...'}</span>
      </div>
    ) : bulkStatusMsg ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
        <CheckCircle2 size={16} />
        <span>{bulkStatusMsg}</span>
      </div>
    ) : (
      <>
        {/* NÚT DUY NHẤT THÂN THIỆN: CHECK LẠI */}
        <button
          type="button"
          onClick={handleBulkRunE2E}
          disabled={isBulkRunning}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
          }}
          title="Tự động kiểm tra lại các tài khoản đã chọn"
        >
          <RefreshCw size={14} />
          <span>Check lại</span>
        </button>

        {/* Nút bỏ chọn */}
        <button
          type="button"
          onClick={() => setSelectedIds([])}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '0.78rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px 8px',
          }}
        >
          Bỏ chọn
        </button>
      </>
    )}
  </div>
)}
```

---

## 3. THIẾT KẾ DATA PROVENANCE TOOLTIP `(i)`: MINH BẠCH NGUỒN GỐC DỮ LIỆU

### 3.1. Nhu Cầu Nghiệp Vụ Thực Tế
Khi mở modal chi tiết để so sánh (`TabDataComparison.tsx`), cán bộ đối soát thường phải trả lời câu hỏi:
* *"Số CCCD này lấy từ đâu ra? Có phải đọc từ ảnh gốc khách hàng chụp hay cào từ thumbnail trên M-System?"*
* *"Tên khách hàng lấy từ chữ trên mail hay từ trang 1 hợp đồng PDF?"*
* *"Độ tin cậy của thuật toán bóc tách là bao nhiêu phần trăm?"*

Nếu không hiển thị nguồn gốc (Data Provenance), cán bộ nghiệp vụ sẽ thiếu niềm tin vào kết luận của hệ thống và lại phải mở từng file PDF/ảnh ra kiểm tra thủ công.

### 3.2. Giải Pháp Giao Diện: `ProvenanceBadge` Tinh Tế
Bên cạnh mỗi giá trị trường thông tin trong bảng đối chiếu, hệ thống đặt một icon `(i)` nhỏ gọn. Khi rê chuột (Hover), một Card giải trình dữ liệu xuất hiện ngay lập tức:

```
┌─────────────────────────────────────────────────────────────┐
│ ℹ️ NGUỒN GỐC DỮ LIỆU: [SỐ CCCD / ĐỊNH DANH]                 │
├─────────────────────────────────────────────────────────────┤
│ • Loại nguồn trích xuất: Giải mã MRZ Chip Thẻ CCCD Mặt Sau │
│ • Tệp bằng chứng gốc   : LE-TRONG-HUY-CCCD-sau.jpg          │
│ • Độ tin cậy thuật toán: 98.5% (High Precision)             │
│ • Dữ liệu bóc tách thô : IDVNM087035120803<<<<<<<<<<<<<<   │
│ • Thời gian xử lý      : 24/09/2026 10:15:32                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3. Bảng Ánh Xạ Phân Loại Nguồn Dữ Liệu

| Loại Nguồn (`sourceType`) | Biểu Tượng & Màu Sắc | Diễn Giải Nghiệp Vụ Cho User |
| :--- | :--- | :--- |
| **`PDF_CONTRACT`** | `FileText` (Xanh dương) | **Hợp Đồng Mở Tài Khoản**: Đọc trực tiếp từ lớp văn bản số (Text Layer) của tệp PDF hợp đồng mở TKGD. Độ tin cậy 100%. |
| **`CCCD_FRONT_IMAGE`** | `ImageIcon` (Vàng hổ phách) | **Mặt Trước Thẻ CCCD**: Bóc tách tự động bằng OCR từ ảnh chụp mặt trước thẻ CCCD của khách hàng. |
| **`CCCD_BACK_MRZ`** | `ScanLine` (Xanh lục) | **Mặt Sau Thẻ CCCD (MRZ)**: Giải mã chuỗi mã máy đọc chuẩn ICAO Document 9303 mặt sau thẻ gắn chip. Trùng khớp năm sinh Dòng 2. |
| **`EMAIL_BODY`** | `Mail` (Tím nhạt) | **Văn Bản Email**: Bóc tách từ nội dung bảng/thông tin trong email gửi từ TVKD. |
| **`MSYSTEM`** | `Globe` (Tím đậm) | **Hệ Thống M-System**: Dữ liệu do Bot RPA cào tự động từ giao diện quản lý NĐT của M-System. |

---

## 4. BẢNG TỔNG HỢP SO SÁNH TRƯỚC VÀ SAU KHI TINH GỌN UX

| Tiêu Chí | Thiết Kế Cũ (Dev-Centric) | Thiết Kế Mới (User-Centric & MXV Standard) | Lợi Ích Nghiệp Vụ |
| :--- | :--- | :--- | :--- |
| **Nút kích hoạt Toolbar** | `Quét & Chạy Ngay` / `Chạy Tự Động Toàn Bộ` | **`Check`** (hoặc `Check Ngay` trong modal cấu hình) | Ngắn gọn, hành động dứt khoát, dễ nhớ. |
| **Thao tác hàng loạt (Bulk Bar)** | 3 nút rời rạc: `Chạy Lại Toàn Trình E2E`, `Chỉ Cào MS`, `Chỉ Tái Thẩm Định` | **1 nút duy nhất: `Check lại`** | Cán bộ chỉ cần chọn dòng và bấm 1 nút, hệ thống tự động làm hết. |
| **Chế độ bóc tách** | Hiển thị dropdown: `Nhanh (Text)` vs `Đầy Đủ (Tệp/Ảnh)` | **Comment ẩn** (Mặc định chạy chế độ thông minh Smart Skip) | Tránh người dùng chọn nhầm chế độ dẫn đến sót dữ liệu OCR. |
| **Các nút chạy thủ công** | Phơi bày các bước 1, 2, 3 riêng lẻ trên menu | **Comment ẩn** trong JSX | Giảm ô nhiễm thị giác, ngăn chặn bấm nhầm thứ tự luồng. |
| **Nút Khắc Phục Bug (Dev)**| Nằm lộ liễu trên Toolbar chính | **Comment ẩn** | User không bị hoang mang bởi các công cụ debug của lập trình viên. |
| **Minh bạch dữ liệu** | Không có nguồn gốc, chỉ thấy giá trị text | **Icon `(i)` Provenance Tooltip** cho từng trường | Thấy rõ tệp gốc, thuật toán trích xuất và độ tin cậy. |
| **Bảo toàn mã nguồn** | Nguy cơ bị xóa code cũ | **Giữ nguyên 100% trong comment** | Kỹ thuật vẫn có thể mở lại để debug khi có sự cố đặc biệt. |

---

## 5. KẾT LUẬN & CAM KẾT VẬN HÀNH

Thiết kế tinh gọn này giúp hệ thống **MXV Account Opening Reconciler**:
1. Trở thành một công cụ làm việc hằng ngày thân thiện, trực quan và chuẩn hóa theo ngôn ngữ nghiệp vụ của Sở Giao dịch Hàng hóa Việt Nam.
2. Loại bỏ hoàn toàn sự rườm rà, máy móc của các thuật ngữ lập trình mà vẫn duy trì sức mạnh xử lý tự động toàn trình ở tầng lõi.
3. Đảm bảo tính kiểm toán và truy vết nguồn gốc dữ liệu minh bạch tuyệt đối thông qua Data Provenance Tooltip.

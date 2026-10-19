# TÀI LIỆU THIẾT KẾ KỸ THUẬT CHUYÊN SÂU: TÍNH NĂNG XUẤT BÁO CÁO EXCEL CA TRỰC VẬN HÀNH MXV

> **Dự án:** MXV Shift Checklist & Trading Operations  
> **Cơ sở tham chiếu mã nguồn:** Repository `mxv-cqg-download-investigation`  
> **Tài liệu nghiệp vụ gốc:** [`Checklist trực vận hành.docx`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/Checklist%20tr%E1%BB%B1c%20v%E1%BA%ADn%20h%C3%A0nh.docx) & [`QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md)  
> **Ngày lập:** 14/10/2026

---

## 1. TỔNG QUAN & BỐI CẢNH NGHIỆP VỤ (BUSINESS CONTEXT)

### 1.1. Mục Tiêu Thiết Kế

Hệ thống quản lý ca trực số hóa đã hoàn thành việc quản lý trạng thái thời gian thực (Real-time Web UI) và tự động hóa tác vụ (Bot Engine). Tuy nhiên, để đáp ứng toàn diện quy trình kiểm toán ISO, thanh tra ngành hàng hóa và báo cáo quản trị Lãnh đạo, hệ thống cần chuẩn hóa **2 luồng xuất dữ liệu bảng tính chuyên nghiệp (Enterprise Excel Reports)**:

1. **Luồng 1 (Maker Level - Single Shift Audit Sheet):** Xuất biên bản chi tiết của **01 ca trực cụ thể**, tái hiện 100% biểu mẫu bảng biểu nguyên văn từ tài liệu Word gốc, đóng dấu thời gian (Timestamp) thực chứng và chữ ký số hóa để lưu hồ sơ pháp lý.
2. **Luồng 2 (Supervisor/Executive Level - Management Periodic Report):** Xuất báo cáo tổng hợp **nhiều ca trực theo khoảng thời gian** (tháng/quý) tại màn hình Lịch sử, phân tích chỉ số KPI tuân thủ hạn mức thời gian (SLA), thống kê danh sách sự cố (Incidents) và đánh giá hiệu suất nhân sự trực.

---

### 1.2. Khảo Sát & Đánh Giá Hiện Trạng Mã Nguồn (Code-First Grounding)

| Thành phần                 | Đường dẫn mã nguồn                                                                                                                                                                                                                                                                                                                                                                                                                | Hiện trạng thực tế                                                                                                                                                                                                           | Đánh giá & Khoảng cách (Gap Analysis)                                                                                                    |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Thư viện Excel Backend** | [backend/package.json#L70-L81](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/package.json#L70-L81)                                                                                                                                                                                                                                          | Đã cài sẵn `exceljs` (`^4.4.0`) và `xlsx` (`^0.18.5`).                                                                                                                                                                       | **Sẵn sàng 100%**. Có đầy đủ công cụ mạnh nhất để format cell, border, color, auto-width, merge cells.                                   |
| **Data Schema Ca Trực**    | [shift-log.schema.ts#L5-L208](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/schemas/shift-log.schema.ts#L5-L208)                                                                                                                                                                                                                        | Lưu trữ đầy đủ: `shiftDate`, `status`, `progressPercentage`, `details` (từng task: `isChecked`, `checkedAt`, `updatedBy`, `note`, `timetableSnapshot`, `actionDescriptionSnapshot`), `closedBy`, `closedAt`, `handoverNote`. | **Dữ liệu đầy đủ 100%**, có quan hệ populate tới `ChecklistTemplate`, `User`, `Department`.                                              |
| **Data Schema Sự Cố**      | [incident.schema.ts#L24-L60](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/schemas/incident.schema.ts#L24-L60)                                                                                                                                                                                                                          | Lưu trữ đầy đủ: `code`, `taskId`, `shiftLogId`, `severity` (M1/M2/M3), `requiredAction`, `status`, `detectedAt`, `resolvedAt`, `resolvedBy`.                                                                                 | **Sẵn sàng 100%** để trích xuất Sheet Sự cố cho báo cáo quản trị Lãnh đạo.                                                               |
| **Luồng 1 (Frontend)**     | [checklist/page.tsx#L505-L506](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/page.tsx#L505-L506)<br/>[useChecklist.ts#L510-L556](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/checklist/hooks/useChecklist.ts#L510-L556) | Đã có nút `"Xuất file Excel"` gọi `exportToExcel`.                                                                                                                                                                           | **Hạn chế**: Hiện mới dùng chuỗi nối dấu phẩy xuất file `.csv` thô, chưa có style, chưa có format A4, thiếu các mốc giờ và khung chữ ký. |
| **Luồng 2 (Frontend)**     | [history/page.tsx#L80-L140](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/history/page.tsx#L80-L140)                                                                                                                                                                                                                               | Đã có bộ lọc: Phòng ban, Trạng thái, Từ ngày, Đến ngày.                                                                                                                                                                      | **Chưa có**: Hoàn toàn chưa có nút bấm và API xuất báo cáo tổng hợp nhiều ca trực kèm KPI.                                               |

---

## 2. THIẾT KẾ KỸ THUẬT: LUỒNG 1 - BIÊN BẢN CA TRỰC CHI TIẾT (SINGLE-SHIFT AUDIT SHEET)

### 2.1. Mục Đích & Đối Tượng Sử Dụng

- **Đối tượng:** Nhân viên trực ca (Maker) và Trưởng ca (Checker).
- **Mục đích:** Đóng băng biên bản ca trực thành file `.xlsx` chuẩn form hành chính để in ký giấy, đính kèm hồ sơ bàn giao ca hoặc lưu trữ phục vụ giải trình thanh tra.

### 2.2. Đặc Tả API Backend

- **Endpoint:** `GET /api/v1/shifts/:id/export-excel`
- **Quyền hạn (Permissions):** `VIEW_CHECKLIST` (hoặc `APPROVE_SHIFT`)
- **Headers trả về:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="Bien_Ban_Ca_Truc_MXV_[MA_CA]_[YYYYMMDD].xlsx"`

### 2.3. Bố Cục & Định Dạng Bảng Tính (Layout Specification - ExcelJS)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)              MẪU SỐ: 01/BB-VH/MXV                │
│  TRUNG TÂM VẬN HÀNH & HỆ THỐNG CÔNG NGHỆ           Ban hành theo QĐ số .../QĐ-MXV      │
│                                                                                        │
│                     BIÊN BẢN TRỰC VẬN HÀNH HỆ THỐNG                                    │
│             Mẫu áp dụng: CCP - CHECKLIST VẬN HÀNH CHI TIẾT                             │
│                                                                                        │
│  • Ngày trực: 14/10/2026                 • Ca làm việc: Ca 2 (Qua đêm: 22:00 - 06:00)  │
│  • Cán bộ trực chính: Trương Hải Hiệp     • Trạng thái: ĐÃ HOÀN THÀNH (100%)           │
│  • Cán bộ kiểm tra/xác nhận: ...          • Mã biên bản: SHIFT-20261014-001            │
├─────┬────────────┬─────────────────────────────┬────────────────┬──────────┬───────────┤
│ STT │ Mốc giờ    │ Nội dung vận hành           │ Điểm kiểm tra  │ Kết quả  │ Thời gian │
├─────┼────────────┼─────────────────────────────┼────────────────┼──────────┼───────────┤
│  1  │ 04:00      │ CCP giải tỏa lệnh...        │ Kiểm tra danh..│   ĐẠT    │ 04:02:15  │
│  2  │ 04:15      │ Reconcile tự động           │ Có thông báo.. │   ĐẠT    │ 04:15:30  │
│  3  │ 04:15      │ Đối chiếu lệnh khớp...      │ Kiểm tra màn...│   ĐẠT    │ 04:18:10  │
│ ... │ ...        │ ...                         │ ...            │   ...    │ ...       │
├─────┴────────────┴─────────────────────────────┴────────────────┴──────────┴───────────┤
│ NỘI DUNG BÀN GIAO CA & SỰ CỐ TỒN ĐỌNG:                                                 │
│ "Hệ thống CCP hoàn tất EOD 05:30 bình thường, các file CSV nộp rút đã đẩy lên SFTP..." │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│             NGƯỜI THỰC HIỆN            │             NGƯỜI XÁC NHẬN / TRƯỞNG CA        │
│          (Ký & ghi rõ họ tên)          │               (Ký & ghi rõ họ tên)            │
│                                        │                                               │
│          Trương Hải Hiệp               │                                               │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

#### Quy tắc Style bằng `ExcelJS`:

1. **Tiêu đề cột:** Nền xanh thương hiệu MXV (`#0F4C81`), chữ trắng đậm, canh giữa, chiều cao dòng 28px.
2. **Cột Kết quả:**
   - Trạng thái `PASSED` / Đạt: Chữ xanh lá đậm (`#166534`), nền xanh nhạt (`#DCFCE7`), căn giữa, in đậm.
   - Trạng thái `FAILED` / Không đạt: Chữ đỏ đậm (`#991B1B`), nền đỏ nhạt (`#FEE2E2`), căn giữa, in đậm.
   - Trạng thái `PENDING`: Chữ vàng đậm (`#854D0E`), nền vàng nhạt (`#FEF9C3`).
3. **Kẻ bảng (Borders):** Mọi ô dữ liệu đều có viền mỏng (`thin border: #CBD5E1`).
4. **Độ rộng cột tự động (Auto-fit Columns):** Tự tính độ dài text dài nhất cộng thêm padding 4 ký tự để không bị tràn chữ (`###`).

---

## 3. THIẾT KẾ KỸ THUẬT: LUỒNG 2 - BÁO CÁO TỔNG HỢP QUẢN TRỊ ĐỊNH KỲ (MANAGEMENT PERIOD REPORT)

### 3.1. Mục Đích & Đối Tượng Sử Dụng

- **Đối tượng:** Trưởng phòng, Trưởng bộ phận, Ban Giám đốc, Ban Kiểm soát nội bộ.
- **Mục đích:** Tổng kết hiệu quả vận hành theo tháng/quý; đánh giá tỷ lệ đạt hạn mức thời gian (SLA), thống kê tần suất phát sinh sự cố và mức độ giải quyết sự cố.

### 3.2. Đặc Tả API Backend

- **Endpoint:** `GET /api/v1/shifts/export-summary-excel`
- **Query Parameters:**
  - `departmentId`: Lọc theo phòng ban (hoặc rỗng nếu toàn Sở)
  - `startDate`: Ngày bắt đầu (`YYYY-MM-DD`)
  - `endDate`: Ngày kết thúc (`YYYY-MM-DD`)
  - `status`: Trạng thái ca (`ALL`, `COMPLETED`, `PENDING`)
- **Headers trả về:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="Bao_Cao_Tong_Hop_Van_Hanh_[TU_NGAY]_[DEN_NGAY].xlsx"`

### 3.3. Cấu Trúc Workbook Gồm 3 Sheets

#### 📑 Sheet 1: `TONG_QUAN_KPI` (Dashboard Tóm Tắt)

- **Khối chỉ số tổng quan (KPI Cards):**
  - Tổng số ca trực trong kỳ: `COUNT(ShiftLogs)`
  - Tỷ lệ ca hoàn thành 100%: `(Số ca COMPLETED / Tổng ca) * 100%`
  - Tỷ lệ hoàn thành đúng hạn SLA: `% tác vụ hoàn thành trước deadline`
  - Tổng số sự cố phát sinh: `COUNT(Incidents)` (Phân loại theo M1: Nghiêm trọng, M2: Trung bình, M3: Nhẹ).
- **Bảng thống kê theo Phòng ban / Mẫu ca:**
  - Bảng tổng hợp số lượng ca và tỷ lệ hoàn thành theo từng phòng ban (`IT_CORE`, `QLGD_OPS`, `QLRR_RISK`).

#### 📑 Sheet 2: `CHI_TIET_CA_TRUC` (Shift History Log)

- Danh sách toàn bộ các ca trực trong khoảng thời gian đã lọc:
  - Cột: `STT | Mã ca | Ngày trực | Ca làm việc | Mẫu Checklist | Phòng ban | Người mở ca | Người chốt ca | Giờ chốt | Tỷ lệ % | Số sự cố | Ghi chú bàn giao`.

#### 📑 Sheet 3: `NHAT_KY_SU_CO` (Incident Register)

- Toàn bộ các sự cố được liên kết từ collection `incidents`:
  - Cột: `Mã sự cố | Ngày phát sinh | Thuộc ca trực | Tác vụ liên quan | Mức độ (M1/M2/M3) | Thời điểm phát hiện | Thời điểm xử lý xong | Thời gian khắc phục (Phút) | Cán bộ xử lý | Biện pháp khắc phục & Ghi chú`.

---

## 4. BẢN ĐỒ KIẾN TRÚC MÃ NGUỒN & KẾ HOẠCH TRIỂN KHAI

### 4.1. Cấu Trúc File Dự Kiến Trong Repo

```
backend/src/modules/
├── checklist-hub/
│   ├── services/
│   │   └── shift-excel-exporter.service.ts   <-- SERVICE CHUYÊN BIỆT XUẤT EXCEL
│   └── controllers/
│       └── shift-export.controller.ts        <-- ENDPOINTS EXPORT STREAM
frontend/src/
├── app/
│   ├── checklist/
│   │   └── hooks/useChecklist.ts             <-- NÂNG CẤP HÀM exportToExcel() GỌI API STREAM
│   └── history/
│       └── page.tsx                          <-- BỔ SUNG NÚT "XUẤT BÁO CÁO QUẢN TRỊ"
└── services/api/
    ├── endpoints.ts                          <-- KHAI BÁO ENDPOINTS MỚI
    └── checklist-hub.api.ts                  <-- WRAPPER downloadSingleShiftExcel & downloadPeriodSummaryExcel
```

### 4.2. Kịch Bản Code Mẫu Tối Ưu (Core Implementation Pattern)

#### Backend: Service `ShiftExcelExporterService` (sử dụng `ExcelJS`)

```typescript
import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { Response } from "express";

@Injectable()
export class ShiftExcelExporterService {
  async exportSingleShift(shiftLog: any, res: Response) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MXV Shift Automation Platform";
    const worksheet = workbook.addWorksheet("Bien_Ban_Ca_Truc", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    });

    // 1. Thêm Tiêu đề & Thông tin hành chính
    worksheet.mergeCells("A1:F1");
    worksheet.getCell("A1").value = "SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)";
    worksheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FF0F4C81" },
    };

    // 2. Thiết lập Header Bảng
    const headerRow = worksheet.addRow([
      "STT",
      "Mốc giờ",
      "Nội dung vận hành",
      "Điểm kiểm tra",
      "Kết quả",
      "Thời gian thực tế",
      "Người xác nhận",
      "Ghi chú",
    ]);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F4C81" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // 3. Đổ dữ liệu từng tác vụ
    shiftLog.details.forEach((item: any, idx: number) => {
      const isPassed = item.status === "PASSED" || item.isChecked;
      const row = worksheet.addRow([
        idx + 1,
        item.timetableSnapshot || "",
        item.taskNameSnapshot,
        item.actionDescriptionSnapshot || "",
        isPassed ? "ĐẠT" : "CHƯA ĐẠT",
        item.checkedAt
          ? new Date(item.checkedAt).toLocaleTimeString("vi-VN")
          : "",
        item.updatedBy?.fullName || "",
        item.note || "",
      ]);
      // Tô màu có điều kiện cho ô Kết quả
      const statusCell = row.getCell(5);
      statusCell.font = {
        bold: true,
        color: { argb: isPassed ? "FF166534" : "FF991B1B" },
      };
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isPassed ? "FFDCFCE7" : "FFFEE2E2" },
      };
    });

    // 4. Stream trực tiếp ra HTTP Response (Không tốn RAM/Disk server)
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Bien_Ban_Ca_${shiftLog.shiftDate}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }
}
```

---

## 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

1. **Tính tương thích phần mềm:** File xuất ra mở mượt mà 100% trên Microsoft Excel 2016, 2019, 2021, Office 365, Google Sheets và WPS Office; không bị lỗi font Tiếng Việt Unicode UTF-8.
2. **Tính thẩm mỹ & In ấn:** Khi bấm lệnh In (Print) trên Excel, trang tự động căn vừa trang giấy khổ A4 ngang (`Landscape`), các đường viền rõ nét, không bị cụt chữ hoặc lỗi `###`.
3. **Hiệu năng hệ thống (Performance):** Báo cáo tháng (tổng hợp 60–100 ca trực kèm hàng ngàn tác vụ) xuất trong thời gian **dưới 2.5 giây**, sử dụng kỹ thuật streaming trực tiếp vào `response` để tránh tình trạng tràn bộ nhớ (Memory Leak) trên máy chủ Ubuntu.
4. **Bảo mật & Phân quyền:** Chỉ người dùng có quyền `VIEW_CHECKLIST` mới được xuất ca của phòng ban mình; chỉ `ADMIN` và `SUPERVISOR` mới được quyền xuất báo cáo toàn Sở.

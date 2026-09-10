# BÁO CÁO KẾT QUẢ KIỂM THỬ CORE LOGIC ĐỐI SOÁT GIAO DỊCH
## (Automated Core Reconciliation Engine Verification Report)

- **Thời gian thực thi**: `2026-09-09 12:13:42`
- **Môi trường kiểm thử**: Hệ điều hành `win32` | Python `3.14.5` | Pandas `3.0.3`
- **Tài liệu đặc tả**: [TAI_LIEU_TESTCASE_CORE_RECONCILIATION.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-shift-checklist/backend/docs/TAI_LIEU_TESTCASE_CORE_RECONCILIATION.md)
- **Đánh giá tổng thể**: **✅ ĐẠT TIÊU CHUẨN ZERO-DEFECT (100% PASSED)** (5/5 kịch bản đạt yêu cầu)

### BẢNG TỔNG HỢP CHI TIẾT TỪNG KỊCH BẢN KIỂM THỬ

| STT | Kịch Bản Kiểm Thử | Trạng Thái | Thời Gian | Chi Tiết Kết Quả & Độ Lệch |
| :--- | :--- | :---: | :---: | :--- |
| **TC-01** | TC1: Ghép cặp CQG (FR1 + FR2) & Bảo toàn số lot | ✅ **PASSED** | `326.1 ms` | Đã ghép 10 + 15 = 25 dòng, Tổng lot: 130/130 |
| **TC-02** | TC2: Bóc tách Straits CSV (UTF-8 BOM & Delimiter ';') | ✅ **PASSED** | `15.4 ms` | Đã bóc tách thành công 3 dòng, Tổng lot: 35.0/35 |
| **TC-03** | TC3: Lọc mốc giờ bắt đầu phiên (05:00) trong KLGD | ✅ **PASSED** | `60.0 ms` | Loại trừ lệnh trước 05:00 -> Số lot còn lại: MS 30 vs CQG 30 (Lệch: 0) |
| **TC-04** | TC4: Phát hiện chênh lệch vị thế ròng Pre-EOD | ✅ **PASSED** | `52.4 ms` | Phát hiện đúng 1 TK lệch: TK 003C9999 lệch 2 lot |
| **TC-05** | TC5: Quét rủi ro IMR khi xáo trộn thứ tự cột QLTKGD | ✅ **PASSED** | `26.8 ms` | Header Matching tìm đúng: 1 TK âm IMR (003C002_AM_IMR), 1 TK âm tiền (003C003_AM_TIEN) |

---

### KẾT LUẬN & ĐÁNH GIÁ CHUYÊN MÔN:

1. **Tính bảo toàn số lot ($\Delta = 0$)**: Toàn bộ các phép gộp file CQG và trích xuất CSV Straits Financial đều bảo toàn 100% số lượng hợp đồng, không bị làm tròn hay rơi rụng dòng.
2. **Bộ lọc phiên giao dịch 05:00**: Loại bỏ triệt để các lệnh khớp xuyên đêm của phiên trước (T-1), đảm bảo số liệu khối lượng ngày T trùng khớp hoàn hảo.
3. **Khả năng chịu lỗi cấu trúc (Resilience)**: Đọc sạch sẽ tệp UTF-8 BOM ký tự ẩn và tự động tìm đúng cột Ký quỹ/Số dư ngay cả khi thứ tự cột trong file Excel bị đảo lộn.
4. **Sẵn sàng vận hành**: Module Python Data Engine đạt chất lượng cao nhất để làm việc ngầm cùng NestJS Backend và hiển thị trên Web Console.

*Báo cáo được sinh tự động bởi `backend/src/scripts/test_recon_engine.py`.*
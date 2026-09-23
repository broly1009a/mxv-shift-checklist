# TÀI LIỆU TỔNG HỢP DANH MỤC 20 BÁO CÁO & DIRECT URL M-SYSTEM

> **Hệ thống**: M-System MXV (`https://msadmin.mxv.com.vn`)  
> **Thời điểm xác thực**: 2026-09-23T01:34:01.087Z  
> **Tổng số báo cáo**: 20 báo cáo  
> **Tỷ lệ thành công**: 20/20 PASS (100% Direct Hash Navigation)  

---

## BẢNG TỔNG HỢP DIRECT HASH URL 20 BÁO CÁO M-SYSTEM

| STT | Mã Báo Cáo | Tên Nghiệp Vụ Báo Cáo | Direct Hash URL | Tab Con (Nếu có) | Trạng Thái | Thời Gian |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | **`DSGD`** | Danh sách giao dịch CoreCCP | `#/orderManagement/transactionList` | - | **PASS** | 1.9s |
| 2 | **`TTM`** | Báo cáo Vị thế mở (TTM) | `#/positionManagement/openPositionInfo` | - | **PASS** | 1.8s |
| 3 | **`TTTT`** | Trạng thái tất toán (TTTT) | `#/positionManagement/finalPositionInfo` | - | **PASS** | 1.8s |
| 4 | **`TTCDH`** | Trạng thái tất toán chờ đáo hạn LME | `#/positionManagement/finalPositionInfo` | `Trạng thái tất toán chờ đáo hạn LME` | **PASS** | 3.6s |
| 5 | **`QLTKGD`** | Quản lý tài khoản giao dịch (QLTKGD) | `#/clientManagement/marginStatusManagement` | - | **PASS** | 1.8s |
| 6 | **`QLTKGDAmKQ`** | QL TKGD âm ký quỹ | `#/clientManagement/negativeMarginManagement` | - | **PASS** | 1.8s |
| 7 | **`NKTTHT`** | Nhật ký thao tác hệ thống | `#/systemManagement/activityHistory` | - | **PASS** | 1.8s |
| 8 | **`DSTKGD-Futures`** | Danh sách TKGD - Futures | `#/clientManagement/investorManagement` | - | **PASS** | 1.8s |
| 9 | **`DSTKGD-Spread`** | Danh sách TKGD - Spread | `#/clientManagement/investorManagement` | `Spreads` | **PASS** | 3.6s |
| 10 | **`DSTKGD-LME`** | Danh sách TKGD - LME | `#/clientManagement/investorManagement` | `LME` | **PASS** | 3.6s |
| 11 | **`DSTKGD-ACM`** | Danh sách TKGD - ACM | `#/clientManagement/investorManagement` | `ACM` | **PASS** | 3.6s |
| 12 | **`TLKQHSKQ`** | Tỉ lệ ký quỹ và Hiệu số ký quỹ (TLKQHSKQ) | `#/clientManagement/marginRatioMultiplier` | - | **PASS** | 1.8s |
| 13 | **`DSQLKQ`** | Danh sách quản lý ký quỹ (DSQLKQ) | `#/positionManagement/marginList` | - | **PASS** | 1.8s |
| 14 | **`NR`** | Lịch sử giao dịch tiền TKGD (NR) | `#/clientManagement/marginMoneyTransHistory` | - | **PASS** | 1.8s |
| 15 | **`DSTrader`** | Danh sách Trader hoạt động | `#/clientManagement/traderManagement` | - | **PASS** | 1.8s |
| 16 | **`Markettruoc6h`** | Báo cáo Market trước 6h | `#/orderManagement/orderCreating` | - | **PASS** | 1.8s |
| 17 | **`DSLDK`** | Danh sách lệnh đã khớp | `#/orderManagement/orderList` | `Lệnh đã khớp` | **PASS** | 3.3s |
| 18 | **`DSLCK`** | Danh sách lệnh chờ khớp | `#/orderManagement/orderList` | `Lệnh chờ khớp` | **PASS** | 3.6s |
| 19 | **`DSLH`** | Danh sách lệnh đã hủy | `#/orderManagement/orderList` | `Lệnh đã hủy` | **PASS** | 3.6s |
| 20 | **`DSLK`** | Danh sách lệnh khác | `#/orderManagement/orderList` | `Lệnh khác` | **PASS** | 3.6s |

---

## LƯU Ý KỸ THUẬT QUAN TRỌNG KHI TẢI BÁO CÁO TRÊN M-SYSTEM:
1. **Direct Hash 100%**: Tất cả 20 báo cáo đều hỗ trợ Direct Hash Navigation, loại bỏ hoàn toàn việc click accordion Sidebar để không bị kẹt menu.
2. **Kích hoạt dữ liệu**: Đối với các báo cáo yêu cầu lọc hoặc query (như `NR`, `DSTrader`), bot tự động phát hiện và click nút `Tìm kiếm` trước khi chờ nút xuất file.
3. **Chuyển tiếp giữa các trang trên cùng một Page**: Khi chuyển từ `DSGD` sang `TTM` và `TTTT`, phải đảm bảo URL hash đã thay đổi trước khi tìm nút xuất file để tránh click nhầm vào nút xuất của màn hình trước.

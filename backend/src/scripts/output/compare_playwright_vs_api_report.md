# BÁO CÁO A/B TESTING: ĐỐI CHIẾU FILE PLAYWRIGHT VS FILE REST API (CORECCP)

> Thời điểm chạy: 09:57:09 14/10/2026 | Môi trường: `https://uat-coreccp.mxv.com.vn`

## 1. Bảng Tổng Hợp Kết Quả Đối Chiếu

| STT | Báo cáo | Size Playwright | Size API | Tốc độ PW / API | Khớp Cột (Header) | Khớp Dòng (Rows) | Độ Chính Xác Dữ Liệu |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | **Quản lý trạng thái TKGD (Ký quỹ)** | 8642.7 KB | 735.2 KB | 7.3s / 5.62s | **100.0%** (49/49) | ✅ 5297 dòng | **100.0%** |

---

## 2. Chi Tiết So Sánh Từng Cột Của Từng Báo Cáo

### • Quản lý trạng thái TKGD (Ký quỹ) (`ACCTMARGIN_ALL`)

| STT | Cột File Playwright (Gốc) | Cột File API (Mới) | Trạng thái |
| :---: | :--- | :--- | :---: |
| 1 | Mã TKGD | Mã TKGD | ✅ Khớp |
| 2 | Tên TKGD | Tên TKGD | ✅ Khớp |
| 3 | Mã TVKD | Mã TVKD | ✅ Khớp |
| 4 | Tên TVKD | Tên TVKD | ✅ Khớp |
| 5 | Trạng thái | Trạng thái | ✅ Khớp |
| 6 | Tỷ lệ ký quỹ (%) | Tỷ lệ ký quỹ (%) | ✅ Khớp |
| 7 | Số dư TKKQ | Số dư TKKQ | ✅ Khớp |
| 8 | Mức bổ sung ký quỹ | Mức bổ sung ký quỹ | ✅ Khớp |
| 9 | KQ ban đầu yêu cầu | KQ ban đầu yêu cầu | ✅ Khớp |
| 10 | KQ ban đầu yêu cầu (USD) | KQ ban đầu yêu cầu (USD) | ✅ Khớp |
| 11 | KQ ban đầu yêu cầu tạm tính | KQ ban đầu yêu cầu tạm tính | ✅ Khớp |
| 12 | KQ ban đầu yêu cầu tạm tính (USD) | KQ ban đầu yêu cầu tạm tính (USD) | ✅ Khớp |
| 13 | Lãi lỗ thực tế Future (VND) | Lãi lỗ thực tế Future (VND) | ✅ Khớp |
| 14 | Lãi lỗ thực tế Future (USD) | Lãi lỗ thực tế Future (USD) | ✅ Khớp |
| 15 | Lãi lỗ dự kiến Future (VND) | Lãi lỗ dự kiến Future (VND) | ✅ Khớp |
| 16 | Lãi lỗ dự kiến Future (USD) | Lãi lỗ dự kiến Future (USD) | ✅ Khớp |
| 17 | Lãi lỗ thực tế T-1 Future (VND) | Lãi lỗ thực tế T-1 Future (VND) | ✅ Khớp |
| 18 | Lãi lỗ thực tế T-1 Future (USD) | Lãi lỗ thực tế T-1 Future (USD) | ✅ Khớp |
| 19 | Giá trị ròng ký quỹ | Giá trị ròng ký quỹ | ✅ Khớp |
| 20 | Giá trị ròng ký quỹ (USD) | Giá trị ròng ký quỹ (USD) | ✅ Khớp |
| 21 | Ký quỹ khả dụng tạm tính | Ký quỹ khả dụng tạm tính | ✅ Khớp |
| 22 | Ký quỹ khả dụng | Ký quỹ khả dụng | ✅ Khớp |
| 23 | Ký quỹ khả dụng (USD) | Ký quỹ khả dụng (USD) | ✅ Khớp |
| 24 | Phí giao dịch | Phí giao dịch | ✅ Khớp |
| 25 | Nộp rút trong phiên | Nộp rút trong phiên | ✅ Khớp |
| 26 | Nộp rút trong phiên (USD) | Nộp rút trong phiên (USD) | ✅ Khớp |
| 27 | Ký quỹ giao nhận | Ký quỹ giao nhận | ✅ Khớp |
| 28 | Phí giao nhận | Phí giao nhận | ✅ Khớp |
| 29 | Phí thực hiện thay nghĩa vụ | Phí thực hiện thay nghĩa vụ | ✅ Khớp |
| 30 | Phí dịch vụ thanh toán | Phí dịch vụ thanh toán | ✅ Khớp |
| 31 | Phí thanh toán đáo hạn bằng tiền | Phí thanh toán đáo hạn bằng tiền | ✅ Khớp |
| 32 | Lãi lỗ vị thế đáo hạn | Lãi lỗ vị thế đáo hạn | ✅ Khớp |
| 33 | Số dư đầu ngày | Số dư đầu ngày | ✅ Khớp |
| 34 | Số dư đầu ngày (USD) | Số dư đầu ngày (USD) | ✅ Khớp |
| 35 | Số dư cuối ngày | Số dư cuối ngày | ✅ Khớp |
| 36 | Số dư cuối ngày (USD) | Số dư cuối ngày (USD) | ✅ Khớp |
| 37 | Phương thức xử lý | Phương thức xử lý | ✅ Khớp |
| 38 | Phí quyền chọn | Phí quyền chọn | ✅ Khớp |
| 39 | Phí quyền chọn (USD) | Phí quyền chọn (USD) | ✅ Khớp |
| 40 | MVO | MVO | ✅ Khớp |
| 41 | MVO (USD) | MVO (USD) | ✅ Khớp |
| 42 | Lãi lỗ chờ đáo hạn | Lãi lỗ chờ đáo hạn | ✅ Khớp |
| 43 | Lãi lỗ chờ đáo hạn (USD) | Lãi lỗ chờ đáo hạn (USD) | ✅ Khớp |
| 44 | Lãi lỗ Options | Lãi lỗ Options | ✅ Khớp |
| 45 | Lãi lỗ Options (USD) | Lãi lỗ Options (USD) | ✅ Khớp |
| 46 | Lãi lỗ dự kiến Options | Lãi lỗ dự kiến Options | ✅ Khớp |
| 47 | Lãi lỗ dự kiến Options (USD) | Lãi lỗ dự kiến Options (USD) | ✅ Khớp |
| 48 | Số dư đầu ngày tạm tính | Số dư đầu ngày tạm tính | ✅ Khớp |
| 49 | Số dư đầu ngày tạm tính (USD) | Số dư đầu ngày tạm tính (USD) | ✅ Khớp |


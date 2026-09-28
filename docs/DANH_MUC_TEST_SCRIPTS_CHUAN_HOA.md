# SỔ TAY TEST SCRIPTS CHUẨN HÓA DỰ ÁN (MXV SHIFT CHECKLIST & CRAWLERS)

Tài liệu này tổng hợp toàn bộ các test script chuẩn hóa độc lập trong thư mục `backend/src/scripts/`, phân loại theo từng nhóm nghiệp vụ, kèm câu lệnh chạy tắt qua NPM và mục đích kiểm thử.

---

## 1. Nhóm Crawler / RPA M-System

| Báo Cáo / Module | Lệnh Chạy (Terminal) | Lệnh Tắt NPM (trong thư mục `backend`) | Mục Đích & Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Toàn bộ 20 Báo cáo M-System** | `node src/scripts/test_ms_download_all_20_reports.js --headed` | `npm run test:ms-20` | Kiểm tra tải toàn bộ 20 file về `temp/test_20_reports/`. Đã hỗ trợ selector FontAwesome 5 `fas fa-file-csv`, tự động phục hồi phiên `ensureLoggedIn` và fallback Sidebar. |
| **Trạng thái mở (TTM) & Tất toán (TTTT)** | `node src/scripts/test_ms_download_ttm_tttt.js --headed` | `npm run test:ms-ttm` | Kiểm thử nhanh 2 báo cáo cốt lõi `TTM` và `TTTT`, chụp ảnh snapshot và thẩm định cấu trúc cột Excel. |
| **Các Tab con M-System (Spreads, LME, ACM)** | `node src/scripts/test_ms_tab_downloads.js --headed` | - | Kiểm tra chuyển đổi các sub-tab con trong `investorManagement` và `finalPositionInfo`. |

---

## 2. Nhóm Crawler / RPA CQG

| Nghiệp Vụ | Lệnh Chạy (Terminal) | Lệnh Tắt NPM | Mục Đích & Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Tải song song 2 tài khoản CQG1 & CQG2** | `node src/scripts/test_cqg_parallel_standalone.js --headed` | `npm run test:cqg-parallel` | Khởi chạy 2 context trình duyệt tải `FR1` và `FR2` đồng thời, benchmark thời gian xuất và độ lệch mtime. |
| **Tải các Widget CQG (FR, PS, OP, OD)** | `node src/scripts/test_cqg_tab_downloads.js --headed` | - | Kiểm tra tải các tab báo cáo trên giao diện CQG Desktop. |

---

## 3. Nhóm Email M365 Graph API & Báo Cáo EOD

| Nghiệp Vụ | Lệnh Chạy (Terminal) | Lệnh Tắt NPM | Mục Đích & Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Chẩn đoán M365 & Tải EOD từ it.support** | `ts-node src/scripts/test_m365_eod_email.ts` | `npm run test:eod-email` | Kiểm tra token M365, quyền Microsoft Graph API, quét và tải file `EOD.csv` đính kèm. |
| **Quét Email Hồ Sơ Mở TKGD** | `ts-node src/scripts/test_outlook_fetch_tkgd_mails.ts` | - | Quét hòm thư và kiểm tra tải email, file đính kèm hồ sơ khách hàng. |

---

## 4. Nhóm Core CCP & Thống Kê Lot / Giá Trị (Macro)

| Nghiệp Vụ | Lệnh Chạy (Terminal) | Lệnh Tắt NPM | Mục Đích & Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Tải toàn bộ 25 báo cáo CoreCCP** | `node src/scripts/test_ccp_download_25_files.js --headed` | `npm run test:ccp-25` | Tải 25 báo cáo từ cổng CCP (`uat-coreccp.mxv.com.vn`), tự động xử lý phân trang và chọn rổ báo cáo. |
| **Bộ kiểm thử Thống Kê Lot & Giá Trị CCP** | `ts-node src/scripts/test_ccp_statistics_suite.ts` | - | Kiểm tra đối chiếu logic tính Lot / Giá trị giao dịch CCP theo logic C# Macro sang TypeScript. |

---

## 5. Nhóm Đối Chiếu Số Liệu & TKGD (Reconciliation & Pipelines)

| Nghiệp Vụ | Lệnh Chạy (Terminal) | Lệnh Tắt NPM | Mục Đích & Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Đối chiếu Pre-EOD 3 bên (MS vs CQG vs ACM)** | `ts-node src/scripts/run_auto_check_pre_eod_active.ts` | `npm run test:pre-eod` | Kích hoạt toàn trình quy trình tính toán đối chiếu Pre-EOD cuối ngày. |
| **Toàn trình Pipeline TKGD (Mail -> MS -> OCR)** | `ts-node src/scripts/run_tkgd_pipeline.ts` | `npm run test:tkgd-pipeline` | Chạy toàn bộ pipeline thẩm định đối soát mở tài khoản giao dịch. |
| **E2E Integration Test TKGD** | `ts-node src/scripts/test_tkgd_end_to_end.ts` | - | Kiểm thử tích hợp toàn bộ các module con TKGD. |

---

> **Nguyên Tắc**: Khi gặp sự cố hoặc cần kiểm thử tính năng nào, hãy ưu tiên sử dụng danh mục script trên thay vì code lại script mới từ đầu.

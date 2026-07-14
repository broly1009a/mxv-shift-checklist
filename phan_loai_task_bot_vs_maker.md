# Phân Loại Task: Bot 100% vs. Kết Hợp Bot+Maker vs. Thủ Công

## Tiêu chí phân loại (đã tinh chỉnh)

| Ký hiệu | Tiêu chí xác định |
|:---:|:---|
| 🤖 **Bot 100%** | Kết quả kỹ thuật là **xác định** (đúng/sai rõ ràng). Khi bot SUCCESS → task cha tự PASSED, **không cần Maker checkbox thêm gì**. |
| 🤝 **Bot + Maker** | Bot làm phần kỹ thuật, nhưng **kể cả khi SUCCESS**, Maker vẫn **phải thực hiện thêm hành động** (gửi file, bấm nút, phán đoán, phê duyệt). |
| 🔴 **Thủ công hoàn toàn** | Không có API/automation. Toàn bộ do Maker thực hiện trên phần mềm bên thứ 3. |

---

## PHIÊN MỞ CỬA (OPEN SESSION) — 05:00 → 08:00

### Task 1 · Kiểm tra Job Snapshot Đầu Ngày (05:00)
**🤝 Kết hợp Bot + Maker**
> Bot kiểm tra email và báo kết quả. Nhưng nếu FAILED → Maker **bắt buộc** phối hợp Newgen xử lý. Maker cũng cần xác nhận đã đọc kết quả dù SUCCESS.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 1.1 | Bot tự kiểm tra email "Job Snapshot" trong Inbox | 🤖 Auto-check |
| 1.2 | Bot gửi cảnh báo Telegram nếu không thấy email thành công | 🤖 Auto-check |
| 1.3 | **Maker xác nhận đã đọc kết quả** (nếu OK → tick; nếu FAILED → ghi nhận đã liên hệ Newgen) | 👤 Maker |

---

### Task 2 · Tải Báo Cáo CQG CAST Balances (07:00)
**🤖 Bot 100%**
> Bot đăng nhập CQG CAST, tải file `Accounts_Balances.xlsx`. Thành công hay thất bại là xác định. Không cần Maker làm gì thêm với bản thân việc tải file.

*(Không có sub-task — bot tự check task cha khi job COMPLETED)*

---

### Task 3 · Tải Báo Cáo M-System Đầu Ngày (08:00)
**🤖 Bot 100%**
> Bot tải các file QLTKGD, NR, DSTKGD-* từ M-System. Kết quả kỹ thuật xác định. Không cần Maker xác nhận file đã download.

*(Không có sub-task — bot tự check task cha khi job COMPLETED)*

---

### Task 4 · Kiểm tra EOD OMS & Lệnh MM OMS (05:00)
**🤝 Kết hợp Bot + Maker**
> Bot tải file hỗ trợ (Task 2, 3 đã tự động). Nhưng việc **đánh giá trạng thái EOD CCP/CE và MM** là phán đoán nghiệp vụ — Maker phải xem và xác nhận.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 4.1 | Maker kiểm tra kết quả EOD của CCP/CE trên dashboard (dựa vào file bot đã tải) | 👤 Maker |
| 4.2 | Maker xác nhận lệnh Market Maker (MM) đã lên CCP/CE | 👤 Maker |

---

### Task 5 · Đối chiếu & Chạy EOD MS (06:00–07:00)
**🔴 Bắt buộc thủ công hoàn toàn**
> Không có API M-System. Chạy EOD là thao tác trực tiếp trên phần mềm Newgen.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 5.1 | Maker đối chiếu dữ liệu M-System vs CQG vs ACM | 👤 Maker |
| 5.2 | Maker xác nhận Settlement Price chính xác | 👤 Maker |
| 5.3 | Maker chạy EOD thủ công trên M-System | 👤 Maker |
| 5.4 | Maker ghi nhận kết quả EOD (thành công / thất bại) | 👤 Maker |

---

### Task 6 · Kiểm Tra File Backup M-System (sau EOD)
**🤖 Bot 100%**
> Bot scan thư mục backup, tự tải bổ sung file thiếu. Kết quả: danh sách file OK/MISSING/OUTDATED là xác định tuyệt đối.

*(Không có sub-task — bot tự check task cha khi job COMPLETED)*

---

### Task 7 · Kiểm Tra File Backup CQG (sau EOD)
**🤖 Bot 100%**
> Bot scan và tự merge file CQG bị thiếu. Kỹ thuật xác định.

*(Không có sub-task — bot tự check task cha khi job COMPLETED)*

---

### Task 8 · Kiểm Tra File Backup ACM — Ưu tiên cao (sau EOD)
**🤖 Bot 100%**
> Bot scan Order.xlsx, Fill.xlsx, file SFTP CSV/XLS. Kết quả xác định.

*(Không có sub-task — bot tự check task cha khi job COMPLETED)*

---

### Task 9 · Kiểm Tra Danh Sách TKGD Âm Ký Quỹ (sau EOD)
**🤝 Kết hợp Bot + Maker**
> Bot phân tích file EOD và tổng hợp danh sách tài khoản âm. Nhưng Maker **phải xác nhận đã nhận danh sách và xử lý** theo quy trình nội bộ.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 9.1 | Bot phân tích file EOD, tổng hợp danh sách TKGD âm ký quỹ | 🤖 Auto-check (`CHECK_PRE_EOD`) |
| 9.2 | Bot gửi cảnh báo Telegram danh sách âm ký quỹ | 🤖 Auto-check |
| 9.3 | **Maker xác nhận đã nhận cảnh báo và theo dõi xử lý** | 👤 Maker |

---

### Task 10 · Thực Hiện SOD (trong 30 phút sau EOD)
**🔴 Bắt buộc thủ công hoàn toàn**
> SOD là thao tác trực tiếp trong phần mềm M-System — không có API ngoài.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 10.1 | Maker thực hiện SOD trên giao diện M-System | 👤 Maker |
| 10.2 | Maker xác nhận SOD thành công | 👤 Maker |
| 10.3 | Nếu lỗi: Maker phối hợp Newgen xử lý và chạy lại | 👤 Maker |

---

### Task 11 · Đối Chiếu Số Dư SOD: M-System vs CQG (07:05)
**🤝 Kết hợp Bot + Maker**
> Bot đối chiếu `QLTKGD.xlsx` vs `Accounts_Balances.xlsx`. Nếu **khớp hoàn toàn** → kết quả xác định. Nhưng nếu **lệch** → Maker PHẢI xử lý. Do đó task cha là 🤝 vì đường lỗi cần Maker.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 11.1 | Bot đối chiếu số dư M-System vs CQG, tạo báo cáo lệch | 🤖 Auto-check (`AUTO_CHECK_SOD`) |
| 11.2 | Bot gửi kết quả đối chiếu qua Telegram | 🤖 Auto-check |
| 11.3 | **Maker xác nhận đã xem kết quả** (nếu lệch → ghi nhận đã xử lý) | 👤 Maker |

---

### Task 12 · Đồng Bộ CQG Cast (Sync CQG) — 1–2h sau EOD
**🤝 Kết hợp Bot + Maker**
> Không có API CQG Cast để sync tự động. Maker **bắt buộc** phải bấm thủ công.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 12.1 | Maker kiểm tra bằng mắt CQG Cast đã reset xong chưa | 👤 Maker |
| 12.2 | Maker nhấn Sync CQG Cast thủ công | 👤 Maker |
| 12.3 | Maker xác nhận đồng bộ thành công | 👤 Maker |

---

### Task 13 · Gửi Sao Kê TKGD (trước 08:00)
**🤝 Kết hợp Bot + Maker**
> "Gửi sao kê **thủ công**" trong SOP — Maker trigger gửi. Bot chỉ xác minh kết quả sau đó.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 13.1 | **Maker trigger gửi email sao kê** trên M-System | 👤 Maker |
| 13.2 | Bot xác minh lịch sử gửi email sao kê trong M-System Admin | 🤖 Auto-check (`VERIFY_EMAIL_STATUS`) |
| 13.3 | Bot cảnh báo Telegram nếu có email gửi thất bại | 🤖 Auto-check |
| 13.4 | **Maker xác nhận đã hoàn tất gửi sao kê** | 👤 Maker |

---

## PHIÊN TRONG GIỜ (DURING SESSION) — 08:00 → cuối phiên

### Task 14 · Thay Đổi Ký Quỹ Hàng Hoá (08:00, nếu có)
**🔴 Maker-Checker 4 mắt bắt buộc**
> Nghiệp vụ tài chính — phê duyệt 2 người là quy trình cứng.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 14.1 | Maker (Ca 1) tạo bản ghi thay đổi ký quỹ | 👤 Maker |
| 14.2 | Maker (Ca 1) điền đầy đủ: mã HH, ký quỹ cũ/mới, phiên hiệu lực | 👤 Maker |
| 14.3 | Checker (Ca 2 / Trưởng BP) phê duyệt hoặc từ chối | 👤 Checker |

---

### Task 15 · Giám Sát & Đối Chiếu Định Kỳ (mỗi 1 giờ)
**🤝 Kết hợp Bot + Maker**
> Bot chạy cron đối chiếu. Nhưng khi phát hiện lệch → Maker **bắt buộc** điều tra và xử lý.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 15.1 | Bot so sánh M-System vs CQG và gửi kết quả Telegram | 🤖 Auto-check |
| 15.2 | **Maker xác nhận đã xem kết quả** (nếu lệch → ghi nhận đã xử lý xong) | 👤 Maker |

---

### Task 16 · Báo Cáo Ban Giám Sát (16:00 / 23:00 / 05:00)
**🤝 Kết hợp Bot + Maker**
> Bot chạy macro, xuất file. Nhưng Maker **phải gửi file lên Whatsapp** — bước gửi Whatsapp là hành động người.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 16.1 | Bot chạy macro thống kê số lô giao dịch | 🤖 Auto-check (`RUN_LOT_MACRO`) |
| 16.2 | Bot chạy macro thống kê giá trị giao dịch | 🤖 Auto-check (`RUN_VALUE_MACRO`) |
| 16.3 | **Maker gửi file báo cáo lên nhóm Whatsapp** Ban giám sát | 👤 Maker |
| 16.4 | **Maker xác nhận đã gửi thành công** | 👤 Maker |

---

### Task 17 · Hỗ Trợ & Xử Lý Sự Cố (khi phát sinh)
**🔴 Bắt buộc thủ công hoàn toàn**

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 17.1 | Maker tiếp nhận TVKD (trong 15 phút) | 👤 Maker |
| 17.2 | Maker tạo ticket Incident trên hệ thống | 👤 Maker |
| 17.3 | Maker thông báo Newgen & CNTT (trong 5 phút) | 👤 Maker |
| 17.4 | Maker gửi email sự cố ĐVNV & TVKD (trong 10 phút) | 👤 Maker |
| 17.5 | Maker cập nhật Báo cáo lỗi Mẫu 01/QT/TVH | 👤 Maker |

---

### Task 18 · Giám Sát Tất Toán Hợp Đồng (theo đáo hạn)
**🤝 Kết hợp Bot + Maker**
> Bot nhắc nhở tự động. Nhưng hành động force close là quyết định của người.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 18.1 | Bot tính mốc đáo hạn và gửi thông báo nhắc nhở TVKD | 🤖 Auto-check (`NOTIFY_MATURITY`) |
| 18.2 | **Maker xác nhận đã gửi thông báo** và theo dõi phản hồi TVKD | 👤 Maker |
| 18.3 | Nếu TVKD không tự xử lý: Maker hủy lệnh chờ & force close | 👤 Maker |

---

### Task 19 · Mở Mới Hợp Đồng Giao Dịch (hàng tháng)
**🔴 Bắt buộc thủ công hoàn toàn**

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 19.1 | Maker thiết lập Futures, Spreads, ACM trên M-System | 👤 Maker |
| 19.2 | Maker cấu hình tương ứng trên CQG Cast | 👤 Maker |
| 19.3 | Maker xác nhận không mở quá 1 năm | 👤 Maker |

---

## PHIÊN ĐÓNG CỬA (CLOSE SESSION) — 04:00 → 05:00

### Task 20 · Chạy Macro Tổng Hợp Cuối Phiên
**🤖 Bot 100%**
> Macro chạy, xuất kết quả. Kỹ thuật xác định, không cần Maker xác nhận macro đã chạy xong.

*(Không có sub-task — bot tự check task cha khi COMPLETED)*

---

### Task 21 · Backup Dữ Liệu Cuối Phiên — Xác nhận tổng kết
**🤝 Kết hợp Bot + Maker**
> Các job audit đã chạy tự động (Task 6, 7, 8). Nhưng cần **chữ ký nghiệp vụ** của Maker xác nhận toàn bộ backup đã hoàn tất trước khi kết thúc ca.

| # | Sub-task | Ai thực hiện |
|---|---|:---:|
| 21.1 | **Maker xác nhận ACM & CE đã backup thành công** (bắt buộc trước hệ thống khác) | 👤 Maker |
| 21.2 | **Maker xác nhận toàn bộ file M-System và báo cáo cuối phiên đầy đủ** | 👤 Maker |

---

## TÓM TẮT PHÂN LOẠI (ĐÃ TINH CHỈNH)

| Loại | Task cha | Ghi chú |
|:---|:---|:---|
| 🤖 **Bot 100%** (6 task) | Task 2, 3, 6, 7, 8, 20 | Download, File Audit, Macro — kết quả kỹ thuật xác định, không cần Maker |
| 🤝 **Bot + Maker** (10 task) | Task 1, 4, 9, 11, 13, 15, 16, 18, 21 + Task 12 | Bot check phần kỹ thuật; Maker làm hành động nghiệp vụ bắt buộc |
| 🔴 **Thủ công hoàn toàn** (5 task) | Task 5, 10, 14, 17, 19 | Không có API, hoặc Maker-Checker bắt buộc |

> [!TIP]
> **Nguyên tắc phân biệt Bot 100% vs Bot+Maker**: Hỏi câu này — *"Nếu bot chạy SUCCESS, Maker có cần làm thêm bất kỳ hành động nào không?"*
> - **KHÔNG** → 🤖 Bot 100%
> - **CÓ** (gửi file, bấm nút, phán đoán, phê duyệt) → 🤝 Bot + Maker

---

## DANH SÁCH JOB TYPE PHÂN LOẠI

### 🤖 Job type → Task 100% Bot
| Job Type | Task cha |
|---|---|
| `DOWNLOAD_CAST` | Task 2 |
| `RPA_DOWNLOAD_REPORTS` | Task 3 |
| `FILE_AUDIT_MS` | Task 6 |
| `FILE_AUDIT_CQG` | Task 7 |
| `FILE_AUDIT_ACM` | Task 8 |
| `RUN_LOT_MACRO` + `RUN_VALUE_MACRO` | Task 20 |

### 🤝 Job type → Sub-task trong task kết hợp
| Job Type | Vai trò sub-task |
|---|---|
| `VERIFY_EMAIL_STATUS` | Sub-task kỹ thuật trong Task 13 (Maker vẫn phải trigger gửi và xác nhận) |
| `AUTO_CHECK_SOD` | Sub-task kỹ thuật trong Task 11 & 15 (Maker xác nhận nếu lệch) |
| `CHECK_PRE_EOD` | Sub-task kỹ thuật trong Task 9 (Maker phải xác nhận theo dõi) |
| `NOTIFY_MATURITY` | Sub-task kỹ thuật trong Task 18 (Maker phải force close nếu cần) |

### ⚠️ Job type cần implement handler
| Job Type | Priority |
|---|---|
| `CHECK_PRE_EOD` | 🔴 Cao |
| `CHECK_EOD_MM` | 🔴 Cao |
| `NOTIFY_MATURITY` | 🟡 Trung bình |

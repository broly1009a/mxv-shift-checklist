# 📋 CHECKLIST THU THẬP INPUT — Dự Án TKGD Automation

**Hướng dẫn:** Tick  khi đã có file, note tên file cụ thể vào cột bên phải.

---

## NHÓM 1: Email Mẫu

| # | File cần | Tình trạng | Tên file thực tế |
|---|---|---|---|
| 1.1 | Email từ TVKD 003 (body + attachments) | ⬜ Chưa có | |
| 1.2 | Email từ TVKD khác (nếu có) | ⬜ Chưa có | |
| 1.3 | Screenshot body mail trong Outlook | ⬜ Chưa có | |

**→ Thư mục:** `inputs/mail-samples/`

---

## NHÓM 2: File PDF Hợp Đồng

| # | File cần | Tình trạng | Tên file thực tế |
|---|---|---|---|
| 2.1 | PDF Hợp đồng mở TKGD (`*-mxv.pdf`) | ⬜ Chưa có | |
| 2.2 | PDF Phụ lục PL01 (`*-PL01.pdf`) | ⬜ Chưa có | |

**→ Thư mục:** `inputs/pdf-samples/`

---

## NHÓM 3: Ảnh CCCD Mẫu (đã che thông tin)

| # | File cần | Tình trạng | Tên file thực tế |
|---|---|---|---|
| 3.1 | Ảnh CCCD mặt TRƯỚC (có QR code) | ⬜ Chưa có | |
| 3.2 | Ảnh CCCD mặt SAU (có MRZ) | ⬜ Chưa có | |
| 3.3 | Ảnh CCCD bị mờ/lóa (test edge case) | ⬜ Không bắt buộc | |

**→ Thư mục:** `inputs/cccd-samples/`  
** Dùng ảnh đã che số CMND/CCCD hoặc ảnh fake để test.**

---

## NHÓM 4: File Excel Template & DSGD

| # | File cần | Tình trạng | Tên file thực tế |
|---|---|---|---|
| 4.1 | Template Excel đối chiếu TKGD (đang dùng thủ công) | ⬜ Chưa có | |
| 4.2 | File DSGD.xlsx xuất từ M-System (danh sách tổng) | ⬜ Chưa có | |
| 4.3 | File chi tiết 1 TK từ M-System (nếu có) | ⬜ Chưa có | |

**→ Thư mục:** `inputs/excel-templates/`

---

## NHÓM 5: Tài Liệu M-System & API

| # | File cần | Tình trạng | Tên file thực tế |
|---|---|---|---|
| 5.1 | Tài liệu API MXV v2.13 |  **Đã có** | `KetNoiAPI_WS.v2.13.md` |
| 5.2 | Screenshot màn hình Danh sách TK trên MS | ⬜ Chưa có | |
| 5.3 | Screenshot màn hình **Chi tiết TK** trên MS | ⬜ **Quan trọng** | |
| 5.4 | Screenshot màn hình Tìm kiếm TK | ⬜ Chưa có | |

**→ Thư mục:** `inputs/msystem-specs/`

---

## CÂU HỎI CẦN LÀM RÕ TRƯỚC KHI PHÁT TRIỂN

| # | Câu hỏi | Trả lời |
|---|---|---|
| Q1 | Các TVKD gửi mail theo form thống nhất hay mỗi TVKD có form riêng? | _(điền vào)_ |
| Q2 | Hiện tại có file Excel template nào đang dùng thủ công không? | _(điền vào)_ |
| Q3 | IT có thể cấp quyền Azure AD App để đọc mailbox qua Graph API không? | _(điền vào)_ |
| Q4 | Màn hình Chi tiết TK trên M-System có hiển thị số CCCD/CMND không? | _(điền vào)_ |
| Q5 | URL của M-System nội bộ là gì? (dạng https://msystem.mxv.vn hay khác?) | _(điền vào)_ |
| Q6 | Phiên bản CCCD nào đang phổ biến: CCCD gắn chip 12 số hay CMND 9 số cũ? | _(điền vào)_ |
| Q7 | Trong bão mail, có mail nào của TVKD khác ngoài TVKD 003 không? | _(điền vào)_ |
| Q8 | Kết quả đối chiếu Excel cần phân quyền (ai được xem ai không)? | _(điền vào)_ |

---

_Cập nhật checklist này khi có thêm input mới._

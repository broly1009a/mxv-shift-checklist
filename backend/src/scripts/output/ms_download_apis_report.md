# BÁO CÁO ĐẶC TẢ API TẢI BÁO CÁO M-SYSTEM (GROUND TRUTH AUDIT)

> Thời gian cào: 11:45:03 14/10/2026
> M-System Admin: `https://admin-dev.msystem.newgen.dev`
> M-System API Host: `https://api-dev.newgen.dev`

## 1. TỔNG HỢP CÁC ENDPOINT TẢI FILE ĐÃ BẮT ĐƯỢC

| STT | Mã Báo Cáo | Tên Báo Cáo | Hash URL | HTTP Method | Endpoint API Bắt Được | Trạng Thái |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| 1 | `NKTTHT` | Nhật ký thao tác hệ thống | `#/systemManagement/activityHistory` | `GET` | `/approval/admin/activities/excel?sort_by%3Ddesc(datetime)` | ✅ Thành công |
| 2 | `DSTKGD-Futures` | Danh sách TKGD Futures | `#/clientManagement/investorManagement` | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D%3DNULL` | ✅ Thành công |
| 3 | `DSTKGD-Spread` | Danh sách TKGD Spread | `#/clientManagement/investorManagement` | `GET` | `/am/admin/investors/excel?subInvestorType%5Beq%5D%3DS` | ✅ Thành công |
| 4 | `DSTKGD-LME` | Danh sách TKGD LME | `#/clientManagement/investorManagement` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 5 | `DSTKGD-ACM` | Danh sách TKGD ACM | `#/clientManagement/investorManagement` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 6 | `TLQHSKQ` | Thiết lập quan hệ số ký quỹ | `#/clientManagement/marginRatioMultiplier` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 7 | `NR` | Danh sách nộp rút tiền | `#/clientManagement/marginMoneyTransHistory` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 8 | `DSTrader` | Danh sách Trader | `#/clientManagement/traderManagement` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 9 | `market truoc 6h` | Market trước 6h | `#/orderManagement/orderCreating` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 10 | `DSLDK` | Danh sách lệnh dự kiến (đã khớp) | `#/orderManagement/orderList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 11 | `DSLCK` | Danh sách lệnh chờ khớp | `#/orderManagement/orderList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 12 | `DSLH` | Danh sách lệnh hủy | `#/orderManagement/orderList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 13 | `DSLK` | Danh sách lệnh khác | `#/orderManagement/orderList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 14 | `DSGD` | Danh sách giao dịch | `#/orderManagement/transactionList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 15 | `TTM` | Trạng thái mở (Vị thế mở) | `#/positionManagement/openPositionInfo` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 16 | `TTTT` | Trạng thái tất toán | `#/positionManagement/finalPositionInfo` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 17 | `TTCDH` | Trạng thái tất toán chờ đáo hạn LME | `#/positionManagement/finalPositionInfo` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 18 | `DSQLKQ` | Danh sách quản lý ký quỹ | `#/positionManagement/marginList` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 19 | `QLTKGD` | Quản lý tài khoản giao dịch | `#/clientManagement/marginStatusManagement` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |
| 20 | `QLTKGD âm KQ` | Quản lý TKGD âm ký quỹ | `#/clientManagement/negativeMarginManagement` | - | - | ⚠️ Chưa bắt được (Không thấy nút xuất file trên UI) |

## 2. CHI TIẾT ENDPOINT & CURL MẪU GỌI TRỰC TIẾP TỪNG BÁO CÁO

### • Báo cáo: Nhật ký thao tác hệ thống (`NKTTHT`)

- **URL Đầy Đủ:** `https://api-dev.newgen.dev/approval/admin/activities/excel?sort_by%3Ddesc(datetime)`
- **Phương Thức:** `GET`
- **File Mặc Định:** `attachment; filename=nhat_ky_thao_tac_1791952743.xlsx`
- **cURL Mẫu Gọi Trực Tiếp:**
```bash
curl -X GET "https://api-dev.newgen.dev/approval/admin/activities/excel?sort_by%3Ddesc(datetime)" \
  -H "authorization: Bearer <MS_TOKEN>" \
  -H "origin: https://admin-dev.msystem.newgen.dev" \
  -H "referer: https://admin-dev.msystem.newgen.dev/" \
  -o "NKTTHT.xlsx"
```

---

### • Báo cáo: Danh sách TKGD Futures (`DSTKGD-Futures`)

- **URL Đầy Đủ:** `https://api-dev.newgen.dev/am/admin/investors/excel?subInvestorType%5Beq%5D%3DNULL`
- **Phương Thức:** `GET`
- **cURL Mẫu Gọi Trực Tiếp:**
```bash
curl -X GET "https://api-dev.newgen.dev/am/admin/investors/excel?subInvestorType%5Beq%5D%3DNULL" \
  -H "authorization: Bearer <MS_TOKEN>" \
  -H "origin: https://admin-dev.msystem.newgen.dev" \
  -H "referer: https://admin-dev.msystem.newgen.dev/" \
  -o "DSTKGD-Futures.xlsx"
```

---

### • Báo cáo: Danh sách TKGD Spread (`DSTKGD-Spread`)

- **URL Đầy Đủ:** `https://api-dev.newgen.dev/am/admin/investors/excel?subInvestorType%5Beq%5D%3DS`
- **Phương Thức:** `GET`
- **File Mặc Định:** `attachment; filename=danh_sach_TKGD.xlsx`
- **cURL Mẫu Gọi Trực Tiếp:**
```bash
curl -X GET "https://api-dev.newgen.dev/am/admin/investors/excel?subInvestorType%5Beq%5D%3DS" \
  -H "authorization: Bearer <MS_TOKEN>" \
  -H "origin: https://admin-dev.msystem.newgen.dev" \
  -H "referer: https://admin-dev.msystem.newgen.dev/" \
  -o "DSTKGD-Spread.xlsx"
```

---


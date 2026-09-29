# TÀI LIỆU NGHIÊN CỨU & THIẾT KẾ: PHÂN HỆ XỬ LÝ EMAIL SAI FORMAT & MÀN HÌNH HỖ TRỢ NGOẠI LỆ (EXCEPTION SCREEN)

> **Trạng thái**: 🟡 **ON HOLD (TẠM DỪNG TRIỂN KHAI MÃ NGUỒN)**  
> **Lý do**: Văn bản quy chuẩn định dạng email mở TKGD cấp Sở đang trong quá trình hoàn thiện chính sách, chưa ban hành bắt buộc tới toàn bộ TVKD. Tài liệu này đóng gói toàn bộ nghiên cứu, kiến trúc dữ liệu và thiết kế giao diện để sẵn sàng triển khai ngay khi văn bản được ban hành.  
> **Ngày lập**: 24/09/2026  
> **Dự án**: MXV Account Opening Reconciler (`mxv-account-opening-reconciler`)

---

## 1. BỐI CẢNH & ĐÁNH GIÁ THỰC TẾ (REALITY CHECK)

### 1.1. Hiện Trạng Tiếp Nhận Email Tại Sở MXV

- Hằng ngày, hòm thư tiếp nhận `clearing.acc@mxv.vn` nhận hàng chục đến hàng trăm email từ các Thành viên Kinh doanh (TVKD 003, 012, 036, 682...).
- Do **chưa có văn bản quy chuẩn chính thức bắt buộc**, format email gửi về hiện nay muôn hình vạn trạng:
  - Có TVKD đặt tiêu đề đúng chuẩn: `[MỞ TKGD] - 003 - NGUYỄN VĂN AN - 003C1234567`.
  - Có TVKD đặt tiêu đề tự do: _"Hồ sơ mở tài khoản"_, _"Y/C cấp tài khoản NĐT"_, _"TVKD gửi hồ sơ khách hàng VIP"_.
  - Nội dung có nơi theo form bảng, có nơi chỉ viết vắn tắt vài dòng kèm tệp đính kèm.

### 1.2. Điểm Nghẽn Kỹ Thuật Đã Phát Hiện Trong Mã Nguồn

- **Tầng Graph API**: Truy vấn `$search="Yêu cầu mở TKGD"` của Microsoft Graph thực tế tìm kiếm trên **cả Tiêu đề lẫn Thân thư (Body)**.
- **Tầng Lọc In-Memory (Node.js)**: Tại [tkgd-automation.service.ts#L1638-L1641](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-tkgd-ccp-work/mxv-account-opening-reconciler/src/modules/tkgd-automation/tkgd-automation.service.ts#L1638-L1641), hàm `mailMatchFn` chỉ kiểm tra duy nhất `m.subject` (Tiêu đề).
- **Hệ quả**: Nếu TVKD đặt tiêu đề tự do nhưng bên trong thân thư có đầy đủ mã tài khoản `003C...`, hợp đồng và CCCD, hệ thống sẽ **vứt bỏ oan email này**, dẫn đến nguy cơ bỏ sót hồ sơ của Nhà đầu tư.

### 1.3. Đánh Giá Tính Thiết Thực (Tránh Bẫy "Over-Engineering")

- **Không xây dựng phân hệ Quản lý Form Template (CRUD/Builder) cồng kềnh**:
  - Sở ban hành quy chuẩn thường áp dụng ổn định 2–5 năm, TVKD không thể tùy tiện đổi form mỗi tuần.
  - Cán bộ ca trực không có nhu cầu hàng tuần vào tạo hay quản lý Template. Nếu làm builder phức tạp sẽ rơi vào tình trạng **"dùng 1 lần rồi bỏ xó"**, lãng phí tài nguyên và khó bảo trì.
- **Nhu cầu cốt lõi thực sự của ca trực**:
  - Không được để sót email có thông tin tài khoản.
  - Phải bắt được các email gửi sai format, **VẪN LƯU LẠI VÀO HỆ THỐNG** để ca trực có bằng chứng kiểm tra thủ công và gửi email/thông báo phản hồi yêu cầu TVKD chuẩn hóa lại.

---

## 2. NGUYÊN TẮC THIẾT KẾ CỐT LÕI (CORE PRINCIPLES)

1. **Nguyên Tắc Không Làm Rác Màn Hình Chính (Zero Distraction)**:
   - Màn hình làm việc ca trực chính (`/`) là nơi đối soát dữ liệu và phê duyệt tài khoản với tốc độ cao.
   - **Tuyệt đối không nhồi nhét Tab 1, Tab 2 vào màn hình chính**. Các email sai format hoàn toàn không được xuất hiện ở màn hình chính để tránh gây nhiễu và làm loãng quy trình làm việc.
2. **Nguyên Tắc Màn Hình Hỗ Trợ Ngoại Lệ Độc Lập (Dedicated Support & Exception Screen)**:
   - Bố trí riêng một màn hình phụ (`/exceptions`) nằm ở thanh menu hỗ trợ.
   - Màn hình này **chỉ đóng vai trò công cụ hỗ trợ**: Khi ca trực rảnh tay hoặc khi TVKD gọi điện thắc mắc về hồ sơ chưa được duyệt, cán bộ mới mở màn hình này ra để tra cứu và gửi phản hồi.
3. **Nguyên Tắc Cứu Hồ Sơ & Bảo Toàn Dữ Liệu (Zero-Drop Policy)**:
   - Dù email gửi sai cú pháp tiêu đề, nhưng nếu trong thân thư có mã tài khoản định dạng Sở (`0xxCxxxxxxx`) $\rightarrow$ **Vẫn bóc tách và lưu vào hệ thống**, phục vụ đối soát và chỉ gắn cờ cảnh báo format.

---

## 3. KIẾN TRÚC DỮ LIỆU TÁCH RỜI (DECOUPLED DATA ARCHITECTURE)

```
                       ┌──────────────────────────────────────────────┐
                       │  EMAIL GỬI VỀ HÒM THƯ CLEARING.ACC@MXV.VN    │
                       └──────────────────────────────────────────────┘
                                               │
                        Bộ Lọc Cửa Ngõ 2 Lớp (Dual-Layer Filter)
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
      [ LUỒNG CHÍNH: HỒ SƠ HỢP LỆ ]                     [ LUỒNG NGOẠI LỆ: THƯ SAI FORMAT ]
  • Có mã TKGD 0xxC... hợp lệ                       • Tiêu đề sai quy chuẩn, không ra mã TK
  • Bóc tách CCCD, Hợp đồng, M-System               • Email hỏi đáp, spam hoặc thiếu hẳn dữ liệu
                      │                                                 │
                      ▼                                                 ▼
      📁 Bảng `clean_account_records`                   📁 Bảng `invalid_format_emails`
                      │                                                 │
                      ▼                                                 ▼
      🖥️ MÀN HÌNH CA TRỰC CHÍNH (`/`)                  🛠️ MÀN HÌNH HỖ TRỢ NGOẠI LỆ (`/exceptions`)
  • Tập trung 100% vào nghiệp vụ:                   • Nằm riêng biệt ở menu tiện ích hỗ trợ
    So khớp dữ liệu ➔ Bấm Phê Duyệt                   • Chỉ mở ra khi cần tra cứu hoặc rảnh tay
  • Giao diện sạch sẽ, chuyên nghiệp                • Có nút 1-Click gửi mail phản hồi TVKD
```

### 3.1. Cấu Trúc Bảng CSDL Ngoại Lệ (`invalid_format_emails`)

```typescript
@Schema({ timestamps: true, collection: "invalid_format_emails" })
export class InvalidFormatEmail {
  @Prop({ unique: true, index: true, required: true })
  messageId: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true, index: true })
  senderEmail: string;

  @Prop()
  senderName?: string;

  @Prop({ required: true, index: true })
  receivedDateTime: Date;

  @Prop()
  bodySnippet: string; // Trích dẫn 300 ký tự đầu nội dung thư

  @Prop({ type: [String], default: [] })
  violationReasons: string[];
  // Ví dụ: ['Tiêu đề thiếu tiền tố [MỞ TKGD]', 'Không tìm thấy mã tài khoản 0xxC... trong thư']

  @Prop({
    enum: ["CHUA_XU_LY", "DA_THONG_BAO_TVKD", "BO_QUA"],
    default: "CHUA_XU_LY",
    index: true,
  })
  status: string;

  @Prop()
  notifiedAt?: Date;

  @Prop()
  notifiedBy?: string; // Email cán bộ ca trực bấm gửi phản hồi

  @Prop()
  replyNotes?: string;
}
```

---

## 4. BẢN VẼ THIẾT KẾ MÀN HÌNH HỖ TRỢ NGOẠI LỆ (`/exceptions`)

Giao diện độc lập hoàn toàn, thiết kế tối giản, tập trung vào công tác **tra cứu và phản hồi**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🛠️ TRUNG TÂM HỖ TRỢ: TRA CỨU HÒM THƯ SAI QUY CHUẨN (EXCEPTIONS LOG)                    │
│  (Công cụ hỗ trợ ca trực đối chất và phản hồi các email không đúng định dạng của TVKD) │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🔍 [Ô tìm kiếm theo tiêu đề, email TVKD...]            [Chọn ngày: 24/09/2026   ▼]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  DANH SÁCH EMAIL NGOẠI LỆ TRONG CA:                                                    │
│                                                                                        │
│  1. Lúc 08:15 | Người gửi: support@saigonfutures.com (TVKD 012)                        │
│     • Tiêu đề nhận : "Gửi hồ sơ mở tài khoản cho anh Nam"                              │
│     • Lỗi phát hiện: ❌ Thiếu tiền tố quy chuẩn [MỞ TKGD] - 012 - ...                  │
│     • Trạng thái   : 🟡 Chưa thông báo                                                 │
│     • Thao tác     : [👁️ Xem nội dung mail]   [✉️ Gửi mail phản hồi TVKD]  [📋 Copy lỗi]│
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  2. Lúc 09:20 | Người gửi: backoffice@giacatloi.vn (TVKD 003)                          │
│     • Tiêu đề nhận : "Hỏi về thủ tục cấp tài khoản giao dịch"                          │
│     • Lỗi phát hiện: ❌ Không tìm thấy mã tài khoản hợp lệ (0xxC...) trong nội dung    │
│     • Trạng thái   : 🟢 Đã gửi mail nhắc lúc 09:25 (Bởi: hiepth@mxv.vn)                │
│     • Thao tác     : [👁️ Xem nội dung mail]   [📋 Xem lại nội dung đã gửi]             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Mẫu Nội Dung Phản Hồi TVKD Tự Động (Auto-Draft Response)

Khi cán bộ bấm **`[✉️ Gửi mail phản hồi TVKD]`** hoặc **`[📋 Copy lỗi]`**, hệ thống tự động sinh nội dung chuẩn hóa:

> **Kính gửi Thành viên Kinh doanh [MÃ_TVKD],**
>
> Hòm thư tiếp nhận của Sở Giao dịch Hàng hóa Việt Nam (clearing.acc@mxv.vn) có tiếp nhận email của Quý đơn vị lúc **[THỜI_GIAN]** với tiêu đề: _"**[TIÊU_ĐỀ_GỐC]**"_.
>
> Qua rà soát hệ thống, email trên chưa đáp ứng đúng quy chuẩn định dạng tiếp nhận của Sở:
>
> - **Chi tiết lỗi**: [DANH_SÁCH_LÝ_DO_LỖI]
>
> Để đảm bảo tiến độ cấp tài khoản cho Nhà đầu tư, đề nghị Quý TVKD vui lòng chuẩn hóa lại email và gửi lại theo đúng quy chuẩn ban hành của MXV.
>
> _Trân trọng,_  
> **Phòng Nghiệp vụ Giám sát & Quản lý giao dịch - MXV**

---

## 5. KẾ HOẠCH TRIỂN KHAI KHI SỞ BAN HÀNH QUY CHUẨN CHÍNH THỨC

Khi văn bản chính thức về Quy chuẩn Email mở TKGD được ban hành tới các TVKD, hệ thống sẽ kích hoạt tính năng theo lộ trình 3 bước:

|    Bước    | Hạng mục thực hiện                                                                   | Thời gian dự kiến | Mục tiêu                                                                          |
| :--------: | :----------------------------------------------------------------------------------- | :---------------: | :-------------------------------------------------------------------------------- |
| **Bước 1** | Bổ sung Collection `invalid_format_emails` và nạp email ngoại lệ vào bảng riêng      |     0.5 ngày      | Bảo đảm 100% email sai quy cách được ghi nhận đầy đủ, không bỏ sót.               |
| **Bước 2** | Xây dựng Màn hình Hỗ Trợ Ngoại Lệ `/exceptions` kèm nút Copy lỗi / Gửi mail phản hồi |      1 ngày       | Cung cấp công cụ tra cứu và đối chất cho cán bộ ca trực.                          |
| **Bước 3** | Bổ sung 2 ô từ khóa nhận diện động (Tiêu đề / Thân thư) trên trang Cài đặt hiện có   |     0.5 ngày      | Cho phép ca trực tinh chỉnh từ khóa khi có phát sinh thực tế mà không cần gọi IT. |

---

## 6. KẾT LUẬN

Việc **tạm dừng (HOLD)** triển khai mã nguồn tại thời điểm này là hoàn toàn chính xác để tránh việc phát triển vội vàng khi chính sách nghiệp vụ chưa chốt. Toàn bộ thiết kế kiến trúc, mô hình dữ liệu tách rời và giao diện hỗ trợ đã được đóng gói hoàn chỉnh tại tài liệu này, sẵn sàng đưa vào áp dụng ngay khi có văn bản chỉ đạo từ Sở.

const fs = require('fs');
const path = require('path');

const changelogEntry = `## [2026-10-15] - Triển Khai Chặng 0 & Chặng 1: Ingress Dynamic Flags & ACM ETP REST API Adapter

### 1. Mục tiêu thay đổi
- Thực hiện bước đi đầu tiên trong lộ trình chuyển đổi Ingress theo nguyên tắc chia nhỏ (Strangler Fig Pattern):
  + **Chặng 0**: Bổ sung cơ chế 4 công tắc Feature Flag độc lập trong \`system_settings\` (\`ingress_mode_acm\`, \`ingress_mode_ms\`, \`ingress_mode_ccp\`, \`ingress_mode_ce\`), mặc định \`PLAYWRIGHT\` để bảo đảm an toàn tuyệt đối cho ca trực đang vận hành.
  + **Chặng 1**: Pilot cắm phân hệ REST API ACM ETP qua \`AcmEtpAdapter\` để tải 2 báo cáo \`ACM_ETP_ORDERS\` và \`ACM_ETP_TRADES\`.

### 2. Danh sách file tác động
- [acm-etp.adapter.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/adapters/acm-etp.adapter.ts) *(Tạo mới)*: Triển khai \`IIngressPort\`, bẫy AWS ALB Sticky Cookie, Client UUID v4, Captcha, và gọi Direct REST API tải file Excel.
- [ingress.module.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.module.ts) *(Chỉnh sửa)*: Khai báo \`AcmEtpAdapter\` vào \`providers\` và \`exports\`.
- [ingress.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.service.ts) *(Chỉnh sửa)*: Nâng cấp hàm định tuyến \`download()\`, ưu tiên cờ nguồn riêng (\`ingress_mode_acm\`...) và phân nhánh tự động giữa ACM ETP Web và Straits SFTP.

### 3. Tóm tắt nội dung code
- \`AcmEtpAdapter\`:
  + \`CookieJar\`: Quản lý cookie header và cập nhật tự động Set-Cookie từ response.
  + \`getValidSession()\`: Kiểm tra cache session trước khi đăng nhập, nạp credentials động từ MongoDB \`bot_credentials_acm\`.
  + \`download()\`: Tải 2 file \`ACM_ETP_ORDERS\` và \`ACM_ETP_TRADES\` trực tiếp về thư mục ca trực.
- \`IngressService\`: Tự động fallback về Playwright nếu cờ chưa kích hoạt hoặc có lỗi.

### 4. Xác nhận kiểm thử & Biên dịch
- Lệnh chạy: \`npx tsc -p tsconfig.build.json --noEmit\`
- Kết quả: **Exit code 0 (Pass 100%, không có bất kỳ lỗi biên dịch nào)**.

---
`;

const paths = [
  '../mxv-cqg-download-investigation/CHANGELOG_AI.md',
  'CHANGELOG_AI.md'
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    const original = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, changelogEntry + '\n' + original, 'utf8');
    console.log(`Updated changelog at: ${p}`);
  }
});

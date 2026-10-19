/**
 * run_download_all.js - Tải toàn bộ báo cáo M-System về máy qua REST API
 * Chạy: node scripts/run_download_all.js
 */

const path = require('path');
const fs = require('fs');

const CONFIG = {
  baseUrl: process.env.MS_BASE_URL || 'https://api-dev.newgen.dev',
  adminUrl: process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev',
  username: process.env.MS_USERNAME || 'mxvhieptruong',
  password: process.env.MS_PASSWORD || 'Taovipko0!',
  pin: process.env.MS_PIN || '269696',
};

// 18 BÁO CÁO M-SYSTEM VỚI ENDPOINT CHUẨN XÁC 100% ĐÃ GIẢI MÃ
const REPORTS = [
  { key: 'NKTTHT', name: 'Nhật ký thao tác hệ thống', endpoint: '/approval/admin/activities/excel?sort_by=desc(datetime)', fileName: 'NKTTHT.xlsx' },
  { key: 'DSTKGD-Futures', name: 'Danh sách TKGD Futures', endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D=NULL', fileName: 'DSTKGD-Futures.xlsx' },
  { key: 'DSTKGD-Spread', name: 'Danh sách TKGD Spread', endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D=S', fileName: 'DSTKGD-Spread.xlsx' },
  { key: 'DSTKGD-LME', name: 'Danh sách TKGD LME', endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D=LME', fileName: 'DSTKGD-LME.xlsx' },
  { key: 'DSTKGD-ACM', name: 'Danh sách TKGD ACM', endpoint: '/am/admin/investors/excel?subInvestorType%5Beq%5D=ACM', fileName: 'DSTKGD-ACM.xlsx' },
  { key: 'TLQHSKQ', name: 'Thiết lập quan hệ số ký quỹ', endpoint: '/am/admin/margin-ratio-multiplier/investors/excel?sort_by=desc(createdDate)', fileName: 'TLQHSKQ.xlsx' },
  { key: 'NR', name: 'Danh sách nộp rút tiền', endpoint: '/am/admin/investors/marginTransactionHistory/excel', fileName: 'NR.xlsx' },
  { key: 'DSTrader', name: 'Danh sách Trader', endpoint: '/am/admin/traders/excel?sort_by=desc(createdDate)', fileName: 'DSTrader.xlsx' },
  { key: 'DSLDK', name: 'Danh sách lệnh đã khớp', endpoint: '/order/admin/list/excel?status[in]=PARTIALLY_FILLED,FILLED', fileName: 'DSLDK.xlsx' },
  { key: 'DSLCK', name: 'Danh sách lệnh chờ khớp', endpoint: '/order/admin/list/excel?status[in]=WORKING', fileName: 'DSLCK.xlsx' },
  { key: 'DSLH', name: 'Danh sách lệnh hủy', endpoint: '/order/admin/list/excel?status[in]=CANCELLED', fileName: 'DSLH.xlsx' },
  { key: 'DSGD', name: 'Danh sách giao dịch', endpoint: '/transaction/admin/list/excel', fileName: 'DSGD.xlsx' },
  { key: 'TTM', name: 'Trạng thái mở', endpoint: '/position/admin/open/excel', fileName: 'TTM.xlsx' },
  { key: 'TTTT', name: 'Trạng thái tất toán', endpoint: '/position/admin/settle/excel', fileName: 'TTTT.xlsx' },
  { key: 'TTCDH', name: 'Trạng thái tất toán chờ đáo hạn LME', endpoint: '/position/admin/settleLME/excel', fileName: 'TTCDH.xlsx' },
  { key: 'DSQLKQ', name: 'Danh sách quản lý ký quỹ', endpoint: '/margin/admin/list/excel?limit=20&offset=0', fileName: 'DSQLKQ.xlsx' },
  { key: 'QLTKGD', name: 'Quản lý tài khoản giao dịch', endpoint: '/margin/admin/status/excel', fileName: 'QLTKGD.xlsx' },
  { key: 'QLTKGD âm KQ', name: 'Quản lý TKGD âm ký quỹ', endpoint: '/margin/admin/status/negative/excel', fileName: 'QLTKGD_am_KQ.xlsx' },
];

async function login() {
  const commonHeaders = {
    'accept': 'application/json',
    'origin': CONFIG.adminUrl,
    'referer': `${CONFIG.adminUrl}/`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  const step1 = await fetch(`${CONFIG.baseUrl}/am/admin/users/login`, {
    method: 'POST',
    headers: { ...commonHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ username: CONFIG.username, password: CONFIG.password }),
  });
  const data1 = await step1.json();
  const userId = data1.data.user.id || data1.data.user._id;
  const tempToken = data1.data.user.accessToken;

  const step2 = await fetch(`${CONFIG.baseUrl}/am/admin/users/verifyPin/${userId}`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'content-type': 'application/json',
      'authorization': `Bearer ${tempToken}`,
    },
    body: JSON.stringify({ pin: String(CONFIG.pin) }),
  });
  const data2 = await step2.json();
  return data2.data.user.accessToken;
}

(async () => {
  console.log('========================================================================');
  console.log('   🚀 BẮT ĐẦU TẢI TRỌN GÓI BÁO CÁO M-SYSTEM QUA REST API TRỰC TIẾP     ');
  console.log(`   Host API:   ${CONFIG.baseUrl}`);
  console.log(`   Admin Host: ${CONFIG.adminUrl}`);
  console.log('========================================================================\n');

  try {
    const token = await login();
    console.log(` Đăng nhập M-System thành công! Bearer Token: ${token.slice(0, 35)}...\n`);

    const outDir = path.resolve(__dirname, '../output');
    fs.mkdirSync(outDir, { recursive: true });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < REPORTS.length; i++) {
      const rep = REPORTS[i];
      process.stdout.write(`[${i + 1}/${REPORTS.length}] Đang tải [${rep.name}]... `);

      const startTime = Date.now();
      try {
        const res = await fetch(`${CONFIG.baseUrl}${rep.endpoint}`, {
          method: 'GET',
          headers: {
            'accept': 'application/json, text/plain, */*',
            'authorization': `Bearer ${token}`,
            'origin': CONFIG.adminUrl,
            'referer': `${CONFIG.adminUrl}/`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const targetPath = path.join(outDir, rep.fileName);
          fs.writeFileSync(targetPath, buffer);
          const duration = Date.now() - startTime;
          console.log(` OK! ${(buffer.length / 1024).toFixed(1)} KB | ${duration}ms`);
          successCount++;
        } else {
          console.log(` HTTP ${res.status}`);
          failCount++;
        }
      } catch (err) {
        console.log(` Lỗi kết nối: ${err.message}`);
        failCount++;
      }
    }

    console.log('\n========================================================================');
    console.log(`🎉 TỔNG KẾT: Thành công: ${successCount}/${REPORTS.length} báo cáo!`);
    console.log(`📁 Thư mục lưu file: ${outDir}`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error(' Lỗi:', err.message);
  }
})();

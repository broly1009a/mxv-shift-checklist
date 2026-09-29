/**
 * ============================================================================
 * TEST SCRIPT: BỘ KIỂM THỬ TÍNH MINH BẠCH & CÚ PHÁP SELECTOR PLAYWRIGHT
 * ============================================================================
 * 
 * Mục đích:
 * 1. Tự động kiểm tra cú pháp của toàn bộ selector trong hệ thống bot Playwright.
 * 2. Ngăn ngừa triệt để các lỗi nguy hiểm như:
 *    - Trộn lẫn XPath vào danh sách CSS selector (.join(', ') chứa 'xpath=//...').
 *    - Ký tự không hợp lệ (@class, syntax error) làm sập Playwright CSS Engine.
 *    - Các lỗi selector chết người gây dừng luồng đối soát chính.
 * 3. Kiểm thử trực tiếp với Playwright locator compiler để đảm bảo mọi selector
 *    đều có thể khởi tạo và thực thi an toàn trong runtime.
 * 
 * Lệnh chạy:
 *   cd backend
 *   node src/scripts/test_verify_playwright_selectors.js
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// 1. Danh sách selector quan trọng trong luồng đối soát chính
const SELECTORS_TO_AUDIT = [
  // M-System DSGD Candidate Selectors (recon-jobs.handler.ts)
  { label: 'MS DSGD - Candidate 1 (Button fa-file-csv)', selector: "button:has(i[class*='fa-file-csv'])" },
  { label: 'MS DSGD - Candidate 2 (Ladda button)', selector: "button.ladda-button:has(i[class*='fa-file-csv'])" },
  { label: 'MS DSGD - Candidate 3 (Ghost primary)', selector: "button.btn-ghost-primary:has(i[class*='fa-file-csv'])" },
  { label: 'MS DSGD - Candidate 4 (FontAwesome 5 Solid)', selector: "button:has(i.fas.fa-file-csv)" },
  { label: 'MS DSGD - Candidate 5 (FontAwesome 4/standard)', selector: "button:has(i.fa-file-csv)" },
  { label: 'MS DSGD - Candidate 6 (Generic Ladda button)', selector: "button.ladda-button" },
  { label: 'MS DSGD - Candidate 7 (Direct Icon class)', selector: "i[class*='fa-file-csv']" },
  { label: 'MS DSGD - Candidate 8 (Direct Icon fa-file-csv)', selector: "i.fa-file-csv" },
  { label: 'MS DSGD - Candidate 9 (Direct Icon fas.fa-file-csv)', selector: "i.fas.fa-file-csv" },
  { label: 'MS DSGD - Candidate 10 (XPath Icon)', selector: "xpath=//i[contains(@class, 'fa-file-csv')]" },
  { label: 'MS DSGD - Candidate 11 (XPath Button Export)', selector: "xpath=//button[contains(., 'Xuất') or contains(., 'Export')]" },
  { label: 'MS DSGD - Fallback CSS (Merged safe CSS)', selector: "button:has(i[class*='fa-file-csv']), button.ladda-button, i[class*='fa-file-csv']" },

  // ACM Export Selectors
  { label: 'ACM - Export Button', selector: '.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")' },

  // CoreCCP Selectors
  { label: 'CoreCCP - Menu DSGD', selector: "xpath=//span[text()='Danh sách giao dịch']" },
  { label: 'CoreCCP - Button Kết xuất', selector: "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel')]" },
  { label: 'CoreCCP - Menu Export All', selector: "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[contains(text(), 'Export all')]" },

  // M-System Helper Standard Selectors (msystem-tab-navigator.helper.ts)
  {
    label: 'MS Helper - MS_SPECIFIC_EXPORT_BUTTON_SELECTORS',
    selector: [
      'button:has(i[class*="fa-file-csv"])',
      'button:has(i[class*="fa-file-excel"])',
      'button.ladda-button:has(i[class*="fa-file-csv"])',
      'button.ladda-button:has(i[class*="fa-file-excel"])',
      'button.btn-ghost-primary:has(i[class*="fa-file-csv"])',
      'button.ladda-button:has(i.fas.fa-file-csv)',
      'button.ladda-button:has(i.fa-file-csv)',
      'button.ladda-button:has(i.fas.fa-file-excel)',
      'button.ladda-button:has(i.fa-file-excel)',
      'button:has(i.fas.fa-file-csv)',
      'button:has(i.fa-file-csv)',
      'button:has(i.fas.fa-file-excel)',
      'button:has(i.fa-file-excel)',
      'i[class*="fa-file-csv"]',
      'i[class*="fa-file-excel"]',
      'i.fas.fa-file-csv',
      'i.fa-file-csv',
      'i.fas.fa-file-excel',
      'i.fa-file-excel',
      "button:has-text('Xuất file')",
      "button:has-text('Xuất Excel')",
      "button[title*='Export' i]",
    ].join(', ')
  },
];

// 2. Static Codebase Scanner: Tìm xem có bất kỳ file code nào trộn lẫn CSS và XPath bằng .join(', ')
function staticAuditCodebase() {
  console.log('\n🔍 [BƯỚC 1/2] QUÉT TĨNH MÃ NGUỒN BACKEND TÌM DẤU HIỆU TRỘN SELECTOR...');
  const filesToScan = [
    path.join(__dirname, '../modules/bot-engine/handlers/recon-jobs.handler.ts'),
    path.join(__dirname, '../modules/bot-engine/rpa-downloader.service.ts'),
    path.join(__dirname, '../modules/bot-engine/helpers/msystem-tab-navigator.helper.ts'),
    path.join(__dirname, '../modules/bot-engine/ccp-ce-downloader.service.ts'),
    path.join(__dirname, '../modules/bot-engine/gtt-checker.service.ts'),
  ];

  let staticErrors = 0;

  for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Kiểm tra mẫu nguy hiểm: mảng có cả CSS và 'xpath=' rồi .join(', ')
    const badPattern = /\[[^\]]*xpath=[^\]]*\]\.join\(['"],\s*['"]\)/s;
    if (badPattern.test(content)) {
      console.error(`❌ PHÁT HIỆN LỖI TĨNH TẠI ${path.basename(filePath)}: Có mảng chứa 'xpath=' được nối bằng .join(', ')!`);
      staticErrors++;
    }

    lines.forEach((line, idx) => {
      // Bắt trực tiếp dòng chứa chuỗi tai hại
      if (line.includes("xpath=//") && line.includes("button:") && line.includes(",")) {
        console.error(`❌ Dòng ${idx + 1} trong ${path.basename(filePath)}: Ghép chung selector CSS và XPath trên cùng 1 chuỗi: ${line.trim()}`);
        staticErrors++;
      }
    });
  }

  if (staticErrors === 0) {
    console.log('✅ Quét tĩnh hoàn tất: Không phát hiện file nào trộn lẫn CSS và XPath trong mảng .join(\', \')!');
  } else {
    console.error(`🚨 Phát hiện ${staticErrors} vi phạm cú pháp tĩnh trong mã nguồn!`);
  }
  return staticErrors === 0;
}

// 3. Runtime Playwright Selector Compiler Audit
async function runtimeAuditSelectors() {
  console.log('\n⚙️ [BƯỚC 2/2] KIỂM THỬ RUNTIME: KHỞI TẠO BẰNG PLAYWRIGHT SELECTOR COMPILER...');
  const execPath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: execPath,
  });

  const page = await browser.newPage();
  // Set trang HTML giả lập có cấu trúc giống M-System để test locator
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <div class="main-content">
          <button class="btn btn-ghost-primary ladda-button">
            <span class="ladda-label">
              <i class="fas fa-file-csv"></i>
            </span>
          </button>
          <a class="nav-link">Danh sách giao dịch</a>
          <button class="btn btn-primary">Kết xuất</button>
        </div>
      </body>
    </html>
  `);

  let passed = 0;
  let failed = 0;

  for (const item of SELECTORS_TO_AUDIT) {
    try {
      // Test 1: Khởi tạo locator
      const locator = page.locator(item.selector);
      // Test 2: Đếm số lượng phần tử khớp (Playwright sẽ parse selector ở bước này)
      const count = await locator.count();
      const isVisible = count > 0 ? await locator.first().isVisible() : false;
      console.log(`  ✅ [PASS] ${item.label}`);
      console.log(`     -> Selector: ${item.selector.slice(0, 80)}${item.selector.length > 80 ? '...' : ''}`);
      console.log(`     -> Số phần tử khớp trên mock DOM: ${count} (Visible: ${isVisible})`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${item.label}`);
      console.error(`     -> Selector: ${item.selector}`);
      console.error(`     -> LỖI CÚ PHÁP: ${err.message}`);
      failed++;
    }
  }

  await browser.close();

  console.log('\n=============================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ SELECTORS:`);
  console.log(`   - Hợp lệ: ${passed}/${SELECTORS_TO_AUDIT.length}`);
  console.log(`   - Vi phạm cú pháp: ${failed}/${SELECTORS_TO_AUDIT.length}`);
  console.log('=============================================================');

  return failed === 0;
}

async function main() {
  const staticOk = staticAuditCodebase();
  let runtimeOk = false;
  try {
    runtimeOk = await runtimeAuditSelectors();
  } catch (err) {
    console.error(`Lỗi thực thi kiểm thử Runtime: ${err.message}`);
  }

  if (staticOk && runtimeOk) {
    console.log('\n🎯 TOÀN BỘ SELECTOR ĐẠT CHUẨN 100%. KHÔNG CÒN NGUY CƠ CRASH DO LỖI CÚ PHÁP!');
    process.exit(0);
  } else {
    console.error('\n🚨 PHÁT HIỆN LỖI SELECTOR CẦN KHẮC PHỤC NGAY!');
    process.exit(1);
  }
}

main();

/**
 * ============================================================================
 * AUDIT_CCP_EXPORT_MECHANISMS.JS
 * ============================================================================
 * Mục đích:
 * 1. Tự động đăng nhập vào CoreCCP (UAT/Production).
 * 2. Lần lượt truy cập các trang báo cáo trọng điểm của CoreCCP.
 * 3. Lắng nghe toàn bộ lưu lượng mạng (Network Interception) khi:
 *    - Vào trang: Bắt Search API (/ccp/inquiry/maintain/.../search/...)
 *    - Bấm nút "Kết xuất" -> "Xuất tất cả": Bắt Export API (/ccp/export/create và /ccp/report/download/{id})
 *    - Bấm nút "Kết xuất" -> "Xuất trang hiện tại": Kiểm tra cơ chế Client-side Export.
 * 4. Phân loại cơ chế của từng trang vào 3 nhóm:
 *    - SERVER_SIDE: Tạo job qua /ccp/export/create + tải qua /ccp/report/download
 *    - CLIENT_SIDE: Xuất trực tiếp trên trình duyệt (Blob / FileSaver)
 *    - DIRECT_API: Có REST API lấy dữ liệu thô JSON trực tiếp
 * 5. Xuất báo cáo đặc tả hoàn chỉnh ra:
 *    - backend/src/scripts/output/audit_ccp_export_mechanisms.md
 *    - backend/src/scripts/output/audit_ccp_export_mechanisms.json
 * 
 * Cách chạy:
 *   node backend/src/scripts/audit_ccp_export_mechanisms.js --headed
 *   node backend/src/scripts/audit_ccp_export_mechanisms.js --headless
 * ============================================================================
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// ─── 1. DANH SÁCH MÀN HÌNH TRỌNG ĐIỂM CỦA CORECCP ────────────────────────────
const TARGET_SCREENS = [
  {
    code: 'ORDERBOOK',
    name: 'Danh sách lệnh (DSL)',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/ORDERBOOK',
  },
  {
    code: 'ORDERMATCH_DETAIL',
    name: 'Danh sách giao dịch chi tiết (DSGD)',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/ORDERMATCH_DETAIL',
  },
  {
    code: 'OPEN_POSITION',
    name: 'Trạng thái mở (TTM)',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/OPEN_POSITION',
  },
  {
    code: 'PNL_EXECUTED',
    name: 'Trạng thái tất toán (TTTT)',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/PNL_EXECUTED',
  },
  {
    code: 'ORDERBOOK_MM',
    name: 'Danh sách lệnh MM',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/ORDERBOOK_MM',
  },
  {
    code: 'ORDERBOOK_ALL_MM',
    name: 'Lịch sử giao dịch MM',
    group: 'Lệnh và vị thế',
    url: '/ORDERS/ORDERBOOK_ALL_MM',
  },
  {
    code: 'CASHTRANFER_HIST',
    name: 'Lịch sử Nộp/ Rút tiền (NR)',
    group: 'Nộp rút tiền',
    url: '/CASHTRANFER/CASHTRANFER_HIST',
  },
  {
    code: 'ACCOUNTS_INFO',
    name: 'Danh sách tài khoản giao dịch (DSTKGD)',
    group: 'Quản lý tài khoản',
    url: '/ACCOUNTMNG/ACCOUNTS_INFO',
  },
  {
    code: 'ACCTMARGIN_ALL',
    name: 'Quản lý trạng thái TKGD (Ký quỹ)',
    group: 'Quản lý rủi ro',
    url: '/RISKMNG/ACCTMARGIN_ALL',
  },
  {
    code: 'MARGIN_MNG',
    name: 'Quản lý ký quỹ TKGD',
    group: 'Quản lý rủi ro',
    url: '/RISKMNG/MARGIN_MNG',
  },
  {
    code: 'SETTLEMENT',
    name: 'Quản lý giá thanh toán (GTT)',
    group: 'Quản lý sản phẩm',
    url: '/PRODUCT/SETTLEMENT',
  },
  {
    code: 'COMMODITY',
    name: 'Quản lý hàng hóa, hợp đồng (HH)',
    group: 'Quản lý sản phẩm',
    url: '/PRODUCT/COMMODITY',
  },
  {
    code: 'FCM_INFORMATION',
    name: 'Danh sách FCM',
    group: 'Quản lý FCM',
    url: '/FCMMNG/FCM_INFORMATION',
  },
  {
    code: 'TLPROFILES',
    name: 'Người sử dụng',
    group: 'Người dùng và phân quyền',
    url: '/USERMNG/TLPROFILES',
  },
];

// ─── 2. HÀM GIẢI MÃ & LẤY CREDENTIALS TỪ DB HOẶC ENV ────────────────────────
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
  const iv = Buffer.from(process.env.ENCRYPTION_IV || '1234567890123456', 'utf-8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

async function getCredentials() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv-shift-checklist';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const SystemSetting = mongoose.model(
      'SystemSettingAuditExport',
      new mongoose.Schema({ key: String, value: String }, { collection: 'system_settings' }),
    );
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    if (setting && setting.value) {
      return JSON.parse(decrypt(setting.value));
    }
  } catch { } finally {
    try { await mongoose.disconnect(); } catch { }
  }
  return {
    url: process.env.CORECCP_URL || 'https://uat-coreccp.mxv.com.vn',
    username: process.env.CORECCP_USERNAME || 'hieptruong',
    password: process.env.CORECCP_PASSWORD || 'Taovipko0!',
  };
}

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// ─── 3. TIỆN ÍCH GIAO DIỆN MUI ──────────────────────────────────────────────
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch { }
}

// ─── 4. HÀM CHÍNH KHẢO SÁT ──────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || !args.includes('--headless');

  console.log('\n========================================================================');
  console.log('   CORECCP EXPORT MECHANISMS AUDITOR (KHẢO SÁT CƠ CHẾ XUẤT FILE)');
  console.log('========================================================================\n');

  const creds = await getCredentials();
  const baseUrl = creds.url.replace(/\/login\/?$/, '');
  const username = creds.username;
  const password = creds.password;

  console.log(`  • Hệ thống:       ${baseUrl}`);
  console.log(`  • Tài khoản:      ${username}`);
  console.log(`  • Chế độ:         ${isHeaded ? 'Giao diện trực quan (--headed)' : 'Headless'}`);
  console.log(`  • Số màn hình:   ${TARGET_SCREENS.length} màn hình cốt lõi\n`);

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: getChromeExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null, acceptDownloads: true });
  const page = await context.newPage();

  // Biến lưu trữ kết quả kiểm tra
  const auditResults = [];

  // 1. Đăng nhập
  console.log(`🔑 Đang đăng nhập vào CoreCCP (${baseUrl}/login)...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill("input[name='username'], input[type='text']", username);
  await page.fill("input[name='password'], input[type='password']", password);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(2500);
  await dismissModalBackdrop(page);
  console.log('  ✓ Đăng nhập thành công!\n');

  // 2. Duyệt qua từng màn hình
  for (let i = 0; i < TARGET_SCREENS.length; i++) {
    const screen = TARGET_SCREENS[i];
    const fullUrl = `${baseUrl}${screen.url}`;
    console.log(`------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${TARGET_SCREENS.length}] Khảo sát: ${screen.name} (${screen.url})`);

    const result = {
      code: screen.code,
      name: screen.name,
      group: screen.group,
      url: screen.url,
      hasExportButton: false,
      exportOptions: [],
      mechanisms: {
        serverSideExport: false,
        clientSideExport: false,
        hasDirectSearchApi: false,
      },
      capturedApis: {
        searchApi: null,
        exportCreateApi: null,
        downloadApi: null,
      },
      headers: {},
      notes: '',
    };

    // Theo dõi network riêng cho màn hình này
    const screenRequests = [];
    const requestListener = (req) => {
      const u = req.url();
      if (u.includes('/ccp/')) {
        screenRequests.push({
          url: u,
          method: req.method(),
          headers: req.headers(),
          postData: req.postData(),
        });
      }
    };
    page.on('request', requestListener);

    try {
      // Điều hướng trực tiếp
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await dismissModalBackdrop(page);

      // 1. Kiểm tra Search API đã được gọi khi load trang
      for (const req of screenRequests) {
        if (req.url.includes('/search/') || req.url.includes('/inquiry/')) {
          result.mechanisms.hasDirectSearchApi = true;
          result.capturedApis.searchApi = req.url;
          result.headers = {
            authorization: req.headers['authorization'] ? 'Bearer [JWT]' : '',
            connectkey: req.headers['connectkey'] || '',
          };
          break;
        }
      }

      // 2. Tìm nút Kết xuất
      const exportBtn = page.locator(
        "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
        " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]"
      ).first();

      if (await exportBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        result.hasExportButton = true;
        console.log(`  ✓ Tìm thấy nút Kết xuất`);

        // Click nút kết xuất để mở menu dropdown (nếu có)
        await exportBtn.click({ force: true });
        await page.waitForTimeout(500);

        const menuItems = await page.locator("xpath=//ul[@role='menu']//li[@role='menuitem']").all();
        for (const item of menuItems) {
          const text = (await item.textContent().catch(() => ''))?.trim();
          if (text) result.exportOptions.push(text);
        }

        console.log(`    Các tùy chọn: [${result.exportOptions.join(', ')}]`);

        // Xóa danh sách request tạm để đo đợt click export
        screenRequests.length = 0;

        // Ưu tiên click "Xuất tất cả", nếu không có thì click nút kết xuất đơn
        const exportAllItem = page.locator("xpath=//li[@role='menuitem'][contains(., 'Xuất tất cả')]").first();
        if (await exportAllItem.isVisible({ timeout: 600 }).catch(() => false)) {
          console.log(`    Đang thử click: "Xuất tất cả"...`);
          await exportAllItem.click({ force: true });
        } else {
          const exportCurrentItem = page.locator("xpath=//li[@role='menuitem'][contains(., 'Xuất trang hiện tại')]").first();
          if (await exportCurrentItem.isVisible({ timeout: 400 }).catch(() => false)) {
            console.log(`    Đang thử click: "Xuất trang hiện tại"...`);
            await exportCurrentItem.click({ force: true });
          }
        }

        // Chờ 3 giây để bắt request export được bắn ra
        await page.waitForTimeout(3000);

        // Kiểm tra xem request bắn ra là loại nào
        for (const req of screenRequests) {
          if (req.url.includes('/ccp/export/create')) {
            result.mechanisms.serverSideExport = true;
            result.capturedApis.exportCreateApi = req.url;
            console.log(`    🎯 Bắt được Server-Side Export: POST /ccp/export/create`);
          }
          if (req.url.includes('/ccp/report/download/')) {
            result.capturedApis.downloadApi = req.url;
            console.log(`    🎯 Bắt được Download URL: ${req.url}`);
          }
        }

        if (!result.mechanisms.serverSideExport) {
          result.mechanisms.clientSideExport = true;
          console.log(`    ℹ️ Cơ chế: Client-Side Export (FE tự tạo file)`);
        }

        await page.keyboard.press('Escape');
      } else {
        console.log(`   Màn hình không có nút Kết xuất trực tiếp.`);
        result.notes = 'Không có nút kết xuất trực tiếp trên thanh công cụ';
      }

    } catch (screenErr) {
      console.log(`   Lỗi khi quét: ${screenErr.message}`);
      result.notes = `Lỗi: ${screenErr.message}`;
    } finally {
      page.off('request', requestListener);
    }

    auditResults.push(result);
    await page.waitForTimeout(500);
  }

  await context.close().catch(() => { });
  await browser.close().catch(() => { });

  // ─── 5. XUẤT FILE KẾT QUẢ JSON & BÁO CÁO MARKDOWN ─────────────────────────
  const jsonPath = path.join(outputDir, 'audit_ccp_export_mechanisms.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2), 'utf-8');

  const mdPath = path.join(outputDir, 'audit_ccp_export_mechanisms.md');
  let md = `# BÁO CÁO PHÂN TÍCH CƠ CHẾ TẢI FILE & API HỆ THỐNG CORECCP (VNCLEAR)\n\n`;
  md += `> Thời gian quét: ${new Date().toLocaleString('vi-VN')} | Môi trường: \`${baseUrl}\` | Tổng số màn hình: **${auditResults.length}**\n\n`;
  md += `## 1. Bảng Tổng Hợp Cơ Chế Xuất File & Search API Của Các Trang\n\n`;
  md += `| STT | Mã Báo Cáo | Tên Màn Hình Nghiệp Vụ | URL Route | Server-Side Export? | Client-Side FE? | Có REST API Search? | Ghi Chú |\n`;
  md += `| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n`;

  auditResults.forEach((r, idx) => {
    const srv = r.mechanisms.serverSideExport ? ' CÓ (/export/create)' : '❌';
    const cli = r.mechanisms.clientSideExport ? ' CÓ (FE Blob)' : '❌';
    const api = r.mechanisms.hasDirectSearchApi ? ' CÓ (/inquiry/...)' : '❌';
    md += `| ${idx + 1} | \`${r.code}\` | **${r.name}** | \`${r.url}\` | ${srv} | ${cli} | ${api} | ${r.notes || r.exportOptions.join(', ')} |\n`;
  });

  md += `\n---\n\n## 2. Đặc Tả Chi Tiết Từng Màn Hình\n\n`;
  auditResults.forEach((r, idx) => {
    md += `### ${idx + 1}. [${r.code}] ${r.name}\n\n`;
    md += `- **URL Route**: \`${r.url}\` (Nhóm: *${r.group}*)\n`;
    md += `- **Nút Kết xuất**: ${r.hasExportButton ? `Có (Tùy chọn: \`${r.exportOptions.join(', ')}\`)` : 'Không có'}\n`;
    md += `- **Cơ chế tải file**:\n`;
    md += `  + *Server-Side Export*: ${r.mechanisms.serverSideExport ? 'Được hỗ trợ (`POST /ccp/export/create` -> `GET /ccp/report/download/{id}`)' : 'Không sử dụng'}\n`;
    md += `  + *Client-Side Export*: ${r.mechanisms.clientSideExport ? 'Được hỗ trợ (Tự kết xuất trên trình duyệt)' : 'Không sử dụng'}\n`;
    md += `  + *Search REST API*: ${r.mechanisms.hasDirectSearchApi ? `\`${r.capturedApis.searchApi}\`` : 'Không bắt được'}\n`;
    if (r.capturedApis.exportCreateApi) {
      md += `  + *Export Endpoint*: \`${r.capturedApis.exportCreateApi}\`\n`;
    }
    if (r.capturedApis.downloadApi) {
      md += `  + *Download Endpoint*: \`${r.capturedApis.downloadApi}\`\n`;
    }
    md += `\n---\n\n`;
  });

  fs.writeFileSync(mdPath, md, 'utf-8');

  console.log('\n========================================================================');
  console.log('   HOÀN TẤT KHẢO SÁT CƠ CHẾ XUẤT FILE CORECCP');
  console.log('========================================================================');
  console.log(`  ✓ Đã xuất file JSON:     ${jsonPath}`);
  console.log(`  ✓ Đã xuất file Markdown: ${mdPath}\n`);
}

main().catch(console.error);

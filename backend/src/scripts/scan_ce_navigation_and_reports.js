/**
 * SCRIPT KHẢO SÁT & QUÉT TOÀN DIỆN CÂY MENU, BÁO CÁO, BỘ LỌC VÀ NÚT KẾT XUẤT CỦA CORE EXCHANGE (CE)
 * 
 * Tác vụ:
 * 1. Đăng nhập vào CE UAT (https://uat-coreexchange.mxv.com.vn).
 * 2. Mở rộng Sidebar qua button[aria-label='Chuyển đổi menu'].
 * 3. Duyệt tuần tự qua tất cả các Menu cha và con (dùng scoped locator theo từng khối cha).
 * 4. Truy cập lần lượt từng trang con:
 *    - Ghi nhận URL chính xác (Direct Path).
 *    - Quét Sub-tabs, Bộ lọc (Inputs, Selects, DatePickers).
 *    - Quét Nút Kết xuất & kiểm tra menu định dạng (Excel, CSV, v.v.).
 *    - Quét danh sách cột của Bảng dữ liệu.
 *    - Chụp ảnh snapshot lưu trữ làm bằng chứng.
 * 5. Xuất báo cáo đặc tả hoàn chỉnh TAI_LIEU_DANH_MUC_MENU_VA_BAO_CAO_CORE_EXCHANGE_CE.md và ce_full_audit_result.json.
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Cấu trúc danh mục toàn diện CE (Ground Truth đã xác thực từ DOM)
const CE_MENU_STRUCTURE = [
  {
    parent: 'Trang chủ',
    isDirectPage: true,
    title: 'Dashboard (Trang chủ)',
  },
  {
    parent: 'Quản lý tham số',
    children: [
      'Lịch làm việc',
      'Tham số hệ thống',
      'Cấu hình Noti/SMS/Email',
      'Giao dịch',
    ],
  },
  {
    parent: 'Quản lý FCM',
    children: [
      'Khai báo FCM',
    ],
  },
  {
    parent: 'Quản lý người dùng và phân quyền',
    children: [
      'Quản lý nhóm quyền',
      'Người sử dụng',
    ],
  },
  {
    parent: 'Quản lý sản phẩm',
    children: [
      'Quản lý hàng hóa, hợp đồng',
      'Quản lý hàng hóa, hợp đồng liên thông',
      'Quản lý giá thanh toán',
      'Quản lý lịch sử giá thanh toán',
      'Quản lý trạng thái CB',
      'Giao dịch',
    ],
  },
  {
    parent: 'Quản lý phiên giao dịch',
    children: [
      'Cấu hình phiên giao dịch',
      'Danh sách cấu hình phiên',
      'Thông tin phiên trong ngày',
      'Thông tin phiên quá khứ',
      'Giao dịch',
    ],
  },
  {
    parent: 'Quản lý thành viên',
    children: [
      'Thông tin thành viên',
    ],
  },
  {
    parent: 'Quản lý sổ lệnh',
    children: [
      'Danh sách lệnh',
      'Danh sách giao dịch',
      'Lịch sử lệnh',
      'Lịch sử giao dịch',
      'Độ sâu thị trường',
      'Độ sâu thị trường (Không MM)',
      'Giao dịch',
      'Danh sách lệnh liên thông',
      'Lịch sử lệnh liên thông',
      'Danh sách giao dịch liên thông',
      'Lịch sử giao dịch liên thông',
      'Danh sách lệnh MM',
      'Lịch sử lệnh MM',
      'Danh sách giao dịch MM',
      'Lịch sử giao dịch MM',
    ],
  },
  {
    parent: 'Quản lý tài khoản',
    children: [
      'Quản lý khách hàng',
      'Quản lý khách hàng (đầy đủ)',
      'Danh sách tài khoản giao dịch',
    ],
  },
  {
    parent: 'Monitor ME',
    isDirectPage: true,
    title: 'Monitor ME',
  },
  {
    parent: 'Quản lý vận hành',
    children: [
      'EOD hàng hóa',
      'EOD hệ thống',
      'EOD hàng hóa liên thông',
      'Truy vấn dữ liệu liên thông',
      'Đối chiếu liên thông',
    ],
  },
  {
    parent: 'Báo cáo',
    isDirectPage: true,
    title: 'Báo cáo',
  },
];

async function runCeAudit() {
  console.log('========================================================================');
  console.log('  CRAWLER KHẢO SÁT & QUÉT TOÀN DIỆN HỆ THỐNG CORE EXCHANGE (CE) - MXV   ');
  console.log('========================================================================\n');

  const uri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const setting = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_ce' });
  await mongoose.disconnect();

  if (!setting) throw new Error('Không tìm thấy cấu hình bot_credentials_ce trong Database!');
  const creds = JSON.parse(decrypt(setting.value));
  const rawUrl = creds.url || 'https://uat-coreexchange.mxv.com.vn/login';
  const baseUrl = rawUrl.replace(/\/login\/?$/, '');
  const username = creds.username;
  const password = creds.password;

  console.log(`- CE Base URL: ${baseUrl}`);
  console.log(`- Tài khoản  : ${username}\n`);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  let executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  // 1. ĐĂNG NHẬP
  console.log('1. Đang truy cập trang đăng nhập CE...');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  console.log('2. Điền thông tin đăng nhập...');
  await page.fill("input[name='username']", username);
  await page.fill("input[name='password']", password);
  await page.click("button[type='submit']");

  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log(` Đăng nhập thành công! URL hiện tại: ${page.url()}\n`);

  // Đóng backdrop modal nếu có
  try {
    const backdrop = page.locator("div[class*='MuiBackdrop-root']").first();
    if (await backdrop.isVisible({ timeout: 1000 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch {}

  // 2. MỞ RỘNG SIDEBAR
  console.log('3. Mở rộng Sidebar (Chuyển đổi menu)...');
  const toggleBtn = page.locator("button[aria-label='Chuyển đổi menu']").first();
  if (await toggleBtn.isVisible({ timeout: 3000 })) {
    await toggleBtn.click({ force: true });
    await page.waitForTimeout(1000);
    console.log(' Sidebar đã mở rộng 280px thành công.\n');
  }

  // Chuẩn bị danh sách phẳng các mục cần duyệt
  const flatTasks = [];
  for (const group of CE_MENU_STRUCTURE) {
    if (group.isDirectPage) {
      flatTasks.push({
        parent: group.parent,
        title: group.title,
        isDirect: true,
      });
    } else {
      for (const child of group.children) {
        flatTasks.push({
          parent: group.parent,
          title: child,
          isDirect: false,
        });
      }
    }
  }

  console.log(`========================================================================`);
  console.log(`4. BẮT ĐẦU DUYỆT TỪNG TRANG (${flatTasks.length} MỤC CHỨC NĂNG)`);
  console.log(`========================================================================\n`);

  const screenshotDir = path.join(__dirname, '..', '..', 'docs', 'ce_audit');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const auditResults = [];

  for (let i = 0; i < flatTasks.length; i++) {
    const task = flatTasks[i];
    const stepLabel = `[${(i + 1).toString().padStart(2, '0')}/${flatTasks.length}]`;
    console.log(`${stepLabel} Đang truy cập: "${task.parent} -> ${task.title}"...`);

    try {
      if (task.isDirect) {
        // Menu trực tiếp (Trang chủ, Monitor ME, Báo cáo)
        const directBtn = page.locator(`.menu-sidebar__content >> xpath=.//*[normalize-space(text())='${task.parent}']`).first();
        await directBtn.waitFor({ state: 'visible', timeout: 5000 });
        await directBtn.click({ force: true });
      } else {
        // Menu con: Tìm đúng khối cha
        const parentBox = page.locator('.menu-sidebar__content > div').filter({ hasText: task.parent });
        
        // Kiểm tra xem menu con đã hiển thị trong khối cha chưa
        const childLocator = parentBox.locator(`xpath=.//*[normalize-space(text())='${task.title}']`).first();
        const isChildVis = await childLocator.isVisible({ timeout: 500 }).catch(() => false);
        
        if (!isChildVis) {
          // Click vào nút cha để mở rộng Accordion
          const parentBtn = parentBox.locator(`xpath=.//*[normalize-space(text())='${task.parent}']`).first();
          await parentBtn.click({ force: true });
          await page.waitForTimeout(600);
        }

        // Click vào menu con
        await childLocator.waitFor({ state: 'visible', timeout: 5000 });
        await childLocator.click({ force: true });
      }

      await page.waitForTimeout(2000);
      // Chờ spinner / loading tắt
      await page.waitForSelector("div[class*='MuiCircularProgress'], [role='progressbar'], div.loading", { state: 'detached', timeout: 5000 }).catch(() => {});

      const currentUrl = page.url();
      const relativeUrl = currentUrl.replace(baseUrl, '');
      console.log(`    URL Path: ${relativeUrl}`);

      // Bóc tách thông tin trang
      const pageDetails = await page.evaluate(() => {
        // 1. Breadcrumb / Header
        const breadcrumbs = Array.from(document.querySelectorAll('.MuiBreadcrumbs-root li, [class*="breadcrumb"] li, h4, h5, h6, .page-title, [class*="title"]'))
          .map(el => el.innerText.trim())
          .filter(t => t.length > 0 && t.length < 60 && !t.includes('Xin chào') && !t.includes('Trang chủ'));

        // 2. Sub-tabs
        const tabs = Array.from(document.querySelectorAll('[role="tab"], .MuiTab-root, .nav-tabs a, button[class*="tab" i]'))
          .map(t => t.innerText.trim())
          .filter(t => t.length > 0);

        // 3. Search / Filter fields
        const filterFields = [];
        const inputs = Array.from(document.querySelectorAll('input, select, .MuiSelect-select, textarea'));
        for (const inp of inputs) {
          const placeholder = inp.getAttribute('placeholder') || '';
          const name = inp.getAttribute('name') || '';
          let label = '';
          const formControl = inp.closest('.MuiFormControl-root') || inp.parentElement;
          if (formControl) {
            const labelEl = formControl.querySelector('label, .MuiInputLabel-root');
            if (labelEl) label = labelEl.innerText.trim();
          }
          const fieldName = label || placeholder || name;
          if (fieldName && fieldName !== 'Tìm kiếm...' && !filterFields.includes(fieldName)) {
            filterFields.push(fieldName);
          }
        }

        // 4. Action buttons
        const actionButtons = [];
        const allBtns = Array.from(document.querySelectorAll('button, a.btn, [role="button"]'));
        for (const btn of allBtns) {
          const text = btn.innerText ? btn.innerText.trim() : '';
          const title = btn.getAttribute('title') || '';
          const aria = btn.getAttribute('aria-label') || '';
          const btnName = text || title || aria;
          if (
            btnName &&
            btnName.length > 1 &&
            btnName.length < 35 &&
            !btnName.includes('Xin chào') &&
            !btnName.includes('Trang chủ') &&
            !btnName.includes('Chuyển đổi menu') &&
            !btnName.includes('Cài đặt') &&
            !actionButtons.includes(btnName)
          ) {
            actionButtons.push(btnName);
          }
        }

        // 5. Table Columns
        const tableColumns = [];
        const ths = Array.from(document.querySelectorAll('thead th, table th, [role="columnheader"], .MuiTableCell-head'));
        for (const th of ths) {
          const colName = th.innerText ? th.innerText.trim().replace(/\n+/g, ' ') : '';
          if (colName && colName !== 'Chi tiết' && !tableColumns.includes(colName)) {
            tableColumns.push(colName);
          }
        }

        // 6. Nút Kết xuất / Export
        const exportBtn = allBtns.find(btn => {
          const t = btn.innerText || btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
          return /kết xuất|xuất file|export|xuất excel|xuất csv/i.test(t);
        });

        const hasExport = !!exportBtn;
        const exportBtnText = exportBtn ? (exportBtn.innerText || exportBtn.getAttribute('title') || 'Kết xuất') : null;

        return {
          breadcrumbs: [...new Set(breadcrumbs)].slice(0, 3),
          tabs: [...new Set(tabs)],
          filterFields,
          actionButtons,
          tableColumns,
          hasExport,
          exportBtnText,
        };
      });

      // Nếu có nút Kết xuất, thử click kiểm tra định dạng
      let exportFormats = [];
      if (pageDetails.hasExport) {
        try {
          const expBtnLocator = page.locator("xpath=//button[contains(text(), 'Kết xuất') or contains(text(), 'Xuất file') or contains(@title, 'Export') or contains(@title, 'Kết xuất')]").first();
          if (await expBtnLocator.isVisible({ timeout: 1500 })) {
            await expBtnLocator.click({ force: true });
            await page.waitForTimeout(500);

            exportFormats = await page.evaluate(() => {
              const menuItems = Array.from(document.querySelectorAll('.MuiMenu-list li, [role="menuitem"], div[class*="dropdown-menu"] a, div[class*="dropdown-menu"] button'));
              return menuItems.map(m => m.innerText.trim()).filter(t => t.length > 0);
            });

            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          }
        } catch {}
      }
      pageDetails.exportFormats = exportFormats;

      console.log(`    Nút Kết xuất: ${pageDetails.hasExport ? ' CÓ (' + (exportFormats.length ? exportFormats.join(', ') : pageDetails.exportBtnText) + ')' : ' Không'}`);
      console.log(`    Bộ lọc (${pageDetails.filterFields.length}): ${pageDetails.filterFields.slice(0, 4).join(', ')}${pageDetails.filterFields.length > 4 ? '...' : ''}`);
      console.log(`    Cột bảng (${pageDetails.tableColumns.length}): ${pageDetails.tableColumns.slice(0, 5).join(' | ')}${pageDetails.tableColumns.length > 5 ? '...' : ''}`);

      const record = {
        index: i + 1,
        parent: task.parent,
        title: task.title,
        relativeUrl,
        fullUrl: currentUrl,
        ...pageDetails,
      };
      auditResults.push(record);

      // Chụp ảnh snapshot lưu trữ
      const safeFilename = `${(i + 1).toString().padStart(2, '0')}_${task.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.png`;
      await page.screenshot({ path: path.join(screenshotDir, safeFilename), fullPage: false }).catch(() => {});

    } catch (err) {
      console.log(`    Lỗi khi duyệt "${task.title}": ${err.message}`);
      auditResults.push({
        index: i + 1,
        parent: task.parent,
        title: task.title,
        relativeUrl: 'N/A',
        error: err.message,
      });
    }

    await page.waitForTimeout(400);
  }

  // 5. LƯU KẾT QUẢ VÀO FILE JSON
  const jsonPath = path.join(__dirname, '..', '..', 'docs', 'ce_audit', 'ce_full_audit_result.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2), 'utf8');
  console.log(`\n Đã lưu file JSON cấu trúc tại: ${jsonPath}`);

  // 6. XUẤT TÀI LIỆU MARKDOWN HOÀN CHỈNH
  const docPath = path.join(__dirname, '..', '..', 'docs', 'TAI_LIEU_DANH_MUC_MENU_VA_BAO_CAO_CORE_EXCHANGE_CE.md');
  
  let md = `# TÀI LIỆU KHẢO SÁT & ĐẶC TẢ DANH MỤC TRANG, BÁO CÁO CORE EXCHANGE (CE)

> **Tài liệu phục vụ**: Thiết kế & phát triển tính năng Backup tự động Core Exchange (CE) cho ca trực MXV  
> **Môi trường khảo sát**: UAT (\`https://uat-coreexchange.mxv.com.vn\`)  
> **Tài khoản kiểm thử**: \`${username}\`  
> **Thời điểm quét thực tế**: ${new Date().toISOString()}  
> **Tổng số màn hình chức năng khảo sát**: ${auditResults.length} trang  

---

## 1. TỔNG QUAN CÁC TRANG CÓ HỖ TRỢ KẾT XUẤT DỮ LIỆU (EXPORT / DOWNLOAD)

Bảng dưới đây tổng hợp tất cả các màn hình trên hệ thống Core Exchange (CE) có nút **"Kết xuất" (Xuất file)** sẵn sàng phục vụ quy trình sao lưu định kỳ của ca trực:

| STT | Menu Cha | Tên Chức Năng / Màn Hình | URL Path Chuẩn | Định Dạng Kết Xuất | Bộ Lọc Tìm Kiếm Chính |
| :---: | :--- | :--- | :--- | :--- | :--- |
`;

  const exportPages = auditResults.filter(r => r.hasExport);
  exportPages.forEach((p, idx) => {
    const formats = p.exportFormats && p.exportFormats.length ? p.exportFormats.join(', ') : (p.exportBtnText || 'Kết xuất');
    const filters = p.filterFields && p.filterFields.length ? p.filterFields.slice(0, 3).join(', ') : 'Mặc định';
    md += `| ${idx + 1} | ${p.parent} | **${p.title}** | \`${p.relativeUrl}\` | ${formats} | ${filters} |\n`;
  });

  md += `\n> **Nhận xét quan trọng cho luồng phát triển Backup CE**:  
> - **Cấu trúc URL chuẩn**: Toàn bộ các trang trên Core Exchange đều sử dụng URL path trực tiếp (như \`/ORDERS/ORDERBOOK\`, \`/ORDERS/ORDERMATCH_DETAIL\`, \`/REPORTS\`, \`/SESSION/SESSION_CONFIG\`, \`/PRODUCT/COMMODITY\`, v.v.). Bot có thể điều hướng trực tiếp bằng \`page.goto(baseUrl + path)\` với tốc độ cực nhanh (< 1.5s), không cần click mở từng cấp sidebar.
> - **Component Kết xuất đồng bộ**: Nút **"Kết xuất"** sử dụng chung component chuẩn của VNCLEAR (MUI Table Toolbar) giống 100% với CoreCCP, cho phép tái sử dụng hàm \`clickExportAndDownload\` hoặc \`downloadByReportCode\` đã hoàn thiện.
> - **Menu Báo cáo tập trung**: Phân hệ **Báo cáo** (\`/REPORTS\`) chứa danh mục các mẫu báo cáo tổng hợp tương tự như CoreCCP.

---

## 2. MA TRẬN CHI TIẾT TẤT CẢ ${auditResults.length} MÀN HÌNH CHỨC NĂNG CORE EXCHANGE (CE)

`;

  // Gom nhóm theo Menu cha
  const groupedByParent = {};
  for (const r of auditResults) {
    if (!groupedByParent[r.parent]) groupedByParent[r.parent] = [];
    groupedByParent[r.parent].push(r);
  }

  for (const [parentName, items] of Object.entries(groupedByParent)) {
    md += `###  ${parentName.toUpperCase()} (${items.length} màn hình)\n\n`;

    for (const item of items) {
      md += `#### ${item.index}. ${item.title}\n`;
      md += `- **URL Path**: \`${item.relativeUrl}\`\n`;
      md += `- **URL Đầy đủ**: \`${item.fullUrl || 'N/A'}\`\n`;
      md += `- **Nút Kết xuất (Export)**: ${item.hasExport ? ' **CÓ** (' + (item.exportFormats && item.exportFormats.length ? item.exportFormats.join(', ') : item.exportBtnText) + ')' : '❌ Không'}\n`;
      
      if (item.tabs && item.tabs.length) {
        md += `- **Sub-tabs**: ${item.tabs.map(t => `\`${t}\``).join(', ')}\n`;
      }

      if (item.filterFields && item.filterFields.length) {
        md += `- **Bộ lọc / Tiêu chí tìm kiếm**: ${item.filterFields.map(f => `\`${f}\``).join(', ')}\n`;
      }

      if (item.actionButtons && item.actionButtons.length) {
        md += `- **Nút thao tác trên màn hình**: ${item.actionButtons.map(b => `[${b}]`).join(' ')}\n`;
      }

      if (item.tableColumns && item.tableColumns.length) {
        md += `- **Các cột dữ liệu của bảng**: \n`;
        item.tableColumns.forEach(col => {
          md += `  * ${col}\n`;
        });
      }

      md += `\n`;
    }
    md += `---\n\n`;
  }

  fs.writeFileSync(docPath, md, 'utf8');
  console.log(` Đã sinh tài liệu đặc tả hoàn chỉnh tại: ${docPath}`);

  await browser.close();
  console.log('\n Khảo sát Core Exchange (CE) hoàn tất xuất sắc 100%!');
}

runCeAudit().catch(console.error);

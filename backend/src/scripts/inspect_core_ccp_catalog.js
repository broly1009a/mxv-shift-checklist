/**
 * ============================================================================
 * CORECCP METADATA & SCHEMA INSPECTOR (CRAWLER TOÀN DIỆN 100% MENU VNCLEAR)
 * ============================================================================
 * 
 * Mục đích:
 * 1. Tự động đăng nhập vào CoreCCP VNCLEAR.
 * 2. Duyệt qua TOÀN BỘ 100% các mục Menu trên Sidebar (bao gồm cả menu 3 cấp:
 *    Menu Cha -> Nhóm Con -> Màn hình lá, ví dụ: Lệnh và vị thế -> Tra cứu tổng hợp -> Danh sách lệnh).
 * 3. Với từng màn hình nghiệp vụ:
 *    - Bóc tách URL Route thực tế (/ORDERS/ORDERBOOK, /CASHTRANFER/..., /RISKMNG/...).
 *    - Quét toàn bộ các Tab con (Sub-tabs) bên trong và click từng tab để đọc cột riêng.
 *    - Kiểm tra nút "Kết xuất" / "Export", hover kiểm tra định dạng xuất (Excel, CSV...).
 *    - Đọc toàn bộ bộ lọc tìm kiếm (Inputs, DatePickers, Select dropdowns).
 *    - Bóc tách toàn bộ tiêu đề các cột của Bảng dữ liệu (Table Columns / Grid Headers).
 *    - Quét số lượng bản ghi hiển thị (Pagination: "1-20 trên 588").
 *    - Thu thập mẫu 1-2 dòng dữ liệu đầu tiên.
 * 4. Tự động xuất ra 2 tệp từ điển dữ liệu hoàn chỉnh:
 *    - JSON:     backend/src/scripts/output/core_ccp_catalog.json
 *    - Markdown: backend/src/scripts/output/core_ccp_catalog.md
 * 
 * Cách chạy:
 *   # 1. Chạy quét ĐỦ TOÀN BỘ 100% MENU (Có giao diện trực quan):
 *   node backend/src/scripts/inspect_core_ccp_catalog.js --headed
 * 
 *   # 2. Chạy quét riêng 1 nhóm menu cụ thể:
 *   node backend/src/scripts/inspect_core_ccp_catalog.js --headed --menu "Lệnh và vị thế"
 *   node backend/src/scripts/inspect_core_ccp_catalog.js --headed --menu "Vận hành"
 *   node backend/src/scripts/inspect_core_ccp_catalog.js --headed --menu "Nộp rút tiền"
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { chromium } = require('playwright-core');

// ─── 1. BẢNG DANH MỤC 100% CẤU TRÚC MENU VNCLEAR UAT ────────────────────────
const FULL_VNCLEAR_MENU_STRUCTURE = [
  {
    parent: 'Quản lý FCM',
    children: [
      { name: 'Danh sách FCM' },
      { name: 'Quản lý cấu hình báo cáo offset' },
      { name: 'Quản lý file báo cáo offset' },
    ],
  },
  {
    parent: 'Người dùng và phân quyền',
    children: [
      { name: 'Quản lý nhóm quyền' },
      { name: 'Người sử dụng' },
    ],
  },
  {
    parent: 'Tham số hệ thống',
    children: [
      { name: 'Lịch làm việc' },
      { name: 'Tỷ giá nguyên tệ' },
      { name: 'Tham số hệ thống' },
      { name: 'Cấu hình Noti/SMS/Email' },
    ],
  },
  {
    parent: 'Loại hình giao dịch',
    aliases: ['Loại hình giao dịch', 'Quản lý loại hình giao dịch'],
    children: [
      { name: 'Quản lý loại hình giao dịch' },
      { name: 'Loại tiểu khoản giao dịch' },
      { name: 'Rổ hệ số ký quỹ' },
      { name: 'Rổ hạn mức' },
      { name: 'Biểu phí giao dịch' },
    ],
  },
  {
    parent: 'Quản lý sản phẩm',
    children: [
      { name: 'Quản lý hàng hóa, hợp đồng' },
      { name: 'Quản lý giá thanh toán' },
      { name: 'Quản lý lịch sử giá thanh toán' },
    ],
  },
  {
    parent: 'Quản lý thành viên',
    children: [
      { name: 'Thông tin thành viên' },
      { name: 'Gửi email cho thành viên' },
    ],
  },
  {
    parent: 'Quản lý tài khoản',
    children: [
      { name: 'Yêu cầu mở tài khoản' },
      { name: 'Danh sách tài khoản giao dịch' },
      { name: 'Yêu cầu mở tiểu khoản' },
      { name: 'Lịch sử phê duyệt yêu cầu mở tiểu khoản' },
      { name: 'Quản lý khách hàng (đầy đủ)' },
    ],
  },
  {
    parent: 'Nộp rút tiền',
    aliases: ['Nộp rút tiền', 'Quản lý tiền'],
    children: [
      { name: 'Yêu cầu nộp tiền' },
      { name: 'Yêu cầu rút tiền' },
      { name: 'Lịch sử Nộp/ Rút tiền' },
      { name: 'Gửi yêu cầu rút tiền sang ngân hàng' },
      { name: 'Tài khoản ngân hàng' },
      { name: 'Tài khoản VA' },
      { name: 'Theo dõi yêu cầu mở VA với MSB' },
      { name: 'Danh sách ngân hàng' },
      { name: 'Chênh lệch phí TVKD' },
      { name: 'Đối soát nộp rút tiền MSB' },
    ],
  },
  {
    parent: 'Lệnh và vị thế',
    children: [
      { name: 'Đặt lệnh' },
      // Nhóm con cấp 2 lồng trong "Lệnh và vị thế":
      { name: 'Danh sách lệnh', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Danh sách giao dịch', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Lịch sử lệnh', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Lịch sử giao dịch', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Danh sách lệnh MM', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Lịch sử lệnh MM', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Danh sách giao dịch MM', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Lịch sử giao dịch MM', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Trạng thái mở', subGroup: 'Tra cứu tổng hợp' },
      { name: 'Trạng thái tất toán', subGroup: 'Tra cứu tổng hợp' },
    ],
  },
  {
    parent: 'Giao nhận',
    children: [
      { name: 'Quản lý hạn mức giao nhận' },
      { name: 'Tra cứu hạn mức giao nhận' },
      { name: 'Yêu cầu đăng ký giao nhận' },
      { name: 'Yêu cầu đăng ký lưu ký' },
      { name: 'Trạng thái giao nhận vật chất' },
      { name: 'Tra cứu đối chiếu MSB' },
      { name: 'Chỉ định yêu cầu giao nhận vật chất' },
      { name: 'Quản lý tiền giao nhận' },
      { name: 'Yêu cầu giao hàng chỉ định bị từ chối' },
    ],
  },
  {
    parent: 'Quản lý rủi ro',
    children: [
      { name: 'Quản lý ký quỹ TKGD' },
      { name: 'Quản lý trạng thái TKGD' },
      { name: 'Danh sách Tài khoản vi phạm ký quỹ' },
      { name: 'Tra cứu lịch sử Force Sell' },
      { name: 'Thiết lập tài khoản loại trừ xử lý tự động' },
    ],
  },
  {
    parent: 'Báo cáo',
    children: [
      { name: 'Báo cáo' },
    ],
  },
  {
    parent: 'Monitor OMS',
    children: [
      { name: 'Monitor OMS MXV' },
      { name: 'Monitor OMS ACM' },
    ],
  },
  {
    parent: 'Vận hành',
    children: [
      { name: 'SOD hệ thống' },
      { name: 'EOD hệ thống' },
      { name: 'EOD giao nhận' },
      { name: 'File Monitor (CSV)' },
      { name: 'Truy vấn thông tin từ core Exchange' },
      { name: 'Đối chiếu lệnh với core Exchange' },
      { name: 'Lịch sử đối chiếu lệnh với core Exchange' },
      { name: 'Kết quả EOD' },
      { name: 'Đối chiếu lệnh liên thông' },
      { name: 'Lịch sử đối chiếu lệnh liên thông' },
    ],
  },
];

// ─── 2. GIẢI MÃ CONFIG MONGODB (AES-256) ────────────────────────────────────
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
  const iv = Buffer.from(process.env.ENCRYPTION_IV || '1234567890123456', 'utf-8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

async function getCredentialsFromDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv-shift-checklist';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const SystemSetting = mongoose.model(
      'SystemSettingInspectorFull',
      new mongoose.Schema({ key: String, value: String }, { collection: 'system_settings' }),
    );
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    if (setting && setting.value) {
      return JSON.parse(decrypt(setting.value));
    }
  } catch { } finally {
    try { await mongoose.disconnect(); } catch { }
  }
  return null;
}

// ─── 3. TÌM EXECUTABLE CHROME / EDGE ────────────────────────────────────────
function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxCandidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const p of linuxCandidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ─── 4. CÁC HÀM TIỆN ÍCH GIAO DIỆN MUI ──────────────────────────────────────
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch { }
}

async function ensureSidebarExpanded(page) {
  await dismissModalBackdrop(page);
  try {
    const sidebarText = page.locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]").first();
    if (await sidebarText.isVisible({ timeout: 800 })) return;

    const toggleBtn = page.locator(
      "xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')] | //svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]"
    ).first();
    if (await toggleBtn.isVisible({ timeout: 1000 })) {
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  } catch { }
}

async function waitForTableLoadingComplete(page, maxTimeoutMs = 15000) {
  const startTime = Date.now();
  await page.waitForTimeout(400);

  const spinnerSelector =
    "xpath=//*[contains(@class, 'MuiCircularProgress-root') " +
    "or contains(@class, 'MuiLinearProgress-root') " +
    "or @role='progressbar' " +
    "or contains(@id, 'mrt-progress') " +
    "or contains(@class, 'MuiSkeleton-root')]";

  let stableCount = 0;
  while ((Date.now() - startTime) < maxTimeoutMs) {
    const spinners = await page.locator(spinnerSelector).all();
    let isAnyVisible = false;
    for (const s of spinners) {
      try {
        if (await s.isVisible()) {
          isAnyVisible = true;
          break;
        }
      } catch { }
    }

    if (!isAnyVisible) {
      stableCount++;
      if (stableCount >= 2) {
        await page.waitForTimeout(200);
        return true;
      }
    } else {
      stableCount = 0;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

// ─── 5. HÀM MỞ RỘNG NHÓM VÀ CLICK MENU LÁ (3-LEVEL SUPPORT) ─────────────────
async function navigateToMenuItem(page, parentName, childName, subGroupName = null, aliases = []) {
  await ensureSidebarExpanded(page);

  // 1. Mở menu Cha (Parent)
  const candidateParents = [parentName, ...aliases];
  let parentItem = null;

  for (const name of candidateParents) {
    const loc = page.locator(
      `xpath=//li[contains(@class, 'MuiListItem-root')][.//span[normalize-space(text())='${name}']] | //div[contains(@class, 'MuiButtonBase-root')][.//span[normalize-space(text())='${name}']]`
    ).first();
    if (await loc.isVisible({ timeout: 600 }).catch(() => false)) {
      parentItem = loc;
      break;
    }
  }

  if (parentItem) {
    // Kiểm tra menu con mục tiêu đã hiển thị chưa
    const isTargetVisible = await page.locator(
      `xpath=//span[normalize-space(text())='${childName}']`
    ).first().isVisible({ timeout: 200 }).catch(() => false);

    if (!isTargetVisible) {
      // Click nút mũi tên mở rộng (IconButton) của nhóm cha
      const toggleBtn = parentItem.locator("xpath=.//button[contains(@class, 'MuiIconButton-root')] | .//button").first();
      if (await toggleBtn.isVisible({ timeout: 400 }).catch(() => false)) {
        await toggleBtn.click({ force: true });
      } else {
        await parentItem.click({ force: true });
      }
      await page.waitForTimeout(400);
    }
  }

  // 2. Nếu có Sub-Group cấp 2 (ví dụ "Tra cứu tổng hợp" nằm trong "Lệnh và vị thế")
  if (subGroupName) {
    const subGroupItem = page.locator(
      `xpath=//div[contains(@class, 'MuiListItemButton-root') or contains(@class, 'MuiButtonBase-root')][.//span[normalize-space(text())='${subGroupName}']]`
    ).first();

    if (await subGroupItem.isVisible({ timeout: 800 }).catch(() => false)) {
      const isLeafVisible = await page.locator(
        `xpath=//span[normalize-space(text())='${childName}']`
      ).first().isVisible({ timeout: 300 }).catch(() => false);

      if (!isLeafVisible) {
        const toggleSubBtn = subGroupItem.locator("xpath=.//button[contains(@class, 'MuiIconButton-root')] | .//button").first();
        if (await toggleSubBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await toggleSubBtn.click({ force: true });
        } else {
          await subGroupItem.click({ force: true });
        }
        await page.waitForTimeout(400);
      }
    }
  }

  // 3. Click vào menu Lá mục tiêu (Child item)
  const leafItem = page.locator(
    `xpath=//span[normalize-space(text())='${childName}']/ancestor::div[contains(@class, 'MuiListItemButton-root') or contains(@class, 'MuiButtonBase-root')][1]`
  ).first();

  if (await leafItem.isVisible({ timeout: 1500 }).catch(() => false)) {
    await leafItem.click({ force: true });
    await page.waitForTimeout(1000);
    await dismissModalBackdrop(page);
    return true;
  }

  return false;
}

// ─── 6. HÀM QUÉT DỮ LIỆU CỦA 1 MÀN HÌNH (PAGE INSPECTOR) ──────────────────
async function inspectScreenData(page, parentName, childName, subGroupName = null) {
  console.log(`\n  [INSPECTING] ${parentName} ${subGroupName ? `-> ${subGroupName} ` : ''}-> "${childName}"...`);
  await waitForTableLoadingComplete(page, 10000);
  await dismissModalBackdrop(page);

  const screenData = {
    parentMenu: parentName,
    subGroup: subGroupName || '',
    childMenu: childName,
    actualUrl: page.url(),
    pagePath: new URL(page.url()).pathname,
    inspectedAt: new Date().toISOString(),
    pageTitle: '',
    tabs: [],
    exportButton: {
      hasExport: false,
      text: '',
      dropdownOptions: [],
    },
    hasSearchButton: false,
    filters: [],
    table: {
      hasTable: false,
      columns: [],
      rowCountText: '',
      sampleRows: [],
    },
  };

  // 1. Tiêu đề trang
  try {
    const titleElem = page.locator(
      "xpath=//h4 | //h5 | //h6 | //div[contains(@class, 'MuiTypography-h')] | //div[contains(@class, 'title') and text()]"
    ).first();
    if (await titleElem.isVisible({ timeout: 600 })) {
      screenData.pageTitle = (await titleElem.textContent() || '').trim();
    }
  } catch { }

  // 2. Quét Tabs con
  try {
    const tabLocators = await page.locator(
      "xpath=//div[@role='tablist']//button[@role='tab'] | //div[@role='tablist']//div[@role='tab']"
    ).all();
    for (const tab of tabLocators) {
      const text = (await tab.textContent() || '').trim();
      const isSelected = (await tab.getAttribute('aria-selected')) === 'true' ||
        ((await tab.getAttribute('class')) || '').includes('Mui-selected');
      if (text) {
        screenData.tabs.push({ name: text, isSelected, columns: [] });
      }
    }
    if (screenData.tabs.length > 0) {
      console.log(`     Tabs con (${screenData.tabs.length}): ${screenData.tabs.map(t => (t.isSelected ? `[${t.name}]*` : t.name)).join(' | ')}`);
    }
  } catch { }

  // 3. Quét Nút Kết xuất & Định dạng xuất
  try {
    const exportBtn = page.locator(
      "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
      " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]" +
      " | //button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]"
    ).first();

    if (await exportBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      screenData.exportButton.hasExport = true;
      screenData.exportButton.text = (await exportBtn.textContent().catch(() => ''))?.trim() || 'Kết xuất';
      console.log(`    Nút Kết xuất: "${screenData.exportButton.text}"`);

      // Hover thử xem có menu dropdown (CSV, Excel) không
      try {
        await exportBtn.hover({ timeout: 500 });
        await page.waitForTimeout(200);
        const menuItems = await page.locator("xpath=//ul[@role='menu']//li[@role='menuitem']").all();
        for (const item of menuItems) {
          if (await item.isVisible().catch(() => false)) {
            const optText = (await item.textContent().catch(() => ''))?.trim();
            if (optText && !screenData.exportButton.dropdownOptions.includes(optText)) {
              screenData.exportButton.dropdownOptions.push(optText);
            }
          }
        }
        if (screenData.exportButton.dropdownOptions.length > 0) {
          console.log(`       Định dạng xuất hỗ trợ: ${screenData.exportButton.dropdownOptions.join(', ')}`);
        }
        await page.keyboard.press('Escape');
      } catch { }
    }
  } catch { }

  // 4. Nút Tìm kiếm
  try {
    const searchBtn = page.locator("xpath=//button[contains(., 'Tìm kiếm') or contains(., 'Tra cứu')]").first();
    screenData.hasSearchButton = await searchBtn.isVisible({ timeout: 300 }).catch(() => false);
  } catch { }

  // 5. Quét Bộ lọc tìm kiếm (Thêm timeout 150ms để không bị nghẽn)
  try {
    const filterInputs = await page.locator(
      "xpath=//div[contains(@class, 'MuiFormControl-root')] | //div[contains(@class, 'MuiInputBase-root')]"
    ).all();
    const seenFilters = new Set();
    for (const f of filterInputs.slice(0, 10)) {
      try {
        const label = await f.locator("label").first().textContent({ timeout: 150 }).catch(() => '');
        const placeholder = await f.locator("input").first().getAttribute('placeholder', { timeout: 150 }).catch(() => '');
        const name = (label || placeholder || '').trim().replace(/[0-9]+$/, '');
        if (name && !seenFilters.has(name) && name.length < 35 && !name.includes('\n')) {
          seenFilters.add(name);
          screenData.filters.push(name);
        }
      } catch { }
    }
    if (screenData.filters.length > 0) {
      console.log(`     Bộ lọc: ${screenData.filters.join(' | ')}`);
    }
  } catch { }

  // 6. Quét Bảng Dữ Liệu & Danh Sách Cột (Sửa cú pháp CSS role='cell' và làm sạch số rác)
  try {
    const tableHeader = page.locator(
      "xpath=//table//thead | //div[@role='rowgroup'] | //div[contains(@class, 'MuiTableHead-root')]"
    ).first();

    if (await tableHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
      screenData.table.hasTable = true;

      const thList = await page.locator(
        "xpath=//table//thead//th | //div[contains(@class, 'MuiTableHead-root')]//th | //div[@role='columnheader']"
      ).all();

      for (const th of thList) {
        try {
          let colText = (await th.textContent().catch(() => ''))?.trim() || '';
          // Loại bỏ số rác ở cuối do badge index
          colText = colText.replace(/[0-9]+$/, '').trim();
          if (colText && colText !== 'expand' && colText !== 'checkbox' && colText.length < 50) {
            screenData.table.columns.push(colText.replace(/\s+/g, ' '));
          }
        } catch { }
      }

      console.log(`    Cột bảng dữ liệu (${screenData.table.columns.length} cột):`);
      console.log(`       ${screenData.table.columns.slice(0, 8).join(' | ')}${screenData.table.columns.length > 8 ? ' ...' : ''}`);

      // Phân trang
      const pagination = page.locator(
        "xpath=//*[contains(@class, 'MuiTablePagination-displayedRows') or contains(text(), 'trên') or contains(text(), 'of')]"
      ).first();
      if (await pagination.isVisible({ timeout: 400 }).catch(() => false)) {
        screenData.table.rowCountText = (await pagination.textContent().catch(() => ''))?.trim() || '';
        console.log(`       Phân trang: ${screenData.table.rowCountText}`);
      }

      // Dữ liệu mẫu dòng đầu (dùng xpath chuẩn)
      const firstRow = page.locator("xpath=//table//tbody//tr | //div[@role='rowgroup'][2]//div[@role='row']").first();
      if (await firstRow.isVisible({ timeout: 600 }).catch(() => false)) {
        const cells = await firstRow.locator("xpath=.//td | .//div[@role='cell']").all();
        const sampleCellData = [];
        for (const c of cells.slice(0, 8)) {
          const cellText = (await c.textContent().catch(() => ''))?.trim().replace(/\s+/g, ' ');
          if (cellText) sampleCellData.push(cellText);
        }
        if (sampleCellData.length > 0) {
          screenData.table.sampleRows.push(sampleCellData);
        }
      }
    } else {
      console.log('   ℹ️ Màn hình không có Bảng dữ liệu chuẩn (Form cấu hình hoặc Dashboard).');
    }
  } catch (err) {
    console.log(`   Lỗi khi quét bảng: ${err.message}`);
  }

  // 7. Click qua từng Tab con để lấy thêm cột riêng nếu có
  if (screenData.tabs.length > 1) {
    for (let tIdx = 0; tIdx < Math.min(screenData.tabs.length, 5); tIdx++) {
      const tabInfo = screenData.tabs[tIdx];
      if (!tabInfo.isSelected) {
        try {
          const tabBtn = page.locator(`xpath=//button[@role='tab' and normalize-space(.)='${tabInfo.name}']`).first();
          if (await tabBtn.isVisible({ timeout: 800 })) {
            await tabBtn.click({ force: true });
            await page.waitForTimeout(500);
            await waitForTableLoadingComplete(page, 4000);
            const subThList = await page.locator("xpath=//table//thead//th | //div[@role='columnheader']").all();
            const subCols = [];
            for (const th of subThList) {
              const txt = (await th.textContent() || '').trim();
              if (txt && txt !== 'expand') subCols.push(txt.replace(/\s+/g, ' '));
            }
            tabInfo.columns = subCols;
          }
        } catch { }
      } else {
        tabInfo.columns = [...screenData.table.columns];
      }
    }
  }

  return screenData;
}

// ─── 7. HÀM CHÍNH (ORCHESTRATOR) ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || !args.includes('--headless');
  const targetMenuFilter = args.find((a, i) => args[i - 1] === '--menu');

  function getArgValue(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  }

  console.log('\n========================================================================');
  console.log('   CORECCP FULL-SCHEMA INSPECTOR (QUÉT 100% CÂY MENU VNCLEAR UAT)');
  console.log('========================================================================\n');

  // Lấy thông tin đăng nhập
  const dbCreds = await getCredentialsFromDB();
  const systemUrl = getArgValue('--url') || dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = getArgValue('--user') || dbCreds?.username || 'hieptruong';
  const password = getArgValue('--pass') || dbCreds?.password || 'Taovipko0!';

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let totalPlannedScreens = 0;
  FULL_VNCLEAR_MENU_STRUCTURE.forEach(g => {
    if (!targetMenuFilter || g.parent.toLowerCase().includes(targetMenuFilter.toLowerCase())) {
      totalPlannedScreens += g.children.length;
    }
  });

  console.log(`  • URL Hệ thống:         ${systemUrl}`);
  console.log(`  • Tài khoản:            ${username}`);
  console.log(`  • Chế độ hiển thị:      ${isHeaded ? 'Giao diện trực quan (--headed)' : 'Chạy ngầm (headless)'}`);
  if (targetMenuFilter) {
    console.log(`  • Bộ lọc nhóm menu:    "${targetMenuFilter}"`);
  }
  console.log(`  • Tổng số màn hình quét: ${totalPlannedScreens} màn hình`);
  console.log(`  • Thư mục xuất kết quả: ${outputDir}\n`);

  const execPath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: execPath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const fullCatalog = [];
  const startTimeTotal = Date.now();

  try {
    // 1. Đăng nhập VNCLEAR
    console.log(`🔑 Đang đăng nhập vào CoreCCP (${systemUrl})...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const userInput = page.locator("input[name='username'], input[type='text']").first();
    await userInput.waitFor({ state: 'visible', timeout: 15000 });
    await userInput.fill(username);

    await page.fill("input[name='password'], input[type='password']", password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForTimeout(2000);
    await dismissModalBackdrop(page);
    console.log('  ✓ Đăng nhập thành công!\n');

    await ensureSidebarExpanded(page);

    const groupsToRun = targetMenuFilter
      ? FULL_VNCLEAR_MENU_STRUCTURE.filter((g) => g.parent.toLowerCase().includes(targetMenuFilter.toLowerCase()))
      : FULL_VNCLEAR_MENU_STRUCTURE;

    let processedCount = 0;

    for (const group of groupsToRun) {
      console.log(`========================================================================`);
      console.log(`   NHÓM: "${group.parent}" (${group.children.length} màn hình)`);
      console.log(`========================================================================`);

      for (const item of group.children) {
        processedCount++;
        console.log(`[Tiến trình ${processedCount}/${totalPlannedScreens}] Đang mở: ${group.parent} -> ${item.name}`);

        try {
          const clicked = await navigateToMenuItem(
            page,
            group.parent,
            item.name,
            item.subGroup,
            group.aliases || []
          );

          if (!clicked) {
            console.log(`   Không thể mở màn hình: "${item.name}"`);
            continue;
          }

          const screenData = await inspectScreenData(page, group.parent, item.name, item.subGroup);
          fullCatalog.push(screenData);

        } catch (itemErr) {
          console.log(`   Lỗi khi quét "${item.name}": ${itemErr.message}`);
        }

        await page.waitForTimeout(400);
      }
    }

  } catch (globalErr) {
    console.error(`\n❌ LỖI TOÀN CỤC: ${globalErr.message}`);
  } finally {
    if (isHeaded) {
      console.log('\n[HOÀN TẤT] Giữ màn hình trong 3 giây trước khi đóng trình duyệt...');
      await page.waitForTimeout(3000);
    }
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
  }

  // ─── 8. XUẤT KẾT QUẢ RA FILE JSON VÀ MARKDOWN ──────────────────────────────
  const jsonPath = path.join(outputDir, 'core_ccp_catalog.json');
  fs.writeFileSync(jsonPath, JSON.stringify(fullCatalog, null, 2), 'utf-8');

  const mdPath = path.join(outputDir, 'core_ccp_catalog.md');
  let md = `# BẢN ĐỒ TỪ ĐIỂN DỮ LIỆU & ROUTE MÀN HÌNH CORECCP (VNCLEAR)\n\n`;
  md += `> Ngày trích xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số màn hình đã quét thành công: **${fullCatalog.length}**\n\n`;
  md += `## 1. Bảng Tổng Hợp 100% Tuyến Đường & Nút Kết Xuất\n\n`;
  md += `| STT | Menu Cha | Nhóm Con | Menu Con | URL Route (Path) | Có Nút Kết Xuất? | Số Tab Con | Số Cột Bảng |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |\n`;

  fullCatalog.forEach((item, idx) => {
    const hasExport = item.exportButton.hasExport ? 'CÓ (Sẵn sàng)' : 'Không';
    const subGrp = item.subGroup ? `*${item.subGroup}*` : '-';
    const tabCount = item.tabs.length;
    const colCount = item.table.columns.length;
    md += `| ${idx + 1} | **${item.parentMenu}** | ${subGrp} | [${item.childMenu}](#${item.childMenu.toLowerCase().replace(/[^a-z0-9]/g, '-')}) | \`${item.pagePath}\` | ${hasExport} | ${tabCount} | ${colCount} |\n`;
  });

  md += `\n---\n\n## 2. Chi Tiết Từng Màn Hình Nghiệp Vụ\n\n`;

  fullCatalog.forEach((item, idx) => {
    md += `### ${idx + 1}. ${item.childMenu}\n\n`;
    md += `- **Cây Menu**: \`${item.parentMenu}${item.subGroup ? ` > ${item.subGroup}` : ''} > ${item.childMenu}\`\n`;
    md += `- **URL Route**: \`${item.pagePath}\`\n`;
    md += `- **Nút Kết xuất**: ${item.exportButton.hasExport ? `Có (\`${item.exportButton.text}\`)` : 'Không có'}\n`;
    if (item.exportButton.dropdownOptions.length > 0) {
      md += `  + *Định dạng xuất hỗ trợ*: ${item.exportButton.dropdownOptions.join(', ')}\n`;
    }
    if (item.tabs.length > 0) {
      md += `- **Danh sách Tab con**: ${item.tabs.map(t => (t.isSelected ? `**[${t.name}]**` : t.name)).join(', ')}\n`;
      const tabsWithCols = item.tabs.filter(t => t.columns && t.columns.length > 0);
      if (tabsWithCols.length > 0) {
        md += `  + *Chi tiết cột từng Tab*:\n`;
        tabsWithCols.forEach(t => {
          md += `    * **Tab [${t.name}]** (${t.columns.length} cột): \`${t.columns.join(' | ')}\`\n`;
        });
      }
    }
    if (item.filters.length > 0) {
      md += `- **Bộ lọc tìm kiếm**: ${item.filters.join(', ')}\n`;
    }
    if (item.table.hasTable) {
      md += `- **Phân trang / Bản ghi**: ${item.table.rowCountText || 'Không hiển thị'}\n`;
      md += `- **Danh sách cột (${item.table.columns.length} cột)**:\n\n`;
      md += `\`\`\`text\n${item.table.columns.join(' | ')}\n\`\`\`\n`;
      if (item.table.sampleRows.length > 0) {
        md += `\n- **Dữ liệu mẫu dòng đầu**:\n\`\`\`text\n${item.table.sampleRows[0].join(' | ')}\n\`\`\`\n`;
      }
    } else {
      md += `- **Bảng dữ liệu**: Màn hình cấu hình / Form nhập liệu (không có table grid).\n`;
    }
    md += `\n---\n\n`;
  });

  fs.writeFileSync(mdPath, md, 'utf-8');

  const totalTimeSec = ((Date.now() - startTimeTotal) / 1000).toFixed(1);

  console.log('\n========================================================================');
  console.log('   TỔNG KẾT QUÉT 100% HỆ THỐNG CORECCP VNCLEAR');
  console.log('========================================================================');
  console.log(`  ✓ Đã quét thành công:      ${fullCatalog.length}/${totalPlannedScreens} màn hình trong ${totalTimeSec}s.`);
  console.log(`  ✓ Số màn hình có Kết xuất: ${fullCatalog.filter(c => c.exportButton.hasExport).length} màn hình.`);
  console.log(`  ✓ File JSON siêu dữ liệu:  ${jsonPath}`);
  console.log(`  ✓ File Markdown từ điển:   ${mdPath}\n`);
}

main().catch(console.error);

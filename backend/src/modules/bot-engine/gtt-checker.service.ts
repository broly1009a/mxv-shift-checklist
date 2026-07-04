import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { RpaDownloaderService } from './rpa-downloader.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { decrypt } from './utils/crypto';
import { chromium, Page } from 'playwright-core';
import * as XLSX from 'xlsx';

export interface GttDataRow {
  symbol: string;
  gttMs: number | null;
  gttCqg: number | null;
  diff: number | null;
  status: 'MATCH' | 'DIFF' | 'MS_ONLY' | 'CQG_ONLY' | 'NO_PRICE';
}

export interface GttReport {
  runAt: string;
  totalContracts: number;
  matched: number;
  diffCount: number;
  msOnlyCount: number;
  cqgOnlyCount: number;
  rows: GttDataRow[];
  marketCsvPath: string | null;
  gttFilePath: string | null;
}

@Injectable()
export class GttCheckerService {
  private readonly logger = new Logger(GttCheckerService.name);
  private latestReport: GttReport | null = null;

  // Configured paths
  private readonly workDir = path.join(process.cwd(), 'temp', 'gtt');
  private readonly marketCsvPath = path.join(process.cwd(), 'temp', 'gtt', 'market.csv');
  private readonly trangThaiMoPath = path.join(process.cwd(), 'temp', 'gtt', 'trang-thai-mo.xlsx');
  private readonly gttXlsxPath = path.join(process.cwd(), 'temp', 'gtt', 'GTT.xlsx');
  private readonly reportJsonPath = path.join(process.cwd(), 'temp', 'gtt', 'latest-report.json');

  constructor(
    private readonly rpaService: RpaDownloaderService,
    private readonly settingsService: SystemSettingsService,
  ) {
    // Ensure work directory exists
    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
    // Load cached report if exists
    try {
      if (fs.existsSync(this.reportJsonPath)) {
        this.latestReport = JSON.parse(fs.readFileSync(this.reportJsonPath, 'utf8'));
      }
    } catch {}
  }

  getWorkDir() {
    return this.workDir;
  }

  getGttXlsxPath() {
    return this.gttXlsxPath;
  }

  getMarketCsvPath() {
    return this.marketCsvPath;
  }

  getLatestReport(): GttReport | null {
    return this.latestReport;
  }

  /**
   * Helper to retrieve Chrome executable path.
   */
  private getChromeExecutablePath(): string | null {
    const bundledPath = path.join(
      process.cwd(),
      '..',
      'it-tool-src',
      'operate-transaction-app',
      'Chrome',
      'chrome-win',
      'chrome.exe'
    );

    if (fs.existsSync(bundledPath)) {
      this.logger.log(`Using bundled Chrome binary at: ${bundledPath}`);
      return bundledPath;
    }

    this.logger.warn(`Bundled Chrome binary not found at ${bundledPath}. Falling back to default playwright launch.`);
    return null;
  }

  /**
   * Parse market.csv exported from M-System orderCreating page.
   * Dynamically matches column names to support format changes.
   */
  async parseMarketCsv(csvFilePath: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`Không tìm thấy file market.csv tại: ${csvFilePath}`);
    }

    const fileStream = fs.createReadStream(csvFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let headerIndex: { symbol: number; settle: number } | null = null;
    let lineNum = 0;

    for await (const line of rl) {
      lineNum++;
      let cleanLine = line.trim();
      if (cleanLine.startsWith('\uFEFF')) {
        cleanLine = cleanLine.substring(1);
      }
      if (!cleanLine) continue;

      const cols = cleanLine.split(',').map(c => {
        let val = c.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      });

      if (lineNum === 1) {
        const symbolIdx = cols.findIndex(c => c.toLowerCase().includes('mã hợp đồng') || c.toLowerCase() === 'symbol' || c.toLowerCase() === 'contract');
        const settleIdx = cols.findIndex(c => c.toLowerCase().includes('giá thanh toán') || c.toLowerCase() === 'settlement price');
        if (symbolIdx !== -1 && settleIdx !== -1) {
          headerIndex = { symbol: symbolIdx, settle: settleIdx };
        } else {
          // Fallback to defaults
          headerIndex = { symbol: 0, settle: 18 };
        }
        this.logger.log(`market.csv headers parsed: Symbol col index = ${headerIndex.symbol}, Settle col index = ${headerIndex.settle}`);
        continue;
      }

      if (headerIndex) {
        const symbol = cols[headerIndex.symbol]?.trim().toUpperCase();
        const priceStr = cols[headerIndex.settle]?.trim().replace(/,/g, '');
        const price = parseFloat(priceStr || '');
        if (symbol && !isNaN(price)) {
          result.set(symbol, price);
        }
      }
    }

    this.logger.log(`Parsed market.csv: ${result.size} contracts with settlement prices`);
    return result;
  }

  /**
   * Parse unique open contract symbols from M-System's trang-thai-mo.xlsx
   */
  parseUniqueMSContracts(filePath: string): string[] {
    if (!fs.existsSync(filePath)) return [];
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) return [];

    const headers = data[0];
    const contractIndex = headers.indexOf('Mã HĐ');
    if (contractIndex === -1) {
      this.logger.warn('⚠️ Không tìm thấy cột "Mã HĐ" trong file Excel trang-thai-mo.xlsx!');
      return [];
    }

    const uniqueContracts = new Set<string>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[contractIndex]) {
        uniqueContracts.add(row[contractIndex].toString().trim());
      }
    }
    return Array.from(uniqueContracts).sort();
  }

  /**
   * Legacy parser for uploaded GTT.xlsx (fallback option)
   */
  async parseGttXlsx(xlsxPath: string): Promise<{ symbol: string; gttFromFile: number | null }[]> {
    if (!fs.existsSync(xlsxPath)) {
      throw new Error(`Không tìm thấy file GTT.xlsx tại: ${xlsxPath}`);
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new Error('GTT.xlsx không có sheet dữ liệu nào.');
    }

    const results: { symbol: string; gttFromFile: number | null }[] = [];
    const maxRow = sheet.rowCount;

    for (let r = 2; r <= maxRow; r++) {
      const symbolCell = sheet.getCell(`A${r}`);
      const gttCell = sheet.getCell(`B${r}`);

      const symbol = String(symbolCell.value || '').trim().toUpperCase();
      if (!symbol) continue;

      let gttVal: number | null = null;
      const rawGtt = gttCell.result ?? gttCell.value;
      if (rawGtt !== null && rawGtt !== undefined && !isNaN(Number(rawGtt))) {
        gttVal = Number(rawGtt);
      }

      results.push({ symbol, gttFromFile: gttVal });
    }

    this.logger.log(`Parsed GTT.xlsx: ${results.length} open contracts`);
    return results;
  }

  /**
   * Reconcile settlement prices (from market.csv) against CQG prices.
   */
  compareGttData(
    msMap: Map<string, number>,
    cqgMap: Map<string, number>,
    contractList: string[],
  ): GttDataRow[] {
    const rows: GttDataRow[] = [];
    const allSymbols = new Set([...contractList, ...cqgMap.keys()]);

    for (const symbol of allSymbols) {
      const gttMs = msMap.get(symbol) ?? null;
      const gttCqg = cqgMap.get(symbol) ?? null;

      let status: GttDataRow['status'];
      let diff: number | null = null;

      if (gttMs === null && gttCqg === null) {
        status = 'NO_PRICE';
      } else if (gttMs === null) {
        status = 'CQG_ONLY';
      } else if (gttCqg === null) {
        status = 'MS_ONLY';
      } else {
        diff = Math.abs(gttCqg - gttMs);
        status = diff < 0.0001 ? 'MATCH' : 'DIFF';
      }

      rows.push({ symbol, gttMs, gttCqg, diff, status });
    }

    // Sort priority: DIFF first, then MS_ONLY, CQG_ONLY, NO_PRICE, MATCH last
    const priority: Record<string, number> = { DIFF: 0, MS_ONLY: 1, CQG_ONLY: 2, NO_PRICE: 3, MATCH: 4 };
    rows.sort((a, b) => {
      const ap = priority[a.status] ?? 5;
      const bp = priority[b.status] ?? 5;
      if (ap !== bp) return ap - bp;
      return a.symbol.localeCompare(b.symbol);
    });

    return rows;
  }

  /**
   * Helper function for CQG price scraping scroll behavior
   */
  private async scrapeQSSPrices(page: Page, resultsMap: Map<string, number>): Promise<void> {
    const viewportSelector = '.ag-body-viewport';
    const hasViewport = await page.locator(viewportSelector).first().isVisible({ timeout: 2000 }).catch(() => false);

    if (hasViewport) {
      let previousCount = -1;
      let retries = 0;

      while (retries < 6) {
        const data = await page.evaluate(() => {
          const parseCQGPrice = (textVal: string | null) => {
            if (!textVal) return NaN;
            textVal = textVal.trim().replace(/,/g, '');
            if (textVal.includes("'")) {
              const parts = textVal.split("'");
              const isNegative = parts[0].startsWith('-');
              const main = Math.abs(parseFloat(parts[0]) || 0);
              const fraction = parseFloat(parts[1] || '0');
              const price = main + (fraction / 8);
              return isNegative ? -price : price;
            }
            return parseFloat(textVal);
          };

          const batch: { symbol: string; price: number }[] = [];
          const symbolRows = document.querySelectorAll('.ag-pinned-left-cols-container [role="row"]');
          symbolRows.forEach(row => {
            const rowId = row.getAttribute('row-id');
            const symbolEl = row.querySelector('.wpfe-qss-symbol-cell-primary-text');
            if (symbolEl && rowId) {
              const symbol = symbolEl.textContent.trim().split(/\s+/)[0];
              const settleRow = document.querySelector(`.ag-center-cols-container [row-id="${rowId}"]`);
              if (settleRow) {
                const priceEl = settleRow.querySelector('[col-id="settle"] .wpfe-price');
                if (priceEl) {
                  const price = parseCQGPrice(priceEl.textContent);
                  if (!isNaN(price)) {
                    batch.push({ symbol, price });
                  }
                }
              }
            }
          });
          return batch;
        });

        for (const item of data) {
          resultsMap.set(item.symbol, item.price);
        }

        if (resultsMap.size === previousCount) {
          retries++;
        } else {
          retries = 0;
          previousCount = resultsMap.size;
        }

        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          if (el) el.scrollTop += 300;
        }, viewportSelector);

        await page.waitForTimeout(400);
      }

      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) el.scrollTop = 0;
      }, viewportSelector);

    } else {
      const data = await page.evaluate(() => {
        const parseCQGPrice = (textVal: string | null) => {
          if (!textVal) return NaN;
          textVal = textVal.trim().replace(/,/g, '');
          if (textVal.includes("'")) {
            const parts = textVal.split("'");
            const isNegative = parts[0].startsWith('-');
            const main = Math.abs(parseFloat(parts[0]) || 0);
            const fraction = parseFloat(parts[1] || '0');
            const price = main + (fraction / 8);
            return isNegative ? -price : price;
          }
          return parseFloat(textVal);
        };

        const batch: { symbol: string; price: number }[] = [];
        const symbolRows = document.querySelectorAll('.ag-pinned-left-cols-container [role="row"]');
        symbolRows.forEach(row => {
          const rowId = row.getAttribute('row-id');
          const symbolEl = row.querySelector('.wpfe-qss-symbol-cell-primary-text');
          if (symbolEl && rowId) {
            const symbol = symbolEl.textContent.trim().split(/\s+/)[0];
            const settleRow = document.querySelector(`.ag-center-cols-container [row-id="${rowId}"]`);
            if (settleRow) {
              const priceEl = settleRow.querySelector('[col-id="settle"] .wpfe-price');
              if (priceEl) {
                const price = parseCQGPrice(priceEl.textContent);
                if (!isNaN(price)) {
                  batch.push({ symbol, price });
                }
              }
            }
          }
        });
        return batch;
      });

      for (const item of data) {
        resultsMap.set(item.symbol, item.price);
      }
    }
  }

  /**
   * Helper function to add column S in CQG Quote Spreadsheet
   */
  private async addSettlementColumn(page: Page, batchNum: number): Promise<void> {
    this.logger.log(`📊 Thêm cột S cho Batch ${batchNum}...`);

    await page.waitForSelector('.ag-header-cell[col-id="symbol"]', { state: 'visible', timeout: 10000 }).catch(() => {});

    const sColExists = await page.locator('[class*="column-header"]:has-text("S"), th:has-text("S")').isVisible({ timeout: 2000 }).catch(() => false);
    if (sColExists) {
      this.logger.log('Cột S đã tồn tại, bỏ qua.');
      return;
    }

    const headerSelectors = [
      '.ag-header-cell[col-id="symbol"]',
      '.ag-header-cell[col-id="trade"]',
      '.ag-header-cell[col-id="bid"]',
      '.ag-header-cell[col-id="ask"]',
      '.ag-header-cell:has-text("Symbol")',
    ];

    let headerClicked = false;
    for (const sel of headerSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        await el.click({ button: 'right' });
        headerClicked = true;
        break;
      }
    }

    if (!headerClicked) {
      this.logger.warn('Không tìm thấy header để click chuột phải thêm cột S.');
      return;
    }

    await page.waitForTimeout(1000);

    const ADD_COLUMNS_SEL = 'wpfe-dropdown-menu-item-text:has-text("Add columns")';
    await page.waitForSelector(ADD_COLUMNS_SEL, { state: 'visible', timeout: 5000 });
    await page.click(ADD_COLUMNS_SEL);
    await page.waitForTimeout(1500);

    const FILTER_INPUT = '.wpfe-column-picker-dialog-search-input input[placeholder="Type to filter"]';
    await page.waitForSelector(FILTER_INPUT, { state: 'visible', timeout: 8000 });
    await page.fill(FILTER_INPUT, 'Settlement');
    await page.waitForTimeout(1000);

    const S_ITEM_SELECTORS = [
      '.wpfe-list-item-content:has-text("Last settlement")',
      '.wpfe-list-item-name-content:has-text("S")',
      '.wpfe-focus-list-item:has-text("Last settlement")',
    ];

    let itemClicked = false;
    for (const sel of S_ITEM_SELECTORS) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        itemClicked = true;
        break;
      }
    }

    if (!itemClicked) {
      await page.dblclick('.wpfe-list-item-content').catch(() => {});
    }

    await page.waitForTimeout(500);

    // Click "Add + Close"
    const ADD_CLOSE_BTN = 'button:has-text("Add + Close"), .gpc-button-wrapper-content:has-text("Add + Close")';
    await page.waitForSelector(ADD_CLOSE_BTN, { state: 'visible', timeout: 5000 });
    await page.click(ADD_CLOSE_BTN);
    await page.waitForTimeout(2000);

    this.logger.log(`✅ Đã thêm cột S cho Batch ${batchNum}`);
  }

  /**
   * Full pipeline orchestrator:
   * 1. Download market.csv and trang-thai-mo.xlsx from M-System
   * 2. Parse contract list from trang-thai-mo.xlsx
   * 3. Fetch settlement prices from CQG
   * 4. Compare and save report
   */
  async runFullGttCheck(options: {
    downloadMarketCsv?: boolean;
    gttXlsxPath?: string;
  } = {}): Promise<GttReport> {
    const runAt = new Date().toISOString();
    this.logger.log('=== BẮT ĐẦU PIPELINE KIỂM TRA GTT TỰ ĐỘNG ===');

    const downloadMarketCsv = !!options.downloadMarketCsv;
    const chromePath = this.getChromeExecutablePath();

    if (downloadMarketCsv) {
      // =========================================================================
      // BƯỚC 1: TẢI FILE TỪ M-SYSTEM
      // =========================================================================
      this.logger.log('Đăng nhập M-System và tải file báo cáo...');
      
      let msUrl = 'https://msadmin.mxv.com.vn/';
      let msUser = process.env.MS_USER || '';
      let msPass = process.env.MS_PASSWORD || '';
      let msPin = process.env.MS_PIN || '';

      const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
      if (credentialsRaw) {
        try {
          const credentials = JSON.parse(decrypt(credentialsRaw));
          if (credentials.url) msUrl = credentials.url;
          if (credentials.username) msUser = credentials.username;
          if (credentials.password) msPass = credentials.password;
          if (credentials.pin) msPin = credentials.pin;
        } catch (err) {
          this.logger.warn('Không thể giải mã cấu hình M-System từ DB, dùng biến môi trường.');
        }
      }

      if (!msUser || !msPass || !msPin) {
        throw new Error('Cấu hình tài khoản M-System không đầy đủ (url, username, password, pin). Vui lòng cấu hình qua Admin UI hoặc file .env');
      }

      const launchOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);

      try {
        this.logger.log(`Đi tới trang M-System: ${msUrl}...`);
        await page.goto(msUrl);
        await page.waitForTimeout(2000);

        this.logger.log('Nhập tài khoản và mật khẩu...');
        await page.waitForSelector('input[name="username"]', { state: 'visible' });
        await page.fill('input[name="username"]', msUser);
        await page.fill('input[name="password"]', msPass);
        await page.waitForTimeout(500);

        this.logger.log('Nhấn nút Đăng nhập...');
        await page.click('button.btn-primary');
        await page.waitForTimeout(2000);

        this.logger.log('Đang đợi bảng nhập mã PIN ảo hiển thị...');
        let pinSelectorVisible = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          pinSelectorVisible = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
          if (pinSelectorVisible) break;
          this.logger.warn(`Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`);
          await page.click('button.btn-primary').catch(() => {});
          await page.waitForTimeout(2000);
        }

        await page.waitForSelector('div.pincode', { state: 'visible', timeout: 10000 });
        this.logger.log('Đang tự động click mã PIN ảo...');
        const pinDigits = msPin.split('');
        for (const digit of pinDigits) {
          const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
          await page.waitForSelector(digitSelector, { state: 'visible' });
          await page.click(digitSelector);
          await page.waitForTimeout(500);
        }

        this.logger.log('Xác thực đăng nhập...');
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3000);
        this.logger.log('🎉 ĐĂNG NHẬP M-SYSTEM THÀNH CÔNG!');

        // Tải market.csv
        const orderCreatingUrl = `${msUrl.split('#')[0]}#/orderManagement/orderCreating`;
        this.logger.log(`Điều hướng đến trang bảng giá: ${orderCreatingUrl}...`);
        await page.goto(orderCreatingUrl);
        await page.waitForTimeout(5000);

        const csvBtn = page.locator('div.edit-icon i.fa-file-csv, div.edit-icon, i.fa-file-csv.green').first();
        if (await csvBtn.isVisible().catch(() => false)) {
          this.logger.log('Tìm thấy nút xuất CSV Bảng giá. Đang tải...');
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25000 }),
            csvBtn.click()
          ]);
          await download.saveAs(this.marketCsvPath);
          this.logger.log(`✅ Đã tải thành công market.csv: ${this.marketCsvPath}`);
        } else {
          throw new Error('Không tìm thấy nút tải market.csv trên trang orderCreating');
        }

        // Tải trang-thai-mo.xlsx
        const openPositionUrl = `${msUrl.split('#')[0]}#/positionManagement/openPositionInfo`;
        this.logger.log(`Điều hướng đến trang trạng thái mở: ${openPositionUrl}...`);
        await page.goto(openPositionUrl);
        await page.waitForTimeout(5000);

        const excelBtn = page.locator('button.ladda-button:has(i.fa-file-csv), button.ladda-button').first();
        if (await excelBtn.isVisible().catch(() => false)) {
          this.logger.log('Tìm thấy nút xuất Excel Trạng thái mở. Đang tải...');
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25000 }),
            excelBtn.click()
          ]);
          await download.saveAs(this.trangThaiMoPath);
          this.logger.log(`✅ Đã tải thành công trang-thai-mo.xlsx: ${this.trangThaiMoPath}`);
        } else {
          throw new Error('Không tìm thấy nút tải trang-thai-mo.xlsx trên trang openPositionInfo');
        }

      } finally {
        await browser.close();
      }
    }

    // =========================================================================
    // BƯỚC 2: TRÍCH XUẤT DANH SÁCH MÃ HỢP ĐỒNG CẦN CHECK
    // =========================================================================
    let contractList: string[] = [];
    if (fs.existsSync(this.trangThaiMoPath)) {
      this.logger.log(`Đọc danh sách hợp đồng mở từ file Excel trang-thai-mo.xlsx...`);
      contractList = this.parseUniqueMSContracts(this.trangThaiMoPath);
    } else {
      const gttFile = options.gttXlsxPath || this.gttXlsxPath;
      if (fs.existsSync(gttFile)) {
        this.logger.log(`Không tìm thấy trang-thai-mo.xlsx. Đọc từ file fallback GTT.xlsx...`);
        const rows = await this.parseGttXlsx(gttFile);
        contractList = rows.map(r => r.symbol);
      }
    }

    this.logger.log(`Tìm thấy ${contractList.length} mã hợp đồng đang hoạt động để đối soát.`);
    if (contractList.length === 0) {
      throw new Error('Không tìm thấy danh sách mã hợp đồng mở để kiểm tra! Vui lòng upload GTT.xlsx hoặc bật chế độ tự động tải.');
    }

    // =========================================================================
    // BƯỚC 3: ĐĂNG NHẬP CQG & QUÉT GIÁ QSS
    // =========================================================================
    const cqgPricesMap = new Map<string, number>();

    let cqgUrl = 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
    let cqgUser = process.env.CQG_USER || '';
    let cqgPass = process.env.CQG_PASSWORD || '';

    const cqgCredentialsRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');
    if (cqgCredentialsRaw) {
      try {
        const cqgCredentials = JSON.parse(decrypt(cqgCredentialsRaw));
        if (cqgCredentials.url) cqgUrl = cqgCredentials.url;
        if (cqgCredentials.username) cqgUser = cqgCredentials.username;
        if (cqgCredentials.password) cqgPass = cqgCredentials.password;
      } catch (err) {
        this.logger.warn('Không thể giải mã cấu hình CQG từ DB, dùng biến môi trường.');
      }
    }

    if (!cqgUser || !cqgPass) {
      throw new Error('Cấu hình tài khoản CQG không đầy đủ (url, username, password). Vui lòng cấu hình qua Admin UI hoặc file .env');
    }

    this.logger.log(`Khởi tạo browser kết nối CQG: ${cqgUrl}...`);
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
      this.logger.log('Đăng nhập CQG...');
      await page.goto(cqgUrl);
      await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 20000 });
      await page.fill('input[name="userName"]', cqgUser);
      await page.fill('input[name="password"]', cqgPass);
      await page.click('button[type="submit"]');

      await page.waitForSelector('div.wpfe-logo-image', { state: 'visible', timeout: 60000 });
      await page.waitForTimeout(3000);
      this.logger.log('✅ Đăng nhập CQG THÀNH CÔNG!');

      // Batch split (max 95 per tab)
      const BATCH_LIMIT = 95;
      const batches: string[][] = [];
      for (let i = 0; i < contractList.length; i += BATCH_LIMIT) {
        batches.push(contractList.slice(i, i + BATCH_LIMIT));
      }

      this.logger.log(`Phân chia thành ${batches.length} batch(es) để tra cứu CQG...`);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchNum = batchIdx + 1;
        const batchSymbols = batches[batchIdx];
        const symbolStr = batchSymbols.join(', ');
        this.logger.log(`--- BẮT ĐẦU BATCH ${batchNum}/${batches.length} (${batchSymbols.length} mã) ---`);

        // Click Add Tab "+"
        await page.waitForSelector('.wpfe-add-widget-btn', { state: 'visible', timeout: 15000 });
        await page.click('.wpfe-add-widget-btn');
        await page.waitForTimeout(2000);

        // Click Quotes
        await page.waitForSelector('.wpfe-list-item:has-text("Quotes")', { state: 'visible', timeout: 10000 });
        await page.click('.wpfe-list-item:has-text("Quotes")');
        await page.waitForTimeout(1000);

        // Click Quote spreadsheet widget
        await page.waitForSelector('[data-widgetclass="wpfe-QuoteSpreadSheet"]', { state: 'visible', timeout: 10000 });
        await page.click('[data-widgetclass="wpfe-QuoteSpreadSheet"]');
        await page.waitForTimeout(3000);

        // Click New list
        await page.waitForSelector('button:has-text("New list")', { state: 'visible', timeout: 10000 });
        await page.click('button:has-text("New list")');
        await page.waitForTimeout(2000);

        // Fill Search input
        const SEARCH_INPUT = 'input[placeholder="Search symbols"]';
        await page.waitForSelector(SEARCH_INPUT, { state: 'visible', timeout: 15000 });
        await page.fill(SEARCH_INPUT, symbolStr);
        await page.waitForTimeout(1500);

        // Click OK to load list
        const okBtn = page.locator('button.wpfe-button-primary:has-text("OK"), button:has-text("OK")').first();
        await okBtn.click();
        await page.waitForTimeout(5000);

        // Add Column S (Settlement)
        await this.addSettlementColumn(page, batchNum);

        // Scrape prices
        this.logger.log(`Đang quét giá CQG Batch ${batchNum}...`);
        await this.scrapeQSSPrices(page, cqgPricesMap);
        this.logger.log(`Lũy kế: Đã đọc được ${cqgPricesMap.size} giá từ CQG.`);
      }

    } finally {
      await browser.close();
    }

    // =========================================================================
    // BƯỚC 4: ĐỐI CHIẾU SO KHỚP DỮ LIỆU
    // =========================================================================
    this.logger.log('Đang phân tích và so khớp dữ liệu...');
    const msMap = await this.parseMarketCsv(this.marketCsvPath);
    const rows = this.compareGttData(msMap, cqgPricesMap, contractList);

    const matched = rows.filter((r) => r.status === 'MATCH').length;
    const diffCount = rows.filter((r) => r.status === 'DIFF').length;
    const msOnlyCount = rows.filter((r) => r.status === 'MS_ONLY').length;
    const cqgOnlyCount = rows.filter((r) => r.status === 'CQG_ONLY').length;

    const report: GttReport = {
      runAt,
      totalContracts: rows.length,
      matched,
      diffCount,
      msOnlyCount,
      cqgOnlyCount,
      rows,
      marketCsvPath: this.marketCsvPath,
      gttFilePath: fs.existsSync(this.trangThaiMoPath) ? this.trangThaiMoPath : this.gttXlsxPath,
    };

    // Save report to disk
    fs.writeFileSync(this.reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
    this.latestReport = report;

    this.logger.log(`=== HOÀN TẤT ĐỐI SOÁT GTT: ${matched} khớp, ${diffCount} lệch, ${msOnlyCount + cqgOnlyCount} thiếu ===`);
    return report;
  }
}

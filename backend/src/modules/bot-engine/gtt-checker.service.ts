import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { RpaDownloaderService } from './rpa-downloader.service';

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
  private readonly gttXlsxPath = path.join(process.cwd(), 'temp', 'gtt', 'GTT.xlsx');
  private readonly reportJsonPath = path.join(process.cwd(), 'temp', 'gtt', 'latest-report.json');

  constructor(private readonly rpaService: RpaDownloaderService) {
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
   * Parse market.csv exported from M-System orderCreating page.
   * Column A: Symbol (contract code)
   * Column S (index 18, 0-based): Settlement Price (GTT)
   * Returns: Map<symbol, settlementPrice>
   */
  async parseMarketCsv(csvFilePath: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`Không tìm thấy file market.csv tại: ${csvFilePath}`);
    }

    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineNum = 0;
    let symbolColIdx = 0;
    let gttColIdx = 18; // Column S (index 18, 0-based) = 19th column = Settlement Price
    let headerParsed = false;

    for await (const line of rl) {
      lineNum++;
      if (!line.trim()) continue;

      // Parse CSV line respecting quoted fields
      const cols = this.parseCsvLine(line);

      if (lineNum === 1) {
        // Detect header row and find correct column indexes
        headerParsed = true;
        for (let i = 0; i < cols.length; i++) {
          const h = cols[i].toLowerCase().trim();
          // M-System CSV headers (detect by common Vietnamese/English names)
          if (h === 'contract' || h === 'symbol' || h === 'mã hợp đồng' || h === 'ma hd') {
            symbolColIdx = i;
          }
          if (h === 'settlement price' || h === 'settlement' || h === 'gtt' || h === 'giá thanh toán') {
            gttColIdx = i;
          }
        }
        this.logger.log(`market.csv header detected. Symbol col: ${symbolColIdx}, GTT col: ${gttColIdx}`);
        continue;
      }

      const symbol = (cols[symbolColIdx] || '').trim().toUpperCase();
      const gttStr = (cols[gttColIdx] || '').trim().replace(/,/g, '');
      const gtt = parseFloat(gttStr);

      if (symbol && !isNaN(gtt) && gtt > 0) {
        result.set(symbol, gtt);
      }
    }

    this.logger.log(`Parsed market.csv: ${result.size} contracts with settlement prices`);
    return result;
  }

  /**
   * Parse GTT.xlsx (uploaded by user) to extract list of open contracts.
   * Column A: Contract symbol
   * Column B: GTT value from M-System (VLOOKUP formula result)
   * 
   * Since XLSX parsing requires openpyxl equivalent in Node, we use exceljs.
   */
  async parseGttXlsx(xlsxPath: string): Promise<{ symbol: string; gttFromFile: number | null }[]> {
    if (!fs.existsSync(xlsxPath)) {
      throw new Error(`Không tìm thấy file GTT.xlsx tại: ${xlsxPath}`);
    }

    // Dynamic import to avoid top-level dependency issues
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);

    const sheet = workbook.getWorksheet(1); // First sheet
    if (!sheet) {
      throw new Error('GTT.xlsx không có sheet dữ liệu nào.');
    }

    const results: { symbol: string; gttFromFile: number | null }[] = [];
    const maxRow = sheet.rowCount;

    for (let r = 2; r <= maxRow; r++) {
      // Row 1 is header, data starts from row 2
      const symbolCell = sheet.getCell(`A${r}`);
      const gttCell = sheet.getCell(`B${r}`);

      const symbol = String(symbolCell.value || '').trim().toUpperCase();
      if (!symbol) continue;

      // B column may have VLOOKUP formula result or raw number
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
   * Compare MS settlement prices (from market.csv) against CQG prices.
   * MS data comes from market.csv. CQG data comes from Playwright scrape.
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

    // Sort: DIFF first, then MS_ONLY, CQG_ONLY, NO_PRICE, MATCH last
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
   * Full pipeline orchestrator:
   * 1. Download market.csv from M-System (if not already present)
   * 2. Parse GTT.xlsx contract list
   * 3. Fetch settlement prices from CQG
   * 4. Compare and save report
   */
  async runFullGttCheck(options: {
    downloadMarketCsv?: boolean;
    gttXlsxPath?: string;
  } = {}): Promise<GttReport> {
    const runAt = new Date().toISOString();
    this.logger.log('=== BẮT ĐẦU PIPELINE KIỂM TRA GTT ===');

    const gttFile = options.gttXlsxPath || this.gttXlsxPath;
    let marketCsvActualPath = this.marketCsvPath;

    // Step 1: Download market.csv from M-System (optional, skip if file exists and fresh)
    if (options.downloadMarketCsv) {
      this.logger.log('[Bước 1] Tải market.csv từ M-System...');
      const { browser } = await this.rpaService.downloadMarketCsv(this.workDir);
      await browser.close();
      this.logger.log('[Bước 1] Tải market.csv XONG.');
    } else {
      this.logger.log('[Bước 1] Bỏ qua tải market.csv (dùng file có sẵn).');
    }

    // Step 2: Parse market.csv → MS GTT map
    this.logger.log('[Bước 2] Phân tích market.csv...');
    const msMap = await this.parseMarketCsv(marketCsvActualPath);

    // Step 3: Parse GTT.xlsx → contract list
    this.logger.log('[Bước 3] Đọc danh sách hợp đồng mở từ GTT.xlsx...');
    const gttRows = await this.parseGttXlsx(gttFile);
    const contractList = gttRows.map((r) => r.symbol);
    this.logger.log(`[Bước 3] Tìm thấy ${contractList.length} hợp đồng mở cần kiểm tra.`);

    // Step 4: Fetch CQG settlement prices
    this.logger.log('[Bước 4] Lấy giá GTT từ CQG Quote Spreadsheet...');
    const cqgMap = await this.rpaService.fetchCQGSettlementPrices(contractList);
    this.logger.log(`[Bước 4] CQG trả về ${cqgMap.size} giá.`);

    // Step 5: Compare
    this.logger.log('[Bước 5] So sánh GTT giữa M-System và CQG...');
    const rows = this.compareGttData(msMap, cqgMap, contractList);

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
      marketCsvPath: marketCsvActualPath,
      gttFilePath: gttFile,
    };

    // Save report to disk
    fs.writeFileSync(this.reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
    this.latestReport = report;

    this.logger.log(`=== HOÀN TẤT PIPELINE GTT: ${matched} khớp, ${diffCount} chênh lệch, ${msOnlyCount} chỉ có trên MS, ${cqgOnlyCount} chỉ có trên CQG ===`);
    return report;
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /**
   * Simple CSV line parser that handles quoted fields with commas inside.
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}

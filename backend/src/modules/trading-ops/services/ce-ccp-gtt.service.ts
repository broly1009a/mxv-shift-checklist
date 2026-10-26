import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
  decrypt,
} from '../../../shared';
import { CcpCeScraperService } from '../../ingress';
import { GttExcelParser } from '../parsers';

export interface CeCcpGttDataRow {
  symbol: string;
  commodity: string;
  priceCe: number | null;
  priceCcp: number | null;
  diff: number | null;
  tickSize: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'DIFF' | 'CE_ONLY' | 'CCP_ONLY' | 'NO_PRICE';
  dateCe: string | null;
  dateCcp: string | null;
  currency: string;
}

export interface CeCcpGttReport {
  runAt: string;
  completedAt?: string;
  durationMs?: number;
  targetDate?: string;
  totalContracts: number;
  matched: number;
  minorDiffCount: number;
  diffCount: number;
  ceOnlyCount: number;
  ccpOnlyCount: number;
  noPriceCount: number;
  filterOpen: boolean;
  rows: CeCcpGttDataRow[];
  logs?: string[];
  filePaths: {
    ceGtt: string | null;
    ccpGtt: string | null;
    ceHh: string | null;
    ccpHh: string | null;
    ttm: string | null;
  };
}

export interface RunCeCcpGttOptions {
  targetDate?: string;
  filterOpen?: boolean;
  async?: boolean;
  autoDownload?: boolean; // Tự động tải nếu thiếu file (mặc định: true)
  forceDownload?: boolean; // Bắt buộc tải mới từ sàn dù file đã tồn tại (mặc định: false)
  ceGttPath?: string;
  ccpGttPath?: string;
  ceHhPath?: string;
  ccpHhPath?: string;
  ttmPath?: string;
}

// Bảng bước giá dự phòng chuẩn theo thông số sở & ACM
const FALLBACK_TICK_SIZES: Record<string, number> = {
  // ACM Nano commodities
  PL1NY: 0.1,    // Bạch kim Nano ACM (USD)
  CP2CO: 0.0005, // Đồng Nano ACM (USD)
  SI5CO: 0.005,  // Bạc Nano ACM (USD)
  // Standard Futures commodities
  CLE: 0.01,
  KCE: 0.05,
  ZCE: 0.25,
  ZSE: 0.25,
  ZLE: 0.01,
  ZME: 0.1,
  CPE: 0.0005,
  VNC: 10,
};

@Injectable()
export class CeCcpGttCheckerService {
  private readonly logger = new Logger(CeCcpGttCheckerService.name);
  private latestReport: CeCcpGttReport | null = null;
  private isRunning: boolean = false;
  private currentLogs: string[] = [];
  private currentStartTime: number = 0;

  private readonly workDir = path.join(process.cwd(), 'temp', 'gtt');
  private readonly reportJsonPath = path.join(
    process.cwd(),
    'temp',
    'gtt',
    'ce-ccp-latest-report.json',
  );

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly ccpCeDownloaderService?: CcpCeScraperService,
  ) {
    if (!fs.existsSync(this.workDir)) {
      try {
        fs.mkdirSync(this.workDir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Không thể tạo thư mục temp/gtt: ${err.message}`);
      }
    }
    this.loadCachedReport();
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getCurrentLogs(): string[] {
    return this.currentLogs;
  }

  getLatestReport(): CeCcpGttReport | null {
    return this.latestReport;
  }

  private logStep(msg: string) {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const line = `[${timeStr}] ${msg}`;
    this.logger.log(msg);
    this.currentLogs.push(line);
  }

  private loadCachedReport() {
    try {
      if (fs.existsSync(this.reportJsonPath)) {
        const raw = fs.readFileSync(this.reportJsonPath, 'utf8');
        this.latestReport = JSON.parse(raw);
        this.logger.log('Đã nạp báo cáo đối soát GTT CE-CCP gần nhất từ cache file.');
      }
    } catch (err: any) {
      this.logger.warn(`Không thể đọc cache report: ${err.message}`);
    }
  }

  private saveReportToCache(report: CeCcpGttReport) {
    try {
      fs.writeFileSync(this.reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Không thể lưu cache report: ${err.message}`);
    }
  }

  /**
   * Helper tìm file đầu tiên tồn tại trong danh sách ứng viên
   */
  private findFirstExistingPath(candidates: (string | undefined | null)[]): string | null {
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        try {
          const stat = fs.statSync(c);
          if (stat.isFile() && stat.size > 0) return c;
        } catch {
          // Ignore
        }
      }
    }
    return null;
  }

  /**
   * Tự động giải quyết các đường dẫn file cho CE và CCP theo ngày targetDate
   */
  async resolveFilePaths(options: RunCeCcpGttOptions): Promise<{
    ceGtt: string | null;
    ccpGtt: string | null;
    ceHh: string | null;
    ccpHh: string | null;
    ttm: string | null;
  }> {
    const targetDate = options.targetDate ? new Date(options.targetDate) : new Date();

    const ceBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ce',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures',
    );
    const ccpBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      '',
    );

    const { fullPath: ceDailyPath } = resolveDailySubfolder(ceBackupBase, targetDate);
    const { fullPath: ccpDailyPath } = resolveDailySubfolder(ccpBackupBase, targetDate);
    const resolvedCeBase = resolveStoragePathCrossPlatform(ceBackupBase);
    const resolvedCcpBase = resolveStoragePathCrossPlatform(ccpBackupBase);

    // Candidates for CE GTT
    const ceGttCandidates = [
      options.ceGttPath,
      path.join(ceDailyPath, 'GTT ACM.xlsx'),
      path.join(resolvedCeBase, 'GTT ACM.xlsx'),
      path.join(this.workDir, 'GTT ACM.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ce_downloads', 'GTT ACM.xlsx'),
    ];

    // Candidates for CCP GTT
    const ccpGttCandidates = [
      options.ccpGttPath,
      path.join(ccpDailyPath, 'GTT CCP.xlsx'),
      path.join(ccpDailyPath, 'LSGTT.xlsx'),
      path.join(resolvedCcpBase, 'GTT CCP.xlsx'),
      path.join(resolvedCcpBase, 'LSGTT.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_25_downloads', 'GTT CCP.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_25_downloads', 'LSGTT.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_downloads', 'GTT CCP.xlsx'),
      path.join(this.workDir, 'GTT CCP.xlsx'),
    ];

    // Candidates for CE HH
    const ceHhCandidates = [
      options.ceHhPath,
      path.join(ceDailyPath, 'HH ACM.xlsx'),
      path.join(resolvedCeBase, 'HH ACM.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ce_downloads', 'HH ACM.xlsx'),
      path.join(this.workDir, 'HH ACM.xlsx'),
    ];

    // Candidates for CCP HH
    const ccpHhCandidates = [
      options.ccpHhPath,
      path.join(ccpDailyPath, 'HH.xlsx'),
      path.join(resolvedCcpBase, 'HH.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_25_downloads', 'HH.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_downloads', 'HH.xlsx'),
      path.join(this.workDir, 'HH.xlsx'),
    ];

    // Candidates for TTM (Open Positions)
    const ttmCandidates = [
      options.ttmPath,
      path.join(ccpDailyPath, 'TTM CCP.xlsx'),
      path.join(ccpDailyPath, 'TTM.xlsx'),
      path.join(resolvedCcpBase, 'TTM CCP.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_25_downloads', 'TTM CCP.xlsx'),
      path.join(process.cwd(), 'temp', 'test_ccp_downloads', 'TTM CCP.xlsx'),
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\TTM CCP.xlsx',
      path.join(this.workDir, 'TTM CCP.xlsx'),
    ];

    return {
      ceGtt: this.findFirstExistingPath(ceGttCandidates),
      ccpGtt: this.findFirstExistingPath(ccpGttCandidates),
      ceHh: this.findFirstExistingPath(ceHhCandidates),
      ccpHh: this.findFirstExistingPath(ccpHhCandidates),
      ttm: this.findFirstExistingPath(ttmCandidates),
    };
  }

  /**
   * Phân tích file GTT (Ủy thác qua GttExcelParser dùng chung trong parsers/)
   */
  parseGttFile(filePath: string, label: string) {
    return GttExcelParser.parseGttFile(filePath, label);
  }

  /**
   * Phân tích file Bước giá (Tick Size) (Ủy thác qua GttExcelParser dùng chung trong parsers/)
   */
  parseTickSizes(filePath: string | null): Map<string, number> {
    return GttExcelParser.parseTickSizes(filePath);
  }

  /**
   * Phân tích danh sách mã hợp đồng có vị thế mở (TTM) (Ủy thác qua GttExcelParser dùng chung trong parsers/)
   */
  parseOpenContracts(filePath: string | null): Set<string> {
    return GttExcelParser.parseOpenContracts(filePath);
  }

  /**
   * Tự động khởi chạy Playwright bot tải file GTT từ CoreEX và/hoặc CoreCCP
   */
  private async autoDownloadMissingFiles(
    targetDateStr: string,
    needCe: boolean,
    needCcp: boolean,
  ): Promise<void> {
    if (!this.ccpCeDownloaderService) {
      this.logStep('Cảnh báo: CcpCeDownloaderService chưa sẵn sàng, bỏ qua tự động tải.');
      return;
    }

    // 1. Tự động tải file GTT ACM từ sàn CoreEX
    if (needCe) {
      try {
        const ceCredRaw = await this.settingsService.getSetting('bot_credentials_ce', '');
        if (!ceCredRaw) {
          this.logStep('Cảnh báo: Chưa cấu hình tài khoản CoreEX (bot_credentials_ce) trong CSDL.');
        } else {
          const ceCreds = JSON.parse(decrypt(ceCredRaw));
          if (ceCreds.url && ceCreds.username && ceCreds.password) {
            this.logStep('Đang khởi động bot tự động đăng nhập CoreEX để tải Giá thanh toán liên thông...');
            const ceBackupBase = await this.settingsService.getSetting(
              'bot_backup_path_ce',
              'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures',
            );
            const { fullPath: ceDailyPath } = resolveDailySubfolder(ceBackupBase, targetDateStr);
            let outDir = ceDailyPath;
            try {
              if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            } catch {
              outDir = this.workDir;
            }

            await this.ccpCeDownloaderService.run(
              {
                systemUrl: ceCreds.url,
                username: ceCreds.username,
                password: ceCreds.password,
                startDate: targetDateStr,
                endDate: targetDateStr,
                outputDir: outDir,
                reports: [
                  {
                    code: 'GTT',
                    name: 'Giá thanh toán (CE)',
                    parentMenu: 'Quản lý sản phẩm',
                    childMenu: 'Quản lý giá thanh toán',
                    tabName: 'Giá thanh toán liên thông',
                    cachedUrl: '/PRODUCT/SETTLEMENT',
                    enabled: true,
                    phase: 'EOD',
                    outputFileName: 'GTT ACM.xlsx',
                  },
                ],
              },
              (m: string) => this.logStep(`[CoreEX Bot] ${m}`),
            );
          }
        }
      } catch (err: any) {
        this.logStep(`Lỗi tự tải GTT CoreEX: ${err?.message || err}`);
      }
    }

    // 2. Tự động tải file GTT CCP từ hệ thống CoreCCP
    if (needCcp) {
      try {
        const ccpCredRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
        if (!ccpCredRaw) {
          this.logStep('Cảnh báo: Chưa cấu hình tài khoản CoreCCP (bot_credentials_ccp) trong CSDL.');
        } else {
          const ccpCreds = JSON.parse(decrypt(ccpCredRaw));
          if (ccpCreds.url && ccpCreds.username && ccpCreds.password) {
            this.logStep('Đang khởi động bot tự động đăng nhập CoreCCP để tải Giá thanh toán...');
            const ccpBackupBase = await this.settingsService.getSetting(
              'bot_backup_path_ccp',
              '',
            );
            const { fullPath: ccpDailyPath } = resolveDailySubfolder(ccpBackupBase, targetDateStr);
            let outDir = ccpDailyPath;
            try {
              if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            } catch {
              outDir = this.workDir;
            }

            await this.ccpCeDownloaderService.run(
              {
                systemUrl: ccpCreds.url,
                username: ccpCreds.username,
                password: ccpCreds.password,
                startDate: targetDateStr,
                endDate: targetDateStr,
                outputDir: outDir,
                reports: [
                  {
                    code: 'GTT',
                    name: 'Quản lý giá thanh toán',
                    parentMenu: 'Quản lý sản phẩm',
                    childMenu: 'Quản lý giá thanh toán',
                    cachedUrl: '/PRODUCT/SETTLEMENT',
                    enabled: true,
                    phase: 'EOD',
                    outputFileName: 'GTT CCP.xlsx',
                  },
                ],
              },
              (m: string) => this.logStep(`[CoreCCP Bot] ${m}`),
            );
          }
        }
      } catch (err: any) {
        this.logStep(`Lỗi tự tải GTT CoreCCP: ${err?.message || err}`);
      }
    }
  }

  /**
   * Chạy pipeline đối soát GTT giữa CoreEX (CE) và CoreCCP (VNCLEAR)
   */
  async runCeCcpGttCheck(options: RunCeCcpGttOptions = {}): Promise<CeCcpGttReport> {
    if (this.isRunning) {
      throw new Error('Tiến trình đối soát GTT CE-CCP đang chạy. Vui lòng đợi trong giây lát!');
    }

    this.isRunning = true;
    this.currentLogs = [];
    this.currentStartTime = Date.now();

    try {
      this.logStep('Khởi động tiến trình đối chiếu Giá thanh toán: CoreEX (CE) vs CoreCCP (VNCLEAR)...');

      let files = await this.resolveFilePaths(options);

      // Tự động tải file On-Demand nếu thiếu file hoặc được yêu cầu forceDownload
      const needCe = !files.ceGtt || options.forceDownload === true;
      const needCcp = !files.ccpGtt || options.forceDownload === true;

      if ((needCe || needCcp) && options.autoDownload !== false) {
        this.logStep(
          `Trạng thái file ban đầu: CE GTT = [${files.ceGtt ? 'Đã có' : 'Chưa có'}], CCP GTT = [${files.ccpGtt ? 'Đã có' : 'Chưa có'}]. Kích hoạt bot tự động tải On-Demand...`,
        );
        const sessionStartStr = await this.settingsService.getSetting(
          'session_start_time',
          '05:00',
        );
        const resolvedDate = resolveTradingSessionDate(options.targetDate, {
          sessionStartStr,
        });
        await this.autoDownloadMissingFiles(
          resolvedDate.dateStr,
          needCe,
          needCcp,
        );

        // Quét lại file sau khi tải
        files = await this.resolveFilePaths(options);
      }

      this.logStep(`File CE GTT: ${files.ceGtt ? path.basename(files.ceGtt) : 'Chưa tìm thấy'}`);
      this.logStep(`File CCP GTT: ${files.ccpGtt ? path.basename(files.ccpGtt) : 'Chưa tìm thấy'}`);
      if (files.ceHh) this.logStep(`File Bước giá CE: ${path.basename(files.ceHh)}`);
      if (files.ccpHh) this.logStep(`File Bước giá CCP: ${path.basename(files.ccpHh)}`);
      if (files.ttm) this.logStep(`File Vị thế mở (TTM): ${path.basename(files.ttm)}`);

      if (!files.ceGtt) {
        throw new Error(
          'Không tìm thấy file Giá thanh toán CoreEX (GTT ACM.xlsx) ngay cả sau khi kích hoạt bot tự tải. Vui lòng kiểm tra cấu hình tài khoản CoreEX hoặc kết nối mạng!',
        );
      }
      if (!files.ccpGtt) {
        throw new Error(
          'Không tìm thấy file Giá thanh toán CoreCCP (GTT CCP.xlsx hoặc LSGTT.xlsx) ngay cả sau khi kích hoạt bot tự tải. Vui lòng kiểm tra cấu hình tài khoản CoreCCP hoặc kết nối mạng!',
        );
      }

      // Parse files
      this.logStep('Đang đọc và phân tích cấu trúc dữ liệu bảng tính...');
      const ceData = this.parseGttFile(files.ceGtt, 'CoreEX');
      const ccpData = this.parseGttFile(files.ccpGtt, 'CoreCCP');
      const ceTicks = this.parseTickSizes(files.ceHh);
      const ccpTicks = this.parseTickSizes(files.ccpHh);
      const openContracts = this.parseOpenContracts(files.ttm);

      this.logStep(`CoreEX (CE): ${ceData.map.size} hợp đồng (Ngày: ${ceData.date || 'N/A'})`);
      this.logStep(`CoreCCP (VNCLEAR): ${ccpData.map.size} hợp đồng (Ngày: ${ccpData.date || 'N/A'})`);

      if (ceData.date && ccpData.date && ceData.date !== ccpData.date) {
        this.logStep(
          `Cảnh báo: Ngày phiên khác nhau! CE=[${ceData.date}] vs CCP=[${ccpData.date}]. Độ lệch có thể do khác ngày giao dịch.`,
        );
      }

      // Apply open position filter if requested
      const filterOpen = !!options.filterOpen && openContracts.size > 0;
      let targetSymbols = Array.from(new Set([...ceData.map.keys(), ...ccpData.map.keys()]));
      if (filterOpen) {
        targetSymbols = targetSymbols.filter((s) => openContracts.has(s));
        this.logStep(`Đã lọc theo ${openContracts.size} hợp đồng có vị thế mở (TTM). Số mã kiểm tra: ${targetSymbols.length}`);
      } else {
        this.logStep(`So khớp toàn bộ danh mục hợp đồng: ${targetSymbols.length} mã.`);
      }

      const rows: CeCcpGttDataRow[] = [];
      let countMatch = 0;
      let countMinorDiff = 0;
      let countDiff = 0;
      let countCeOnly = 0;
      let countCcpOnly = 0;
      let countNoPrice = 0;

      for (const symbol of targetSymbols) {
        const ceItem = ceData.map.get(symbol);
        const ccpItem = ccpData.map.get(symbol);
        const priceCe = ceItem?.price ?? null;
        const priceCcp = ccpItem?.price ?? null;

        const commodity = ceItem?.commodity || ccpItem?.commodity || symbol.slice(0, 5);
        let tickSize =
          ceTicks.get(commodity) ||
          ccpTicks.get(commodity) ||
          FALLBACK_TICK_SIZES[commodity] ||
          null;

        if (tickSize === null) {
          for (const [k, v] of Object.entries(FALLBACK_TICK_SIZES)) {
            if (symbol.startsWith(k)) {
              tickSize = v;
              break;
            }
          }
        }
        if (tickSize === null) tickSize = 0.05; // Default safe fallback

        let status: 'MATCH' | 'MINOR_DIFF' | 'DIFF' | 'CE_ONLY' | 'CCP_ONLY' | 'NO_PRICE' = 'MATCH';
        let diff: number | null = null;

        if (priceCe === null && priceCcp === null) {
          status = 'NO_PRICE';
          countNoPrice++;
        } else if (priceCe === null) {
          status = 'CCP_ONLY';
          countCcpOnly++;
        } else if (priceCcp === null) {
          status = 'CE_ONLY';
          countCeOnly++;
        } else {
          diff = parseFloat(Math.abs(priceCe - priceCcp).toFixed(6));
          if (diff < 0.0001) {
            status = 'MATCH';
            countMatch++;
          } else if (diff <= tickSize + 0.00001) {
            status = 'MINOR_DIFF';
            countMinorDiff++;
          } else {
            status = 'DIFF';
            countDiff++;
          }
        }

        rows.push({
          symbol,
          commodity,
          priceCe,
          priceCcp,
          diff,
          tickSize,
          status,
          dateCe: ceItem?.date || null,
          dateCcp: ccpItem?.date || null,
          currency: ceItem?.currency || ccpItem?.currency || '',
        });
      }

      // Priority sort: DIFF -> MINOR_DIFF -> CE_ONLY -> CCP_ONLY -> MATCH
      const statusOrder: Record<string, number> = {
        DIFF: 0,
        MINOR_DIFF: 1,
        CE_ONLY: 2,
        CCP_ONLY: 3,
        NO_PRICE: 4,
        MATCH: 5,
      };
      rows.sort((a, b) => {
        const orderDiff = (statusOrder[a.status] ?? 6) - (statusOrder[b.status] ?? 6);
        if (orderDiff !== 0) return orderDiff;
        return a.symbol.localeCompare(b.symbol);
      });

      const durationMs = Date.now() - this.currentStartTime;
      this.logStep(
        `Hoàn tất đối soát trong ${Math.round(durationMs / 1000)}s! Kết quả: ${countMatch} MATCH, ${countMinorDiff} MINOR_DIFF, ${countDiff} DIFF, ${countCeOnly} CE_ONLY, ${countCcpOnly} CCP_ONLY.`,
      );

      const report: CeCcpGttReport = {
        runAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        targetDate: options.targetDate,
        totalContracts: rows.length,
        matched: countMatch,
        minorDiffCount: countMinorDiff,
        diffCount: countDiff,
        ceOnlyCount: countCeOnly,
        ccpOnlyCount: countCcpOnly,
        noPriceCount: countNoPrice,
        filterOpen,
        rows,
        logs: [...this.currentLogs],
        filePaths: files,
      };

      this.latestReport = report;
      this.saveReportToCache(report);
      return report;
    } catch (err: any) {
      this.logStep(`Lỗi tiến trình đối soát GTT CE-CCP: ${err.message}`);
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Tạo Buffer Excel cho báo cáo đầy đủ
   */
  generateReportExcelBuffer(): Buffer {
    if (!this.latestReport || !this.latestReport.rows.length) {
      throw new Error('Chưa có dữ liệu báo cáo để xuất Excel.');
    }

    const excelRows = this.latestReport.rows.map((r, idx) => ({
      STT: idx + 1,
      'Mã hợp đồng': r.symbol,
      'Mã hàng hóa': r.commodity,
      'Giá CoreEX (CE)': r.priceCe,
      'Giá CoreCCP': r.priceCcp,
      'Độ lệch (|CE - CCP|)': r.diff,
      'Bước giá (Tick Size)': r.tickSize,
      'Trạng thái': r.status,
      'Ngày phiên CE': r.dateCe || '',
      'Ngày phiên CCP': r.dateCcp || '',
      'Tiền tệ': r.currency || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Doi_Soat_GTT_CE_CCP');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Tạo Buffer Excel cho danh sách mã cần điều chỉnh giá
   */
  generateCorrectionExcelBuffer(): Buffer {
    if (!this.latestReport || !this.latestReport.rows.length) {
      throw new Error('Chưa có dữ liệu báo cáo để xuất Excel.');
    }

    const diffRows = this.latestReport.rows.filter(
      (r) => r.status === 'DIFF' || r.status === 'MINOR_DIFF',
    );

    if (diffRows.length === 0) {
      throw new Error('Không có mã hợp đồng nào bị lệch giá (DIFF/MINOR_DIFF) cần điều chỉnh.');
    }

    const fixRows = diffRows.map((r, idx) => ({
      STT: idx + 1,
      'Mã hợp đồng': r.symbol,
      'Mã hàng hóa': r.commodity,
      'Giá CoreEX': r.priceCe,
      'Giá CoreCCP hiện tại': r.priceCcp,
      'Giá đề xuất điều chỉnh': r.priceCe,
      'Độ lệch': r.diff,
      'Bước giá': r.tickSize,
      'Trạng thái': r.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(fixRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Dieu_Chinh_GTT');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

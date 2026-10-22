import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CoreCcpApiAdapter } from '../../ingress/adapters/coreccp-api.adapter';
import {
  EXTERNAL_SYSTEM_CORECCP,
  findHeaderIndex,
  findLatestFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
  resolveTradingCheckCcpDailyPath,
} from '../../../shared';
import { TRADING_FILE_PATTERNS } from '../constants/trading-file-patterns.constant';

export type OmsReconStatus =
  | 'MATCH'
  | 'DIFF_TTM'
  | 'DIFF_TOTAL'
  | 'DIFF_BOTH'
  | 'NOT_FOUND_IN_QLTTTKGD'
  | 'NOT_FOUND_IN_OMS';

export type OmsTtmReconStatus =
  | 'MATCH'
  | 'DIFF_BUY'
  | 'DIFF_SELL'
  | 'DIFF_BOTH'
  | 'NOT_FOUND_IN_TTM'
  | 'NOT_FOUND_IN_OMS';

export interface IOmsTtmPositionDetail {
  accountId: string;
  symbol: string;
  txDate?: string;
  orderId?: string;
  execId?: string;
  longQtty: number;
  shortQtty: number;
  closeQtty?: number;
  matchPrice?: number;
  currency?: string;
  source: 'OMS' | 'TTM_FILE';
}

export interface IOmsTtmReconRow {
  accountNumber: string;
  accountId: string;
  symbol: string;

  omsBuyQty: number;
  ttmBuyQty: number;
  diffBuyQty: number;
  isMatchBuy: boolean;

  omsSellQty: number;
  ttmSellQty: number;
  diffSellQty: number;
  isMatchSell: boolean;

  status: OmsTtmReconStatus;
  statusNote: string;

  omsDetails: IOmsTtmPositionDetail[];
  ttmDetails: IOmsTtmPositionDetail[];
}

export interface IOmsTtmReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  ttmFilePath?: string;
  summary: {
    totalPairs: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffBuy: number;
    totalDiffSell: number;
    totalDiffBoth: number;
    totalNotFoundInTtm: number;
    totalNotFoundInOms: number;
    totalOmsBuyVol: number;
    totalOmsSellVol: number;
    totalTtmBuyVol: number;
    totalTtmSellVol: number;
  };
  rows: IOmsTtmReconRow[];
  logs?: string[];
}

export type OmsTtttReconStatus =
  | 'MATCH'
  | 'DIFF_VOL'
  | 'DIFF_PNL'
  | 'DIFF_BOTH'
  | 'NOT_FOUND_IN_TTTT'
  | 'NOT_FOUND_IN_OMS';

export interface IOmsTtttPositionDetail {
  accountId: string;
  symbol: string;
  txDate?: string;
  closeDate?: string;
  closeSide: string; // 'BUY' | 'SELL'
  closeQtty: number;
  costPrice?: number;
  closePrice?: number;
  vrplAmt: number;
  vrplAmt_Vnd?: number;
  orderId?: string;
  closeOrderId?: string;
  execId?: string;
  closeExecId?: string;
  currency?: string;
  source: 'OMS' | 'TTTT_FILE';
}

export interface IOmsTtttReconRow {
  accountNumber: string;
  accountId: string;
  symbol: string;

  omsBuyQty: number;
  ttttBuyQty: number;
  diffBuyQty: number;
  isMatchBuy: boolean;

  omsSellQty: number;
  ttttSellQty: number;
  diffSellQty: number;
  isMatchSell: boolean;

  omsRealizedPnl: number;
  ttttRealizedPnl: number;
  diffRealizedPnl: number;
  isMatchPnl: boolean;

  omsRealizedPnlVnd: number;
  ttttRealizedPnlVnd: number;
  diffRealizedPnlVnd: number;

  status: OmsTtttReconStatus;
  statusNote: string;

  omsDetails: IOmsTtttPositionDetail[];
  ttttDetails: IOmsTtttPositionDetail[];
}

export interface IOmsTtttReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  ttttFilePath?: string;
  summary: {
    totalPairs: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffVol: number;
    totalDiffPnl: number;
    totalDiffBoth: number;
    totalNotFoundInTttt: number;
    totalNotFoundInOms: number;
    totalOmsBuyVol: number;
    totalOmsSellVol: number;
    totalTtttBuyVol: number;
    totalTtttSellVol: number;
    totalOmsRealizedPnl: number;
    totalTtttRealizedPnl: number;
    totalDiffRealizedPnl: number;
    totalOmsRealizedPnlVnd: number;
    totalTtttRealizedPnlVnd: number;
    totalDiffRealizedPnlVnd: number;
  };
  rows: IOmsTtttReconRow[];
  logs?: string[];
}

export interface IOmsPortfolioItem {
  symbol: string;
  uaCode: string;
  longQtty: number;
  shortQtty: number;
  openPositionQtty: number;
  pendingLongIM_Qtty: number;
  pendingShortIM_Qtty: number;
  pendingIM_Qtty: number;
  rmo: number;
  rma: number;
  evrplAmt: number;
  vwap: number;
}

export interface IOmsMarginReconRow {
  accountNumber: string;
  accountId: string;
  memberCode: string;
  imCash: number;
  cashAvlWithdraw: number;
  totalNav: number;

  // 1. Ký quỹ TTM
  omsRma: number;
  qlReqSecured: number;
  diffTtm: number;
  isMatchTtm: boolean;

  // 2. Ký quỹ Lệnh chờ & Tổng
  omsRmo: number;
  omsTotalReq: number;
  qlEReqSecured: number;
  diffTotal: number;
  isMatchTotal: boolean;

  status: OmsReconStatus;
  statusNote: string;
  portfolios: Record<string, IOmsPortfolioItem>;
}

export interface IOmsMarginReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  summary: {
    totalOmsAccounts: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffTtm: number;
    totalDiffTotal: number;
    totalDiffBoth: number;
    totalNotFoundInQl: number;
    totalNotFoundInOms: number;
  };
  rows: IOmsMarginReconRow[];
  logs?: string[];
}

@Injectable()
export class OmsReconService {
  private readonly logger = new Logger(OmsReconService.name);
  private cachedLatestResult: IOmsMarginReconResult | null = null;
  private cachedLatestTtmResult: IOmsTtmReconResult | null = null;
  private cachedLatestTtttResult: IOmsTtttReconResult | null = null;
  private readonly cacheDir = path.join(process.cwd(), 'temp', 'oms_recon');

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    @Inject(forwardRef(() => CoreCcpApiAdapter))
    private readonly coreCcpApiAdapter?: CoreCcpApiAdapter,
  ) {
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Không thể tạo thư mục cache OMS ${this.cacheDir}: ${err.message}`);
      }
    }
    // Nạp lại kết quả đã lưu bền vững gần nhất từ đĩa khi khởi động server
    this.cachedLatestResult = this.loadJsonCache<IOmsMarginReconResult>('margin_latest.json');
    this.cachedLatestTtmResult = this.loadJsonCache<IOmsTtmReconResult>('ttm_latest.json');
    this.cachedLatestTtttResult = this.loadJsonCache<IOmsTtttReconResult>('tttt_latest.json');
    if (this.cachedLatestResult) {
      this.logger.log(`[OMS-Recon] Đã nạp cache Ký quỹ OMS từ đĩa (phiên ${this.cachedLatestResult.sessionDate}).`);
    }
  }

  private saveJsonCache(filename: string, data: any) {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(path.join(this.cacheDir, filename), JSON.stringify(data), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Không thể lưu cache OMS ${filename}: ${err.message}`);
    }
  }

  private loadJsonCache<T>(filename: string): T | null {
    try {
      const fullPath = path.join(this.cacheDir, filename);
      if (fs.existsSync(fullPath)) {
        const raw = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      this.logger.warn(`Không thể đọc cache OMS ${filename}: ${err.message}`);
    }
    return null;
  }

  /**
   * Chuẩn hóa mã tài khoản (loại bỏ hậu tố -A, -M, khoảng trắng)
   */
  private normalizeAccount(acc: string): string {
    if (!acc) return '';
    return String(acc).trim().toUpperCase().replace(/-[A-Z0-9]$/, '');
  }

  /**
   * Chuyển đổi an toàn giá trị số (khoa học E-notation, chuỗi có dấu phẩy)
   */
  private parseNumber(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Lấy số liệu QLTTTKGD từ REST Search API hoặc File Backup
   */
  private async fetchQltkgdMap(
    session: any,
    baseUrl: string,
    targetDate: string,
  ): Promise<Map<string, { reqSecured: number; eReqSecured: number; raw: any }>> {
    const qlMap = new Map<string, { reqSecured: number; eReqSecured: number; raw: any }>();

    // 1. Thử gọi Direct REST Search API (SearchCode: ACCTMARGIN_ALL)
    if (this.coreCcpApiAdapter) {
      try {
        this.logger.log(`[OmsReconService] Gọi API CoreCCP lấy dữ liệu QLTTTKGD (ACCTMARGIN_ALL)...`);
        const searchResult = await this.coreCcpApiAdapter.searchFullJson(
          session,
          'ACCTMARGIN_ALL',
          baseUrl,
          '/RISKMNG/ACCTMARGIN_ALL',
        );

        if (searchResult && Array.isArray(searchResult.rows) && searchResult.rows.length > 0) {
          for (const row of searchResult.rows) {
            const rawAcc = row.INVESTORCODE || row['Mã TKGD'] || row.AFACCTNO || row.CUSTODYCD || '';
            const clean = this.normalizeAccount(rawAcc);
            if (!clean) continue;

            const reqSecured = this.parseNumber(row.REQSECURED ?? row['KQ ban đầu yêu cầu'] ?? row['Ký quỹ ban đầu yêu cầu']);
            const eReqSecured = this.parseNumber(row.EREQSECURED ?? row['KQ ban đầu yêu cầu tạm tính'] ?? row['Ký quỹ ban đầu yêu cầu tạm tính']);

            qlMap.set(clean, { reqSecured, eReqSecured, raw: row });
          }
          this.logger.log(`[OmsReconService] Đã nạp ${qlMap.size} tài khoản QLTTTKGD qua Direct Search API.`);
          return qlMap;
        }
      } catch (apiErr: any) {
        this.logger.warn(`[OmsReconService] Không thể tải QLTTTKGD qua Direct Search API: ${apiErr.message}. Thử đọc file backup...`);
      }
    }

    // 2. Fallback sang đọc file QL TT TKGD.xlsx trong thư mục lưu trữ
    try {
      const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
      const [y, m, d] = targetDate.includes('-')
        ? targetDate.split('-')
        : [new Date().getFullYear().toString(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')];
      const subFolder = path.join(y, `T${m}.${y}`, `${d}.${m}`);
      const checkDailyPath = resolveTradingCheckCcpDailyPath(subFolder, rawCcpBase);
      const backupDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

      const candidateDirs = [checkDailyPath, backupDailyPath].filter((p) => fs.existsSync(p));
      let qltkgdFile: string | null = null;
      for (const dir of candidateDirs) {
        const found = findLatestFile(dir, /ql[\s_]*t+[\s_]*t*k?gd|ql.*tt.*tkgd/i);
        if (found && fs.existsSync(found)) {
          qltkgdFile = found;
          break;
        }
      }

      if (qltkgdFile && fs.existsSync(qltkgdFile)) {
        this.logger.log(`[OmsReconService] Đọc dữ liệu QLTTTKGD từ tệp: ${qltkgdFile}`);
        const wb = XLSX.readFile(qltkgdFile);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows && rows.length > 1) {
          const header = rows[0].map((h) => String(h || '').trim());
          const accIdx = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Investor Code', 'Tai khoan', 'TKGD']);
          const reqIdx = findHeaderIndex(header, 'KQ ban đầu yêu cầu', ['Ký quỹ ban đầu yêu cầu', 'REQSECURED', 'KQ yêu cầu']);
          const eReqIdx = findHeaderIndex(header, 'KQ ban đầu yêu cầu tạm tính', ['Ký quỹ ban đầu yêu cầu tạm tính', 'EREQSECURED', 'KQ tạm tính']);

          if (accIdx !== -1) {
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row) continue;
              const rawAcc = String(row[accIdx] || '').trim();
              const clean = this.normalizeAccount(rawAcc);
              if (!clean) continue;

              const reqSecured = reqIdx !== -1 ? this.parseNumber(row[reqIdx]) : 0;
              const eReqSecured = eReqIdx !== -1 ? this.parseNumber(row[eReqIdx]) : 0;
              qlMap.set(clean, { reqSecured, eReqSecured, raw: row });
            }
            this.logger.log(`[OmsReconService] Đã nạp ${qlMap.size} tài khoản QLTTTKGD từ file backup.`);
          }
        }
      }
    } catch (fsErr: any) {
      this.logger.warn(`[OmsReconService] Lỗi khi đọc file QLTTTKGD backup: ${fsErr.message}`);
    }

    return qlMap;
  }

  /**
   * Thực hiện đối chiếu ký quỹ giữa Monitor OMS ACM và QLTTTKGD
   */
  public async checkOmsMarginReconciliation(sessionDateStr?: string): Promise<IOmsMarginReconResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const emitLog = (msg: string) => {
      this.logger.log(msg);
      logs.push(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
    };

    const targetDate = sessionDateStr || new Date().toISOString().split('T')[0];
    emitLog(`Khởi chạy đối chiếu Ký quỹ OMS - QLTTTKGD cho phiên: ${targetDate}`);

    if (!this.coreCcpApiAdapter) {
      throw new Error('Hệ thống chưa nạp CoreCcpApiAdapter!');
    }

    // 1. Xác thực và nạp Session CoreCCP
    let baseUrl = process.env.CORECCP_BASE_URL || EXTERNAL_SYSTEM_CORECCP.baseUrl;
    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('coreccp_base_url', baseUrl);
    }
    const session = await this.coreCcpApiAdapter.getValidSession();
    emitLog(`Xác thực CoreCCP thành công (User: ${session.username}, Host: ${new URL(baseUrl).hostname})`);

    // 2. Gọi API OMS_ACM lấy danh sách tài khoản OMS
    emitLog(`Đang gửi yêu cầu POST /ccp/inquiry/OMS_ACM (searchcode: OMS_ACCOUNT)...`);
    const omsRes = await this.coreCcpApiAdapter.getOmsAcmAccounts(session, baseUrl);
    const omsAccounts: any[] = omsRes.data || [];
    emitLog(`Nhận về ${omsAccounts.length} tài khoản từ phân hệ Monitor OMS.`);

    // 3. Lấy dữ liệu đối soát QLTTTKGD (CoreCCP ACCTMARGIN_ALL)
    emitLog(`Đang lấy dữ liệu đối ứng từ QLTTTKGD (CoreCCP Bù trừ)...`);
    const qlMap = await this.fetchQltkgdMap(session, baseUrl, targetDate);
    emitLog(`Tổng hợp được ${qlMap.size} tài khoản trong bảng QLTTTKGD.`);

    // 4. So khớp từng tài khoản
    const rows: IOmsMarginReconRow[] = [];
    const matchedSet = new Set<string>();

    let totalMatched = 0;
    let totalDiffTtm = 0;
    let totalDiffTotal = 0;
    let totalDiffBoth = 0;
    let totalNotFoundInQl = 0;

    for (const item of omsAccounts) {
      const accountId = String(item.accountId || `${item.dmaAccount}-A`);
      const rawAcc = String(item.dmaAccount || accountId);
      const cleanAcc = this.normalizeAccount(rawAcc);
      matchedSet.add(cleanAcc);

      const memberCode = String(item.memberCode || '');
      const imCash = this.parseNumber(item.imCash);
      const cashAvlWithdraw = this.parseNumber(item.cashAvlWithdraw);
      const totalNav = this.parseNumber(item.totalNav);

      // 1. Ký quỹ TTM (rma)
      const omsRma = this.parseNumber(item.rma);

      // 2. Ký quỹ Lệnh chờ (rmo)
      const omsRmo = this.parseNumber(item.rmo);
      const omsTotalReq = omsRma + omsRmo;

      // Parse danh sách hợp đồng con trong portfolios
      const portfolios: Record<string, IOmsPortfolioItem> = {};
      if (item.portfolios && typeof item.portfolios === 'object') {
        for (const [sym, p] of Object.entries<any>(item.portfolios)) {
          portfolios[sym] = {
            symbol: sym,
            uaCode: String(p.uaCode || ''),
            longQtty: this.parseNumber(p.longQtty),
            shortQtty: this.parseNumber(p.shortQtty),
            openPositionQtty: this.parseNumber(p.openPositionQtty),
            pendingLongIM_Qtty: this.parseNumber(p.pendingLongIM_Qtty),
            pendingShortIM_Qtty: this.parseNumber(p.pendingShortIM_Qtty),
            pendingIM_Qtty: this.parseNumber(p.pendingIM_Qtty),
            rmo: this.parseNumber(p.rmo),
            rma: this.parseNumber(p.rma),
            evrplAmt: this.parseNumber(p.evrplAmt),
            vwap: this.parseNumber(p.vwap),
          };
        }
      }

      // So khớp với bảng QLTTTKGD
      const qlItem = qlMap.get(cleanAcc);
      let qlReqSecured = 0;
      let qlEReqSecured = 0;
      let isMatchTtm = false;
      let isMatchTotal = false;
      let status: OmsReconStatus = 'MATCH';
      let statusNote = '';

      if (qlItem) {
        qlReqSecured = qlItem.reqSecured;
        qlEReqSecured = qlItem.eReqSecured;

        const diffTtm = omsRma - qlReqSecured;
        const diffTotal = omsTotalReq - qlEReqSecured;

        isMatchTtm = Math.abs(diffTtm) <= 1; // Cho phép sai số làm tròn 1 VND
        isMatchTotal = Math.abs(diffTotal) <= 1;

        if (isMatchTtm && isMatchTotal) {
          status = 'MATCH';
          statusNote = 'Khớp hoàn toàn công thức TTM & Lệnh chờ';
          totalMatched++;
        } else if (!isMatchTtm && isMatchTotal) {
          status = 'DIFF_TTM';
          statusNote = `Lệch Ký quỹ TTM (${diffTtm > 0 ? '+' : ''}${diffTtm.toLocaleString('vi-VN')} VND)`;
          totalDiffTtm++;
        } else if (isMatchTtm && !isMatchTotal) {
          status = 'DIFF_TOTAL';
          statusNote = `Lệch Ký quỹ Tổng tạm tính (${diffTotal > 0 ? '+' : ''}${diffTotal.toLocaleString('vi-VN')} VND)`;
          totalDiffTotal++;
        } else {
          status = 'DIFF_BOTH';
          statusNote = `Lệch cả Ký quỹ TTM và Ký quỹ Tổng`;
          totalDiffBoth++;
        }

        rows.push({
          accountNumber: cleanAcc,
          accountId,
          memberCode,
          imCash,
          cashAvlWithdraw,
          totalNav,
          omsRma,
          qlReqSecured,
          diffTtm,
          isMatchTtm,
          omsRmo,
          omsTotalReq,
          qlEReqSecured,
          diffTotal,
          isMatchTotal,
          status,
          statusNote,
          portfolios,
        });
      } else {
        status = 'NOT_FOUND_IN_QLTTTKGD';
        statusNote = 'Không tìm thấy tài khoản trong bảng QLTTTKGD';
        totalNotFoundInQl++;

        rows.push({
          accountNumber: cleanAcc,
          accountId,
          memberCode,
          imCash,
          cashAvlWithdraw,
          totalNav,
          omsRma,
          qlReqSecured: 0,
          diffTtm: omsRma,
          isMatchTtm: false,
          omsRmo,
          omsTotalReq,
          qlEReqSecured: 0,
          diffTotal: omsTotalReq,
          isMatchTotal: false,
          status,
          statusNote,
          portfolios,
        });
      }
    }

    // 5. Kiểm tra các tài khoản có ký quỹ trong QLTTTKGD nhưng thiếu trong OMS
    let totalNotFoundInOms = 0;
    for (const [cleanAcc, qlItem] of qlMap.entries()) {
      if (!matchedSet.has(cleanAcc) && (qlItem.reqSecured > 0 || qlItem.eReqSecured > 0)) {
        totalNotFoundInOms++;
        rows.push({
          accountNumber: cleanAcc,
          accountId: cleanAcc,
          memberCode: String(qlItem.raw?.MEMBERCODE || ''),
          imCash: this.parseNumber(qlItem.raw?.IMCASH),
          cashAvlWithdraw: 0,
          totalNav: 0,
          omsRma: 0,
          qlReqSecured: qlItem.reqSecured,
          diffTtm: -qlItem.reqSecured,
          isMatchTtm: false,
          omsRmo: 0,
          omsTotalReq: 0,
          qlEReqSecured: qlItem.eReqSecured,
          diffTotal: -qlItem.eReqSecured,
          isMatchTotal: false,
          status: 'NOT_FOUND_IN_OMS',
          statusNote: 'Tài khoản có ký quỹ ở QLTTTKGD nhưng không thấy trong OMS',
          portfolios: {},
        });
      }
    }

    // Sắp xếp: Ưu tiên tài khoản LỆCH lên đầu để người vận hành phát hiện ngay
    rows.sort((a, b) => {
      const isDiffA = a.status !== 'MATCH' ? 1 : 0;
      const isDiffB = b.status !== 'MATCH' ? 1 : 0;
      if (isDiffA !== isDiffB) return isDiffB - isDiffA;
      return Math.abs(b.diffTotal) - Math.abs(a.diffTotal);
    });

    const durationMs = Date.now() - startTime;
    const totalDiff = totalDiffTtm + totalDiffTotal + totalDiffBoth + totalNotFoundInQl + totalNotFoundInOms;

    emitLog(
      `Hoàn tất đối chiếu OMS: Tổng ${rows.length} TK | Khớp: ${totalMatched} | Lệch TTM: ${totalDiffTtm} | Lệch Tổng: ${totalDiffTotal} | Lệch Cả Hai: ${totalDiffBoth} (${(durationMs / 1000).toFixed(2)}s)`,
    );

    const result: IOmsMarginReconResult = {
      success: true,
      sessionDate: targetDate,
      executedAt: new Date().toISOString(),
      durationMs,
      source: baseUrl,
      summary: {
        totalOmsAccounts: omsAccounts.length,
        totalMatched,
        totalDiff,
        totalDiffTtm,
        totalDiffTotal,
        totalDiffBoth,
        totalNotFoundInQl,
        totalNotFoundInOms,
      },
      rows,
      logs,
    };

    this.cachedLatestResult = result;
    this.saveJsonCache('margin_latest.json', result);
    if (targetDate) {
      this.saveJsonCache(`margin_${targetDate}.json`, result);
    }
    return result;
  }

  /**
   * Lấy kết quả đối chiếu OMS mới nhất trong cache (ưu tiên ngày nếu có)
   */
  public getLatestResult(sessionDate?: string): IOmsMarginReconResult | null {
    if (sessionDate) {
      const dateResult = this.loadJsonCache<IOmsMarginReconResult>(`margin_${sessionDate}.json`);
      if (dateResult) return dateResult;
    }
    return this.cachedLatestResult || this.loadJsonCache<IOmsMarginReconResult>('margin_latest.json');
  }

  /**
   * Quét tìm file TTM tải trực tiếp trong các thư mục lưu trữ phiên
   */
  private async findTtmFile(targetDate: string): Promise<string | null> {
    const [y, m, d] = targetDate.includes('-')
      ? targetDate.split('-')
      : [
          new Date().getFullYear().toString(),
          String(new Date().getMonth() + 1).padStart(2, '0'),
          String(new Date().getDate()).padStart(2, '0'),
        ];
    const subFolder = path.join(y, `T${m}.${y}`, `${d}.${m}`);

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const checkCcpPath = resolveTradingCheckCcpDailyPath(subFolder, rawCcpBase);
    const backupCcpPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    const candidates = [
      checkCcpPath,
      backupCcpPath,
      path.join(process.cwd(), 'data', 'trading-check', 'ccp', 'futures', subFolder),
      path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures', subFolder),
      path.join(process.cwd(), 'data', 'trading-check', 'ccp', subFolder),
      path.join(process.cwd(), 'data', 'backup', 'ccp', subFolder),
    ];

    const patterns = TRADING_FILE_PATTERNS.CCP_TTM;

    for (const dir of candidates) {
      if (!fs.existsSync(dir)) continue;
      for (const pattern of patterns) {
        const found = findLatestFile(dir, pattern);
        if (found && fs.existsSync(found) && fs.statSync(found).size > 0) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Bóc tách dữ liệu từ file TTM (hỗ trợ cả .csv và .xlsx)
   */
  private parseTtmFile(filePath: string): IOmsTtmPositionDetail[] {
    const buffer = fs.readFileSync(filePath);
    let rows: any[][] = [];

    if (filePath.toLowerCase().endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      const wb = XLSX.read(content, { type: 'string' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    } else {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'export') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    }

    if (!rows || rows.length < 2) return [];

    let headerRowIdx = 0;
    let accIdx = -1;
    let symIdx = -1;
    let buyIdx = -1;
    let sellIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      if (!rows[r]) continue;
      const header = rows[r].map((h) => String(h || '').trim());
      const tempAcc = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Account', 'ACCTNO', 'Số tài khoản', 'Investor Code', 'Tai khoan', 'TKGD']);
      const tempSym = findHeaderIndex(header, 'Mã hợp đồng', ['Mã HĐ', 'Symbol', 'SYMBOL', 'Hợp đồng', 'Contract', 'Mã HD']);
      const tempBuy = findHeaderIndex(header, 'Khối lượng mua', ['KL Mua', 'KL mua', 'LONGQTTY', 'Long', 'Buy Volume']);
      const tempSell = findHeaderIndex(header, 'Khối lượng bán', ['KL Bán', 'KL bán', 'SHORTQTTY', 'Short', 'Sell Volume']);

      if (tempAcc !== -1 && tempSym !== -1 && (tempBuy !== -1 || tempSell !== -1)) {
        headerRowIdx = r;
        accIdx = tempAcc;
        symIdx = tempSym;
        buyIdx = tempBuy;
        sellIdx = tempSell;
        break;
      }
    }

    if (accIdx === -1 || symIdx === -1) {
      this.logger.warn(`File TTM ${filePath} không tìm thấy cột Mã TKGD hoặc Mã hợp đồng.`);
      return [];
    }

    const header = rows[headerRowIdx].map((h) => String(h || '').trim());
    const closeIdx = findHeaderIndex(header, 'Khối lượng đóng', ['KL Đóng', 'KL đóng', 'CLOSEQTTY', 'Close Volume', 'Close']);
    const orderIdx = findHeaderIndex(header, 'Mã giao dịch', ['Mã lệnh', 'ORDERID', 'Order ID', 'So hieu lenh', 'Mã GD']);
    const execIdx = findHeaderIndex(header, 'ExecId', ['Mã giao dịch OMS', 'EXECID', 'Exec ID']);
    const priceIdx = findHeaderIndex(header, 'Giá khớp', ['Giá TB', 'VWAP', 'MATCHPRICE', 'Giá trung bình', 'Price']);
    const dateIdx = findHeaderIndex(header, 'Ngày thực hiện', ['Ngày giờ thực hiện', 'TXDATE', 'Ngày mở', 'Date', 'Trading Date', 'Session Date']);
    const currIdx = findHeaderIndex(header, 'Tiền tệ', ['Currency', 'CURRENCY']);

    const items: IOmsTtmPositionDetail[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawAcc = String(row[accIdx] || '').trim();
      const rawSym = String(row[symIdx] || '').trim();
      if (!rawAcc || !rawSym) continue;

      const longQtty = buyIdx !== -1 ? this.parseNumber(row[buyIdx]) : 0;
      const shortQtty = sellIdx !== -1 ? this.parseNumber(row[sellIdx]) : 0;
      const closeQtty = closeIdx !== -1 ? this.parseNumber(row[closeIdx]) : 0;
      const matchPrice = priceIdx !== -1 ? this.parseNumber(row[priceIdx]) : 0;
      const orderId = orderIdx !== -1 ? String(row[orderIdx] || '').trim() : '';
      const execId = execIdx !== -1 ? String(row[execIdx] || '').trim() : '';
      const txDate = dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '';
      const currency = currIdx !== -1 ? String(row[currIdx] || '').trim() : 'USD';

      items.push({
        accountId: rawAcc,
        symbol: rawSym,
        longQtty,
        shortQtty,
        closeQtty,
        orderId,
        execId,
        matchPrice,
        txDate,
        currency,
        source: 'TTM_FILE',
      });
    }

    return items;
  }

  /**
   * Thực hiện đối chiếu trạng thái mở (TTM) giữa OMS (API OMS_OPEN_POSITION) và File TTM tải trực tiếp
   */
  public async checkOmsTtmReconciliation(sessionDateStr?: string): Promise<IOmsTtmReconResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const emitLog = (msg: string) => {
      this.logger.log(msg);
      logs.push(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
    };

    const targetDate = sessionDateStr || new Date().toISOString().split('T')[0];
    emitLog(`Khởi chạy đối chiếu TTM (Trạng thái mở) OMS vs File TTM cho phiên: ${targetDate}`);

    if (!this.coreCcpApiAdapter) {
      throw new Error('Hệ thống chưa nạp CoreCcpApiAdapter!');
    }

    // 1. Xác thực và nạp Session CoreCCP
    let baseUrl = process.env.CORECCP_BASE_URL || EXTERNAL_SYSTEM_CORECCP.baseUrl;
    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('coreccp_base_url', baseUrl);
    }
    const session = await this.coreCcpApiAdapter.getValidSession();
    emitLog(`Xác thực CoreCCP thành công (User: ${session.username}, Host: ${new URL(baseUrl).hostname})`);

    // 2. Gọi API OMS_ACM lấy danh sách vị thế mở từ OMS (searchcode: OMS_OPEN_POSITION)
    emitLog(`Đang gửi yêu cầu POST /ccp/inquiry/OMS_ACM (searchcode: OMS_OPEN_POSITION)...`);
    const omsRes = await this.coreCcpApiAdapter.getOmsOpenPositions(session, baseUrl);
    const omsPositions: any[] = omsRes.data || [];
    emitLog(`Nhận về ${omsPositions.length} bản ghi vị thế mở từ OMS.`);

    // 3. Tìm và bóc tách file TTM tải trực tiếp
    emitLog(`Đang quét tệp TTM tải trực tiếp cho ngày ${targetDate}...`);
    const ttmFilePath = await this.findTtmFile(targetDate);
    let ttmPositions: IOmsTtmPositionDetail[] = [];
    if (ttmFilePath) {
      emitLog(`Đã tìm thấy tệp TTM: ${ttmFilePath}`);
      ttmPositions = this.parseTtmFile(ttmFilePath);
      emitLog(`Bóc tách được ${ttmPositions.length} bản ghi từ tệp TTM.`);
    } else {
      emitLog(`CẢNH BÁO: Chưa tìm thấy tệp TTM trong các thư mục lưu trữ phiên ${targetDate}.`);
    }

    // 4. Gom nhóm theo cặp (Mã TKGD, Mã Hợp Đồng)
    interface IGroupedPos {
      accountNumber: string;
      accountId: string;
      symbol: string;
      buy: number;
      sell: number;
      details: IOmsTtmPositionDetail[];
    }

    const omsMap = new Map<string, IGroupedPos>();
    for (const p of omsPositions) {
      const normAcc = this.normalizeAccount(p.accountId || '');
      const normSym = String(p.symbol || '').trim().toUpperCase();
      if (!normAcc || !normSym) continue;

      const key = `${normAcc}___${normSym}`;
      if (!omsMap.has(key)) {
        omsMap.set(key, {
          accountNumber: normAcc,
          accountId: p.accountId || normAcc,
          symbol: normSym,
          buy: 0,
          sell: 0,
          details: [],
        });
      }
      const g = omsMap.get(key)!;
      const buy = this.parseNumber(p.longQtty);
      const sell = this.parseNumber(p.shortQtty);
      g.buy += buy;
      g.sell += sell;
      g.details.push({
        accountId: p.accountId,
        symbol: p.symbol,
        txDate: p.txDate,
        orderId: p.orderId,
        execId: p.execId,
        longQtty: buy,
        shortQtty: sell,
        closeQtty: this.parseNumber(p.closeQtty),
        matchPrice: this.parseNumber(p.matchPrice),
        currency: p.currency || 'USD',
        source: 'OMS',
      });
    }

    const ttmMap = new Map<string, IGroupedPos>();
    for (const p of ttmPositions) {
      const normAcc = this.normalizeAccount(p.accountId || '');
      const normSym = String(p.symbol || '').trim().toUpperCase();
      if (!normAcc || !normSym) continue;

      const key = `${normAcc}___${normSym}`;
      if (!ttmMap.has(key)) {
        ttmMap.set(key, {
          accountNumber: normAcc,
          accountId: p.accountId || normAcc,
          symbol: normSym,
          buy: 0,
          sell: 0,
          details: [],
        });
      }
      const g = ttmMap.get(key)!;
      g.buy += p.longQtty;
      g.sell += p.shortQtty;
      g.details.push(p);
    }

    // 5. So khớp hai nguồn dữ liệu
    const allKeys = new Set<string>([...omsMap.keys(), ...ttmMap.keys()]);
    const rows: IOmsTtmReconRow[] = [];

    let totalMatched = 0;
    let totalDiffBuy = 0;
    let totalDiffSell = 0;
    let totalDiffBoth = 0;
    let totalNotFoundInTtm = 0;
    let totalNotFoundInOms = 0;

    let totalOmsBuyVol = 0;
    let totalOmsSellVol = 0;
    let totalTtmBuyVol = 0;
    let totalTtmSellVol = 0;

    for (const key of allKeys) {
      const omsItem = omsMap.get(key);
      const ttmItem = ttmMap.get(key);

      const [normAcc, normSym] = key.split('___');
      const accountId = omsItem?.accountId || ttmItem?.accountId || normAcc;

      const omsBuyQty = omsItem?.buy || 0;
      const omsSellQty = omsItem?.sell || 0;
      const ttmBuyQty = ttmItem?.buy || 0;
      const ttmSellQty = ttmItem?.sell || 0;

      totalOmsBuyVol += omsBuyQty;
      totalOmsSellVol += omsSellQty;
      totalTtmBuyVol += ttmBuyQty;
      totalTtmSellVol += ttmSellQty;

      const diffBuyQty = omsBuyQty - ttmBuyQty;
      const diffSellQty = omsSellQty - ttmSellQty;
      const isMatchBuy = diffBuyQty === 0;
      const isMatchSell = diffSellQty === 0;

      let status: OmsTtmReconStatus = 'MATCH';
      let statusNote = '';

      if (!ttmItem) {
        status = 'NOT_FOUND_IN_TTM';
        statusNote = 'Có vị thế mở ở OMS nhưng không thấy trong file TTM';
        totalNotFoundInTtm++;
      } else if (!omsItem) {
        status = 'NOT_FOUND_IN_OMS';
        statusNote = 'Có vị thế mở ở file TTM nhưng không thấy trong OMS';
        totalNotFoundInOms++;
      } else if (isMatchBuy && isMatchSell) {
        status = 'MATCH';
        statusNote = 'Khớp hoàn toàn cả khối lượng mua và bán';
        totalMatched++;
      } else if (!isMatchBuy && isMatchSell) {
        status = 'DIFF_BUY';
        statusNote = `Lệch khối lượng mua (${diffBuyQty > 0 ? '+' : ''}${diffBuyQty})`;
        totalDiffBuy++;
      } else if (isMatchBuy && !isMatchSell) {
        status = 'DIFF_SELL';
        statusNote = `Lệch khối lượng bán (${diffSellQty > 0 ? '+' : ''}${diffSellQty})`;
        totalDiffSell++;
      } else {
        status = 'DIFF_BOTH';
        statusNote = `Lệch cả mua (${diffBuyQty > 0 ? '+' : ''}${diffBuyQty}) và bán (${diffSellQty > 0 ? '+' : ''}${diffSellQty})`;
        totalDiffBoth++;
      }

      rows.push({
        accountNumber: normAcc,
        accountId,
        symbol: normSym,
        omsBuyQty,
        ttmBuyQty,
        diffBuyQty,
        isMatchBuy,
        omsSellQty,
        ttmSellQty,
        diffSellQty,
        isMatchSell,
        status,
        statusNote,
        omsDetails: omsItem?.details || [],
        ttmDetails: ttmItem?.details || [],
      });
    }

    // Sắp xếp: Đưa các dòng có chênh lệch lên đầu
    rows.sort((a, b) => {
      const isDiffA = a.status !== 'MATCH' ? 1 : 0;
      const isDiffB = b.status !== 'MATCH' ? 1 : 0;
      if (isDiffA !== isDiffB) return isDiffB - isDiffA;
      const absA = Math.abs(a.diffBuyQty) + Math.abs(a.diffSellQty);
      const absB = Math.abs(b.diffBuyQty) + Math.abs(b.diffSellQty);
      return absB - absA;
    });

    const durationMs = Date.now() - startTime;
    const totalDiff = totalDiffBuy + totalDiffSell + totalDiffBoth + totalNotFoundInTtm + totalNotFoundInOms;

    emitLog(
      `Hoàn tất đối chiếu TTM: Tổng ${rows.length} cặp TK-HĐ | Khớp: ${totalMatched} | Lệch Mua: ${totalDiffBuy} | Lệch Bán: ${totalDiffSell} | Lệch Cả Hai: ${totalDiffBoth} (${(durationMs / 1000).toFixed(2)}s)`,
    );

    const result: IOmsTtmReconResult = {
      success: true,
      sessionDate: targetDate,
      executedAt: new Date().toISOString(),
      durationMs,
      source: baseUrl,
      ttmFilePath: ttmFilePath || undefined,
      summary: {
        totalPairs: rows.length,
        totalMatched,
        totalDiff,
        totalDiffBuy,
        totalDiffSell,
        totalDiffBoth,
        totalNotFoundInTtm,
        totalNotFoundInOms,
        totalOmsBuyVol,
        totalOmsSellVol,
        totalTtmBuyVol,
        totalTtmSellVol,
      },
      rows,
      logs,
    };

    this.cachedLatestTtmResult = result;
    this.saveJsonCache('ttm_latest.json', result);
    if (targetDate) {
      this.saveJsonCache(`ttm_${targetDate}.json`, result);
    }
    return result;
  }

  /**
   * Lấy kết quả đối chiếu TTM mới nhất trong cache (ưu tiên ngày nếu có)
   */
  public getLatestTtmResult(sessionDate?: string): IOmsTtmReconResult | null {
    if (sessionDate) {
      const dateResult = this.loadJsonCache<IOmsTtmReconResult>(`ttm_${sessionDate}.json`);
      if (dateResult) return dateResult;
    }
    return this.cachedLatestTtmResult || this.loadJsonCache<IOmsTtmReconResult>('ttm_latest.json');
  }

  /**
   * Quét tìm file TTTT tải trực tiếp trong các thư mục lưu trữ phiên
   */
  private async findTtttFile(targetDate: string): Promise<string | null> {
    const [y, m, d] = targetDate.includes('-')
      ? targetDate.split('-')
      : [
          new Date().getFullYear().toString(),
          String(new Date().getMonth() + 1).padStart(2, '0'),
          String(new Date().getDate()).padStart(2, '0'),
        ];
    const subFolder = path.join(y, `T${m}.${y}`, `${d}.${m}`);

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const checkCcpPath = resolveTradingCheckCcpDailyPath(subFolder, rawCcpBase);
    const backupCcpPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    const candidates = [
      checkCcpPath,
      backupCcpPath,
      path.join(process.cwd(), 'data', 'trading-check', 'ccp', 'futures', subFolder),
      path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures', subFolder),
      path.join(process.cwd(), 'data', 'trading-check', 'ccp', subFolder),
      path.join(process.cwd(), 'data', 'backup', 'ccp', subFolder),
    ];

    const patterns = TRADING_FILE_PATTERNS.CCP_TTTT;

    for (const dir of candidates) {
      if (!fs.existsSync(dir)) continue;
      for (const pattern of patterns) {
        const found = findLatestFile(dir, pattern);
        if (found && fs.existsSync(found) && fs.statSync(found).size > 0) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Bóc tách dữ liệu từ file TTTT (hỗ trợ cả .csv và .xlsx)
   */
  private parseTtttFile(filePath: string): IOmsTtttPositionDetail[] {
    const buffer = fs.readFileSync(filePath);
    let rows: any[][] = [];

    if (filePath.toLowerCase().endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      const wb = XLSX.read(content, { type: 'string' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    } else {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'export') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    }

    if (!rows || rows.length < 2) return [];

    let headerRowIdx = 0;
    let accIdx = -1;
    let symIdx = -1;
    let closeQttyIdx = -1;
    let buyQttyIdx = -1;
    let sellQttyIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      if (!rows[r]) continue;
      const header = rows[r].map((h) => String(h || '').trim());
      const tempAcc = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Account', 'ACCTNO', 'Số tài khoản', 'Investor Code', 'Tai khoan', 'TKGD']);
      const tempSym = findHeaderIndex(header, 'Mã hợp đồng', ['Mã HĐ', 'Symbol', 'SYMBOL', 'Hợp đồng', 'Contract', 'Mã HD']);
      const tempClose = findHeaderIndex(header, 'Khối lượng đóng', ['KL Đóng', 'KL đóng', 'CLOSEQTTY', 'Close Volume', 'Close Qtty', 'Khối lượng']);
      const tempBuy = findHeaderIndex(header, 'Khối lượng mua', ['KL Mua', 'KL mua', 'BUYQTTY', 'Buy Volume']);
      const tempSell = findHeaderIndex(header, 'Khối lượng bán', ['KL Bán', 'KL bán', 'SELLQTTY', 'Sell Volume']);

      if (tempAcc !== -1 && tempSym !== -1 && (tempClose !== -1 || tempBuy !== -1 || tempSell !== -1)) {
        headerRowIdx = r;
        accIdx = tempAcc;
        symIdx = tempSym;
        closeQttyIdx = tempClose;
        buyQttyIdx = tempBuy;
        sellQttyIdx = tempSell;
        break;
      }
    }

    if (accIdx === -1 || symIdx === -1 || (closeQttyIdx === -1 && buyQttyIdx === -1 && sellQttyIdx === -1)) {
      this.logger.warn(`File TTTT ${filePath} không tìm thấy cột Mã TKGD, Mã hợp đồng hoặc Khối lượng đóng/mua/bán.`);
      return [];
    }

    const header = rows[headerRowIdx].map((h) => String(h || '').trim());
    const sideIdx = findHeaderIndex(header, 'Lệnh', ['Side', 'Chiều', 'SIDE', 'Loại lệnh']);
    const pnlIdx = findHeaderIndex(header, 'Lãi lỗ thực tế', ['Lãi/lỗ thực tế', 'VRPL', 'VRPLAMT', 'Realized PnL', 'Lãi lỗ TT', 'Lãi lỗ']);
    const pnlVndIdx = findHeaderIndex(header, 'Lãi lỗ thực tế(VND)', ['Lãi lỗ thực tế (VND)', 'Lãi/lỗ thực tế (VND)', 'Lãi/lỗ thực tế(VND)', 'VRPLAMT_VND', 'Realized PnL (VND)', 'Lãi lỗ VND']);
    const costPriceIdx = findHeaderIndex(header, 'Giá vốn', ['Cost Price', 'Giavốn', 'COSTPRICE']);
    const closePriceIdx = findHeaderIndex(header, 'Giá đóng', ['Close Price', 'Giáđóng', 'CLOSEPRICE']);
    const orderIdx = findHeaderIndex(header, 'SHL mở', ['Mã GD mở', 'Số hiệu lệnh mở', 'ORDERID', 'Open Order ID', 'Mã lệnh mở']);
    const closeOrderIdx = findHeaderIndex(header, 'SHL đóng', ['Mã GD đóng', 'Số hiệu lệnh đóng', 'CLOSEORDERID', 'Close Order ID', 'Mã lệnh đóng']);
    const openDateIdx = findHeaderIndex(header, 'Ngày đặt lệnh mở', ['Ngày mở', 'TXDATE', 'Open Date']);
    const closeDateIdx = findHeaderIndex(header, 'Ngày đặt lệnh đóng', ['Ngày đóng', 'CLOSEDATE', 'Close Date']);
    const currIdx = findHeaderIndex(header, 'Tiền tệ', ['Currency', 'CURRENCY']);

    const items: IOmsTtttPositionDetail[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawAcc = String(row[accIdx] || '').trim();
      const rawSym = String(row[symIdx] || '').trim();
      if (!rawAcc || !rawSym) continue;

      const buyQtty = buyQttyIdx !== -1 ? this.parseNumber(row[buyQttyIdx]) : 0;
      const sellQtty = sellQttyIdx !== -1 ? this.parseNumber(row[sellQttyIdx]) : 0;
      let closeQtty = closeQttyIdx !== -1 ? this.parseNumber(row[closeQttyIdx]) : 0;
      if (closeQtty === 0 && (buyQtty > 0 || sellQtty > 0)) {
        closeQtty = Math.max(buyQtty, sellQtty);
      }

      let closeSide = 'BUY';
      if (sideIdx !== -1) {
        const sideRaw = String(row[sideIdx] || '').trim().toUpperCase();
        const isBuy = sideRaw.startsWith('BUY') || sideRaw.startsWith('MUA') || sideRaw === 'B';
        closeSide = isBuy ? 'BUY' : 'SELL';
      } else if (buyQtty > 0 && sellQtty === 0) {
        closeSide = 'BUY';
      } else if (sellQtty > 0 && buyQtty === 0) {
        closeSide = 'SELL';
      } else {
        closeSide = 'BOTH';
      }

      const vrplAmt = pnlIdx !== -1 ? this.parseNumber(row[pnlIdx]) : 0;
      const vrplAmt_Vnd = pnlVndIdx !== -1 ? this.parseNumber(row[pnlVndIdx]) : 0;
      const costPrice = costPriceIdx !== -1 ? this.parseNumber(row[costPriceIdx]) : 0;
      const closePrice = closePriceIdx !== -1 ? this.parseNumber(row[closePriceIdx]) : 0;
      const orderId = orderIdx !== -1 ? String(row[orderIdx] || '').trim() : '';
      const closeOrderId = closeOrderIdx !== -1 ? String(row[closeOrderIdx] || '').trim() : '';
      const txDate = openDateIdx !== -1 ? String(row[openDateIdx] || '').trim() : '';
      const closeDate = closeDateIdx !== -1 ? String(row[closeDateIdx] || '').trim() : '';
      const currency = currIdx !== -1 ? String(row[currIdx] || '').trim() : 'USD';

      items.push({
        accountId: rawAcc,
        symbol: rawSym,
        closeSide,
        closeQtty,
        vrplAmt,
        vrplAmt_Vnd,
        costPrice,
        closePrice,
        orderId,
        closeOrderId,
        txDate,
        closeDate,
        currency,
        source: 'TTTT_FILE',
      });
    }

    return items;
  }

  /**
   * Thực hiện đối chiếu trạng thái tất toán và lãi lỗ (TTTT) giữa OMS (API OMS_PNL_DETAIL) và File TTTT tải trực tiếp
   */
  public async checkOmsTtttReconciliation(sessionDateStr?: string): Promise<IOmsTtttReconResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const emitLog = (msg: string) => {
      this.logger.log(msg);
      logs.push(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
    };

    const targetDate = sessionDateStr || new Date().toISOString().split('T')[0];
    emitLog(`Khởi chạy đối chiếu TTTT (Tất toán & Lãi lỗ) OMS vs File TTTT cho phiên: ${targetDate}`);

    if (!this.coreCcpApiAdapter) {
      throw new Error('Hệ thống chưa nạp CoreCcpApiAdapter!');
    }

    // 1. Xác thực và nạp Session CoreCCP
    let baseUrl = process.env.CORECCP_BASE_URL || EXTERNAL_SYSTEM_CORECCP.baseUrl;
    if (this.settingsService) {
      baseUrl = await this.settingsService.getSetting('coreccp_base_url', baseUrl);
    }
    const session = await this.coreCcpApiAdapter.getValidSession();
    emitLog(`Xác thực CoreCCP thành công (User: ${session.username}, Host: ${new URL(baseUrl).hostname})`);

    // 2. Gọi API OMS_ACM lấy danh sách giao dịch tất toán từ OMS (searchcode: OMS_PNL_DETAIL)
    emitLog(`Đang gửi yêu cầu POST /ccp/inquiry/OMS_ACM (searchcode: OMS_PNL_DETAIL)...`);
    const omsRes = await this.coreCcpApiAdapter.getOmsPnlDetails(session, baseUrl);
    const omsPositions: any[] = omsRes.data || [];
    emitLog(`Nhận về ${omsPositions.length} bản ghi tất toán từ OMS.`);

    // 3. Tìm và bóc tách file TTTT tải trực tiếp
    emitLog(`Đang quét tệp TTTT tải trực tiếp cho ngày ${targetDate}...`);
    const ttttFilePath = await this.findTtttFile(targetDate);
    let ttttPositions: IOmsTtttPositionDetail[] = [];
    if (ttttFilePath) {
      emitLog(`Đã tìm thấy tệp TTTT: ${ttttFilePath}`);
      ttttPositions = this.parseTtttFile(ttttFilePath);
      emitLog(`Bóc tách được ${ttttPositions.length} bản ghi từ tệp TTTT.`);
    } else {
      emitLog(`CẢNH BÁO: Chưa tìm thấy tệp TTTT trong các thư mục lưu trữ phiên ${targetDate}.`);
    }

    // 4. Gom nhóm theo cặp (Mã TKGD, Mã Hợp Đồng)
    interface IGroupedPnl {
      accountNumber: string;
      accountId: string;
      symbol: string;
      buyQty: number;
      sellQty: number;
      realizedPnl: number;
      realizedPnlVnd: number;
      details: IOmsTtttPositionDetail[];
    }

    const omsMap = new Map<string, IGroupedPnl>();
    for (const p of omsPositions) {
      const normAcc = this.normalizeAccount(p.accountId || '');
      const normSym = String(p.symbol || '').trim().toUpperCase();
      if (!normAcc || !normSym) continue;

      const key = `${normAcc}___${normSym}`;
      if (!omsMap.has(key)) {
        omsMap.set(key, {
          accountNumber: normAcc,
          accountId: p.accountId || normAcc,
          symbol: normSym,
          buyQty: 0,
          sellQty: 0,
          realizedPnl: 0,
          realizedPnlVnd: 0,
          details: [],
        });
      }
      const g = omsMap.get(key)!;
      const sideRaw = String(p.closeSide || '').trim().toUpperCase();
      const isBuy = sideRaw.startsWith('BUY') || sideRaw.startsWith('MUA') || sideRaw === 'B';
      const closeSide = isBuy ? 'BUY' : 'SELL';
      const qtty = this.parseNumber(p.closeQtty);
      const vrpl = this.parseNumber(p.vrplAmt);
      const vrplVnd = this.parseNumber(p.vrplAmt_Vnd);

      if (closeSide === 'BUY') {
        g.buyQty += qtty;
      } else {
        g.sellQty += qtty;
      }
      g.realizedPnl += vrpl;
      g.realizedPnlVnd += vrplVnd;

      g.details.push({
        accountId: p.accountId,
        symbol: p.symbol,
        txDate: p.txDate,
        closeDate: p.closeDate,
        closeSide,
        closeQtty: qtty,
        vrplAmt: vrpl,
        vrplAmt_Vnd: vrplVnd,
        costPrice: this.parseNumber(p.costPrice),
        closePrice: this.parseNumber(p.closePrice),
        orderId: p.orderId,
        closeOrderId: p.closeOrderId,
        execId: p.execId,
        closeExecId: p.closeExecId,
        currency: p.currency || 'USD',
        source: 'OMS',
      });
    }

    const ttttMap = new Map<string, IGroupedPnl>();
    for (const p of ttttPositions) {
      const normAcc = this.normalizeAccount(p.accountId || '');
      const normSym = String(p.symbol || '').trim().toUpperCase();
      if (!normAcc || !normSym) continue;

      const key = `${normAcc}___${normSym}`;
      if (!ttttMap.has(key)) {
        ttttMap.set(key, {
          accountNumber: normAcc,
          accountId: p.accountId || normAcc,
          symbol: normSym,
          buyQty: 0,
          sellQty: 0,
          realizedPnl: 0,
          realizedPnlVnd: 0,
          details: [],
        });
      }
      const g = ttttMap.get(key)!;
      const omsItem = omsMap.get(key);
      if (p.closeSide === 'BOTH') {
        // Tệp TTTT CCP đối trừ bù trừ cả 2 chiều mua/bán (matched pair), phân bổ theo OMS leg để hiển thị chuẩn xác
        if (omsItem && omsItem.buyQty === p.closeQtty && omsItem.sellQty === 0) {
          g.buyQty += p.closeQtty;
        } else if (omsItem && omsItem.sellQty === p.closeQtty && omsItem.buyQty === 0) {
          g.sellQty += p.closeQtty;
        } else if (omsItem && omsItem.buyQty + omsItem.sellQty === p.closeQtty) {
          g.buyQty += omsItem.buyQty;
          g.sellQty += omsItem.sellQty;
        } else {
          g.buyQty += p.closeQtty;
        }
      } else if (p.closeSide === 'BUY') {
        g.buyQty += p.closeQtty;
      } else {
        g.sellQty += p.closeQtty;
      }
      g.realizedPnl += p.vrplAmt;
      g.realizedPnlVnd += (p.vrplAmt_Vnd || 0);
      g.details.push(p);
    }

    // 5. So khớp hai nguồn dữ liệu
    const allKeys = new Set<string>([...omsMap.keys(), ...ttttMap.keys()]);
    const rows: IOmsTtttReconRow[] = [];

    let totalMatched = 0;
    let totalDiffVol = 0;
    let totalDiffPnl = 0;
    let totalDiffBoth = 0;
    let totalNotFoundInTttt = 0;
    let totalNotFoundInOms = 0;

    let totalOmsBuyVol = 0;
    let totalOmsSellVol = 0;
    let totalTtttBuyVol = 0;
    let totalTtttSellVol = 0;
    let totalOmsRealizedPnl = 0;
    let totalTtttRealizedPnl = 0;
    let totalOmsRealizedPnlVnd = 0;
    let totalTtttRealizedPnlVnd = 0;

    for (const key of allKeys) {
      const omsItem = omsMap.get(key);
      const ttttItem = ttttMap.get(key);

      const [normAcc, normSym] = key.split('___');
      const accountId = omsItem?.accountId || ttttItem?.accountId || normAcc;

      const omsBuyQty = omsItem?.buyQty || 0;
      const omsSellQty = omsItem?.sellQty || 0;
      const ttttBuyQty = ttttItem?.buyQty || 0;
      const ttttSellQty = ttttItem?.sellQty || 0;

      const omsRealizedPnl = omsItem?.realizedPnl || 0;
      const ttttRealizedPnl = ttttItem?.realizedPnl || 0;
      const omsRealizedPnlVnd = omsItem?.realizedPnlVnd || 0;
      const ttttRealizedPnlVnd = ttttItem?.realizedPnlVnd || 0;

      totalOmsBuyVol += omsBuyQty;
      totalOmsSellVol += omsSellQty;
      totalTtttBuyVol += ttttBuyQty;
      totalTtttSellVol += ttttSellQty;
      totalOmsRealizedPnl += omsRealizedPnl;
      totalTtttRealizedPnl += ttttRealizedPnl;
      totalOmsRealizedPnlVnd += omsRealizedPnlVnd;
      totalTtttRealizedPnlVnd += ttttRealizedPnlVnd;

      const diffBuyQty = omsBuyQty - ttttBuyQty;
      const diffSellQty = omsSellQty - ttttSellQty;
      const diffRealizedPnl = omsRealizedPnl - ttttRealizedPnl;
      const diffRealizedPnlVnd = omsRealizedPnlVnd - ttttRealizedPnlVnd;

      const isMatchBuy = diffBuyQty === 0;
      const isMatchSell = diffSellQty === 0;
      const isMatchVol = isMatchBuy && isMatchSell;
      // Chuyển toàn bộ tiêu chí so khớp Lãi lỗ sang tiền VND (sai số <= 1 đồng do làm tròn)
      const isMatchPnl = Math.abs(diffRealizedPnlVnd) <= 1;

      let status: OmsTtttReconStatus = 'MATCH';
      let statusNote = '';

      if (!ttttItem) {
        status = 'NOT_FOUND_IN_TTTT';
        statusNote = 'Có giao dịch tất toán ở OMS nhưng không thấy trong file TTTT';
        totalNotFoundInTttt++;
      } else if (!omsItem) {
        status = 'NOT_FOUND_IN_OMS';
        statusNote = 'Có giao dịch tất toán ở file TTTT nhưng không thấy trong OMS';
        totalNotFoundInOms++;
      } else if (isMatchVol && isMatchPnl) {
        status = 'MATCH';
        statusNote = 'Khớp hoàn toàn cả khối lượng đóng và lãi lỗ thực tế (VND)';
        totalMatched++;
      } else if (!isMatchVol && isMatchPnl) {
        status = 'DIFF_VOL';
        statusNote = `Lệch khối lượng đóng (Mua: ${diffBuyQty > 0 ? '+' : ''}${diffBuyQty}, Bán: ${diffSellQty > 0 ? '+' : ''}${diffSellQty})`;
        totalDiffVol++;
      } else if (isMatchVol && !isMatchPnl) {
        status = 'DIFF_PNL';
        statusNote = `Lệch lãi lỗ thực tế VND (${diffRealizedPnlVnd > 0 ? '+' : ''}${Math.round(diffRealizedPnlVnd).toLocaleString('en-US')} đ)`;
        totalDiffPnl++;
      } else {
        status = 'DIFF_BOTH';
        statusNote = `Lệch cả KL (Mua: ${diffBuyQty}, Bán: ${diffSellQty}) và lãi lỗ VND (${diffRealizedPnlVnd > 0 ? '+' : ''}${Math.round(diffRealizedPnlVnd).toLocaleString('en-US')} đ)`;
        totalDiffBoth++;
      }

      rows.push({
        accountNumber: normAcc,
        accountId,
        symbol: normSym,
        omsBuyQty,
        ttttBuyQty,
        diffBuyQty,
        isMatchBuy,
        omsSellQty,
        ttttSellQty,
        diffSellQty,
        isMatchSell,
        omsRealizedPnl,
        ttttRealizedPnl,
        diffRealizedPnl,
        isMatchPnl,
        omsRealizedPnlVnd,
        ttttRealizedPnlVnd,
        diffRealizedPnlVnd,
        status,
        statusNote,
        omsDetails: omsItem?.details || [],
        ttttDetails: ttttItem?.details || [],
      });
    }

    // Sắp xếp: Đưa các dòng có chênh lệch lên đầu
    rows.sort((a, b) => {
      const isDiffA = a.status !== 'MATCH' ? 1 : 0;
      const isDiffB = b.status !== 'MATCH' ? 1 : 0;
      if (isDiffA !== isDiffB) return isDiffB - isDiffA;
      const absA = Math.abs(a.diffBuyQty) + Math.abs(a.diffSellQty) + Math.abs(a.diffRealizedPnlVnd);
      const absB = Math.abs(b.diffBuyQty) + Math.abs(b.diffSellQty) + Math.abs(b.diffRealizedPnlVnd);
      return absB - absA;
    });

    const durationMs = Date.now() - startTime;
    const totalDiff = totalDiffVol + totalDiffPnl + totalDiffBoth + totalNotFoundInTttt + totalNotFoundInOms;
    const totalDiffRealizedPnl = totalOmsRealizedPnl - totalTtttRealizedPnl;
    const totalDiffRealizedPnlVnd = totalOmsRealizedPnlVnd - totalTtttRealizedPnlVnd;

    emitLog(
      `Hoàn tất đối chiếu TTTT: Tổng ${rows.length} cặp TK-HĐ | Khớp: ${totalMatched} | Lệch KL: ${totalDiffVol} | Lệch PnL VND: ${totalDiffPnl} | Lệch Cả Hai: ${totalDiffBoth} (${(durationMs / 1000).toFixed(2)}s)`,
    );

    const result: IOmsTtttReconResult = {
      success: true,
      sessionDate: targetDate,
      executedAt: new Date().toISOString(),
      durationMs,
      source: baseUrl,
      ttttFilePath: ttttFilePath || undefined,
      summary: {
        totalPairs: rows.length,
        totalMatched,
        totalDiff,
        totalDiffVol,
        totalDiffPnl,
        totalDiffBoth,
        totalNotFoundInTttt,
        totalNotFoundInOms,
        totalOmsBuyVol,
        totalOmsSellVol,
        totalTtttBuyVol,
        totalTtttSellVol,
        totalOmsRealizedPnl,
        totalTtttRealizedPnl,
        totalDiffRealizedPnl,
        totalOmsRealizedPnlVnd,
        totalTtttRealizedPnlVnd,
        totalDiffRealizedPnlVnd,
      },
      rows,
      logs,
    };

    this.cachedLatestTtttResult = result;
    this.saveJsonCache('tttt_latest.json', result);
    if (targetDate) {
      this.saveJsonCache(`tttt_${targetDate}.json`, result);
    }
    return result;
  }

  /**
   * Lấy kết quả đối chiếu TTTT mới nhất trong cache (ưu tiên ngày nếu có)
   */
  public getLatestTtttResult(sessionDate?: string): IOmsTtttReconResult | null {
    if (sessionDate) {
      const dateResult = this.loadJsonCache<IOmsTtttReconResult>(`tttt_${sessionDate}.json`);
      if (dateResult) return dateResult;
    }
    return this.cachedLatestTtttResult || this.loadJsonCache<IOmsTtttReconResult>('tttt_latest.json');
  }
}

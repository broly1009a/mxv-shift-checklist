import { Injectable, Logger } from '@nestjs/common';
import {
  KlgdReconService,
  PreEodReconService,
  CcpReconService,
  CqgSyncReconService,
  ReconConsoleSummaryService,
  CheckKLGDResult,
  EODMismatchedItem,
} from './services';
import {
  parseCqgNumber,
  parseCqgDateTime,
  parseTradeDateTime,
  findHeaderIndex,
  isIgnoredCommodity,
  convertLMESymbol,
  getNormalizedAccount,
  findLatestFile,
  mergeCqgRawFiles,
  resolveCqgFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
  parseDSGD,
  parseFR,
  parseNano,
  parseOP,
  parseTTM,
  parseTTTTForVolume,
  parsePSForVolume,
  parseStraitsCsv,
  parseTTTTForRecon,
  parsePSForRecon,
} from './helpers/recon-number-parser.helper';

export type { CheckKLGDResult, EODMismatchedItem };

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  // Static backward compatibility helpers
  static parseCqgNumber = parseCqgNumber;
  static findHeaderIndex = findHeaderIndex;
  static convertLMESymbol = convertLMESymbol;
  static getNormalizedAccount = getNormalizedAccount;

  constructor(
    private readonly klgdReconService: KlgdReconService,
    private readonly preEodReconService: PreEodReconService,
    private readonly ccpReconService: CcpReconService,
    private readonly cqgSyncReconService: CqgSyncReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
  ) {}

  // ==========================================
  // Backward compatibility helper methods
  // ==========================================
  findHeaderIndex(headers: string[], target: string, aliases: string[] = []): number {
    return findHeaderIndex(headers, target, aliases);
  }

  parseCqgNumber(val: any): number {
    return parseCqgNumber(val);
  }

  buildPreEodEmailHtml(...args: any[]): string {
    return (this.preEodReconService as any).buildPreEodEmailHtml(...args);
  }

  buildNegativeMarginEmailHtml(...args: any[]): string {
    return (this.cqgSyncReconService as any).buildNegativeMarginEmailHtml(...args);
  }

  // ==========================================
  // 1. KLGD Intraday Reconciliation (CheckKLGD)
  // ==========================================
  async checkKLGD(
    files: {
      dsgd?: Buffer;
      fr?: Buffer;
      fr1?: Buffer;
      fr2?: Buffer;
      nano?: Buffer;
      ttm?: Buffer;
      op?: Buffer;
      op1?: Buffer;
      op2?: Buffer;
      tttt?: Buffer;
      ps?: Buffer;
      ps1?: Buffer;
      ps2?: Buffer;
      dsgdCcp?: Buffer;
      ttmCcp?: Buffer;
      ttttCcp?: Buffer;
      ccpStatus?: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    },
    tradingDate: Date = new Date(),
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
      cutoffTime?: Date;
    },
  ): Promise<CheckKLGDResult> {
    return this.klgdReconService.checkKLGD(
      files,
      tradingDate,
      holidays,
      sessionStartStr,
      options,
    );
  }

  async runAutoCheckKLGD(
    tradingDate: Date,
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
      checkCcp?: boolean;
    },
  ): Promise<CheckKLGDResult> {
    return this.klgdReconService.runAutoCheckKLGD(tradingDate, options);
  }

  // ==========================================
  // 2. Pre-EOD & EOD MM Reconciliation
  // ==========================================
  async checkEOD(
    files: {
      qltkgd?: Buffer;
      eod?: Buffer;
      tttt?: Buffer;
      qltkgdName?: string;
      eodName?: string;
      ttttName?: string;
      qltkgdCcp?: Buffer;
      eodCcp?: Buffer;
      ttttCcp?: Buffer;
      qltkgdCcpName?: string;
      eodCcpName?: string;
      ttttCcpName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    },
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs?: string[];
    mismatchedEOD: EODMismatchedItem[];
    excelBase64?: string;
  }> {
    return this.ccpReconService.checkEOD(files, exchangeRates);
  }

  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt: Buffer;
      cqgPs: Buffer;
      [key: string]: any;
    },
    acmTradesName: string = '',
    tradingDate: Date = new Date(),
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
  ): Promise<{
    passed: boolean;
    totals: {
      totalACM_MS: number;
      totalACM_Straits: number;
      differACM: number;
      totalCQG_MS: number;
      totalCQG_FR: number;
      differCQG: number;
    };
    mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }>;
    mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }>;
    sessionStart?: Date;
    checkTime?: Date;
  }> {
    return this.preEodReconService.checkPreEOD(
      files as any,
      acmTradesName,
      tradingDate,
      holidays,
      sessionStartStr,
    );
  }

  async runAutoCheckPreEOD(tradingDate: Date): Promise<any> {
    return this.preEodReconService.runAutoCheckPreEOD(tradingDate);
  }

  async runAutoCheckSOD(tradingDate: Date): Promise<any> {
    return this.preEodReconService.runAutoCheckSOD(tradingDate);
  }

  async runAutoCheckEodMm(tradingDate: Date): Promise<any> {
    return this.preEodReconService.runAutoCheckEodMm(tradingDate);
  }

  // ==========================================
  // 3. CoreCCP EOD Reconciliation
  // ==========================================
  async checkEODCCP(
    files: {
      qltkgdCcp: Buffer;
      eodCcp?: Buffer;
      ttttCcp?: Buffer;
      qltkgdCcpName?: string;
      eodCcpName?: string;
      ttttCcpName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    },
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs: string[];
    mismatchedEOD: EODMismatchedItem[];
  }> {
    return this.ccpReconService.checkEODCCP(files, exchangeRates);
  }

  async runAutoCheckEodCcp(tradingDate: Date): Promise<any> {
    return this.ccpReconService.runAutoCheckEodCcp(tradingDate);
  }

  async downloadAndExtractCcpMetrics(dateStr?: string) {
    return this.ccpReconService.downloadAndExtractCcpMetrics(dateStr);
  }

  // ==========================================
  // 4. CQG Sync & Negative Margin Reconciliation
  // ==========================================
  async checkEODCQG(
    files: {
      qltkgd: Buffer;
      accountsBalances: Buffer;
      qltkgdName?: string;
      accountsBalancesName?: string;
    },
    usdExchangeRate?: number,
  ): Promise<
    Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }>
  > {
    return this.cqgSyncReconService.checkEODCQG(files, usdExchangeRate);
  }

  async checkNegativeMargin(files: {
    qltkgd: Buffer;
    eod?: Buffer;
    qltkgdName?: string;
    eodName?: string;
  }): Promise<{
    negativeBalanceAccs: string[];
    negativeIMRAcc: string[];
    excelBase64: string;
  }> {
    return this.cqgSyncReconService.checkNegativeMargin(files);
  }

  async runAutoCheckCQGSync(tradingDate: Date): Promise<any> {
    return this.cqgSyncReconService.runAutoCheckCQGSync(tradingDate);
  }

  // ==========================================
  // 5. Trading Console Summary, Rates & IMR
  // ==========================================
  async getConsoleSummary(dateStr?: string, jobId?: string): Promise<any> {
    return this.reconConsoleSummaryService.getConsoleSummary(dateStr, jobId);
  }

  async triggerConsoleRun(
    dateStr?: string,
    jobType: string = 'CHECK_KLGD',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ): Promise<any> {
    return this.reconConsoleSummaryService.triggerConsoleRun(dateStr, jobType, options);
  }

  async checkImr(sessionDateStr?: string) {
    return this.reconConsoleSummaryService.checkImr(sessionDateStr);
  }

  async syncUsdRateFromMSystem(): Promise<number> {
    return this.reconConsoleSummaryService.syncUsdRateFromMSystem();
  }

  async syncAllExchangeRatesFromMSystem(): Promise<Record<string, number>> {
    return this.reconConsoleSummaryService.syncAllExchangeRatesFromMSystem();
  }

  async getCurrentExchangeRates(): Promise<{
    usdLoss: number;
    usdGain: number;
    myrLoss: number;
    myrGain: number;
    jpyLoss: number;
    jpyGain: number;
    rmbLoss: number;
    rmbGain: number;
  }> {
    return this.reconConsoleSummaryService.getCurrentExchangeRates();
  }

  async getCurrentUsdRate(): Promise<number> {
    return this.reconConsoleSummaryService.getCurrentUsdRate();
  }

  async saveUsdRate(rate: number): Promise<void> {
    return this.reconConsoleSummaryService.saveUsdRate(rate);
  }
}

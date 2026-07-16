/**
 * lot-statistics.service.ts
 * Orchestrator chính - thay thế toàn bộ VBA Module1
 *
 * Thứ tự gọi giống VBA:
 *   processLotStatistics()  ← copyfile()
 *     ├─ classifyAllTrades()    ← tong_hop()
 *     ├─ calculateSummary()     ← baocao()
 *     ├─ aggregateByProduct()   ← tonghoplme() + tonghop_options()
 *     └─ aggregateByTvkd()
 */

import { Injectable, Logger } from '@nestjs/common';
import { parseExcelBuffer, ParsedRow } from './helpers/excel-parser.helper';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  classifyDsgd,
  classifyFr,
  classifyTtm,
  classifyTttt,
  classifyOp,
  classifyPs,
} from './helpers/trade-classifier.helper';
import {
  sumDsgdLot,
  sumTtmLot,
  sumTtttLot,
  sumFrLot,
  sumOpLot,
  sumPsLot,
  aggregateByProduct,
  aggregateByTvkd,
  getSPFromDsgd,
  LotByProduct,
  LotByTvkd,
} from './helpers/lot-aggregator.helper';
import { calcFrProduct, FrExclusionConfig } from './helpers/fr-calculator.helper';
import { ProcessLotDto } from './dto/lot-statistics.dto';

// ─── Result Types ────────────────────────────────────────────────────────────

export interface LotSummary {
  // ─ DSGD ─
  dsgdProduct: number;
  dsgdSpread: number;
  dsgdLme: number;
  dsgdOptions: number;
  // ─ FR ─
  frProduct: number;
  frSpread: number;
  frLme: number;
  frOptions: number;
  // ─ TTTT ─
  ttttProduct: number;
  ttttSpread: number;
  ttttLme: number;
  ttttOptions: number;
  // ─ TTM ─
  ttmProduct: number;
  ttmSpread: number;
  ttmLme: number;
  ttmOptions: number;
  // ─ OP ─
  opProduct: number;
  opSpread: number;
  opLme: number;
  opOptions: number;
  // ─ PS ─
  psProduct: number;
  psSpread: number;
  psLme: number;
  psOptions: number;
  // ─ ACM ─
  acmLot: number;
}

export interface ValidationItem {
  field: string;
  expected: number;
  actual: number;
  passed: boolean;
  message?: string;
}

export interface LotSummaryResult {
  ngayGD: Date;
  summary: LotSummary;
  byProduct: LotByProduct[];
  byTvkd: LotByTvkd[];
  validations: ValidationItem[];
  frBreakdown?: Record<string, number>;
}

// ─── Input files ─────────────────────────────────────────────────────────────

export interface LotInputFiles {
  fileDsgd: Buffer;         // required
  fileFr: Buffer;           // required
  fileTtm?: Buffer;         // optional
  fileTttt?: Buffer;        // optional
  fileOp?: Buffer;          // optional
  filePs?: Buffer;          // optional
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LotStatisticsService {
  private readonly logger = new Logger(LotStatisticsService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Tính toán thống kê số lot từ các file Excel
   * Tương đương Sub copyfile() → tong_hop() → baocao() trong VBA
   */
  async processLotStatistics(
    files: LotInputFiles,
    params: ProcessLotDto,
  ): Promise<LotSummaryResult> {
    const ngayGD = new Date(params.ngayGD);
    this.logger.log(`Bắt đầu xử lý lot statistics ngày ${params.ngayGD}`);

    // ─ 1. Đọc và parse tất cả file ─────────────────────────────────────────
    this.logger.debug('Đang parse file Excel...');
    const [dsgdSheet, frSheet, ttmSheet, ttttSheet, opSheet, psSheet] =
      await Promise.all([
        parseExcelBuffer(files.fileDsgd),
        parseExcelBuffer(files.fileFr),
        files.fileTtm ? parseExcelBuffer(files.fileTtm) : Promise.resolve(null),
        files.fileTttt ? parseExcelBuffer(files.fileTttt) : Promise.resolve(null),
        files.fileOp ? parseExcelBuffer(files.fileOp) : Promise.resolve(null),
        files.filePs ? parseExcelBuffer(files.filePs) : Promise.resolve(null),
      ]);

    const dsgdRows = dsgdSheet.rows;
    const frRows = frSheet.rows;
    const ttmRows = ttmSheet?.rows ?? [];
    const ttttRows = ttttSheet?.rows ?? [];
    const opRows = opSheet?.rows ?? [];
    const psRows = psSheet?.rows ?? [];

    this.logger.debug(
      `Đọc xong: DSGD=${dsgdRows.length}, FR=${frRows.length}, TTM=${ttmRows.length}, TTTT=${ttttRows.length}, OP=${opRows.length}, PS=${psRows.length}`,
    );

    // ─ 2. Phân loại giao dịch (tong_hop) ────────────────────────────────────
    this.logger.debug('Đang phân loại giao dịch...');

    const { dsgd, dsgdSpread, dsgdLme, dsgdOptions, dsgdAcm } = classifyDsgd(dsgdRows);
    const { fr, frSpread, frLme, frOptions } = classifyFr(frRows);
    const { ttm, ttmSpread, ttmLme, ttmOptions, ttmAcm } = classifyTtm(ttmRows);
    const { tttt, ttttSpread, ttttLme, ttttOptions, ttttAcm, lmeExpired } =
      classifyTttt(ttttRows, params.filterLmeKyHan);
    const { op, opSpread, opLme, opOptions } = classifyOp(opRows);
    const { ps, psSpread, psLme, psOptions } = classifyPs(psRows);

    this.logger.debug(
      `Phân loại: DSGD(${dsgd.length}), ACM(${dsgdAcm.length}), Spread(${dsgdSpread.length}), LME(${dsgdLme.length}), Opt(${dsgdOptions.length})`,
    );

    // ─ 3. Tính tổng từng nhóm (baocao) ──────────────────────────────────────
    this.logger.debug('Đang tính số lot...');

    // DSGD
    const dsgdTotal = sumDsgdLot(dsgd);
    const dsgdSpreadLot = sumDsgdLot(dsgdSpread);
    const dsgdLmeLot = sumDsgdLot(dsgdLme);
    const dsgdOptionsLot = sumDsgdLot(dsgdOptions);
    const dsgdProduct = dsgdTotal - dsgdSpreadLot - dsgdLmeLot - dsgdOptionsLot;

    // FR (có trừ các loại đặc biệt)
    const frConfig: FrExclusionConfig = {
      ngayGD,
      truDates: (params.truDates ?? []).map((d) => new Date(d)),
      fefDates: (params.fefDates ?? []).map((d) => new Date(d)),
      zftDates: (params.zftDates ?? []).map((d) => new Date(d)),
      deadline: params.deadline,
    };
    const { frProduct, breakdown: frBreakdown } = calcFrProduct(
      fr, frSpread, frLme, frOptions, frConfig,
    );
    const frSpreadLot = sumFrLot(frSpread);
    const frLmeLot = sumFrLot(frLme);
    const frOptionsLot = sumFrLot(frOptions);

    // TTTT (VBA: trừ lmeExpired khi tính LME)
    const ttttTotal = sumTtttLot(tttt);
    const ttttSpreadLot = sumTtttLot(ttttSpread);
    const lmeExpiredLot = sumTtttLot(lmeExpired);
    const ttttLmeLot = sumTtttLot(ttttLme) - lmeExpiredLot;
    const ttttOptionsLot = sumTtttLot(ttttOptions);
    const ttttProduct = ttttTotal - ttttSpreadLot - ttttLmeLot - ttttOptionsLot;

    // TTM
    const ttmTotal = sumTtmLot(ttm);
    const ttmSpreadLot = sumTtmLot(ttmSpread);
    const ttmLmeLot = sumTtmLot(ttmLme);
    const ttmOptionsLot = sumTtmLot(ttmOptions);
    const ttmProduct = ttmTotal - ttmSpreadLot - ttmLmeLot - ttmOptionsLot;

    // OP (chia 2 vì tính cả long và short)
    const opTotal = sumOpLot(op);
    const opSpreadLot = sumOpLot(opSpread) / 2;
    const opLmeLot = sumOpLot(opLme) / 2;
    const opOptionsLot = sumOpLot(opOptions);
    const opProduct = opTotal / 2 - opSpreadLot - opLmeLot - opOptionsLot;

    // PS (trừ lmeExpired, không chia 2)
    const psTotal = sumPsLot(ps);
    const psSpreadLot = sumPsLot(psSpread);
    const psLmeLot = sumPsLot(psLme) - lmeExpiredLot;
    const psOptionsLot = sumPsLot(psOptions);
    const psProduct = psTotal - psOptionsLot - psLmeLot - psSpreadLot;

    // ACM
    const acmLot =
      sumDsgdLot(dsgdAcm) + sumTtttLot(ttttAcm) + sumTtmLot(ttmAcm);

    // ─ 4. Validation cross-check ─────────────────────────────────────────────
    const validations: ValidationItem[] = [
      this.validate('Product (DSGD vs FR)', dsgdProduct, frProduct),
      this.validate('Spread (DSGD vs FR)', dsgdSpreadLot, frSpreadLot),
      this.validate('LME (DSGD vs FR)', dsgdLmeLot, frLmeLot),
      this.validate('Options (DSGD vs FR)', dsgdOptionsLot, frOptionsLot),
      this.validate('Tất toán Product (TTTT vs PS)', ttttProduct, psProduct),
      this.validate('Trạng thái mở Product (TTM vs OP)', ttmProduct, opProduct),
    ];

    validations
      .filter((v) => !v.passed)
      .forEach((v) =>
        this.logger.warn(`⚠️  [VALIDATION] ${v.field}: expected=${v.expected}, actual=${v.actual}`),
      );

    // ─ 5. Aggregate pivot ────────────────────────────────────────────────────
    this.logger.debug('Đang aggregate pivot...');
    const byProduct = aggregateByProduct(dsgd, getSPFromDsgd);
    const byTvkd = aggregateByTvkd(dsgd);

    const result: LotSummaryResult = {
      ngayGD,
      summary: {
        dsgdProduct, dsgdSpread: dsgdSpreadLot, dsgdLme: dsgdLmeLot, dsgdOptions: dsgdOptionsLot,
        frProduct, frSpread: frSpreadLot, frLme: frLmeLot, frOptions: frOptionsLot,
        ttttProduct, ttttSpread: ttttSpreadLot, ttttLme: ttttLmeLot, ttttOptions: ttttOptionsLot,
        ttmProduct, ttmSpread: ttmSpreadLot, ttmLme: ttmLmeLot, ttmOptions: ttmOptionsLot,
        opProduct, opSpread: opSpreadLot, opLme: opLmeLot, opOptions: opOptionsLot,
        psProduct, psSpread: psSpreadLot, psLme: psLmeLot, psOptions: psOptionsLot,
        acmLot,
      },
      byProduct,
      byTvkd,
      validations,
      frBreakdown,
    };

    this.logger.log(
      `Hoàn thành: dsgdProduct=${dsgdProduct}, frProduct=${frProduct}, validated=${validations.every((v) => v.passed)}`,
    );
    return result;
  }

  // ─── Config management (lưu vào SystemSettings MongoDB) ──────────────────

  async getConfig(): Promise<Record<string, string>> {
    const configStr = await this.settingsService.getSetting('lot_statistics_config', '{}');
    try {
      const parsed = JSON.parse(configStr);
      return {
        defaultPathDsgd: parsed.defaultPathDsgd || '',
        defaultPathFr: parsed.defaultPathFr || '',
        defaultPathTtm: parsed.defaultPathTtm || '',
        defaultPathTttt: parsed.defaultPathTttt || '',
        defaultPathOp: parsed.defaultPathOp || '',
        defaultPathPs: parsed.defaultPathPs || '',
        defaultLmeKyHan: parsed.defaultLmeKyHan || '',
      };
    } catch {
      return {
        defaultPathDsgd: '',
        defaultPathFr: '',
        defaultPathTtm: '',
        defaultPathTttt: '',
        defaultPathOp: '',
        defaultPathPs: '',
        defaultLmeKyHan: '',
      };
    }
  }

  async saveConfig(config: Record<string, string>): Promise<{ success: boolean }> {
    await this.settingsService.setSetting('lot_statistics_config', JSON.stringify(config));
    return { success: true };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private validate(
    field: string,
    expected: number,
    actual: number,
    tolerance = 0.001,
  ): ValidationItem {
    const passed = Math.abs(expected - actual) <= tolerance;
    return {
      field,
      expected,
      actual,
      passed,
      message: passed ? undefined : `${field}: kỳ vọng ${expected}, thực tế ${actual}`,
    };
  }
}

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
import * as fs from 'fs';
import * as path from 'path';
import { ensureBaseDirectoryExists } from '../../common/file-guard.helper';
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
import { updateAllCumulativeFiles } from './helpers/excel-accumulator.helper';

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
  frBreakdown?: Record<string, any>;
  autoNotes?: string[];
}

// ─── Input files ─────────────────────────────────────────────────────────────

export interface LotInputFiles {
  fileDsgd: Buffer;           // required
  fileFr: Buffer;             // required — first FR file
  fileFrExtra?: Buffer[];     // optional — FR1.xlsx, FR2.xlsx...
  fileTtm?: Buffer;           // optional
  fileTttt?: Buffer;          // optional
  fileOp?: Buffer;            // optional — first OP file
  fileOpExtra?: Buffer[];     // optional — OP1.xlsx, OP2.xlsx...
  filePs?: Buffer;            // optional — first PS file
  filePsExtra?: Buffer[];     // optional — PS1.xlsx, PS2.xlsx...
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LotStatisticsService {
  private readonly logger = new Logger(LotStatisticsService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Quét thư mục trên server và đọc các file Excel tương ứng dưới dạng Buffer
   */
  loadFilesFromDirectory(folderPath: string): LotInputFiles {
    ensureBaseDirectoryExists(folderPath);
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Thư mục không tồn tại trên server: "${folderPath}"`);
    }
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(`Đường dẫn không phải thư mục: "${folderPath}"`);
    }

    const files = fs.readdirSync(folderPath);
    
    let fileDsgd: Buffer | undefined;
    let fileFr: Buffer | undefined;
    let fileTtm: Buffer | undefined;
    let fileTttt: Buffer | undefined;
    let fileOp: Buffer | undefined;
    let filePs: Buffer | undefined;

    for (const file of files) {
      const lower = file.toLowerCase();
      const fullPath = path.join(folderPath, file);
      if (fs.statSync(fullPath).isDirectory()) continue;

      if (lower.includes('dsgd') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileDsgd = fs.readFileSync(fullPath);
      } else if (lower.includes('fr') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileFr = fs.readFileSync(fullPath);
      } else if (lower.includes('ttm') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileTtm = fs.readFileSync(fullPath);
      } else if (lower.includes('tttt') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileTttt = fs.readFileSync(fullPath);
      } else if (lower.includes('op') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileOp = fs.readFileSync(fullPath);
      } else if (lower.includes('ps') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        filePs = fs.readFileSync(fullPath);
      }
    }

    if (!fileDsgd) {
      throw new Error(`Không tìm thấy file DSGD (tên file chứa 'dsgd') trong thư mục "${folderPath}"`);
    }
    if (!fileFr) {
      throw new Error(`Không tìm thấy file FR (tên file chứa 'fr') trong thư mục "${folderPath}"`);
    }

    return {
      fileDsgd,
      fileFr,
      fileTtm,
      fileTttt,
      fileOp,
      filePs,
    };
  }

  /**
   * Quét cả hai thư mục MS và CQG riêng biệt để lấy báo cáo tương ứng.
   * Hỗ trợ nhiều file FR/OP/PS (FR.xlsx, FR1.xlsx, FR2.xlsx...) bằng cách merge rows.
   */
  loadFilesFromDirectories(folderPathMs: string, folderPathCqg?: string): LotInputFiles {
    if (!folderPathCqg) {
      return this.loadFilesFromDirectory(folderPathMs);
    }

    ensureBaseDirectoryExists(folderPathMs);
    if (!fs.existsSync(folderPathMs)) {
      throw new Error(`Thư mục MS không tồn tại trên server: "${folderPathMs}"`);
    }
    if (folderPathCqg) {
      ensureBaseDirectoryExists(folderPathCqg);
    }
    if (!fs.existsSync(folderPathCqg)) {
      throw new Error(`Thư mục CQG không tồn tại trên server: "${folderPathCqg}"`);
    }

    const filesMs = fs.readdirSync(folderPathMs);
    const filesCqg = fs.readdirSync(folderPathCqg);
    
    let fileDsgd: Buffer | undefined;
    let fileTtm: Buffer | undefined;
    let fileTttt: Buffer | undefined;

    // Collect multiple CQG files by type
    const frBuffers: Buffer[] = [];
    const opBuffers: Buffer[] = [];
    const psBuffers: Buffer[] = [];

    // Quét thư mục MS cho các file DSGD, TTM, TTTT
    for (const file of filesMs) {
      const lower = file.toLowerCase();
      const fullPath = path.join(folderPathMs, file);
      if (fs.statSync(fullPath).isDirectory()) continue;

      if (lower.includes('dsgd') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileDsgd = fs.readFileSync(fullPath);
      } else if (lower.includes('ttm') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileTtm = fs.readFileSync(fullPath);
      } else if (lower.includes('tttt') && (lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
        fileTttt = fs.readFileSync(fullPath);
      }
    }

    // Quét thư mục CQG — thu thập TẤT CẢ file FR*, OP*, PS*
    // Sắp xếp để FR.xlsx luôn đứng trước FR1.xlsx, FR2.xlsx...
    const sortedCqg = [...filesCqg].sort();
    for (const file of sortedCqg) {
      const lower = file.toLowerCase();
      const fullPath = path.join(folderPathCqg, file);
      if (fs.statSync(fullPath).isDirectory()) continue;
      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');
      if (!isExcel) continue;

      const base = lower.replace(/\.(xlsx|xls)$/, '');
      if (base === 'fr' || /^fr\d+$/.test(base)) {
        frBuffers.push(fs.readFileSync(fullPath));
      } else if (base === 'op' || /^op\d+$/.test(base)) {
        opBuffers.push(fs.readFileSync(fullPath));
      } else if (base === 'ps' || /^ps\d+$/.test(base)) {
        psBuffers.push(fs.readFileSync(fullPath));
      }
    }

    if (!fileDsgd) {
      throw new Error(`Không tìm thấy file DSGD (chứa chữ 'dsgd') trong thư mục MS: "${folderPathMs}"`);
    }
    if (frBuffers.length === 0) {
      throw new Error(`Không tìm thấy file FR (tên fr/fr1/fr2...) trong thư mục CQG: "${folderPathCqg}"`);
    }

    return {
      fileDsgd,
      fileFr: frBuffers[0],        // primary FR — multi-file merge handled in parseExcelBuffer
      fileFrExtra: frBuffers.slice(1),
      fileTtm,
      fileTttt,
      fileOp: opBuffers[0],
      fileOpExtra: opBuffers.slice(1),
      filePs: psBuffers[0],
      filePsExtra: psBuffers.slice(1),
    };
  }

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

    let dsgdRows = dsgdSheet.rows;
    let frRows = frSheet.rows;
    let ttmRows = ttmSheet?.rows ?? [];
    let ttttRows = ttttSheet?.rows ?? [];
    let opRows = opSheet?.rows ?? [];
    let psRows = psSheet?.rows ?? [];

    // Merge extra FR/OP/PS files if present
    if (files.fileFrExtra?.length) {
      for (const buf of files.fileFrExtra) {
        const extra = await parseExcelBuffer(buf);
        frRows = [...frRows, ...extra.rows];
      }
    }
    if (files.fileOpExtra?.length) {
      for (const buf of files.fileOpExtra) {
        const extra = await parseExcelBuffer(buf);
        opRows = [...opRows, ...extra.rows];
      }
    }
    if (files.filePsExtra?.length) {
      for (const buf of files.filePsExtra) {
        const extra = await parseExcelBuffer(buf);
        psRows = [...psRows, ...extra.rows];
      }
    }

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
    const autoNotesList: string[] = [];
    const { frProduct, breakdown: frBreakdown, autoNotes } = calcFrProduct(
      fr, frSpread, frLme, frOptions, frConfig,
    );
    if (autoNotes) {
      autoNotesList.push(...autoNotes);
    }
    const frSpreadLot = sumFrLot(frSpread);
    const frLmeLot = sumFrLot(frLme);
    const frOptionsLot = sumFrLot(frOptions);

    // TTTT (VBA: trừ lmeExpired khi tính LME)
    const ttttTotal = sumTtttLot(tttt);
    const ttttSpreadLot = sumTtttLot(ttttSpread);
    const lmeExpiredLot = sumTtttLot(lmeExpired);
    if (lmeExpiredLot > 0) {
      autoNotesList.push(`${lmeExpiredLot} lot LME đáo hạn kỳ hạn ${params.filterLmeKyHan} `);
    }
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
      autoNotes: autoNotesList,
    };

    this.logger.log(
      `Hoàn thành: dsgdProduct=${dsgdProduct}, frProduct=${frProduct}, validated=${validations.every((v) => v.passed)}`,
    );

    if (params.updateCumulative) {
      this.logger.log('Đang thực hiện cập nhật dữ liệu lũy kế năm...');
      const dsgdClassified = classifyDsgd(dsgdRows);
      const paths = {
        pathDsgdCumulative: params.pathDsgdCumulative || '',
        pathNormal: params.pathNormal || '',
        pathAcm: params.pathAcm || '',
        pathLme: params.pathLme || '',
        pathOptions: params.pathOptions || '',
        pathSpread: params.pathSpread || '',
      };
      await updateAllCumulativeFiles(
        files.fileDsgd,
        result,
        dsgdClassified,
        ttttAcm,
        ttmAcm,
        lmeExpiredLot,
        paths,
      );
      this.logger.log('Cập nhật dữ liệu lũy kế năm thành công.');
    }

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
        defaultPathDsgdCumulative: parsed.defaultPathDsgdCumulative || '',
        defaultPathNormal: parsed.defaultPathNormal || '',
        defaultPathAcm: parsed.defaultPathAcm || '',
        defaultPathLme: parsed.defaultPathLme || '',
        defaultPathOptions: parsed.defaultPathOptions || '',
        defaultPathSpread: parsed.defaultPathSpread || '',
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
        defaultPathDsgdCumulative: '',
        defaultPathNormal: '',
        defaultPathAcm: '',
        defaultPathLme: '',
        defaultPathOptions: '',
        defaultPathSpread: '',
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

import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ensureMonthSheetExists } from '../helpers/excel-sheet-cloner.helper';
import {
  provisionExcelColumn,
  ProvisionColumnParams,
  ProvisionColumnResult,
} from '../helpers/ccp-column-provisioner.helper';
import { safeWriteExcel } from '../helpers/excel-safe-writer.helper';
import {
  getSheetName,
  findOrCreateTargetRow,
  findOrCreateValueTargetRow,
  fixSharedFormulas,
} from '../helpers/accumulator-date.helper';
import { LotSummary } from './lot-statistics.service';
import type { LotByProduct, LotByTvkd } from './lot-statistics.service';
import { CcpTransactionValueResult } from './value-statistics.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';

export interface AccumulatorWriteResult {
  file: string;
  sheet: string;
  row: number;
  clonedNewMonthSheet: boolean;
  success: boolean;
  error?: string;
}

@Injectable()
export class CcpAccumulatorService {
  private readonly logger = new Logger(CcpAccumulatorService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Tạo bản sao lưu an toàn trước khi ghi file Excel lũy kế
   */
  private backupFile(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) return;
      const fileDir = path.dirname(filePath);
      const backupDir = path.join(fileDir, 'Backup_Snapshots');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      const base = path.basename(filePath, path.extname(filePath));
      const ext = path.extname(filePath);
      fs.copyFileSync(filePath, path.join(backupDir, `${base}_backup_${ts}${ext}`));
    } catch (err: any) {
      this.logger.warn(`Không thể tạo bản sao lưu cho ${path.basename(filePath)}: ${err.message}`);
    }
  }

  /**
   * Phân giải đường dẫn file thông minh giữa các môi trường Windows và Ubuntu Linux mount CIFS
   */
  resolveFilePath(candidatePath: string): string {
    if (!candidatePath) return '';
    const resolved = resolveStoragePathCrossPlatform(candidatePath);
    if (fs.existsSync(resolved)) return resolved;

    // Kiểm tra trong thư mục output/ hoặc thư mục cha nếu có
    const dir = path.dirname(resolved);
    const base = path.basename(resolved);
    const inOutput = path.join(dir, 'output', base);
    if (fs.existsSync(inOutput)) return inOutput;

    if (path.basename(dir).toLowerCase() === 'output') {
      const parentDir = path.join(path.dirname(dir), base);
      if (fs.existsSync(parentDir)) return parentDir;
    }

    return resolved;
  }

  /**
   * Lấy thư mục gốc lưu trữ tài liệu hoạt động (Target Root)
   */
  async getTargetRoot(customRoot?: string): Promise<string> {
    if (customRoot && fs.existsSync(resolveStoragePathCrossPlatform(customRoot))) {
      return resolveStoragePathCrossPlatform(customRoot);
    }
    if (this.settingsService) {
      const settingRoot = await this.settingsService.getSetting(
        'bot_lot_macro_target_root',
        'M:\\Quanlygiaodich\\Tai lieu hoat dong',
      );
      const resolved = resolveStoragePathCrossPlatform(settingRoot);
      if (fs.existsSync(resolved)) return resolved;
    }
    // Fallback: thư mục Bao cao - Thong ke trong repo nếu đang dev/test
    const localFallback = path.resolve(process.cwd(), '..', 'Bao cao - Thong ke');
    if (fs.existsSync(localFallback)) return localFallback;

    const localRepoFallback = path.resolve(process.cwd(), 'Bao cao - Thong ke');
    if (fs.existsSync(localRepoFallback)) return localRepoFallback;

    return '';
  }

  /**
   * Tự động kiểm tra và mở Sheet tháng (nếu chưa có thì kích hoạt Python openpyxl clone sheet mới)
   */
  private async ensureAndLoadSheet(
    filePath: string,
    targetDate: Date,
    jobLogs?: string[],
  ): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet; sheetName: string; cloned: boolean }> {
    const sheetName = getSheetName(path.basename(filePath), targetDate);
    let wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    let ws = wb.getWorksheet(sheetName);
    let cloned = false;

    if (!ws) {
      const msg = `[CcpAccumulator] Sheet '${sheetName}' chưa tồn tại trong ${path.basename(filePath)}. Đang kích hoạt Python openpyxl tự động nhân bản sheet tháng mới...`;
      this.logger.log(msg);
      jobLogs?.push(msg);

      cloned = ensureMonthSheetExists(filePath, sheetName, jobLogs);
      if (cloned) {
        // Tải lại workbook sau khi Python đã sinh xong sheet mới
        wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(filePath);
        ws = wb.getWorksheet(sheetName);
      }
    }

    if (!ws) {
      throw new Error(`Không thể tìm thấy hoặc tự động sinh Sheet '${sheetName}' trong tệp: ${filePath}`);
    }

    return { wb, ws, sheetName, cloned };
  }

  /**
   * Mở rộng cột TVKD mới hoặc Hàng Hóa mới trên một file Excel cụ thể bằng Python openpyxl an toàn
   * Tuân thủ Safe Transactional Atomic Write Pattern
   */
  provisionColumn(params: {
    filePath: string;
    type: 'tvkd' | 'commodity';
    code: string;
    label: string;
    dryRun?: boolean;
    jobLogs?: string[];
  }): ProvisionColumnResult {
    const resolved = this.resolveFilePath(params.filePath);
    return provisionExcelColumn({
      ...params,
      filePath: resolved,
    });
  }

  /**
   * Mở rộng cột TVKD mới hoặc Hàng Hóa mới đồng loạt trên toàn bộ bộ file Master Accumulator
   * theo thiết kế 1-Click Provisioning (Mục 7.2 THIET_KE_MO_RONG_TVKD_VA_MA_HD_MOI_CORECCP.md)
   */
  async provisionAllTemplates(params: {
    year?: string;
    customTargetRoot?: string;
    type: 'tvkd' | 'commodity';
    code: string;
    label: string;
    dryRun?: boolean;
    jobLogs?: string[];
  }): Promise<{ file: string; result: ProvisionColumnResult }[]> {
    const year = params.year || new Date().getFullYear().toString();
    const targetRoot = await this.getTargetRoot(params.customTargetRoot);
    const results: { file: string; result: ProvisionColumnResult }[] = [];

    if (!targetRoot) {
      throw new Error('Không tìm thấy thư mục lưu trữ Master Excel templates.');
    }

    const relativeTemplates = [
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich ${year}.xlsx`),
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich ${year} 2.xlsx`),
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year} (trên CCP).xlsx`),
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year}.xlsx`),
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich Spread ${year}.xlsx`),
      path.join('Thong ke so lot giao dich', `Thong ke so lot giao dich LME ${year}.xlsx`),
      path.join('Thong ke gia tri giao dich', `Thong ke gia tri giao dich ${year}.xlsx`),
      path.join('Thong ke gia tri giao dich', `Thong ke gia tri giao dich ACM ${year} (Theo CCP).xlsx`),
      path.join('Thong ke gia tri giao dich', `Thong ke gia tri giao dich ACM ${year}.xlsx`),
      // Trường hợp template ở ngay thư mục gốc
      `Thong ke so lot giao dich ${year}.xlsx`,
      `Thong ke so lot giao dich ACM ${year} (trên CCP).xlsx`,
      `Thong ke so lot giao dich ACM ${year}.xlsx`,
      `Thong ke so lot giao dich Spread ${year}.xlsx`,
      `Thong ke so lot giao dich LME ${year}.xlsx`,
      `Thong ke gia tri giao dich ${year}.xlsx`,
      `Thong ke gia tri giao dich ACM ${year} (Theo CCP).xlsx`,
      `Thong ke gia tri giao dich ACM ${year}.xlsx`,
    ];

    const seenFiles = new Set<string>();

    for (const rel of relativeTemplates) {
      const fullPath = this.resolveFilePath(path.join(targetRoot, rel));
      if (fs.existsSync(fullPath) && !seenFiles.has(fullPath)) {
        seenFiles.add(fullPath);
        const res = provisionExcelColumn({
          filePath: fullPath,
          type: params.type,
          code: params.code,
          label: params.label,
          dryRun: params.dryRun,
          jobLogs: params.jobLogs,
        });
        results.push({ file: path.basename(fullPath), result: res });
      }
    }

    return results;
  }

  /**
   * Ghi kết quả Thống Kê Số Lot vào các file Excel lũy kế năm (Master Accumulator Files)
   * Tự động bổ sung Sheet tháng mới qua Python openpyxl nếu chưa có.
   */
  async writeLotStatsToAccumulator(params: {
    targetDate: string;
    summary: LotSummary;
    byProduct: LotByProduct[];
    byTvkd: LotByTvkd[];
    customTargetRoot?: string;
    jobLogs?: string[];
  }): Promise<AccumulatorWriteResult[]> {
    const { targetDate, summary, byProduct, byTvkd, customTargetRoot, jobLogs } = params;
    const targetDateObj = new Date(targetDate);
    const year = targetDateObj.getFullYear().toString();
    const results: AccumulatorWriteResult[] = [];

    const targetRoot = await this.getTargetRoot(customTargetRoot);
    if (!targetRoot) {
      const msg = `[CcpAccumulator] Không tìm thấy thư mục gốc lưu trữ Excel Master. Bỏ qua ghi lũy kế.`;
      this.logger.log(msg);
      jobLogs?.push(msg);
      return results;
    }

    // 1. File Thống kê số lot giao dịch (Normal)
    let normalLotPath = '';
    if (this.settingsService) {
      normalLotPath = await this.settingsService.getSetting('bot_lot_macro_path_normal', '');
    }
    if (!normalLotPath) {
      const candidates = [
        path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ${year} 2.xlsx`),
        path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ${year}.xlsx`),
        path.join(targetRoot, `Thong ke so lot giao dich ${year}.xlsx`),
      ];
      normalLotPath = candidates.find((c) => fs.existsSync(this.resolveFilePath(c))) || '';
    }
    normalLotPath = this.resolveFilePath(normalLotPath);

    if (fs.existsSync(normalLotPath)) {
      try {
        this.backupFile(normalLotPath);
        const { wb, ws, sheetName, cloned } = await this.ensureAndLoadSheet(normalLotPath, targetDateObj, jobLogs);
        const targetRow = findOrCreateTargetRow(ws, targetDateObj);

        // Ghi số liệu tổng DSGD và FR
        const headerRow = ws.getRow(4);
        let colDsgd = 3;
        let colFr = 4;
        for (let c = 1; c <= Math.min(ws.columnCount || 50, 60); c++) {
          const val = String(headerRow.getCell(c).value || '').toUpperCase();
          if (val.includes('DSGD') || val.includes('M-SYSTEM') || val.includes('MS')) colDsgd = c;
          if (val.includes('FR') || val.includes('CQG')) colFr = c;
        }

        ws.getCell(targetRow, colDsgd).value = summary.dsgdTotal;
        ws.getCell(targetRow, colFr).value = summary.frTotal;

        // Quét và cập nhật theo TVKD nếu có cột TVKD tương ứng
        for (let c = 5; c <= Math.min(ws.columnCount || 80, 100); c++) {
          const headerText = String(headerRow.getCell(c).value || '');
          const match = headerText.match(/\b(\d{3})\b/);
          if (match) {
            const tvkdCode = match[1];
            const foundTvkd = byTvkd.find((t) => t.tvkd.includes(tvkdCode));
            if (foundTvkd) {
              ws.getCell(targetRow, c).value = foundTvkd.total;
            }
          }
        }

        fixSharedFormulas(ws);
        await safeWriteExcel(wb, normalLotPath);

        results.push({
          file: path.basename(normalLotPath),
          sheet: sheetName,
          row: targetRow,
          clonedNewMonthSheet: cloned,
          success: true,
        });
        const logMsg = `[CcpAccumulator] Đã ghi thành công ${summary.dsgdTotal} lot vào ${path.basename(normalLotPath)} [Sheet: ${sheetName}, Row: ${targetRow}]`;
        this.logger.log(logMsg);
        jobLogs?.push(logMsg);
      } catch (err: any) {
        results.push({
          file: path.basename(normalLotPath),
          sheet: '',
          row: -1,
          clonedNewMonthSheet: false,
          success: false,
          error: err.message,
        });
        const errMsg = `[CcpAccumulator] Lỗi ghi file ${path.basename(normalLotPath)}: ${err.message}`;
        this.logger.error(errMsg);
        jobLogs?.push(errMsg);
      }
    }

    // 2. File Thống kê số lot giao dịch ACM (trên CCP)
    let acmLotPath = '';
    if (this.settingsService) {
      acmLotPath = await this.settingsService.getSetting('bot_lot_macro_path_acm', '');
    }
    if (!acmLotPath) {
      const candidates = [
        path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year} (trên CCP).xlsx`),
        path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year} 2.xlsx`),
        path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year}.xlsx`),
        path.join(targetRoot, `Thong ke so lot giao dich ACM ${year} (trên CCP).xlsx`),
        path.join(targetRoot, `Thong ke so lot giao dich ACM ${year}.xlsx`),
      ];
      acmLotPath = candidates.find((c) => fs.existsSync(this.resolveFilePath(c))) || '';
    }
    acmLotPath = this.resolveFilePath(acmLotPath);

    if (fs.existsSync(acmLotPath)) {
      try {
        this.backupFile(acmLotPath);
        const { wb, ws, sheetName, cloned } = await this.ensureAndLoadSheet(acmLotPath, targetDateObj, jobLogs);
        const targetRow = findOrCreateTargetRow(ws, targetDateObj);

        // Ghi số liệu tổng quan ACM
        ws.getCell(targetRow, 3).value = summary.acmTotal || 0;
        ws.getCell(targetRow, 4).value = summary.ttttTotal || 0;
        ws.getCell(targetRow, 5).value = summary.ttmTotal || 0;

        // Quét và cập nhật theo TVKD (bắt đầu từ Col 11)
        const headerRow4 = ws.getRow(4);
        const matchedTvkd = new Set<string>();
        const matchedProd = new Set<string>();

        for (let c = 11; c <= Math.min(ws.columnCount || 100, 160); c++) {
          const headerText = String(headerRow4.getCell(c).value || '');
          const match = headerText.match(/\b(\d{3})\b/);
          if (match) {
            const tvkdCode = match[1];
            const foundTvkd = byTvkd.find((t) => t.tvkd.includes(tvkdCode));
            if (foundTvkd) {
              ws.getCell(targetRow, c).value = foundTvkd.total;
              matchedTvkd.add(tvkdCode);
            }
          }
        }

        // Quét và cập nhật theo Hàng Hóa (SI5CO, PL1NY, CP2CO, GLD1...)
        for (let c = 11; c <= Math.min(ws.columnCount || 100, 160); c++) {
          const rawHeader = String(headerRow4.getCell(c).value || '').trim().toUpperCase();
          if (!rawHeader || rawHeader === 'TỔNG' || rawHeader === 'TOTAL') continue;
          const foundProd = byProduct.find((p) => {
            const m = (p.maSP || '').trim().toUpperCase();
            return m && (rawHeader === m || rawHeader.startsWith(m));
          });
          if (foundProd) {
            ws.getCell(targetRow, c).value = foundProd.total;
            matchedProd.add(foundProd.maSP);
          }
        }

        // Data-Driven Guard: Cảnh báo TVKD / Hàng Hóa mới chưa có cột
        const unmappedTvkd = byTvkd.filter((t) => {
          const m = t.tvkd.match(/\b(\d{3})\b/);
          return m && t.total > 0 && !matchedTvkd.has(m[1]);
        });
        for (const u of unmappedTvkd) {
          const warnMsg = `[CcpAccumulator] CẢNH BÁO: TVKD '${u.tvkd}' có ${u.total} lots nhưng CHƯA CÓ CỘT trong ${path.basename(acmLotPath)}. Vui lòng chạy provisionColumn để tự động mở rộng.`;
          this.logger.warn(warnMsg);
          jobLogs?.push(warnMsg);
        }

        const unmappedProd = byProduct.filter((p) => p.total > 0 && !matchedProd.has(p.maSP));
        for (const u of unmappedProd) {
          const warnMsg = `[CcpAccumulator] CẢNH BÁO: Hàng hóa '${u.maSP}' có ${u.total} lots nhưng CHƯA CÓ CỘT trong ${path.basename(acmLotPath)}. Vui lòng chạy provisionColumn để tự động mở rộng.`;
          this.logger.warn(warnMsg);
          jobLogs?.push(warnMsg);
        }

        fixSharedFormulas(ws);
        await safeWriteExcel(wb, acmLotPath);

        results.push({
          file: path.basename(acmLotPath),
          sheet: sheetName,
          row: targetRow,
          clonedNewMonthSheet: cloned,
          success: true,
        });
        const logMsg = `[CcpAccumulator] Đã ghi thành công ${summary.acmTotal} lot ACM vào ${path.basename(acmLotPath)} [Sheet: ${sheetName}, Row: ${targetRow}]`;
        this.logger.log(logMsg);
        jobLogs?.push(logMsg);
      } catch (err: any) {
        results.push({
          file: path.basename(acmLotPath),
          sheet: '',
          row: -1,
          clonedNewMonthSheet: false,
          success: false,
          error: err.message,
        });
        const errMsg = `[CcpAccumulator] Lỗi ghi file ${path.basename(acmLotPath)}: ${err.message}`;
        this.logger.error(errMsg);
        jobLogs?.push(errMsg);
      }
    }

    return results;
  }

  /**
   * Ghi kết quả Thống Kê Giá Trị vào các file Excel lũy kế năm (Master Accumulator Files)
   * Tự động bổ sung Sheet tháng mới qua Python openpyxl nếu chưa có.
   */
  async writeValueStatsToAccumulator(params: {
    targetDate: string;
    result: CcpTransactionValueResult;
    customTargetRoot?: string;
    jobLogs?: string[];
  }): Promise<AccumulatorWriteResult[]> {
    const { targetDate, result, customTargetRoot, jobLogs } = params;
    const targetDateObj = new Date(targetDate);
    const year = targetDateObj.getFullYear().toString();
    const results: AccumulatorWriteResult[] = [];

    const targetRoot = await this.getTargetRoot(customTargetRoot);
    if (!targetRoot) {
      const msg = `[CcpAccumulator] Không tìm thấy thư mục gốc lưu trữ Excel Master. Bỏ qua ghi lũy kế giá trị.`;
      this.logger.log(msg);
      jobLogs?.push(msg);
      return results;
    }

    // 1. File Thống kê giá trị giao dịch (Normal)
    let normalValuePath = '';
    if (this.settingsService) {
      normalValuePath = await this.settingsService.getSetting('bot_lot_macro_path_normal_value', '');
    }
    if (!normalValuePath) {
      const candidates = [
        path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ${year}.xlsx`),
        path.join(targetRoot, `Thong ke gia tri giao dich ${year}.xlsx`),
      ];
      normalValuePath = candidates.find((c) => fs.existsSync(this.resolveFilePath(c))) || '';
    }
    normalValuePath = this.resolveFilePath(normalValuePath);

    if (fs.existsSync(normalValuePath)) {
      try {
        this.backupFile(normalValuePath);
        const { wb, ws, sheetName, cloned } = await this.ensureAndLoadSheet(normalValuePath, targetDateObj, jobLogs);
        const targetRow = findOrCreateValueTargetRow(ws, targetDateObj);

        // Ghi các mặt hàng theo cột
        const headerRow = ws.getRow(4);
        for (let c = 2; c <= Math.min(ws.columnCount || 80, 100); c++) {
          const rawHeader = String(headerRow.getCell(c).value || '').trim().toUpperCase();
          if (!rawHeader || rawHeader === 'TỔNG' || rawHeader === 'TOTAL') continue;

          const item = result.breakdownByProduct.find((p) => rawHeader.startsWith(p.product.toUpperCase()));
          if (item) {
            ws.getCell(targetRow, c).value = item.valueVnd;
          }
        }

        fixSharedFormulas(ws);
        await safeWriteExcel(wb, normalValuePath);

        results.push({
          file: path.basename(normalValuePath),
          sheet: sheetName,
          row: targetRow,
          clonedNewMonthSheet: cloned,
          success: true,
        });
        const logMsg = `[CcpAccumulator] Đã ghi thành công tổng GTGD ${result.totalValueVnd} VND vào ${path.basename(normalValuePath)} [Sheet: ${sheetName}, Row: ${targetRow}]`;
        this.logger.log(logMsg);
        jobLogs?.push(logMsg);
      } catch (err: any) {
        results.push({
          file: path.basename(normalValuePath),
          sheet: '',
          row: -1,
          clonedNewMonthSheet: false,
          success: false,
          error: err.message,
        });
        const errMsg = `[CcpAccumulator] Lỗi ghi file ${path.basename(normalValuePath)}: ${err.message}`;
        this.logger.error(errMsg);
        jobLogs?.push(errMsg);
      }
    }

    // 2. File Thống kê giá trị giao dịch ACM (Theo CCP)
    let acmValuePath = '';
    if (this.settingsService) {
      acmValuePath = await this.settingsService.getSetting('bot_lot_macro_path_acm_value', '');
    }
    if (!acmValuePath) {
      const candidates = [
        path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ACM ${year} (Theo CCP).xlsx`),
        path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ACM ${year}.xlsx`),
        path.join(targetRoot, `Thong ke gia tri giao dich ACM ${year} (Theo CCP).xlsx`),
        path.join(targetRoot, `Thong ke gia tri giao dich ACM ${year}.xlsx`),
      ];
      acmValuePath = candidates.find((c) => fs.existsSync(this.resolveFilePath(c))) || '';
    }
    acmValuePath = this.resolveFilePath(acmValuePath);

    if (fs.existsSync(acmValuePath)) {
      try {
        this.backupFile(acmValuePath);
        const { wb, ws, sheetName, cloned } = await this.ensureAndLoadSheet(acmValuePath, targetDateObj, jobLogs);
        const targetRow = findOrCreateValueTargetRow(ws, targetDateObj);

        // Ghi các mặt hàng theo cột (Header mã hàng hóa tại Row 5 hoặc Row 4)
        const headerRow5 = ws.getRow(5);
        const headerRow4 = ws.getRow(4);
        for (let c = 2; c <= Math.min(ws.columnCount || 80, 100); c++) {
          const r5 = String(headerRow5.getCell(c).value || '').trim().toUpperCase();
          const r4 = String(headerRow4.getCell(c).value || '').trim().toUpperCase();
          if (r5 === 'TỔNG' || r4 === 'TỔNG' || r5 === 'TOTAL') continue;

          const item = result.breakdownByProduct.find((p) => {
            const pUpper = p.product.toUpperCase();
            return (r5 && r5.startsWith(pUpper)) || (r4 && r4.startsWith(pUpper));
          });
          if (item) {
            ws.getCell(targetRow, c).value = item.valueVnd;
          }
        }

        fixSharedFormulas(ws);
        await safeWriteExcel(wb, acmValuePath);

        results.push({
          file: path.basename(acmValuePath),
          sheet: sheetName,
          row: targetRow,
          clonedNewMonthSheet: cloned,
          success: true,
        });
        const logMsg = `[CcpAccumulator] Đã ghi thành công GTGD ACM vào ${path.basename(acmValuePath)} [Sheet: ${sheetName}, Row: ${targetRow}]`;
        this.logger.log(logMsg);
        jobLogs?.push(logMsg);
      } catch (err: any) {
        results.push({
          file: path.basename(acmValuePath),
          sheet: '',
          row: -1,
          clonedNewMonthSheet: false,
          success: false,
          error: err.message,
        });
        const errMsg = `[CcpAccumulator] Lỗi ghi file ${path.basename(acmValuePath)}: ${err.message}`;
        this.logger.error(errMsg);
        jobLogs?.push(errMsg);
      }
    }

    return results;
  }
}

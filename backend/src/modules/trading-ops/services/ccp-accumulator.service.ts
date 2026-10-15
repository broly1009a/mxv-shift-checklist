import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { ensureMonthSheetExists } from '../helpers/excel-sheet-cloner.helper';
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
  private resolveFilePath(candidatePath: string): string {
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
  private async getTargetRoot(customRoot?: string): Promise<string> {
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
      normalLotPath = path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ${year} 2.xlsx`);
      if (!fs.existsSync(normalLotPath)) {
        normalLotPath = path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ${year}.xlsx`);
      }
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

    // 2. File Thống kê số lot giao dịch ACM (nếu có tài khoản ACM)
    let acmLotPath = '';
    if (this.settingsService) {
      acmLotPath = await this.settingsService.getSetting('bot_lot_macro_path_acm', '');
    }
    if (!acmLotPath) {
      acmLotPath = path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year} 2.xlsx`);
      if (!fs.existsSync(acmLotPath)) {
        acmLotPath = path.join(targetRoot, 'Thong ke so lot giao dich', `Thong ke so lot giao dich ACM ${year}.xlsx`);
      }
    }
    acmLotPath = this.resolveFilePath(acmLotPath);

    if (fs.existsSync(acmLotPath)) {
      try {
        this.backupFile(acmLotPath);
        const { wb, ws, sheetName, cloned } = await this.ensureAndLoadSheet(acmLotPath, targetDateObj, jobLogs);
        const targetRow = findOrCreateTargetRow(ws, targetDateObj);

        // Ghi số liệu ACM
        ws.getCell(targetRow, 3).value = summary.acmTotal || 0;
        ws.getCell(targetRow, 4).value = summary.ttttTotal || 0;
        ws.getCell(targetRow, 5).value = summary.ttmTotal || 0;

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
      normalValuePath = path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ${year}.xlsx`);
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

    return results;
  }
}

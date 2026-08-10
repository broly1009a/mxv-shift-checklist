import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  parseExcelBuffer,
  toNum,
  toStr,
  ParsedRow,
} from './helpers/excel-parser.helper';
import {
  updateAllValueCumulativeFiles,
  ValueAccumulatorPaths,
  updateValueTvkdTrackerFile,
} from './helpers/excel-value-accumulator.helper';
import {
  assertSafeWritePath,
  ensureBaseFileExists,
} from '../../common/file-guard.helper';

export function getMaHHFromDsgd(row: ParsedRow): string {
  const maTKGD = toStr(row['Mã TKGD'] ?? row['col4'] ?? '');
  const loaiHD = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['col6'] ?? '');

  if (maTKGD.toUpperCase().endsWith('L')) {
    return loaiHD.substring(0, 3).toUpperCase();
  } else {
    const idx2 = loaiHD.indexOf('2');
    if (idx2 !== -1) {
      const len = idx2 - 1;
      if (len > 0) {
        return loaiHD.substring(0, len).toUpperCase();
      }
    }
    return loaiHD.substring(0, 3).toUpperCase();
  }
}

export function getMaHHFromSpread(row: ParsedRow): string {
  const loaiHD = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['col6'] ?? '');
  return loaiHD.length > 3
    ? loaiHD.substring(0, loaiHD.length - 3).toUpperCase()
    : loaiHD.toUpperCase();
}

/**
 * Extracts raw value or formula result from an ExcelJS Cell
 */
function getVal(
  cell: ExcelJS.Cell,
): string | number | boolean | Date | null | undefined {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      const r = (val as ExcelJS.CellFormulaValue).result;
      if (r instanceof Date) return r;
      return (r as string | number | boolean | null) ?? null;
    }
    if ('richText' in val) {
      return val.richText.map((rt) => rt.text).join('');
    }
    if ('text' in val) {
      return (val as any).text;
    }
  }
  return val as string | number | boolean | Date | null | undefined;
}
export interface ValueStatisticsResult {
  ngayGD: Date;
  tyGiaDefault: number;
  tyGiaTru: number;
  tyGiaMpo: number;
  normalCount: number;
  spreadCount: number;
  normalGtgdBreakdown: Record<string, number>;
  spreadGtgdBreakdown: Record<string, number>;
  tvkdGtgdBreakdown?: Record<string, number>;
}

@Injectable()
export class ValueStatisticsService {
  private readonly logger = new Logger(ValueStatisticsService.name);

  constructor(private readonly settingsService: SystemSettingsService) { }

  /**
   * Processes the "Thống kê giá trị giao dịch" calculation and updates cumulative files.
   *
   * @param targetDate The date of the EOD run (YYYY-MM-DD)
   * @param payload Optional payload overrides for directories or paths
   */
  async processValueStatistics(
    targetDate: Date,
    payload?: any,
  ): Promise<ValueStatisticsResult> {
    const year = targetDate.getFullYear();
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(targetDate.getDate()).padStart(2, '0');

    // 1. Resolve paths
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(
        process.cwd(),
        'marco',
        'Thong ke gia tri giao dich có ACM',
        'Macro thong ke gia tri giao dich có ACM.xlsm',
      )
      : path.join(
        process.cwd(),
        '..',
        'marco',
        'Thong ke gia tri giao dich có ACM',
        'Macro thong ke gia tri giao dich có ACM.xlsm',
      );

    const macroPath =
      payload?.macroPath ||
      (await this.settingsService.getSetting(
        'bot_macro_value_path',
        defaultMacroPath,
      ));

    const targetRoot =
      payload?.targetRoot ||
      (await this.settingsService.getSetting(
        'bot_lot_macro_target_root',
        'M:\\Quanlygiaodich\\Tai lieu hoat dong',
      ));

    this.logger.log(`Using Macro template: ${macroPath}`);
    this.logger.log(`Target root: ${targetRoot}`);

    ensureBaseFileExists(macroPath);
    if (!fs.existsSync(macroPath)) {
      throw new Error(`Không tìm thấy file Macro cấu hình tại: "${macroPath}"`);
    }

    // 2. Parse configuration and exchange rates from macro workbook
    const macroWb = new ExcelJS.Workbook();
    await macroWb.xlsx.readFile(macroPath);

    // Read HH mappings (prefix -> baseHH)
    const hhWs = macroWb.worksheets.find((w) => w.name.toLowerCase() === 'hh');
    if (!hhWs) {
      throw new Error(
        `Không tìm thấy sheet "HH" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }
    const hhMap = new Map<string, string>();
    for (let r = 2; r <= hhWs.rowCount; r++) {
      const prefix = toStr(getVal(hhWs.getCell(r, 1))).toUpperCase();
      const baseHH = toStr(getVal(hhWs.getCell(r, 2))).toUpperCase();
      if (prefix) {
        hhMap.set(prefix, baseHH);
      }
    }

    // Read Hhoa Vlookup configurations (baseHH -> { heSo, donVi })
    const vlookupWs = macroWb.worksheets.find(
      (w) => w.name.toLowerCase() === 'hhoa vlookup',
    );
    if (!vlookupWs) {
      throw new Error(
        `Không tìm thấy sheet "Hhoa Vlookup" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }
    const vlookupMap = new Map<string, { heSo: number; donVi: number }>();
    for (let r = 2; r <= vlookupWs.rowCount; r++) {
      const baseHH = toStr(getVal(vlookupWs.getCell(r, 1))).toUpperCase();
      const heSo = toNum(getVal(vlookupWs.getCell(r, 2)));
      const donVi = toNum(getVal(vlookupWs.getCell(r, 3)));
      if (baseHH) {
        vlookupMap.set(baseHH, { heSo: heSo || 1, donVi: donVi || 1 });
      }
    }

    // Read Exchange rates from Sheet1
    const sheet1 = macroWb.worksheets.find(
      (w) => w.name.toLowerCase() === 'sheet1',
    );
    if (!sheet1) {
      throw new Error(
        `Không tìm thấy sheet "Sheet1" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }

    const tyGiaDefault = toNum(getVal(sheet1.getCell('D2'))) || 26260;
    const tyGiaTru = toNum(getVal(sheet1.getCell('D3'))) || 165;
    const tyGiaMpo = toNum(getVal(sheet1.getCell('D4'))) || 6330;

    this.logger.log(
      `Parsed exchange rates -> Default: ${tyGiaDefault}, TRU: ${tyGiaTru}, MPO: ${tyGiaMpo}`,
    );

    // 3. Locate and read daily DSGD.xlsx
    const dsgdPath =
      payload?.dsgdPath ||
      path.join(
        targetRoot,
        'Backup MS',
        'Futures',
        String(year),
        `T${monthStr}.${year}`,
        `${dayStr}.${monthStr}`,
        'DSGD.xlsx',
      );

    this.logger.log(`Searching for daily DSGD at: ${dsgdPath}`);
    ensureBaseFileExists(dsgdPath);
    if (!fs.existsSync(dsgdPath)) {
      throw new Error(
        `Không tìm thấy file DSGD giao dịch ngày ${dayStr}.${monthStr}.${year} tại: "${dsgdPath}"`,
      );
    }

    const dsgdBuffer = fs.readFileSync(dsgdPath);
    const parsedDsgd = await parseExcelBuffer(dsgdBuffer);
    this.logger.log(
      `Successfully parsed daily DSGD. Total rows: ${parsedDsgd.rows.length}`,
    );

    // 4. Perform calculations
    const normalGtgdMap = new Map<string, number>();
    const spreadGtgdMap = new Map<string, number>();
    const tvkdGtgdMap = new Map<string, number>();

    let normalCount = 0;
    let spreadCount = 0;

    for (const row of parsedDsgd.rows) {
      const maTKGD = toStr(row['Mã TKGD'] ?? row['col4']).toUpperCase();
      const lot = toNum(row['KL giao dịch'] ?? row['col13']);
      const price = toNum(row['Giá khớp'] ?? row['col14']);

      if (lot <= 0 || price <= 0 || !maTKGD) {
        continue;
      }

      // Normal GTGD Calculation
      const prefixNormal = getMaHHFromDsgd(row);
      const baseHHNormal = hhMap.get(prefixNormal) ?? prefixNormal;
      const multNormal = vlookupMap.get(baseHHNormal) ?? { heSo: 1, donVi: 1 };

      let rateNormal = tyGiaDefault;
      if (baseHHNormal === 'TRU') rateNormal = tyGiaTru;
      else if (baseHHNormal === 'MPO') rateNormal = tyGiaMpo;

      const gtgdNormal =
        lot * price * multNormal.heSo * multNormal.donVi * rateNormal;
      normalGtgdMap.set(
        baseHHNormal,
        (normalGtgdMap.get(baseHHNormal) || 0) + gtgdNormal,
      );
      normalCount++;

      // TVKD aggregation
      const tvkd = maTKGD.substring(0, 3);
      if (tvkd.length >= 3) {
        tvkdGtgdMap.set(
          tvkd,
          (tvkdGtgdMap.get(tvkd) || 0) + gtgdNormal,
        );
      }

      // Spread GTGD Calculation
      if (maTKGD.endsWith('-S')) {
        const prefixSpread = getMaHHFromSpread(row);
        const baseHHSpread = prefixSpread; // Spread doesn't look up in HH mapping table
        const multSpread = vlookupMap.get(baseHHSpread) ?? {
          heSo: 1,
          donVi: 1,
        };

        let rateSpread = tyGiaDefault;
        if (baseHHSpread === 'TRU') rateSpread = tyGiaTru;
        else if (baseHHSpread === 'MPO') rateSpread = tyGiaMpo;

        const gtgdSpread =
          lot * price * multSpread.heSo * multSpread.donVi * rateSpread;
        spreadGtgdMap.set(
          baseHHSpread,
          (spreadGtgdMap.get(baseHHSpread) || 0) + gtgdSpread,
        );
        spreadCount++;
      }
    }

    this.logger.log(
      `Calculated values. Normal trade count: ${normalCount}, Spread trade count: ${spreadCount}, TVKD count: ${tvkdGtgdMap.size}`,
    );

    // 5. Update cumulative files
    const paths: ValueAccumulatorPaths = {
      pathNormal:
        payload?.pathNormal ||
        (await this.settingsService.getSetting('bot_lot_macro_path_normal')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ${year}.xlsx`,
        ),
      pathSpread:
        payload?.pathSpread ||
        (await this.settingsService.getSetting('bot_lot_macro_path_spread')) ||
        path.join(
          targetRoot,
          'Backup MS',
          'Spread',
          String(year),
          `Thong ke gia tri giao dich Spread ${year}.xlsx`,
        ),
      pathLme:
        payload?.pathLme ||
        (await this.settingsService.getSetting('bot_lot_macro_path_lme')) ||
        path.join(
          targetRoot,
          'Backup CQG',
          'LME',
          String(year),
          `Thong ke gia tri giao dich LME ${year}.xlsx`,
        ),
      pathOptions:
        payload?.pathOptions ||
        (await this.settingsService.getSetting('bot_lot_macro_path_options')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich Options ${year}.xlsx`,
        ),
      pathAcm:
        payload?.pathAcm ||
        (await this.settingsService.getSetting('bot_lot_macro_path_acm')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ACM ${year}.xlsx`,
        ),
      pathTvkd:
        payload?.pathTvkd ||
        (await this.settingsService.getSetting('bot_lot_macro_path_tvkd')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich theo TVKD',
          `Thong ke gia tri giao dich ${year} theo TVKD.xlsx`,
        ),
    };

    const updateCumulativeStr = await this.settingsService.getSetting('bot_lot_macro_update_cumulative', 'true');
    const updateCumulative =
      payload?.updateCumulative === true ||
      payload?.updateCumulative === 'true' ||
      updateCumulativeStr === 'true';
      
    if (updateCumulative) {
      this.logger.log(`Updating cumulative value tracker files...`);
      await updateAllValueCumulativeFiles(
        paths,
        targetDate,
        normalGtgdMap,
        spreadGtgdMap,
        tvkdGtgdMap,
      );
      this.logger.log(
        `Successfully completed all cumulative updates for target date: ${dayStr}.${monthStr}.${year}`,
      );
    } else {
      this.logger.log(`Cumulative update is disabled by setting.`);
    }

    // 6. Generate newsletter report files (Gửi team bản tin)
    await this.generateNewsletterFile(targetRoot, targetDate, normalGtgdMap);

    return {
      ngayGD: targetDate,
      tyGiaDefault,
      tyGiaTru,
      tyGiaMpo,
      normalCount,
      spreadCount,
      normalGtgdBreakdown: Object.fromEntries(normalGtgdMap),
      spreadGtgdBreakdown: Object.fromEntries(spreadGtgdMap),
      tvkdGtgdBreakdown: Object.fromEntries(tvkdGtgdMap),
    };
  }

  async processTvkdOnly(
    targetDate: Date,
    payload: {
      targetRoot: string;
      dsgdPath: string;
      pathTvkd: string;
    }
  ): Promise<any> {
    const targetRoot = payload.targetRoot;
    const dsgdPath = payload.dsgdPath;
    const pathTvkd = payload.pathTvkd;

    // Security guard checks
    const allowedRoot = process.env.BOT_MACRO_TARGET_ROOT || process.env.BOT_LOT_MACRO_TARGET_ROOT || '';
    if (pathTvkd) {
      assertSafeWritePath(pathTvkd, allowedRoot);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;

    this.logger.log(
      `Starting TVKD-only cumulative process for date: ${dayStr}.${monthStr}.${year}`,
    );

    // 1. Load configuration and exchange rates from macro workbook
    // NOTE: Uses 'bot_macro_value_path' (same key saved by UI via PUT /value-statistics/config)
    const macroPath = await this.settingsService.getSetting(
      'bot_macro_value_path',
      '',
    );
    if (!macroPath) {
      throw new Error(
        'Chưa cấu hình file Macro cấu hình (bot_macro_value_path) trong cài đặt hệ thống. Vui lòng vào Cài đặt → Thống kê giá trị để lưu đường dẫn file Macro.',
      );
    }
    ensureBaseFileExists(macroPath);
    if (!fs.existsSync(macroPath)) {
      throw new Error(`Không tìm thấy file Macro cấu hình tại: "${macroPath}"`);
    }

    const macroWb = new ExcelJS.Workbook();
    await macroWb.xlsx.readFile(macroPath);

    // Read HH mappings (prefix -> baseHH)
    const hhWs = macroWb.worksheets.find((w) => w.name.toLowerCase() === 'hh');
    if (!hhWs) {
      throw new Error(
        `Không tìm thấy sheet "HH" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }
    const hhMap = new Map<string, string>();
    for (let r = 2; r <= hhWs.rowCount; r++) {
      const prefix = toStr(getVal(hhWs.getCell(r, 1))).toUpperCase();
      const baseHH = toStr(getVal(hhWs.getCell(r, 2))).toUpperCase();
      if (prefix) {
        hhMap.set(prefix, baseHH);
      }
    }

    // Read Hhoa Vlookup configurations (baseHH -> { heSo, donVi })
    const vlookupWs = macroWb.worksheets.find(
      (w) => w.name.toLowerCase() === 'hhoa vlookup',
    );
    if (!vlookupWs) {
      throw new Error(
        `Không tìm thấy sheet "Hhoa Vlookup" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }
    const vlookupMap = new Map<string, { heSo: number; donVi: number }>();
    for (let r = 2; r <= vlookupWs.rowCount; r++) {
      const baseHH = toStr(getVal(vlookupWs.getCell(r, 1))).toUpperCase();
      const heSo = toNum(getVal(vlookupWs.getCell(r, 2)));
      const donVi = toNum(getVal(vlookupWs.getCell(r, 3)));
      if (baseHH) {
        vlookupMap.set(baseHH, { heSo: heSo || 1, donVi: donVi || 1 });
      }
    }

    // Read Exchange rates from Sheet1
    const sheet1 = macroWb.worksheets.find(
      (w) => w.name.toLowerCase() === 'sheet1',
    );
    if (!sheet1) {
      throw new Error(
        `Không tìm thấy sheet "Sheet1" trong file Macro cấu hình tại: "${macroPath}"`,
      );
    }

    const tyGiaDefault = toNum(getVal(sheet1.getCell('D2'))) || 26260;
    const tyGiaTru = toNum(getVal(sheet1.getCell('D3'))) || 165;
    const tyGiaMpo = toNum(getVal(sheet1.getCell('D4'))) || 6330;

    // 4. Load daily DSGD
    this.logger.log(`Searching for daily DSGD at: ${dsgdPath}`);
    ensureBaseFileExists(dsgdPath);
    if (!fs.existsSync(dsgdPath)) {
      throw new Error(
        `Không tìm thấy file DSGD giao dịch ngày ${dayStr}.${monthStr}.${year} tại: "${dsgdPath}"`,
      );
    }

    const dsgdBuffer = fs.readFileSync(dsgdPath);
    const parsedDsgd = await parseExcelBuffer(dsgdBuffer);
    this.logger.log(
      `Successfully parsed daily DSGD for TVKD process. Total rows: ${parsedDsgd.rows.length}`,
    );

    // 5. Perform calculations and TVKD aggregation
    const tvkdGtgdMap = new Map<string, number>();
    for (const row of parsedDsgd.rows) {
      const maTKGD = toStr(row['Mã TKGD'] ?? row['col4']).toUpperCase();
      const lot = toNum(row['KL giao dịch'] ?? row['col13']);
      const price = toNum(row['Giá khớp'] ?? row['col14']);

      if (lot <= 0 || price <= 0 || !maTKGD) {
        continue;
      }

      // Normal GTGD Calculation
      const prefixNormal = getMaHHFromDsgd(row);
      const baseHHNormal = hhMap.get(prefixNormal) ?? prefixNormal;
      const multNormal = vlookupMap.get(baseHHNormal) ?? { heSo: 1, donVi: 1 };

      let rateNormal = tyGiaDefault;
      if (baseHHNormal === 'TRU') rateNormal = tyGiaTru;
      else if (baseHHNormal === 'MPO') rateNormal = tyGiaMpo;

      const gtgdNormal =
        lot * price * multNormal.heSo * multNormal.donVi * rateNormal;

      // TVKD aggregation
      const tvkd = maTKGD.substring(0, 3);
      if (tvkd.length >= 3) {
        tvkdGtgdMap.set(
          tvkd,
          (tvkdGtgdMap.get(tvkd) || 0) + gtgdNormal,
        );
      }
    }

    // 6. Write to TVKD Cumulative File
    this.logger.log(`Writing to TVKD cumulative Excel file at: ${pathTvkd}`);
    await updateValueTvkdTrackerFile(pathTvkd, targetDate, tvkdGtgdMap);
    this.logger.log(`Successfully completed TVKD cumulative Excel update.`);

    return {
      ngayGD: targetDate,
      tvkdGtgdBreakdown: Object.fromEntries(tvkdGtgdMap),
    };
  }

  /**
   * Generates the daily newsletter file "Giá trị giao dịch phiên dd.mm.yyyy.xlsx"
   * by copying an existing newsletter template and updating its values.
   */
  private async generateNewsletterFile(
    targetRoot: string,
    targetDate: Date,
    normalGtgdMap: Map<string, number>,
  ) {
    const dayStr = String(targetDate.getDate()).padStart(2, '0');
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const year = targetDate.getFullYear();

    const newsletterDir = path.join(
      targetRoot,
      'Thong ke gia tri giao dich',
      'Gửi team bản tin',
    );
    if (!fs.existsSync(newsletterDir)) {
      this.logger.warn(
        `Thư mục "Gửi team bản tin" không tồn tại: ${newsletterDir}. Bỏ qua xuất file bản tin.`,
      );
      return;
    }

    // Find any existing daily file in newsletter directory as a template
    const files = fs.readdirSync(newsletterDir);
    const templateFileName = files.find(
      (f) => f.startsWith('Giá trị giao dịch phiên') && f.endsWith('.xlsx'),
    );

    if (!templateFileName) {
      this.logger.warn(
        `Không tìm thấy file mẫu nào có dạng 'Giá trị giao dịch phiên' trong thư mục ${newsletterDir}. Bỏ qua.`,
      );
      return;
    }

    const templatePath = path.join(newsletterDir, templateFileName);
    const targetPath = path.join(
      newsletterDir,
      `Giá trị giao dịch phiên ${dayStr}.${monthStr}.${year}.xlsx`,
    );

    this.logger.log(
      `Generating newsletter report at: ${targetPath} using template: ${templatePath}`,
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0]; // First sheet

    // Process rows 6 to 72 (Normal commodities)
    for (let r = 6; r <= 72; r++) {
      const code = ws.getCell(r, 3).value; // Column C (Mã sp)
      if (code && typeof code === 'string') {
        const val = normalGtgdMap.get(code.trim()) || 0;
        ws.getCell(r, 4).value = val; // Column D (Giá trị giao dịch)
      }
    }

    // Process rows 73 to 75 (ACM commodities)
    for (let r = 73; r <= 75; r++) {
      const code = ws.getCell(r, 3).value; // Column C (Mã sp)
      if (code && typeof code === 'string') {
        const val = normalGtgdMap.get(code.trim()) || 0;
        ws.getCell(r, 4).value = val; // Column D (Giá trị giao dịch)
      }
    }

    // Force total row to be recalculatable formula
    ws.getCell(76, 4).value = { formula: 'SUM(D6:D75)' };

    if (targetRoot) {
      assertSafeWritePath(targetPath, targetRoot);
    }
    await wb.xlsx.writeFile(targetPath);
    this.logger.log(`Successfully generated newsletter report: ${targetPath}`);

    // Optionally also generate GTGD_yyyymmdd.xlsx if the directory can be found/created
    const marketValueDir = path.join(targetRoot, 'MarketValue', String(year));
    try {
      if (targetRoot) {
        assertSafeWritePath(marketValueDir, targetRoot);
      }
      fs.mkdirSync(marketValueDir, { recursive: true });
      const targetPath2 = path.join(
        marketValueDir,
        `GTGD_${year}${monthStr}${dayStr}.xlsx`,
      );
      if (targetRoot) {
        assertSafeWritePath(targetPath2, targetRoot);
      }

      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.readFile(templatePath);
      const ws2 = wb2.worksheets[0];

      for (let r = 6; r <= 72; r++) {
        const code = ws2.getCell(r, 3).value;
        if (code && typeof code === 'string') {
          ws2.getCell(r, 4).value = normalGtgdMap.get(code.trim()) || 0;
        }
      }
      for (let r = 73; r <= 75; r++) {
        const code = ws2.getCell(r, 3).value;
        if (code && typeof code === 'string') {
          ws2.getCell(r, 4).value = normalGtgdMap.get(code.trim()) || 0;
        }
      }
      ws2.getCell(76, 4).value = { formula: 'SUM(D6:D75)' };
      await wb2.xlsx.writeFile(targetPath2);
      this.logger.log(
        `Successfully generated MarketValue report: ${targetPath2}`,
      );
    } catch (e: any) {
      this.logger.warn(`Could not generate MarketValue report: ${e.message}`);
    }
  }
}

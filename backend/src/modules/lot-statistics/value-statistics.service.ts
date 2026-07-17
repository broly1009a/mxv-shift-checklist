import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { parseExcelBuffer, toNum, toStr, ParsedRow } from './helpers/excel-parser.helper';
import { updateAllValueCumulativeFiles, ValueAccumulatorPaths } from './helpers/excel-value-accumulator.helper';

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
function getVal(cell: ExcelJS.Cell): string | number | boolean | Date | null | undefined {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      const r = (val as ExcelJS.CellFormulaValue).result;
      if (r instanceof Date) return r;
      return (r as string | number | boolean | null) ?? null;
    }
    if ('richText' in val) {
      return (val as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
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
}

@Injectable()
export class ValueStatisticsService {
  private readonly logger = new Logger(ValueStatisticsService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Processes the "Thống kê giá trị giao dịch" calculation and updates cumulative files.
   *
   * @param targetDate The date of the EOD run (YYYY-MM-DD)
   * @param payload Optional payload overrides for directories or paths
   */
  async processValueStatistics(targetDate: Date, payload?: any): Promise<ValueStatisticsResult> {
    const year = targetDate.getFullYear();
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(targetDate.getDate()).padStart(2, '0');

    // 1. Resolve paths
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm');

    const macroPath = payload?.macroPath || await this.settingsService.getSetting(
      'bot_macro_value_path',
      defaultMacroPath
    );

    const targetRoot = payload?.targetRoot || await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong'
    );

    this.logger.log(`Using Macro template: ${macroPath}`);
    this.logger.log(`Target root: ${targetRoot}`);

    if (!fs.existsSync(macroPath)) {
      throw new Error(`Không tìm thấy file Macro cấu hình tại: "${macroPath}"`);
    }

    // 2. Parse configuration and exchange rates from macro workbook
    const macroWb = new ExcelJS.Workbook();
    await macroWb.xlsx.readFile(macroPath);

    // Read HH mappings (prefix -> baseHH)
    const hhWs = macroWb.worksheets.find(w => w.name.toLowerCase() === 'hh');
    if (!hhWs) {
      throw new Error(`Không tìm thấy sheet "HH" trong file Macro cấu hình tại: "${macroPath}"`);
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
    const vlookupWs = macroWb.worksheets.find(w => w.name.toLowerCase() === 'hhoa vlookup');
    if (!vlookupWs) {
      throw new Error(`Không tìm thấy sheet "Hhoa Vlookup" trong file Macro cấu hình tại: "${macroPath}"`);
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
    const sheet1 = macroWb.worksheets.find(w => w.name.toLowerCase() === 'sheet1');
    if (!sheet1) {
      throw new Error(`Không tìm thấy sheet "Sheet1" trong file Macro cấu hình tại: "${macroPath}"`);
    }

    const tyGiaDefault = toNum(getVal(sheet1.getCell('D2'))) || 26260;
    const tyGiaTru = toNum(getVal(sheet1.getCell('D3'))) || 165;
    const tyGiaMpo = toNum(getVal(sheet1.getCell('D4'))) || 6330;

    this.logger.log(`Parsed exchange rates -> Default: ${tyGiaDefault}, TRU: ${tyGiaTru}, MPO: ${tyGiaMpo}`);

    // 3. Locate and read daily DSGD.xlsx
    const dsgdPath = payload?.dsgdPath || path.join(
      targetRoot,
      'Backup MS',
      'Futures',
      String(year),
      `T${monthStr}.${year}`,
      `${dayStr}.${monthStr}`,
      'DSGD.xlsx'
    );

    this.logger.log(`Searching for daily DSGD at: ${dsgdPath}`);
    if (!fs.existsSync(dsgdPath)) {
      throw new Error(`Không tìm thấy file DSGD giao dịch ngày ${dayStr}.${monthStr}.${year} tại: "${dsgdPath}"`);
    }

    const dsgdBuffer = fs.readFileSync(dsgdPath);
    const parsedDsgd = await parseExcelBuffer(dsgdBuffer);
    this.logger.log(`Successfully parsed daily DSGD. Total rows: ${parsedDsgd.rows.length}`);

    // 4. Perform calculations
    const normalGtgdMap = new Map<string, number>();
    const spreadGtgdMap = new Map<string, number>();

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

      const gtgdNormal = lot * price * multNormal.heSo * multNormal.donVi * rateNormal;
      normalGtgdMap.set(baseHHNormal, (normalGtgdMap.get(baseHHNormal) || 0) + gtgdNormal);
      normalCount++;

      // Spread GTGD Calculation
      if (maTKGD.endsWith('-S')) {
        const prefixSpread = getMaHHFromSpread(row);
        const baseHHSpread = prefixSpread; // Spread doesn't look up in HH mapping table
        const multSpread = vlookupMap.get(baseHHSpread) ?? { heSo: 1, donVi: 1 };

        let rateSpread = tyGiaDefault;
        if (baseHHSpread === 'TRU') rateSpread = tyGiaTru;
        else if (baseHHSpread === 'MPO') rateSpread = tyGiaMpo;

        const gtgdSpread = lot * price * multSpread.heSo * multSpread.donVi * rateSpread;
        spreadGtgdMap.set(baseHHSpread, (spreadGtgdMap.get(baseHHSpread) || 0) + gtgdSpread);
        spreadCount++;
      }
    }

    this.logger.log(`Calculated values. Normal trade count: ${normalCount}, Spread trade count: ${spreadCount}`);

    // 5. Update cumulative files
    const paths: ValueAccumulatorPaths = {
      pathNormal: payload?.pathNormal || path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ${year}.xlsx`),
      pathSpread: payload?.pathSpread || path.join(targetRoot, 'Backup MS', 'Spread', String(year), `Thong ke gia tri giao dich Spread ${year}.xlsx`),
      pathLme: payload?.pathLme || path.join(targetRoot, 'Backup CQG', 'LME', String(year), `Thong ke gia tri giao dich LME ${year}.xlsx`),
      pathOptions: payload?.pathOptions || path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich Options ${year}.xlsx`),
      pathAcm: payload?.pathAcm || path.join(targetRoot, 'Thong ke gia tri giao dich', `Thong ke gia tri giao dich ACM ${year}.xlsx`),
    };

    const updateCumulative = payload?.updateCumulative === true || payload?.updateCumulative === 'true';
    if (updateCumulative) {
      this.logger.log(`Updating cumulative value tracker files...`);
      await updateAllValueCumulativeFiles(paths, targetDate, normalGtgdMap, spreadGtgdMap);
      this.logger.log(`Successfully completed all cumulative updates for target date: ${dayStr}.${monthStr}.${year}`);
    } else {
      this.logger.log(`Cumulative update is disabled by payload setting.`);
    }

    return {
      ngayGD: targetDate,
      tyGiaDefault,
      tyGiaTru,
      tyGiaMpo,
      normalCount,
      spreadCount,
      normalGtgdBreakdown: Object.fromEntries(normalGtgdMap),
      spreadGtgdBreakdown: Object.fromEntries(spreadGtgdMap),
    };
  }
}

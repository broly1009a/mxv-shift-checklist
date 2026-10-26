import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as readline from 'readline';
import { MarginExcelParser } from '../../parsers';

export interface NegativeMarginAccount {
  account: string;
  margin: number;
}

export interface MarginScanResult {
  filePath: string;
  totalScanned: number;
  negativeAccounts: NegativeMarginAccount[];
  scannedAt: Date;
}

@Injectable()
export class MarginCheckerService {
  private readonly logger = new Logger(MarginCheckerService.name);

  /**
   * Quét và trích xuất các tài khoản có ký quỹ âm từ báo cáo EOD (xlsx/csv)
   */
  async scanNegativeMarginAccounts(filePath: string): Promise<NegativeMarginAccount[]> {
    if (!fs.existsSync(filePath)) {
      this.logger.error(`[NegativeMargin] File không tồn tại: ${filePath}`);
      return [];
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    this.logger.log(
      `[NegativeMargin] Bắt đầu quét file: ${path.basename(filePath)} (${(stat.size / 1024).toFixed(1)} KB)`,
    );

    try {
      let results: NegativeMarginAccount[];
      if (ext === '.xlsx' || ext === '.xls') {
        results = this.parseXlsx(filePath);
      } else {
        results = await this.parseCsv(filePath);
      }
      this.logger.log(
        `[NegativeMargin] Phát hiện ${results.length} tài khoản âm ký quỹ từ file ${path.basename(filePath)}.`,
      );
      return results;
    } catch (err: any) {
      this.logger.error(`[NegativeMargin] Lỗi khi đọc file "${path.basename(filePath)}": ${err.message}`);
      return [];
    }
  }

  /**
   * Phân tích file Excel (.xlsx / .xls)
   */
  private parseXlsx(filePath: string): NegativeMarginAccount[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      this.logger.warn(`[NegativeMargin][Excel] File quá ít dòng (< 2): ${filePath}`);
      return [];
    }

    let accountColIdx = -1;
    let marginColIdx = -1;
    const headerScanRows = Math.min(20, data.length);

    for (let r = 0; r < headerScanRows; r++) {
      const row = data[r];
      if (!row) continue;

      const rowStr = row.map((cell) => String(cell || '').trim().toLowerCase());
      const actIdx = rowStr.findIndex(
        (cell) =>
          cell.includes('tài khoản') ||
          cell.includes('mã tk') ||
          cell.includes('account') ||
          cell.includes('acct') ||
          cell === 'tk',
      );
      const mgnIdx = rowStr.findIndex(
        (cell) =>
          cell.includes('ký quỹ đầu ngày') ||
          cell.includes('ký quỹ khả dụng') ||
          cell.includes('initial margin') ||
          cell.includes('margin balance') ||
          cell.includes('available margin') ||
          cell.includes('kq đn') ||
          cell.includes('kq kd') ||
          cell.includes('tkkq đầu ngày') ||
          cell.includes('bổ sung ký quỹ') ||
          cell.includes('mức bổ sung'),
      );

      if (actIdx !== -1 && mgnIdx !== -1) {
        accountColIdx = actIdx;
        marginColIdx = mgnIdx;
        return this.extractFromRows(data, r + 1, accountColIdx, marginColIdx);
      }
    }

    this.logger.warn('[NegativeMargin][Excel] Không tìm thấy header, dùng fallback: col 0 = TK, col 1 = KQ');
    return this.extractFromRows(data, 1, 0, 1);
  }

  private extractFromRows(
    data: any[][],
    startRow: number,
    actIdx: number,
    mgnIdx: number,
  ): NegativeMarginAccount[] {
    const list: NegativeMarginAccount[] = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const actVal = String(row[actIdx] || '').trim();
      const mgnValStr = String(row[mgnIdx] || '').replace(/,/g, '').trim();
      const mgnVal = parseFloat(mgnValStr);

      if (!actVal || isNaN(mgnVal)) continue;

      if (mgnVal < 0) {
        list.push({ account: actVal, margin: mgnVal });
      }
    }
    return list;
  }

  /**
   * Phân tích file CSV
   */
  private async parseCsv(filePath: string): Promise<NegativeMarginAccount[]> {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const list: NegativeMarginAccount[] = [];
    let actIdx = 0;
    let mgnIdx = 1;
    let headersFound = false;

    for await (const line of rl) {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('\uFEFF')) cleanLine = cleanLine.slice(1);
      if (!cleanLine) continue;

      const parts = cleanLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) =>
        p.replace(/^"|"$/g, '').trim(),
      );

      if (!headersFound) {
        const rowLower = parts.map((p) => p.toLowerCase());
        const fAct = rowLower.findIndex((p) => p.includes('tài khoản') || p.includes('account') || p === 'tk');
        const fMgn = rowLower.findIndex((p) => p.includes('ký quỹ') || p.includes('margin'));
        if (fAct !== -1 && fMgn !== -1) {
          actIdx = fAct;
          mgnIdx = fMgn;
          headersFound = true;
          continue;
        }
      }

      if (parts.length > Math.max(actIdx, mgnIdx)) {
        const actVal = parts[actIdx];
        const mgnVal = parseFloat(parts[mgnIdx].replace(/,/g, ''));
        if (actVal && !isNaN(mgnVal) && mgnVal < 0) {
          list.push({ account: actVal, margin: mgnVal });
        }
      }
    }
    return list;
  }

  /**
   * Phân tích và lọc tài khoản âm ký quỹ từ buffer QLTKGD và eod.
   */
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
    const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgd, { fileName: files.qltkgdName });
    let negativeIMRAcc: string[] = [];
    if (files.eod) {
      const eodRes = MarginExcelParser.parseEodMargin(files.eod, { fileName: files.eodName });
      negativeIMRAcc = eodRes.negativeIMRAcc;
    }
    const excelBuffer = MarginExcelParser.buildNegativeBalanceExcelBuffer(qltkgdRes.negativeRows);

    return {
      negativeBalanceAccs: qltkgdRes.negativeBalanceAccs,
      negativeIMRAcc,
      excelBase64: excelBuffer.toString('base64'),
    };
  }
}


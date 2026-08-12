import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as readline from 'readline';

export interface NegativeMarginAccount {
  account: string;
  margin: number;
}

@Injectable()
export class PostEodHandlerService {
  private readonly logger = new Logger(PostEodHandlerService.name);

  /**
   * Reads EOD report (xlsx or csv) and extracts accounts with negative margin.
   */
  async scanNegativeMarginAccounts(
    filePath: string,
  ): Promise<NegativeMarginAccount[]> {
    if (!fs.existsSync(filePath)) {
      this.logger.error(`[NegativeMargin] File không tồn tại: ${filePath}`);
      return [];
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    this.logger.log(
      `[NegativeMargin] Bắt đầu phân tích file:\n` +
      `  - Đường dẫn  : ${filePath}\n` +
      `  - Loại file  : ${ext}\n` +
      `  - Kích thước : ${(stat.size / 1024).toFixed(1)} KB\n` +
      `  - Sửa lần cuối: ${stat.mtime.toISOString()}`,
    );

    try {
      let results: NegativeMarginAccount[];
      if (ext === '.xlsx' || ext === '.xls') {
        results = this.parseXlsx(filePath);
      } else {
        results = await this.parseCsv(filePath);
      }
      this.logger.log(
        `[NegativeMargin] Kết quả phân tích "${path.basename(filePath)}": ` +
        `Phát hiện ${results.length} tài khoản âm ký quỹ.`,
      );
      return results;
    } catch (err: any) {
      this.logger.error(
        `[NegativeMargin] Lỗi khi đọc file "${path.basename(filePath)}": ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Parser for Excel file (.xlsx / .xls)
   */
  private parseXlsx(filePath: string): NegativeMarginAccount[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    this.logger.log(
      `[NegativeMargin][Excel] Sheet được đọc: "${sheetName}" ` +
      `(Tổng ${workbook.SheetNames.length} sheet: ${workbook.SheetNames.join(', ')})`,
    );

    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    this.logger.log(
      `[NegativeMargin][Excel] Tổng số dòng đọc được từ sheet: ${data.length}`,
    );

    if (data.length < 2) {
      this.logger.warn(`[NegativeMargin][Excel] File quá ít dòng (< 2): ${filePath}`);
      return [];
    }

    // Dynamic header lookup
    let accountColIdx = -1;
    let marginColIdx = -1;

    // Scan headers in first few rows (usually row 0, but sometimes shifted)
    const headerScanRows = Math.min(20, data.length);
    for (let r = 0; r < headerScanRows; r++) {
      const row = data[r];
      if (!row) continue;

      const rowStr = row.map((cell) =>
        String(cell || '')
          .trim()
          .toLowerCase(),
      );
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
        this.logger.log(
          `[NegativeMargin][Excel] ✅ Tìm thấy header tại dòng ${r + 1}:\n` +
          `  - Cột tài khoản: cột số ${actIdx} ("${row[actIdx]}")\n` +
          `  - Cột ký quỹ  : cột số ${mgnIdx} ("${row[mgnIdx]}")`,
        );
        return this.extractFromRows(data, r + 1, accountColIdx, marginColIdx);
      }
    }

    // Default fallbacks if headers are not found
    this.logger.warn(
      `[NegativeMargin][Excel] ⚠️ Không tìm thấy header phù hợp. Dùng fallback: cột 0 = Tài khoản, cột 1 = Ký quỹ.`,
    );
    return this.extractFromRows(data, 1, 0, 1);
  }

  private extractFromRows(
    data: any[][],
    startRow: number,
    actIdx: number,
    mgnIdx: number,
  ): NegativeMarginAccount[] {
    const list: NegativeMarginAccount[] = [];
    let totalDataRows = 0;
    let skippedRows = 0;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const actVal = String(row[actIdx] || '').trim();
      const mgnValStr = String(row[mgnIdx] || '')
        .replace(/,/g, '')
        .trim();
      const mgnVal = parseFloat(mgnValStr);

      if (!actVal || isNaN(mgnVal)) {
        skippedRows++;
        continue;
      }

      totalDataRows++;
      if (mgnVal < 0) {
        list.push({
          account: actVal,
          margin: mgnVal,
        });
      }
    }

    this.logger.log(
      `[NegativeMargin][Extract] Thống kê:\n` +
      `  - Tổng dòng dữ liệu hợp lệ: ${totalDataRows}\n` +
      `  - Dòng bị bỏ qua (rỗng/lỗi format): ${skippedRows}\n` +
      `  - Tài khoản có ký quỹ dương/bằng 0: ${totalDataRows - list.length}\n` +
      `  - Tài khoản có ký quỹ ÂM (cần cảnh báo): ${list.length}`,
    );

    return list;
  }

  /**
   * Parser for CSV files
   */
  private async parseCsv(filePath: string): Promise<NegativeMarginAccount[]> {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const list: NegativeMarginAccount[] = [];
    let lineNum = 0;
    let actIdx = 0;
    let mgnIdx = 1;
    let headersFound = false;

    for await (const line of rl) {
      lineNum++;
      let cleanLine = line.trim();
      if (cleanLine.startsWith('\uFEFF')) {
        cleanLine = cleanLine.substring(1);
      }
      if (!cleanLine) continue;

      const cols = cleanLine.split(',').map((c) => {
        let val = c.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      });

      if (!headersFound && lineNum <= 20) {
        const rowStr = cols.map((c) => c.toLowerCase());
        const tempActIdx = rowStr.findIndex(
          (cell) =>
            cell.includes('tài khoản') ||
            cell.includes('mã tk') ||
            cell.includes('account') ||
            cell.includes('acct') ||
            cell === 'tk',
        );
        const tempMgnIdx = rowStr.findIndex(
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

        if (tempActIdx !== -1 && tempMgnIdx !== -1) {
          actIdx = tempActIdx;
          mgnIdx = tempMgnIdx;
          headersFound = true;
          this.logger.log(
            `[NegativeMargin][CSV] ✅ Tìm thấy header tại dòng ${lineNum}:\n` +
            `  - Cột tài khoản: cột số ${actIdx} ("${cols[actIdx]}")\n` +
            `  - Cột ký quỹ  : cột số ${mgnIdx} ("${cols[mgnIdx]}")`,
          );
          continue;
        }
      }

      // Parse data rows
      if (cols.length > Math.max(actIdx, mgnIdx)) {
        const actVal = cols[actIdx]?.trim();
        const mgnValStr = cols[mgnIdx]?.trim().replace(/,/g, '');
        const mgnVal = parseFloat(mgnValStr || '');

        if (actVal && !isNaN(mgnVal) && mgnVal < 0) {
          list.push({
            account: actVal,
            margin: mgnVal,
          });
        }
      }
    }

    return list;
  }
}

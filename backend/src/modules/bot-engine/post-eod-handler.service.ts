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
      this.logger.error(`EOD file does not exist at: ${filePath}`);
      return [];
    }

    const ext = path.extname(filePath).toLowerCase();
    try {
      if (ext === '.xlsx' || ext === '.xls') {
        return this.parseXlsx(filePath);
      } else if (ext === '.csv') {
        return await this.parseCsv(filePath);
      } else {
        // Try fallback to text/csv
        return await this.parseCsv(filePath);
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to parse EOD file for negative margin check: ${err.message}`,
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
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      this.logger.warn(`Excel file is empty or has too few rows: ${filePath}`);
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
          cell.includes('kq kd'),
      );

      if (actIdx !== -1 && mgnIdx !== -1) {
        accountColIdx = actIdx;
        marginColIdx = mgnIdx;
        this.logger.log(
          `Found headers at row ${r}: Account col = ${actIdx}, Margin col = ${mgnIdx}`,
        );
        // Now parse data starting from row r + 1
        return this.extractFromRows(data, r + 1, accountColIdx, marginColIdx);
      }
    }

    // Default fallbacks if headers are not found
    this.logger.warn(
      `Could not find exact headers in Excel. Using fallback columns: Account = 0, Margin = 1`,
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
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const actVal = String(row[actIdx] || '').trim();
      const mgnValStr = String(row[mgnIdx] || '')
        .replace(/,/g, '')
        .trim();
      const mgnVal = parseFloat(mgnValStr);

      if (actVal && !isNaN(mgnVal) && mgnVal < 0) {
        list.push({
          account: actVal,
          margin: mgnVal,
        });
      }
    }
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
            cell.includes('kq kd'),
        );

        if (tempActIdx !== -1 && tempMgnIdx !== -1) {
          actIdx = tempActIdx;
          mgnIdx = tempMgnIdx;
          headersFound = true;
          this.logger.log(
            `CSV Headers found at line ${lineNum}: Account col = ${actIdx}, Margin col = ${mgnIdx}`,
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

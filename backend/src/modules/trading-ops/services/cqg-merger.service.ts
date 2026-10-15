import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MarginExcelParser } from '../parsers';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TelegramService } from '../../telegram/telegram.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';

export interface ICqgMergeResult {
  success: boolean;
  mergedFiles: string[];
  logs: string[];
  errors: string[];
}

function findHeaderIndex(header: string[], primary: string, aliases: string[] = []): number {
  const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const targets = [primary, ...aliases].map(norm);
  return header.findIndex((h) => {
    const nh = norm(h);
    return targets.some((t) => nh === t || nh.includes(t));
  });
}

function findLatestFile(dir: string, pattern: RegExp): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => pattern.test(f));
  if (files.length === 0) return null;
  files.sort((a, b) => {
    const sa = fs.statSync(path.join(dir, a)).mtimeMs;
    const sb = fs.statSync(path.join(dir, b)).mtimeMs;
    return sb - sa;
  });
  return path.join(dir, files[0]);
}

function parseCqgNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;
  let normalized = str;
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot < lastComma) {
      normalized = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = str.replace(/,/g, '.');
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

@Injectable()
export class CqgMergerService {
  private readonly logger = new Logger(CqgMergerService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
    @Optional()
    private readonly telegramService?: TelegramService,
  ) {}

  /**
   * Ghép FR1.xlsx + FR2.xlsx -> FR.xlsx (Giao dịch khớp lệnh)
   *
   * QUY CHUẨN BẢO TỒN 100% TỪ C# FILEUTILS.CS & MONOLITH V1:
   * - Lấy header từ hàng 2 (index 1) hoặc hàng 1.
   * - Bỏ 2 dòng chân trang (Footer rows) của từng file thô: data = rows.slice(2, lr - 2).
   */
  mergeFR(src1: string, src2: string, dest: string): boolean {
    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    let rows2: any[][] = [];
    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2);
        rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    const lr1 = rows1.length;
    const lr2 = rows2.length;

    const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
    const data1 = lr1 > 4 ? rows1.slice(2, lr1 - 2) : lr1 > 2 ? rows1.slice(2) : [];
    const data2 = lr2 > 4 ? rows2.slice(2, lr2 - 2) : lr2 > 2 ? rows2.slice(2) : [];

    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...data2);

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép FR thành công: FR1 (${data1.length}) + FR2 (${data2.length}) -> ${dest}`);
    return true;
  }

  /**
   * Ghép OP1.xlsx + OP2.xlsx -> OP.xlsx (Trạng thái mở)
   */
  mergeOP(src1: string, src2: string, dest: string): boolean {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];

    const headerRow = rows1[1] || [];
    const data1 = rows1.slice(2);
    const mergedData = [headerRow, ...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      if (rows2.length > 3) {
        const data2 = rows2.slice(2);
        mergedData.push(...data2);
      }
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép OP thành công -> ${dest}`);
    return true;
  }

  /**
   * Ghép OD1.xlsx + OD2.xlsx -> Od.xlsx (Sổ lệnh)
   */
  mergeOD(src1: string, src2: string, dest: string): boolean {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
    const lr1 = rows1.length;
    const data1 = rows1.slice(2);
    let mergedData = [...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      if (rows2.length > 3) {
        const data2 = rows2.slice(3);
        const pasteIdx = lr1 - 4;
        if (pasteIdx >= 0 && pasteIdx < data1.length) {
          mergedData = data1.slice(0, pasteIdx).concat(data2);
        } else {
          mergedData.push(...data2);
        }
      }
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép OD thành công -> ${dest}`);
    return true;
  }

  /**
   * Ghép PS1.xlsx + PS2.xlsx -> PS.xlsx kèm xây dựng 3 Sheet đối chiếu vị thế:
   * Sheet 1: Sheet1 (Dữ liệu gộp)
   * Sheet 2: Check CQG-MS (Quy chuẩn hậu tố tài khoản: F$ -> "", L$ -> "-L", S$ -> "-S")
   * Sheet 3: Check MS-CQG (Đối soát với TTM của M-System)
   */
  mergePS(src1: string, src2: string, dest: string, ttmPath?: string): boolean {
    let rows1: any[][] = [];
    if (fs.existsSync(src1)) {
      try {
        const wb1 = XLSX.readFile(src1);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src1}: ${err.message}`);
      }
    }

    let rows2: any[][] = [];
    if (fs.existsSync(src2)) {
      try {
        const wb2 = XLSX.readFile(src2);
        rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc ${src2}: ${err.message}`);
      }
    }

    // 1. Merge Sheet1
    const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
    const data1 = rows1.length > 2 ? rows1.slice(2) : [];
    const data2 = rows2.length > 2 ? rows2.slice(2) : [];
    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...data2);

    const ws1 = XLSX.utils.aoa_to_sheet(mergedData);

    // 2. Check CQG-MS Sheet
    const sheet2Rows = mergedData
      .filter((row, idx) => {
        if (idx === 0) return true;
        return row[0] !== undefined && row[0] !== null && String(row[0]).trim() !== '';
      })
      .map((row) => row.slice(0, 10));

    // Xử lý hậu tố mã tài khoản: F$ -> "", L$ -> "-L", S$ -> "-S"
    for (let i = 1; i < sheet2Rows.length; i++) {
      let acc = String(sheet2Rows[i][0] || '').trim();
      acc = acc
        .replace(/F$/i, '')
        .replace(/L$/i, '-L')
        .replace(/S$/i, '-S')
        .replace(/--/g, '-');
      sheet2Rows[i][0] = acc;
    }

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);

    // Công thức tính toán đối soát cho Check CQG-MS
    for (let i = 1; i < sheet2Rows.length; i++) {
      const r = i + 1;
      ws2[XLSX.utils.encode_cell({ r: i, c: 10 })] = { t: 's', f: `A${r}&D${r}`, v: '' }; // Ma check
      ws2[XLSX.utils.encode_cell({ r: i, c: 11 })] = { t: 'n', f: `I${r}`, v: 0 }; // CQG
      ws2[XLSX.utils.encode_cell({ r: i, c: 12 })] = {
        t: 'n',
        f: `SUMIF('Check MS-CQG'!Z:Z,'Check CQG-MS'!K${r},'Check MS-CQG'!T:T)`,
        v: 0,
      }; // MS
      ws2[XLSX.utils.encode_cell({ r: i, c: 13 })] = { t: 'n', f: `L${r}-M${r}`, v: 0 }; // Check
    }

    ws2[XLSX.utils.encode_cell({ r: 0, c: 10 })] = { t: 's', v: 'Ma check' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 11 })] = { t: 's', v: 'CQG' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 12 })] = { t: 's', v: 'MS' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 13 })] = { t: 's', v: 'Check' };

    if (ws2['!ref']) {
      const range = XLSX.utils.decode_range(ws2['!ref']);
      range.e.c = 13;
      ws2['!ref'] = XLSX.utils.encode_range(range);
    }

    // 3. Check MS-CQG Sheet
    let ttmRows: any[][] = [];
    if (ttmPath && fs.existsSync(ttmPath)) {
      try {
        const wbTtm = XLSX.readFile(ttmPath);
        ttmRows = XLSX.utils.sheet_to_json(wbTtm.Sheets[wbTtm.SheetNames[0]], { header: 1 }) as any[][];
      } catch (err: any) {
        this.logger.error(`Không thể đọc file TTM tại ${ttmPath}: ${err.message}`);
      }
    }

    const sheet3Rows = ttmRows.map((row) => {
      const newRow = [...row];
      while (newRow.length < 20) {
        newRow.push(null);
      }
      return newRow;
    });

    if (sheet3Rows.length === 0) {
      const emptyHeaders = Array(20).fill(null);
      emptyHeaders[7] = 'Mã TKGD';
      emptyHeaders[9] = 'Mã HĐ';
      emptyHeaders[19] = 'KL ròng';
      sheet3Rows.push(emptyHeaders);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);

    for (let i = 1; i < sheet3Rows.length; i++) {
      const r = i + 1;
      ws3[XLSX.utils.encode_cell({ r: i, c: 25 })] = { t: 's', f: `H${r}&J${r}`, v: '' }; // Ma check
      ws3[XLSX.utils.encode_cell({ r: i, c: 26 })] = { t: 'n', f: `SUMIF(Z:Z,Z${r},T:T)`, v: 0 }; // MS
      ws3[XLSX.utils.encode_cell({ r: i, c: 27 })] = {
        t: 'n',
        f: `VLOOKUP(Z${r},'Check CQG-MS'!K:L,2,0)`,
        v: 0,
      }; // CQG
      ws3[XLSX.utils.encode_cell({ r: i, c: 28 })] = { t: 'n', f: `AA${r}-AB${r}`, v: 0 }; // Check
    }

    ws3[XLSX.utils.encode_cell({ r: 0, c: 25 })] = { t: 's', v: 'Ma check' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 26 })] = { t: 's', v: 'MS' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 27 })] = { t: 's', v: 'CQG' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 28 })] = { t: 's', v: 'Check' };

    if (ws3['!ref']) {
      const range = XLSX.utils.decode_range(ws3['!ref']);
      range.e.c = 28;
      ws3['!ref'] = XLSX.utils.encode_range(range);
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
    XLSX.utils.book_append_sheet(wb, ws2, 'Check CQG-MS');
    XLSX.utils.book_append_sheet(wb, ws3, 'Check MS-CQG');
    XLSX.writeFile(wb, dest, { compression: true });
    this.logger.log(`[CQG Merger] Ghép PS thành công cả 3 sheet -> ${dest}`);
    return true;
  }

  /**
   * Tự động quét và ghép toàn bộ 4 cặp file thô có trong thư mục chỉ định
   */
  mergeAll(folder: string, ttmPath?: string): ICqgMergeResult {
    const logs: string[] = [];
    const errors: string[] = [];
    const mergedFiles: string[] = [];

    // 1. Merge FR
    const fr1 = path.join(folder, 'FR1.xlsx');
    const fr2 = path.join(folder, 'FR2.xlsx');
    const frDest = path.join(folder, 'FR.xlsx');
    if (fs.existsSync(fr1) || fs.existsSync(fr2)) {
      try {
        this.mergeFR(fr1, fr2, frDest);
        mergedFiles.push(frDest);
        logs.push('Ghép thành công FR.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép FR.xlsx: ${e.message}`);
      }
    }

    // 2. Merge OP
    const op1 = path.join(folder, 'OP1.xlsx');
    const op2 = path.join(folder, 'OP2.xlsx');
    const opDest = path.join(folder, 'OP.xlsx');
    if (fs.existsSync(op1) || fs.existsSync(op2)) {
      try {
        this.mergeOP(op1, op2, opDest);
        mergedFiles.push(opDest);
        logs.push('Ghép thành công OP.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép OP.xlsx: ${e.message}`);
      }
    }

    // 3. Merge OD
    const od1 = path.join(folder, 'OD1.xlsx');
    const od2 = path.join(folder, 'OD2.xlsx');
    const odDest = path.join(folder, 'Od.xlsx');
    if (fs.existsSync(od1) || fs.existsSync(od2)) {
      try {
        this.mergeOD(od1, od2, odDest);
        mergedFiles.push(odDest);
        logs.push('Ghép thành công Od.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép Od.xlsx: ${e.message}`);
      }
    }

    // 4. Merge PS
    const ps1 = path.join(folder, 'PS1.xlsx');
    const ps2 = path.join(folder, 'PS2.xlsx');
    const psDest = path.join(folder, 'PS.xlsx');
    if (fs.existsSync(ps1) || fs.existsSync(ps2)) {
      try {
        this.mergePS(ps1, ps2, psDest, ttmPath);
        mergedFiles.push(psDest);
        logs.push('Ghép thành công PS.xlsx');
      } catch (e: any) {
        errors.push(`Lỗi ghép PS.xlsx: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      mergedFiles,
      logs,
      errors,
    };
  }

  /**
   * Đối chiếu số dư CQG (CheckEODCQG)
   */
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
    let effectiveRate = usdExchangeRate;
    if (!effectiveRate || effectiveRate <= 0) {
      if (this.settingsService) {
        const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25400');
        effectiveRate = parseFloat(usdRateStr) || 25400;
      } else {
        effectiveRate = 25400;
      }
    }

    // 1. Parse QLTKGD.xlsx qua MarginExcelParser dùng chung
    const qltkgdRes = MarginExcelParser.parseQltkgd(files.qltkgd, { fileName: files.qltkgdName });
    const qltkgdDataMap = qltkgdRes.dataMap;

    // 2. Parse Accounts_Balances.xlsx
    const asWorkbook = XLSX.read(files.accountsBalances, { type: 'buffer' });
    const asSheet = asWorkbook.Sheets[asWorkbook.SheetNames[0]];
    if (!asSheet) throw new Error('Không tìm thấy sheet nào trong Accounts_Balances.xlsx');
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 }) as any[][];
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map((h: any) => String(h || '').trim());
    const accountNumberIdx = findHeaderIndex(asHeader, 'Account Number', ['Account', 'Tài khoản', 'Mã TKGD', 'Tai khoan']);
    const endCashBalanceIdx = findHeaderIndex(asHeader, 'End Cash Balance', ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày']);
    const recordDescriptionIdx = findHeaderIndex(asHeader, 'Record Description', ['Description', 'Mô tả']);

    const asName = files.accountsBalancesName || 'Accounts_Balances.xlsx';
    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      throw new Error(`${asName} không hợp lệ vì thiếu các cột: Account Number hoặc End Cash Balance.`);
    }

    const cqgBalanceMap = new Map<string, number>();
    for (let i = 1; i < asRows.length; i++) {
      const row = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription = recordDescriptionIdx !== -1 ? String(row[recordDescriptionIdx] || '').trim() : '';
      if (!recordDescription.startsWith('Current-day')) continue;

      const account = String(row[accountNumberIdx] || '').trim();
      const balance = parseCqgNumber(row[endCashBalanceIdx]);
      if (!account) continue;

      let accountRaw = account;
      if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1) + '-L';
      } else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1) + '-S';
      } else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) {
        accountRaw = accountRaw.substring(0, accountRaw.length - 1);
      }

      const existingBalance = cqgBalanceMap.get(accountRaw) || 0;
      cqgBalanceMap.set(accountRaw, existingBalance + balance);
    }

    // 3. Compare balances
    const result: Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }> = [];

    for (const maTKGD of cqgBalanceMap.keys()) {
      if (maTKGD.startsWith('999') || maTKGD.startsWith('050') || !/^\d/.test(maTKGD)) continue;

      const qltkgdRow = qltkgdDataMap.get(maTKGD);
      const cqgBalance = cqgBalanceMap.get(maTKGD) ?? 0;

      if (qltkgdRow) {
        const calculated = (qltkgdRow.soDuTKKQHienTai + qltkgdRow.choDaoHan - qltkgdRow.laiLoVND) / effectiveRate;
        const roundedCalc = Math.round(calculated * 100) / 100;
        const roundedCQG = Math.round(cqgBalance * 100) / 100;
        const differ = Math.abs(roundedCalc - roundedCQG);

        if (differ > 100) {
          result.push({
            maTKGD,
            calculatedBalance: roundedCalc,
            cqgBalance: roundedCQG,
            differ,
            inMS: true,
            inCQG: true,
          });
        }
      } else {
        result.push({
          maTKGD,
          calculatedBalance: 0,
          cqgBalance: Math.round(cqgBalance * 100) / 100,
          differ: Math.abs(cqgBalance),
          inMS: false,
          inCQG: true,
        });
      }
    }

    return result;
  }

  /**
   * Tự động kiểm tra đối chiếu đồng bộ số dư CQG (runAutoCheckCQGSync)
   */
  async runAutoCheckCQGSync(tradingDate: Date): Promise<any> {
    if (!this.settingsService) {
      throw new Error('SystemSettingsService chưa sẵn sàng trong CqgMergerService.');
    }

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);

    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
    const accountsBalancesPath =
      findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
      findLatestFile(msDailyPath, /Accounts_Balances/i);

    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    }
    if (!accountsBalancesPath) {
      throw new Error('Không tìm thấy file Accounts_Balances.xlsx từ CQG');
    }

    const usdRateStr = await this.settingsService.getSetting('usd_exchange_rate', '25400');
    const usdRate = parseFloat(usdRateStr) || 25400;

    const cqgResult = await this.checkEODCQG(
      {
        qltkgd: fs.readFileSync(qltkgdPath),
        accountsBalances: fs.readFileSync(accountsBalancesPath),
      },
      usdRate,
    );

    const totalMismatched = cqgResult ? cqgResult.length : 0;
    let telegramMsg = ` [ĐỐI CHIẾU ĐỒNG BỘ SỐ DƯ CQG - ${day}/${month}/${year}]\n`;
    telegramMsg += `• Trạng thái: ${totalMismatched === 0 ? '✓ Khớp hoàn toàn giữa MS và CQG' : 'PHÁT HIỆN LỆCH SỐ DƯ'}\n`;
    telegramMsg += `• Số tài khoản lệch số dư CQG (> $100): ${totalMismatched}\n`;

    if (this.telegramService) {
      await this.telegramService.sendMessage(telegramMsg).catch(() => {});
    }

    return {
      cqgResult,
      totals: {
        totalMismatchedCQG: totalMismatched,
      },
    };
  }
}

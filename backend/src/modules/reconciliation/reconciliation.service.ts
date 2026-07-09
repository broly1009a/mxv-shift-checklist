import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface CheckKLGDResult {
  totals: {
    totalDSGD: number;
    totalFR: number;
    totalACM: number;
    totalNano: number;
    differ: number;
    differACM: number;
  };
  mismatchedTrades: Array<{
    source: 'MSystem' | 'CQG' | 'ACM' | 'Nano';
    maLenh?: string;
    maTKGD: string;
    maHD: string;
    giaKhop: number;
    klGiaoDich: number;
    ngayGio: string;
    reason: string;
  }>;
  mismatchedTTM: Array<{
    maTKGD: string;
    ttmValue: number;
    opValue: number;
    differ: number;
  }>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  // Mappings for LME symbols (from statics.json)
  private readonly LME_CODE_MAP: Record<string, string> = {
    LALZ: 'AHD',
    LDKZ: 'CAD',
    LEDZ: 'PBD',
    LNIZ: 'NID',
    LTIZ: 'SND',
    LZHZ: 'ZDS',
  };

  private readonly REVERSE_MONTH_CODE: Record<string, string> = {
    '01': 'F',
    '02': 'G',
    '03': 'H',
    '04': 'J',
    '05': 'K',
    '06': 'M',
    '07': 'N',
    '08': 'Q',
    '09': 'U',
    '10': 'V',
    '11': 'X',
    '12': 'Z',
  };

  /**
   * Helper to find a header index in a case-insensitive, accent-insensitive, and alias-friendly way.
   */
  private findHeaderIndex(headers: string[], target: string, aliases: string[] = []): number {
    const normalize = (str: string): string => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normTarget = normalize(target);
    const normAliases = aliases.map(a => normalize(a));

    return headers.findIndex(h => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.includes(normH);
    });
  }

  /**
   * Helper to convert LME symbols based on trading date.
   */
  convertLMESymbol(symbol: string, date: Date, holidays: string[] = []): string {
    if (!this.LME_CODE_MAP[symbol]) {
      return symbol;
    }

    // Add 3 months to date
    const adjustedDate = new Date(date);
    adjustedDate.setMonth(adjustedDate.getMonth() + 3);

    // Shift weekend
    const dayOfWeek = adjustedDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 6) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
    } else if (dayOfWeek === 0) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }

    // Format helper
    const formatDDMMYYYY = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Shift LME Dayoffs
    let adjustedDateStr = formatDDMMYYYY(adjustedDate);
    const dayoffMap = new Map<string, string>();
    holidays.forEach(h => {
      const parts = h.split(',');
      if (parts.length >= 2) {
        dayoffMap.set(parts[0].trim(), parts[1].trim());
      }
    });

    while (dayoffMap.has(adjustedDateStr)) {
      const nextDateStr = dayoffMap.get(adjustedDateStr);
      if (!nextDateStr) break;
      adjustedDateStr = nextDateStr;
      const [d, m, y] = adjustedDateStr.split('/').map(Number);
      adjustedDate.setFullYear(y, m - 1, d);
    }

    const newDay = String(adjustedDate.getDate()).padStart(2, '0');
    const newMonth = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const newYear = String(adjustedDate.getFullYear());

    const mapped = this.LME_CODE_MAP[symbol];
    const monthCode = this.REVERSE_MONTH_CODE[newMonth];
    if (!monthCode) {
      throw new Error(`Convert month failed for: ${newMonth}`);
    }
    const yearShort = newYear.substring(2);

    return `${mapped}D${newDay}${monthCode}${yearShort}`;
  }

  /**
   * Parse M-System DSGD.xlsx
   */
  parseDSGD(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const maLenhIdx = header.indexOf('Mã lệnh');
    const maTKGDIdx = header.indexOf('Mã TKGD');
    const maHDIdx = header.indexOf('Mã HĐ');
    const klGiaoDichIdx = header.indexOf('KL giao dịch');
    const giaKhopIdx = header.indexOf('Giá khớp');
    const ngayGioIdx = header.indexOf('Ngày giờ thực hiện');

    if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngayGio = ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio,
        // Combined key as C# does: {maTKGD}{maHD}{giaKhop}
        combinedKey: `${maTKGD}${maHD}${giaKhop}`,
      });
    }
    return result;
  }

  /**
   * Parse CQG FR1.xlsx / FR2.xlsx
   */
  parseFR(buffer: Buffer, date: Date, holidays: string[] = []): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 3) return [];

    // Header is on row index 1 (row 2 in Excel)
    const header = rows[1].map(h => String(h || '').trim());
    const ordIdx = header.indexOf('Ord #');
    const accountIdx = header.indexOf('Account');
    const symbolIdx = header.indexOf('Symbol');
    const qtyIdx = header.indexOf('Qty');
    const fillPIdx = header.indexOf('Fill P');
    const timeIdx = header.indexOf('Time');

    if (ordIdx === -1 || accountIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || fillPIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)');
    }

    const result = [];
    // Data starts at row index 2 (row 3 in Excel)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const ord = String(row[ordIdx] || '').trim();
      const account = String(row[accountIdx] || '').trim();
      const symbol = String(row[symbolIdx] || '').trim();
      const qty = parseFloat(row[qtyIdx]) || 0;
      const fillPVal = parseFloat(row[fillPIdx]) || 0;
      const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';

      if (!ord || !account || !symbol) continue;

      // Handle account suffix adjustment as in C#
      let accountRaw = account;
      if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) {
        accountRaw = accountRaw.slice(0, -1) + '-L';
      } else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) {
        accountRaw = accountRaw.slice(0, -1) + '-S';
      } else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) {
        accountRaw = accountRaw.slice(0, -1);
      }

      const symbolRaw = this.convertLMESymbol(symbol, date, holidays);

      result.push({
        ord,
        account,
        symbol,
        qty,
        fillP: fillPVal,
        time,
        accountRaw,
        // Combined key as C# does: {accountRaw}{symbolRaw}{fillP}
        combinedKey: `${accountRaw}${symbolRaw}${fillPVal}`,
      });
    }
    return result;
  }

  /**
   * Parse ACM Nano.xls/xlsx
   */
  parseNano(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    // Header on row 0
    const header = rows[0].map(h => String(h || '').trim());
    const maLenhIdx = header.indexOf('Order Sysid');
    const maTKGDIdx = header.indexOf('Trader Id');
    const maHDIdx = header.indexOf('Instrument Id');
    const klGiaoDichIdx = header.indexOf('Volume');
    const giaKhopIdx = header.indexOf('Price');
    const ngayIdx = header.indexOf('Trading Day');
    const gioIdx = header.indexOf('Trade Time');
    const maGDIdx = header.indexOf('Trade Id');

    if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1 || maGDIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file Nano (Order Sysid, Trader Id, Instrument Id, Volume, Price, Trade Id)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngay = ngayIdx !== -1 ? String(row[ngayIdx] || '').trim() : '';
      const gio = gioIdx !== -1 ? String(row[gioIdx] || '').trim() : '';
      const maGD = String(row[maGDIdx] || '').trim();

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio: `${ngay} ${gio}`,
        maGD,
        // Combined key as C# does: {maTKGD}{maGD}{klGiaoDich}
        combinedKey: `${maTKGD}${maGD}${klGiaoDich}`,
      });
    }
    return result;
  }

  /**
   * Parse CQG TTM OP1.xlsx / OP2.xlsx
   */
  parseOP(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 3) return [];

    // Header is on row index 1 (row 2 in Excel)
    const header = rows[1].map(h => String(h || '').trim());
    const accountIdx = header.indexOf('Account');
    const symbolIdx = header.indexOf('Symbol');
    
    // Find L and S columns
    let lIdx = header.findIndex(h => h === 'L' || h.startsWith('L (') || h.startsWith('('));
    let sIdx = header.findIndex(h => h === 'S' || h.startsWith('S (') || h.startsWith('S('));

    if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file OP (Account, Symbol, L, S)');
    }

    const result = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const account = String(row[accountIdx] || '').trim();
      const symbol = String(row[symbolIdx] || '').trim();
      const lValue = parseFloat(row[lIdx]) || 0;
      const sValue = parseFloat(row[sIdx]) || 0;

      if (!symbol) continue;

      result.push({
        account,
        symbol,
        lValue,
        sValue,
      });
    }
    return result;
  }

  /**
   * Parse M-System TTM.xlsx
   */
  parseTTM(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    
    // Support all variations of headers
    const maTKGDIdx = header.findIndex(h => h === 'Mã TKGD' || h === 'Mã tài khoản');
    const maHDIdx = header.findIndex(h => h === 'Mã HĐ' || h === 'Mã hợp đồng');
    
    const tongMuaIdx = header.findIndex(h => 
      h === 'KL Mua' || h === 'Tổng KL Mua' || h === 'Tổng mua' || h === 'Tổng KL mua'
    );
    const tongBanIdx = header.findIndex(h => 
      h === 'KL Bán' || h === 'Tổng KL Bán' || h === 'Tổng bán' || h === 'Tổng KL bán'
    );
    const giaKhopIdx = header.findIndex(h => 
      h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình'
    );

    if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, KL Mua/Tổng mua, KL Bán/Tổng bán)');
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const tongMua = parseFloat(row[tongMuaIdx]) || 0;
      const tongBan = parseFloat(row[tongBanIdx]) || 0;
      const giaKhop = giaKhopIdx !== -1 ? parseFloat(row[giaKhopIdx]) || 0 : 0;

      if (!maTKGD || !maHD) continue;

      result.push({
        maTKGD,
        maHD,
        tongMua,
        tongBan,
        giaKhop,
      });
    }
    return result;
  }

  /**
   * Match Trade Volumes (CheckKLGD)
   */
  async checkKLGD(
    files: { dsgd?: Buffer; fr1?: Buffer; fr2?: Buffer; nano?: Buffer; ttm?: Buffer; op1?: Buffer; op2?: Buffer },
    tradingDate: Date,
    holidays: string[] = []
  ): Promise<CheckKLGDResult> {
    const dsgdData = files.dsgd ? this.parseDSGD(files.dsgd) : [];
    const nanoData = files.nano ? this.parseNano(files.nano) : [];
    
    // Parse and merge FR files
    const frData: any[] = [];
    if (files.fr1) frData.push(...this.parseFR(files.fr1, tradingDate, holidays));
    if (files.fr2) frData.push(...this.parseFR(files.fr2, tradingDate, holidays));

    // Calculate totals
    let totalDSGD = 0;
    let totalACM = 0;
    let totalFR = 0;
    let totalNano = 0;

    // DSGD calculations
    dsgdData.forEach(gd => {
      if (gd.maTKGD.endsWith('A')) {
        totalACM += gd.klGiaoDich;
      } else {
        totalDSGD += gd.klGiaoDich;
      }
    });

    // CQG FR calculations
    frData.forEach(fr => {
      if (fr.symbol !== 'ZWAZCE') {
        totalFR += fr.qty;
      }
    });

    // ACM Nano calculations
    nanoData.forEach(gd => {
      totalNano += gd.klGiaoDich;
    });

    const differ = Math.abs(totalFR - totalDSGD);
    const differACM = Math.abs(totalNano - totalACM);

    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG' | 'ACM' | 'Nano';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }> = [];

    // Find FR rows not in DSGD
    frData.forEach(fr => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          reason: 'Lệnh CQG không tìm thấy bên M-System',
        });
      }
    });

    // Find DSGD rows not in FR
    dsgdData.forEach(gd => {
      if (gd.maTKGD.endsWith('A')) return;
      const existsInFR = frData.some(fr => fr.combinedKey === gd.combinedKey);
      if (!existsInFR) {
        mismatchedTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System không tìm thấy bên CQG',
        });
      }
    });

    // Find ACM Nano rows not in MSystem
    nanoData.forEach(gd => {
      const existsInDSGD = dsgdData.some(row => row.maTKGD.endsWith('A') && row.maLenh === gd.maGD);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'ACM',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch ACM không đồng bộ bên M-System',
        });
      }
    });

    // Find MSystem ACM rows not in Nano
    dsgdData.forEach(gd => {
      if (!gd.maTKGD.endsWith('A')) return;
      const existsInNano = nanoData.some(row => row.maGD === gd.maLenh);
      if (!existsInNano) {
        mismatchedTrades.push({
          source: 'Nano',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System (tự doanh) không có bên cổng ACM',
        });
      }
    });

    // --- II. TTM (Open Positions Matching) ---
    const mismatchedTTM: Array<{
      maTKGD: string;
      ttmValue: number;
      opValue: number;
      differ: number;
    }> = [];
    if (files.ttm && (files.op1 || files.op2)) {
      const ttmData = this.parseTTM(files.ttm);
      const opData: any[] = [];
      if (files.op1) opData.push(...this.parseOP(files.op1));
      if (files.op2) opData.push(...this.parseOP(files.op2));

      // Group totals by Account
      const ttmSummary: Record<string, number> = {};
      ttmData.forEach(t => {
        ttmSummary[t.maTKGD] = (ttmSummary[t.maTKGD] || 0) + t.tongMua + t.tongBan;
      });

      const opSummary: Record<string, number> = {};
      opData.forEach(o => {
        opSummary[o.account] = (opSummary[o.account] || 0) + o.lValue + o.sValue;
      });

      const allAccounts = Array.from(new Set([...Object.keys(ttmSummary), ...Object.keys(opSummary)]));
      allAccounts.forEach(acc => {
        if (acc.endsWith('A')) return; // Skip ACM

        const ttmVal = ttmSummary[acc] || 0;
        const opVal = opSummary[acc] || 0;

        if (Math.abs(ttmVal - opVal) > 0) {
          mismatchedTTM.push({
            maTKGD: acc,
            ttmValue: ttmVal,
            opValue: opVal,
            differ: Math.abs(ttmVal - opVal),
          });
        }
      });
    }

    return {
      totals: {
        totalDSGD,
        totalFR,
        totalACM,
        totalNano,
        differ,
        differACM,
      },
      mismatchedTrades,
      mismatchedTTM,
    };
  }

  /**
   * Helper to load statics.json
   */
  private loadStatics(): any {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), '../it-tool-src/operate-transaction-app/Configuration/statics.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (err) {
      this.logger.error('Không thể load statics.json:', err);
    }
    // Fallback static config
    return { LMECode: {}, MonthCode: {}, Commodity: [] };
  }

  /**
   * EOD Calculation and Balance Reconciliation (CheckEOD)
   */
  async checkEOD(
    files: {
      qltkgd: Buffer;
      eod?: Buffer;
      tttt?: Buffer;
      qltkgdName?: string;
      eodName?: string;
      ttttName?: string;
    },
    exchangeRates?: {
      usdLoss: number;
      usdGain: number;
      jpyLoss: number;
      jpyGain: number;
      myrLoss: number;
      myrGain: number;
    }
  ): Promise<{
    negativeIMRAcc: string[];
    negativeBalanceAccs?: string[];
    mismatchedEOD: Array<{
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }>;
    excelBase64?: string;
  }> {
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có trong file: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [qltkgdRows[0]]; // Include the header as the first row
    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const balanceVal = parseFloat(row[soDuTKKQHienTaiIdx]);
      if (!maTKGD) continue;

      if (!isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }
    }

    const negativeIMRAcc: string[] = [];

    // 2. Parse EOD CSV file (eod.csv) if provided
    if (files.eod) {
      const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map(h => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(eodHeader, 'InvestorCode', ['Investor Code', 'investor_code']);
          const initialRequiredMarginIdx = this.findHeaderIndex(eodHeader, 'InitialRequiredMargin', ['Initial Required Margin', 'initial_required_margin']);
          const estimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'EstimatedProfitVND', ['Estimated Profit VND', 'estimated_profit_vnd']);
          const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'OptionsEstimatedProfitVND', ['Options Estimated Profit VND', 'options_estimated_profit_vnd']);
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', ['Net Margin', 'net_margin']);
          const availableMarginIdx = this.findHeaderIndex(eodHeader, 'AvailableMargin', ['Available Margin', 'available_margin']);
          const additionalMarginIdx = this.findHeaderIndex(eodHeader, 'AdditionalMargin', ['Additional Margin', 'additional_margin']);

          const eodName = files.eodName || 'eod.csv';
          if (investorCodeIdx === -1) {
            throw new Error(`${eodName} không hợp lệ vì thiếu cột: InvestorCode. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${eodHeader.slice(0, 15).join(', ')}...]`);
          }

          for (let i = 1; i < eodRows.length; i++) {
            const row = eodRows[i];
            if (!row || row.length === 0) continue;
            const investorCode = String(row[investorCodeIdx] || '').trim();
            if (!investorCode) continue;

            const initialRequiredMargin = initialRequiredMarginIdx !== -1 ? (parseFloat(row[initialRequiredMarginIdx]) || 0) : 0;
            const estimatedProfitVND = estimatedProfitVNDIdx !== -1 ? (parseFloat(row[estimatedProfitVNDIdx]) || 0) : 0;
            const optionsEstimatedProfitVND = optionsEstimatedProfitVNDIdx !== -1 ? (parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0) : 0;
            const netMargin = netMarginIdx !== -1 ? (parseFloat(row[netMarginIdx]) || 0) : 0;
            const availableMargin = availableMarginIdx !== -1 ? (parseFloat(row[availableMarginIdx]) || 0) : 0;
            const additionalMargin = additionalMarginIdx !== -1 ? (parseFloat(row[additionalMarginIdx]) || 0) : 0;

            if (initialRequiredMargin === 0 && estimatedProfitVND === 0 && optionsEstimatedProfitVND === 0 && netMargin === availableMargin && availableMargin < 0 && additionalMargin > 0) {
              negativeIMRAcc.push(investorCode);
            }
          }
        }
      }
    }

    // 3. Generate new workbook containing negative current balance rows
    const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Negative Balance Accounts');
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      negativeIMRAcc,
      negativeBalanceAccs,
      mismatchedEOD: [],
      excelBase64: excelBuffer.toString('base64'),
    };
  }

  /**
   * CQG EOD Balance Reconciliation (CheckEODCQG)
   */
  async checkEODCQG(
    files: {
      qltkgd: Buffer;
      accountsBalances: Buffer;
      qltkgdName?: string;
      accountsBalancesName?: string;
    },
    usdExchangeRate: number = 25220
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
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const laiLoChoDaoHanIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế chờ đáo hạn', ['Chờ đáo hạn', 'Cho dao han', 'Lai lo cho dao han', 'Lãi lỗ chờ đáo hạn']);
    const laiLoThucTeFuturesVNDIdx = this.findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế Futures', 'Lãi lỗ Futures', 'Lai lo thuc te Futures', 'Lai lo Futures']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const qltkgdDataMap = new Map<string, {
      choDaoHan: number;
      laiLoVND: number;
      soDuTKKQHienTai: number;
    }>();

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      if (!maTKGD) continue;

      qltkgdDataMap.set(maTKGD, {
        choDaoHan: laiLoChoDaoHanIdx !== -1 ? (parseFloat(row[laiLoChoDaoHanIdx]) || 0) : 0,
        laiLoVND: laiLoThucTeFuturesVNDIdx !== -1 ? (parseFloat(row[laiLoThucTeFuturesVNDIdx]) || 0) : 0,
        soDuTKKQHienTai: soDuTKKQHienTaiIdx !== -1 ? (parseFloat(row[soDuTKKQHienTaiIdx]) || 0) : 0,
      });
    }

    // 2. Parse Accounts_Balances.xlsx (CQG balances)
    const asWorkbook = XLSX.read(files.accountsBalances, { type: 'buffer' });
    const asSheet = asWorkbook.Sheets[asWorkbook.SheetNames[0]];
    if (!asSheet) throw new Error('Không tìm thấy sheet nào trong Accounts_Balances.xlsx');
    const asRows = XLSX.utils.sheet_to_json(asSheet, { header: 1 }) as any[][];
    if (asRows.length < 2) throw new Error('File Accounts_Balances.xlsx rỗng');

    const asHeader = asRows[0].map(h => String(h || '').trim());
    const accountNumberIdx = this.findHeaderIndex(asHeader, 'Account Number', ['Account', 'Tài khoản', 'Mã TKGD', 'Tai khoan']);
    const endCashBalanceIdx = this.findHeaderIndex(asHeader, 'End Cash Balance', ['Cash Balance', 'Balance', 'Số dư', 'Số dư cuối ngày', 'So du']);
    const recordDescriptionIdx = this.findHeaderIndex(asHeader, 'Record Description', ['Description', 'Mô tả', 'Mo ta']);

    const asName = files.accountsBalancesName || 'Accounts_Balances.xlsx';
    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      const missing = [];
      if (accountNumberIdx === -1) missing.push('Account Number');
      if (endCashBalanceIdx === -1) missing.push('End Cash Balance');
      throw new Error(`${asName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${asHeader.slice(0, 15).join(', ')}...]`);
    }

    const cqgBalanceMap = new Map<string, number>();

    for (let i = 1; i < asRows.length; i++) {
      const row = asRows[i];
      if (!row || row.length === 0) continue;

      const recordDescription = recordDescriptionIdx !== -1 ? String(row[recordDescriptionIdx] || '').trim() : '';
      if (!recordDescription.startsWith('Current-day')) {
        continue;
      }

      const account = String(row[accountNumberIdx] || '').trim();
      let balanceStr = String(row[endCashBalanceIdx] || '').trim().replace(/,/g, '');
      const balance = parseFloat(balanceStr) || 0;

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

    // 3. Perform comparison
    const result: Array<{
      maTKGD: string;
      calculatedBalance: number;
      cqgBalance: number;
      differ: number;
      inMS: boolean;
      inCQG: boolean;
    }> = [];

    const allKeys = new Set([...qltkgdDataMap.keys(), ...cqgBalanceMap.keys()]);

    for (const maTKGD of allKeys) {
      if (maTKGD.startsWith('999') || maTKGD.startsWith('050') || !/^\d/.test(maTKGD)) {
        continue;
      }

      const qltkgdRow = qltkgdDataMap.get(maTKGD);
      const cqgBalance = cqgBalanceMap.get(maTKGD);

      if (qltkgdRow) {
        const calculated = (qltkgdRow.soDuTKKQHienTai + qltkgdRow.choDaoHan - qltkgdRow.laiLoVND) / usdExchangeRate;
        const roundedCalc = Math.round(calculated * 100) / 100;

        if (cqgBalance !== undefined) {
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
            calculatedBalance: roundedCalc,
            cqgBalance: 0,
            differ: roundedCalc,
            inMS: true,
            inCQG: false,
          });
        }
      } else if (cqgBalance !== undefined) {
        const roundedCQG = Math.round(cqgBalance * 100) / 100;
        result.push({
          maTKGD,
          calculatedBalance: 0,
          cqgBalance: roundedCQG,
          differ: roundedCQG,
          inMS: false,
          inCQG: true,
        });
      }
    }

    return result;
  }

  /**
   * Filter negative margin accounts and generate NegativeAccounts.xlsx buffer
   */
  async checkNegativeMargin(
    files: {
      qltkgd: Buffer;
      eod?: Buffer;
      qltkgdName?: string;
      eodName?: string;
    }
  ): Promise<{
    negativeBalanceAccs: string[];
    negativeIMRAcc: string[];
    excelBase64: string;
  }> {
    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const soDuTKKQHienTaiIdx = this.findHeaderIndex(qltkgdHeader, 'Số dư TKKQ hiện tại', ['Số dư TKKQ cuối ngày', 'Số dư hiện tại', 'Số dư cuối ngày', 'Số dư TKKQ', 'TKKQ hiện tại', 'TKKQ cuối ngày']);

    const qltkgdName = files.qltkgdName || 'QLTKGD.xlsx';
    if (maTKGDIdx === -1 || soDuTKKQHienTaiIdx === -1) {
      const missing = [];
      if (maTKGDIdx === -1) missing.push('Mã TKGD');
      if (soDuTKKQHienTaiIdx === -1) missing.push('Số dư TKKQ hiện tại / cuối ngày');
      throw new Error(`${qltkgdName} không hợp lệ vì thiếu các cột: ${missing.join(', ')}. Vui lòng kiểm tra lại xem đúng file không. Các cột hiện có: [${qltkgdHeader.slice(0, 15).join(', ')}...]`);
    }

    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [qltkgdRows[0]]; // Include the header as the first row

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const balanceVal = parseFloat(row[soDuTKKQHienTaiIdx]);
      if (!maTKGD) continue;

      if (!isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }
    }

    // 2. Parse EOD CSV file (eod.csv) if provided
    const negativeIMRAcc: string[] = [];
    if (files.eod) {
      const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
      const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
      if (eodSheet) {
        const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
        if (eodRows.length >= 2) {
          const eodHeader = eodRows[0].map(h => String(h || '').trim());
          const investorCodeIdx = this.findHeaderIndex(eodHeader, 'InvestorCode', ['Investor Code', 'investor_code']);
          const initialRequiredMarginIdx = this.findHeaderIndex(eodHeader, 'InitialRequiredMargin', ['Initial Required Margin', 'initial_required_margin']);
          const estimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'EstimatedProfitVND', ['Estimated Profit VND', 'estimated_profit_vnd']);
          const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(eodHeader, 'OptionsEstimatedProfitVND', ['Options Estimated Profit VND', 'options_estimated_profit_vnd']);
          const netMarginIdx = this.findHeaderIndex(eodHeader, 'NetMargin', ['Net Margin', 'net_margin']);
          const availableMarginIdx = this.findHeaderIndex(eodHeader, 'AvailableMargin', ['Available Margin', 'available_margin']);
          const additionalMarginIdx = this.findHeaderIndex(eodHeader, 'AdditionalMargin', ['Additional Margin', 'additional_margin']);

          if (investorCodeIdx !== -1) {
            for (let i = 1; i < eodRows.length; i++) {
              const row = eodRows[i];
              if (!row || row.length === 0) continue;
              const investorCode = String(row[investorCodeIdx] || '').trim();
              if (!investorCode) continue;

              const initialRequiredMargin = initialRequiredMarginIdx !== -1 ? (parseFloat(row[initialRequiredMarginIdx]) || 0) : 0;
              const estimatedProfitVND = estimatedProfitVNDIdx !== -1 ? (parseFloat(row[estimatedProfitVNDIdx]) || 0) : 0;
              const optionsEstimatedProfitVND = optionsEstimatedProfitVNDIdx !== -1 ? (parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0) : 0;
              const netMargin = netMarginIdx !== -1 ? (parseFloat(row[netMarginIdx]) || 0) : 0;
              const availableMargin = availableMarginIdx !== -1 ? (parseFloat(row[availableMarginIdx]) || 0) : 0;
              const additionalMargin = additionalMarginIdx !== -1 ? (parseFloat(row[additionalMarginIdx]) || 0) : 0;

              if (initialRequiredMargin === 0 && estimatedProfitVND === 0 && optionsEstimatedProfitVND === 0 && netMargin === availableMargin && availableMargin < 0 && additionalMargin > 0) {
                negativeIMRAcc.push(investorCode);
              }
            }
          }
        }
      }
    }

    // 3. Generate new workbook containing negative current balance rows
    const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Negative Balance Accounts');
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      negativeBalanceAccs,
      negativeIMRAcc,
      excelBase64: excelBuffer.toString('base64'),
    };
  }

  /**
   * Parse Straits CSV file containing "Buy" and "Sell" columns
   */
  private parseStraitsCsv(buffer: Buffer): { totalVolume: number } {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error('File Straits CSV rỗng');
    }
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    const buyColIndex = headers.indexOf('buy');
    const sellColIndex = headers.indexOf('sell');

    if (buyColIndex === -1 || sellColIndex === -1) {
      throw new Error("Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits");
    }

    let totalVolume = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',');
      if (buyColIndex < values.length) {
        const buyVal = parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += buyVal;
      }
      if (sellColIndex < values.length) {
        const sellVal = parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0;
        totalVolume += sellVal;
      }
    }
    return { totalVolume };
  }

  /**
   * Parse TTTT.xlsx / TTM.xlsx for Position reconciliation
   */
  private parseTTTTForRecon(buffer: Buffer): { account: string; symbol: string; position: number }[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account', 'Mã khách hàng', 'Mã KH']);
    const symbolIdx = this.findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol', 'Mã HH', 'Mã hàng hóa']);
    const positionIdx = this.findHeaderIndex(header, 'KL ròng', ['Khối lượng ròng', 'Net Position', 'Position', 'Vị thế ròng', 'Trạng thái ròng']);

    // fallback to index if not found (column H is 7, column J is 9, column T is 19)
    const finalAccIdx = accountIdx !== -1 ? accountIdx : 7;
    const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 9;
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 19;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const account = String(row[finalAccIdx] || '').trim();
      const symbol = String(row[finalSymIdx] || '').trim();
      const position = parseFloat(row[finalPosIdx]) || 0;
      if (!account || !symbol) continue;
      result.push({ account, symbol, position });
    }
    return result;
  }

  /**
   * Parse PS.xlsx for Position reconciliation
   */
  private parsePSForRecon(buffer: Buffer): { account: string; symbol: string; position: number }[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim());
    const accountIdx = this.findHeaderIndex(header, 'Account', ['Mã TKGD', 'Mã tài khoản']);
    const symbolIdx = this.findHeaderIndex(header, 'Symbol', ['Mã HĐ', 'Mã hợp đồng']);
    const positionIdx = this.findHeaderIndex(header, 'Position', ['Net', 'KL ròng', 'Vị thế', 'Trạng thái ròng']);

    // fallback to index if not found (column A is 0, column D is 3, column I is 8)
    const finalAccIdx = accountIdx !== -1 ? accountIdx : 0;
    const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 3;
    const finalPosIdx = positionIdx !== -1 ? positionIdx : 8;

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      let account = String(row[finalAccIdx] || '').trim();
      const symbol = String(row[finalSymIdx] || '').trim();
      const position = parseFloat(row[finalPosIdx]) || 0;
      if (!account || !symbol) continue;

      // adjust account suffix
      account = account.replace(/F$/i, '')
                       .replace(/L$/i, '-L')
                       .replace(/S$/i, '-S')
                       .replace(/--/g, '-');

      result.push({ account, symbol, position });
    }
    return result;
  }

  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt: Buffer;
      cqgPs: Buffer;
    },
    acmTradesName: string,
    tradingDate: Date,
    holidays: string[] = [],
  ): Promise<{
    passed: boolean;
    warnings: string[];
    totals: {
      totalACM_MS: number;
      totalACM_Straits: number;
      differACM: number;
      totalCQG_MS: number;
      totalCQG_FR: number;
      differCQG: number;
    };
    mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }>;
    mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }>;
  }> {
    const warnings: string[] = [];

    // 1. Calculate expected T-1 date relative to tradingDate
    const d = new Date(tradingDate);
    d.setDate(d.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) { // 0 Sunday, 6 Saturday
      d.setDate(d.getDate() - 1);
    }
    const expectedDateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;

    // Validate filename date suffix for acmTrades - WARNING only, not error
    if (acmTradesName && !acmTradesName.includes(expectedDateStr)) {
      warnings.push(`⚠️ Tên file ACM (${acmTradesName}) không khớp ngày T-1 dự kiến (${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}). Có thể do ngày nghỉ lễ hoặc chọn nhầm file. Vui lòng xác nhận lại.`);
    }

    // 2. Parse DSGD and separate into ACM and CQG trades
    const dsgdData = this.parseDSGD(files.dsgd);
    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach(gd => {
      if (gd.maTKGD.endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    // 3. Parse Straits ACM Trades CSV
    const acmStraitsData = this.parseStraitsCsv(files.acmTrades);
    const totalACM_Straits = acmStraitsData.totalVolume;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    // 4. Parse CQG FR.xlsx and filter out ZWAZCE
    const frData = this.parseFR(files.cqgFr, tradingDate, holidays);
    let totalCQG_FR = 0;
    frData.forEach(fr => {
      if (fr.symbol !== 'ZWAZCE') {
        totalCQG_FR += fr.qty;
      }
    });
    const differCQG = Math.abs(totalCQG_MS - totalCQG_FR);

    // 5. Find trade discrepancies for normal CQG trades (similar to checkKLGD)
    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }> = [];

    // Find FR rows not in DSGD
    frData.forEach(fr => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          reason: 'Lệnh CQG không tìm thấy bên M-System',
        });
      }
    });

    // Find DSGD rows not in FR (excluding ACM trades)
    dsgdData.forEach(gd => {
      if (gd.maTKGD.endsWith('A')) return;
      const existsInFR = frData.some(fr => fr.combinedKey === gd.combinedKey);
      if (!existsInFR) {
        mismatchedTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System không tìm thấy bên CQG',
        });
      }
    });

    // 6. Compare Net Positions (Check 2: TTTT.xlsx vs PS.xlsx)
    const ttttList = this.parseTTTTForRecon(files.tttt);
    const psList = this.parsePSForRecon(files.cqgPs);

    // Group MS positions by Account + Symbol
    const msSummary = new Map<string, { account: string; symbol: string; position: number }>();
    ttttList.forEach(item => {
      const key = `${item.account}_${item.symbol}`;
      const existing = msSummary.get(key) || { account: item.account, symbol: item.symbol, position: 0 };
      existing.position += item.position;
      msSummary.set(key, existing);
    });

    // Group CQG positions by Account + Symbol
    const cqgSummary = new Map<string, { account: string; symbol: string; position: number }>();
    psList.forEach(item => {
      const key = `${item.account}_${item.symbol}`;
      const existing = cqgSummary.get(key) || { account: item.account, symbol: item.symbol, position: 0 };
      existing.position += item.position;
      cqgSummary.set(key, existing);
    });

    // Find mismatched net positions
    const mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }> = [];

    const allKeys = new Set([...msSummary.keys(), ...cqgSummary.keys()]);
    for (const key of allKeys) {
      const ms = msSummary.get(key);
      const cqg = cqgSummary.get(key);
      const account = ms?.account || cqg?.account || '';
      const symbol = ms?.symbol || cqg?.symbol || '';
      const msVal = ms?.position || 0;
      const cqgVal = cqg?.position || 0;
      const diff = msVal - cqgVal;

      if (Math.abs(diff) > 0.001) {
        mismatchedPositions.push({
          account,
          symbol,
          msPosition: msVal,
          cqgPosition: cqgVal,
          differ: diff,
        });
      }
    }

    const passed = differACM === 0 && differCQG === 0 && mismatchedTrades.length === 0 && mismatchedPositions.length === 0;

    return {
      passed,
      warnings,
      totals: {
        totalACM_MS,
        totalACM_Straits,
        differACM,
        totalCQG_MS,
        totalCQG_FR,
        differCQG,
      },
      mismatchedTrades,
      mismatchedPositions,
    };
  }
}




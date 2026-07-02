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
    const maTKGDIdx = header.indexOf('Mã TKGD');
    const maHDIdx = header.indexOf('Mã HĐ');
    const tongMuaIdx = header.indexOf('Tổng mua');
    const tongBanIdx = header.indexOf('Tổng bán');
    const giaKhopIdx = header.indexOf('Giá khớp');

    if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, Tổng mua, Tổng bán)');
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
    files: { qltkgd: Buffer; eod: Buffer; tttt: Buffer },
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
    mismatchedEOD: Array<{
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }>;
  }> {
    const rates = exchangeRates || {
      usdLoss: 25220,
      usdGain: 25220,
      jpyLoss: 3,
      jpyGain: 4,
      myrLoss: 1,
      myrGain: 2,
    };

    // 1. Parse QLTKGD.xlsx
    const qltkgdWorkbook = XLSX.read(files.qltkgd, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    if (!qltkgdSheet) throw new Error('Không tìm thấy sheet nào trong QLTKGD.xlsx');
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 }) as any[][];
    if (qltkgdRows.length < 2) throw new Error('File QLTKGD.xlsx rỗng');

    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());
    const maTKGDIdx = qltkgdHeader.indexOf('Mã TKGD');
    const soDuTKKQDauNgayIdx = qltkgdHeader.indexOf('Số dư TKKQ đầu ngày');
    const nopRutTrongPhienIdx = qltkgdHeader.indexOf('Nộp rút trong phiên');
    const phiGiaoDichIdx = qltkgdHeader.indexOf('Phí giao dịch');
    const phiQuyenChonIdx = qltkgdHeader.indexOf('Phí quyền chọn');
    const phiDVThanhToanIdx = qltkgdHeader.indexOf('Phí dịch vụ thanh toán (VND)');

    if (maTKGDIdx === -1 || soDuTKKQDauNgayIdx === -1 || nopRutTrongPhienIdx === -1 || phiGiaoDichIdx === -1 || phiQuyenChonIdx === -1 || phiDVThanhToanIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong QLTKGD.xlsx');
    }

    const qltkgdDataMap = new Map<string, {
      soDuTKKQDauNgay: number;
      nopRutTrongPhien: number;
      phiGiaoDich: number;
      phiQuyenChon: number;
      phiDVThanhToan: number;
      laiLoUSD: number;
      laiLoJPY: number;
      laiLoMYR: number;
    }>();

    for (let i = 1; i < qltkgdRows.length; i++) {
      const row = qltkgdRows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      if (!maTKGD) continue;

      qltkgdDataMap.set(maTKGD, {
        soDuTKKQDauNgay: parseFloat(row[soDuTKKQDauNgayIdx]) || 0,
        nopRutTrongPhien: parseFloat(row[nopRutTrongPhienIdx]) || 0,
        phiGiaoDich: parseFloat(row[phiGiaoDichIdx]) || 0,
        phiQuyenChon: parseFloat(row[phiQuyenChonIdx]) || 0,
        phiDVThanhToan: parseFloat(row[phiDVThanhToanIdx]) || 0,
        laiLoUSD: 0,
        laiLoJPY: 0,
        laiLoMYR: 0,
      });
    }

    // 2. Parse EOD CSV file (eod.csv)
    const eodWorkbook = XLSX.read(files.eod, { type: 'buffer' });
    const eodSheet = eodWorkbook.Sheets[eodWorkbook.SheetNames[0]];
    if (!eodSheet) throw new Error('Không tìm thấy dữ liệu trong eod.csv');
    const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 }) as any[][];
    if (eodRows.length < 2) throw new Error('File eod.csv rỗng');

    const eodHeader = eodRows[0].map(h => String(h || '').trim());
    const investorCodeIdx = eodHeader.findIndex(h => h.toLowerCase() === 'investorcode');
    const initialRequiredMarginIdx = eodHeader.findIndex(h => h.toLowerCase() === 'initialrequiredmargin');
    const estimatedProfitVNDIdx = eodHeader.findIndex(h => h.toLowerCase() === 'estimatedprofitvnd');
    const optionsEstimatedProfitVNDIdx = eodHeader.findIndex(h => h.toLowerCase() === 'optionsestimatedprofitvnd');
    const netMarginIdx = eodHeader.findIndex(h => h.toLowerCase() === 'netmargin');
    const availableMarginIdx = eodHeader.findIndex(h => h.toLowerCase() === 'availablemargin');
    const additionalMarginIdx = eodHeader.findIndex(h => h.toLowerCase() === 'additionalmargin');
    const eodBalanceIdx = eodHeader.findIndex(h => h.toLowerCase() === 'eodbalance');

    if (investorCodeIdx === -1 || eodBalanceIdx === -1) {
      throw new Error('Thiếu cột bắt buộc trong eod.csv (investorCode hoặc eodBalance)');
    }

    const negativeIMRAcc: string[] = [];
    const eodBalanceMap = new Map<string, number>();

    for (let i = 1; i < eodRows.length; i++) {
      const row = eodRows[i];
      if (!row || row.length === 0) continue;
      const investorCode = String(row[investorCodeIdx] || '').trim();
      if (!investorCode) continue;

      const initialRequiredMargin = parseFloat(row[initialRequiredMarginIdx]) || 0;
      const estimatedProfitVND = parseFloat(row[estimatedProfitVNDIdx]) || 0;
      const optionsEstimatedProfitVND = parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0;
      const netMargin = parseFloat(row[netMarginIdx]) || 0;
      const availableMargin = parseFloat(row[availableMarginIdx]) || 0;
      const additionalMargin = parseFloat(row[additionalMarginIdx]) || 0;
      const eodBalance = parseFloat(row[eodBalanceIdx]) || 0;

      eodBalanceMap.set(investorCode, eodBalance);

      if (initialRequiredMargin === 0 && estimatedProfitVND === 0 && optionsEstimatedProfitVND === 0 && netMargin === availableMargin && availableMargin < 0 && additionalMargin > 0) {
        negativeIMRAcc.push(investorCode);
      }
    }

    // 3. Parse TTTT.xlsx and map realized Profit/Loss
    const ttttWorkbook = XLSX.read(files.tttt, { type: 'buffer' });
    const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
    if (!ttttSheet) throw new Error('Không tìm thấy sheet nào trong TTTT.xlsx');
    const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 }) as any[][];
    if (ttttRows.length >= 2) {
      const ttttHeader = ttttRows[0].map(h => String(h || '').trim());
      const ttttMaTKGDIdx = ttttHeader.indexOf('Mã TKGD');
      const ttttMaHDIdx = ttttHeader.indexOf('Mã HĐ');
      const ttttTongLaiLoIdx = ttttHeader.indexOf('Lãi lỗ thực tế');

      if (ttttMaTKGDIdx === -1 || ttttMaHDIdx === -1 || ttttTongLaiLoIdx === -1) {
        throw new Error('Thiếu cột bắt buộc trong TTTT.xlsx (Mã TKGD, Mã HĐ, Lãi lỗ thực tế)');
      }

      const statics = this.loadStatics();

      for (let i = 1; i < ttttRows.length; i++) {
        const row = ttttRows[i];
        if (!row || row.length === 0) continue;

        const maTKGD = String(row[ttttMaTKGDIdx] || '').trim();
        const maHD = String(row[ttttMaHDIdx] || '').trim();
        const tongLaiLo = parseFloat(row[ttttTongLaiLoIdx]);

        if (!maTKGD || !maHD || isNaN(tongLaiLo)) continue;

        const client = qltkgdDataMap.get(maTKGD);
        if (client) {
          let comCode = '';
          const lmeCodeKeys = Object.keys(statics.LMECode || {});
          const matchedLMEKey = lmeCodeKeys.find(key => maHD.startsWith(statics.LMECode[key]));
          if (matchedLMEKey) {
            comCode = statics.LMECode[matchedLMEKey];
          } else {
            const monthCodeIndex = maHD.length - 3;
            if (monthCodeIndex >= 0) {
              comCode = maHD.substring(0, monthCodeIndex);
            } else {
              comCode = maHD;
            }
          }

          const commodity = statics.Commodity?.find((comm: any) => comm.MaHangHoa === comCode);
          const loaiTyGia = commodity ? commodity.LoaiTyGia : 'USD/VND';

          if (loaiTyGia === 'JPY/VND') {
            client.laiLoJPY += tongLaiLo;
          } else if (loaiTyGia === 'MYR/VND') {
            client.laiLoMYR += tongLaiLo;
          } else {
            client.laiLoUSD += tongLaiLo;
          }
        }
      }
    }

    // 4. Calculate EOD balances and perform check
    const mismatchedEOD: Array<{
      maTKGD: string;
      calculatedBalance: number;
      eodBalance: number;
      differ: number;
    }> = [];

    for (const [maTKGD, client] of qltkgdDataMap.entries()) {
      let tyGiaUSD = rates.usdGain;
      let tyGiaJPY = rates.jpyGain;
      let tyGiaMYR = rates.myrGain;

      if (client.phiQuyenChon + client.laiLoUSD < 0) {
        tyGiaUSD = rates.usdLoss;
      }
      if (client.laiLoJPY < 0) {
        tyGiaJPY = rates.jpyLoss;
      }
      if (client.laiLoMYR < 0) {
        tyGiaMYR = rates.myrLoss;
      }

      const calculatedBalance = client.soDuTKKQDauNgay
        + client.nopRutTrongPhien
        - client.phiGiaoDich
        - client.phiDVThanhToan
        + (client.phiQuyenChon + client.laiLoUSD) * tyGiaUSD
        + client.laiLoJPY * tyGiaJPY
        + client.laiLoMYR * tyGiaMYR;

      const eodBalance = eodBalanceMap.get(maTKGD);
      if (eodBalance !== undefined) {
        const differ = Math.abs(eodBalance - calculatedBalance);
        if (differ >= 1000) {
          mismatchedEOD.push({
            maTKGD,
            calculatedBalance,
            eodBalance,
            differ,
          });
        }
      }
    }

    return {
      negativeIMRAcc,
      mismatchedEOD,
    };
  }

  /**
   * CQG EOD Balance Reconciliation (CheckEODCQG)
   */
  async checkEODCQG(
    files: { qltkgd: Buffer; accountsBalances: Buffer },
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
    const maTKGDIdx = qltkgdHeader.indexOf('Mã TKGD');
    const laiLoChoDaoHanIdx = qltkgdHeader.indexOf('Lãi lỗ thực tế chờ đáo hạn');
    const laiLoThucTeFuturesVNDIdx = qltkgdHeader.indexOf('Lãi lỗ thực tế Futures (VND)');
    const soDuTKKQHienTaiIdx = qltkgdHeader.indexOf('Số dư TKKQ hiện tại');

    if (maTKGDIdx === -1) {
      throw new Error('Thiếu cột "Mã TKGD" trong QLTKGD.xlsx');
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
    const accountNumberIdx = asHeader.indexOf('Account Number');
    const endCashBalanceIdx = asHeader.indexOf('End Cash Balance');
    const recordDescriptionIdx = asHeader.indexOf('Record Description');

    if (accountNumberIdx === -1 || endCashBalanceIdx === -1) {
      throw new Error('Thiếu cột "Account Number" hoặc "End Cash Balance" trong Accounts_Balances.xlsx');
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
}



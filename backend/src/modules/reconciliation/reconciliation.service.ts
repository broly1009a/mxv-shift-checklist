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
}

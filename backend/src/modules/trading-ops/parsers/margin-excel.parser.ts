import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface QltkgdRecord {
  maTKGD: string;
  soDuTKKQHienTai: number;
  choDaoHan: number;
  laiLoVND: number;
  rawRow?: any[];
}

export interface QltkgdParseResult {
  totalRows: number;
  records: QltkgdRecord[];
  dataMap: Map<string, { soDuTKKQHienTai: number; choDaoHan: number; laiLoVND: number }>;
  negativeBalanceAccs: string[];
  negativeRows: any[][];
  headerRow: any[];
}

export interface EodMarginRecord {
  investorCode: string;
  availableMargin: number;
  additionalMargin: number;
  initialRequiredMargin: number;
  netMargin: number;
  eodBalance: number;
  isNegativeIMR: boolean;
}

export interface EodMarginParseResult {
  totalRows: number;
  records: EodMarginRecord[];
  eodBalanceMap: Map<string, number>;
  negativeIMRAcc: string[];
}

/**
 * Bộ phân tích dữ liệu chuyên biệt cho báo cáo Quản lý tài khoản (QLTKGD / QLTTTKGD)
 * và Báo cáo Trạng thái Ký quỹ Cuối ngày (EOD / EOD CCP).
 * Dùng chung cho: MarginCheckerService, PreEodReconService, CcpEodService, và CqgMergerService.
 */
export class MarginExcelParser {
  public static findHeaderIndex(
    headers: string[],
    target: string,
    aliases: string[] = [],
  ): number {
    const normalize = (str: string): string => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normTarget = normalize(target);
    const normAliases = aliases.map((a) => normalize(a));

    return headers.findIndex((h) => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.some((alias) => normH.includes(alias));
    });
  }

  /**
   * Phân tích file QLTKGD (hoặc QLTTTKGD CCP) từ Buffer hoặc đường dẫn File.
   */
  public static parseQltkgd(
    input: Buffer | string,
    options?: { fileName?: string },
  ): QltkgdParseResult {
    let workbook: XLSX.WorkBook;
    if (typeof input === 'string') {
      if (!fs.existsSync(input)) {
        return {
          totalRows: 0,
          records: [],
          dataMap: new Map(),
          negativeBalanceAccs: [],
          negativeRows: [],
          headerRow: [],
        };
      }
      workbook = XLSX.readFile(input);
    } else {
      if (!input || input.length === 0) {
        return {
          totalRows: 0,
          records: [],
          dataMap: new Map(),
          negativeBalanceAccs: [],
          negativeRows: [],
          headerRow: [],
        };
      }
      workbook = XLSX.read(input, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Không tìm thấy sheet nào trong file QLTKGD');
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!rows || rows.length < 2) {
      return {
        totalRows: 0,
        records: [],
        dataMap: new Map(),
        negativeBalanceAccs: [],
        negativeRows: [],
        headerRow: rows?.[0] || [],
      };
    }

    const header = rows[0].map((h) => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(header, 'Mã TKGD', [
      'mã tài khoản',
      'mã tk',
      'mã tiểu khoản',
      'số tiểu khoản',
      'tai khoan',
      'tkgd',
      'investor code',
      'investorcode',
      'account number',
      'account',
    ]);

    const soDuTKKQHienTaiIdx = this.findHeaderIndex(header, 'Số dư TKKQ hiện tại', [
      'số dư tkkq cuối ngày',
      'số dư hiện tại',
      'số dư cuối ngày',
      'số dư tkkq',
      'tkkq hiện tại',
      'tkkq cuối ngày',
      'end balance',
      'ending balance',
    ]);

    const choDaoHanIdx = this.findHeaderIndex(header, 'Lãi lỗ thực tế chờ đáo hạn', [
      'chờ đáo hạn',
      'cho dao han',
      'lai lo cho dao han',
      'lãi lỗ chờ đáo hạn',
    ]);

    const laiLoVNDIdx = this.findHeaderIndex(header, 'Lãi lỗ thực tế Futures (VND)', [
      'lãi lỗ thực tế futures',
      'lãi lỗ futures',
      'lai lo thuc te futures',
      'lai lo futures',
    ]);

    const fileName = options?.fileName || (typeof input === 'string' ? path.basename(input) : 'QLTKGD.xlsx');
    if (maTKGDIdx === -1) {
      throw new Error(`${fileName} không hợp lệ vì thiếu cột: Mã TKGD / Mã tiểu khoản.`);
    }

    const records: QltkgdRecord[] = [];
    const dataMap = new Map<string, { soDuTKKQHienTai: number; choDaoHan: number; laiLoVND: number }>();
    const negativeBalanceAccs: string[] = [];
    const negativeRows: any[][] = [rows[0]];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      if (!maTKGD) continue;

      const balanceVal = soDuTKKQHienTaiIdx !== -1 ? parseFloat(row[soDuTKKQHienTaiIdx]) || 0 : 0;
      const choDaoHan = choDaoHanIdx !== -1 ? parseFloat(row[choDaoHanIdx]) || 0 : 0;
      const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(row[laiLoVNDIdx]) || 0 : 0;

      if (soDuTKKQHienTaiIdx !== -1 && !isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }

      const item: QltkgdRecord = {
        maTKGD,
        soDuTKKQHienTai: balanceVal,
        choDaoHan,
        laiLoVND,
        rawRow: row,
      };

      records.push(item);
      dataMap.set(maTKGD, {
        soDuTKKQHienTai: balanceVal,
        choDaoHan,
        laiLoVND,
      });
    }

    return {
      totalRows: rows.length - 1,
      records,
      dataMap,
      negativeBalanceAccs,
      negativeRows,
      headerRow: rows[0],
    };
  }

  /**
   * Phân tích file EOD (hoặc EOD CCP) từ Buffer hoặc đường dẫn File.
   */
  public static parseEodMargin(
    input: Buffer | string,
    options?: { fileName?: string },
  ): EodMarginParseResult {
    let workbook: XLSX.WorkBook;
    if (typeof input === 'string') {
      if (!fs.existsSync(input)) {
        return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
      }
      workbook = XLSX.readFile(input);
    } else {
      if (!input || input.length === 0) {
        return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
      }
      workbook = XLSX.read(input, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!rows || rows.length < 2) {
      return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
    }

    const header = rows[0].map((h) => String(h || '').trim());
    const investorCodeIdx = this.findHeaderIndex(header, 'InvestorCode', [
      'investor code',
      'investor_code',
      'mã tkgd',
      'mã tài khoản',
      'mã tk',
      'mã tiểu khoản',
      'số tiểu khoản',
      'account',
      'account number',
    ]);

    const availableMarginIdx = this.findHeaderIndex(header, 'AvailableMargin', [
      'available margin',
      'available_margin',
      'ký quỹ khả dụng',
      'availablemargin',
    ]);

    const additionalMarginIdx = this.findHeaderIndex(header, 'AdditionalMargin', [
      'additional margin',
      'additional_margin',
      'ký quỹ bổ sung',
      'mức bổ sung ký quỹ',
      'additionalmargin',
    ]);

    const initialRequiredMarginIdx = this.findHeaderIndex(header, 'InitialRequiredMargin', [
      'initial required margin',
      'initial_required_margin',
      'ký quỹ ban đầu',
      'kq ban đầu yêu cầu',
      'ký quỹ ban đầu yêu cầu',
    ]);

    const netMarginIdx = this.findHeaderIndex(header, 'NetMargin', [
      'net margin',
      'net_margin',
      'ký quỹ ròng',
      'giá trị ròng ký quỹ',
    ]);

    const eodBalanceIdx = this.findHeaderIndex(header, 'eodBalance', [
      'eod balance',
      'eodbalance',
      'eod_balance',
      'số dư cuối ngày',
      'số dư eod',
      'end balance',
      'ending balance',
      'balance',
    ]);

    if (investorCodeIdx === -1) {
      return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
    }

    const records: EodMarginRecord[] = [];
    const eodBalanceMap = new Map<string, number>();
    const negativeIMRAcc: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const investorCode = String(row[investorCodeIdx] || '').trim();
      if (!investorCode) continue;

      const avail = availableMarginIdx !== -1 ? parseFloat(row[availableMarginIdx]) || 0 : 0;
      const add = additionalMarginIdx !== -1 ? parseFloat(row[additionalMarginIdx]) || 0 : 0;
      const init = initialRequiredMarginIdx !== -1 ? parseFloat(row[initialRequiredMarginIdx]) || 0 : 0;
      const net = netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
      const eodBal = eodBalanceIdx !== -1 ? parseFloat(row[eodBalanceIdx]) || 0 : 0;

      if (eodBalanceIdx !== -1 && !isNaN(eodBal)) {
        eodBalanceMap.set(investorCode, eodBal);
      }

      // Tiêu chuẩn nhận diện tài khoản âm ký quỹ IMR (Initial Margin Requirement):
      // Hoặc theo công thức CoreCCP: (init === 0 && net === avail && avail < 0 && add > 0)
      // Hoặc theo quy tắc M-System: (avail < 0 && add > 0)
      const isNegativeIMR =
        (init === 0 && net === avail && avail < 0 && add > 0) ||
        (avail < 0 && add > 0);

      if (isNegativeIMR) {
        negativeIMRAcc.push(investorCode);
      }

      records.push({
        investorCode,
        availableMargin: avail,
        additionalMargin: add,
        initialRequiredMargin: init,
        netMargin: net,
        eodBalance: eodBal,
        isNegativeIMR,
      });
    }

    return {
      totalRows: rows.length - 1,
      records,
      eodBalanceMap,
      negativeIMRAcc,
    };
  }

  /**
   * Tạo buffer Excel chứa danh sách các tài khoản âm số dư
   */
  public static buildNegativeBalanceExcelBuffer(negativeRows: any[][]): Buffer {
    const newSheet = XLSX.utils.aoa_to_sheet(negativeRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Negative Balance Accounts');
    return XLSX.write(newWorkbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }
}

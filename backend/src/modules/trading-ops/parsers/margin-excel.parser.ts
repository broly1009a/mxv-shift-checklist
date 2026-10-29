import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { FAST_XLSX_READ_OPTIONS as FAST_XLSX_OPTS } from '../../../shared';

export interface QltkgdRecord {
  maTKGD: string;
  soDuTKKQHienTai: number;
  choDaoHan: number;
  laiLoVND: number;
  soDuTKKQDauNgay?: number;
  nopRutTrongPhien?: number;
  phiGiaoDich?: number;
  phiQuyenChon?: number;
  phiDVThanhToan?: number;
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
  estimatedProfitVND: number;
  optionsEstimatedProfitVND: number;
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
 * Dùng chung cho: MarginCheckerService, MsEodReconService, CcpEodService, và CqgMergerService.
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

    // Ưu tiên 1: Exact Match (Khớp chính xác 100%)
    const exactIdx = headers.findIndex((h) => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.includes(normH);
    });
    if (exactIdx !== -1) return exactIdx;

    // Ưu tiên 2: Substring Match (Chỉ khi không có cột nào khớp chính xác)
    return headers.findIndex((h) => {
      const normH = normalize(h);
      return normAliases.some((alias) => normH.includes(alias));
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
      workbook = XLSX.readFile(input, FAST_XLSX_OPTS);
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
      workbook = XLSX.read(input, { ...FAST_XLSX_OPTS, type: 'buffer' });
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

    const soDuTKKQDauNgayIdx = this.findHeaderIndex(header, 'Số dư TKKQ đầu ngày', [
      'số dư đầu ngày',
      'so du dau ngay',
      'beginning balance',
      'start balance',
    ]);

    const nopRutTrongPhienIdx = this.findHeaderIndex(header, 'Nộp rút trong phiên', [
      'nộp rút trong phiên',
      'nop rut trong phien',
      'nộp rút',
      'nop rut',
      'deposit withdrawal',
    ]);

    const phiGiaoDichIdx = this.findHeaderIndex(header, 'Phí giao dịch', [
      'phí gd',
      'phi giao dich',
      'trading fee',
      'transaction fee',
    ]);

    const phiQuyenChonIdx = this.findHeaderIndex(header, 'Phí quyền chọn', [
      'phí qc',
      'phi quyen chon',
      'option fee',
      'options fee',
    ]);

    const phiDVThanhToanIdx = this.findHeaderIndex(header, 'Phí dịch vụ thanh toán (VND)', [
      'phí dv thanh toán',
      'phí dvtt',
      'phi dvtt',
      'phi dich vu thanh toan',
      'phí dịch vụ thanh toán',
      'payment service fee',
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
      const soDuTKKQDauNgay = soDuTKKQDauNgayIdx !== -1 ? parseFloat(row[soDuTKKQDauNgayIdx]) || 0 : 0;
      const nopRutTrongPhien = nopRutTrongPhienIdx !== -1 ? parseFloat(row[nopRutTrongPhienIdx]) || 0 : 0;
      const phiGiaoDich = phiGiaoDichIdx !== -1 ? parseFloat(row[phiGiaoDichIdx]) || 0 : 0;
      const phiQuyenChon = phiQuyenChonIdx !== -1 ? parseFloat(row[phiQuyenChonIdx]) || 0 : 0;
      const phiDVThanhToan = phiDVThanhToanIdx !== -1 ? parseFloat(row[phiDVThanhToanIdx]) || 0 : 0;

      if (soDuTKKQHienTaiIdx !== -1 && !isNaN(balanceVal) && balanceVal < 0) {
        negativeBalanceAccs.push(maTKGD);
        negativeRows.push(row);
      }

      const item: QltkgdRecord = {
        maTKGD,
        soDuTKKQHienTai: balanceVal,
        choDaoHan,
        laiLoVND,
        soDuTKKQDauNgay,
        nopRutTrongPhien,
        phiGiaoDich,
        phiQuyenChon,
        phiDVThanhToan,
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
      workbook = XLSX.readFile(input, FAST_XLSX_OPTS);
    } else {
      if (!input || input.length === 0) {
        return { totalRows: 0, records: [], eodBalanceMap: new Map(), negativeIMRAcc: [] };
      }
      workbook = XLSX.read(input, { ...FAST_XLSX_OPTS, type: 'buffer' });
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

    const estimatedProfitVNDIdx = this.findHeaderIndex(header, 'estimatedProfitVND', [
      'estimated profit vnd',
      'estimatedprofitvnd',
      'lãi lỗ dự kiến',
      'lãi lỗ dự kiến vnd',
    ]);

    const optionsEstimatedProfitVNDIdx = this.findHeaderIndex(header, 'optionsEstimatedProfitVND', [
      'options estimated profit vnd',
      'optionsestimatedprofitvnd',
      'lãi lỗ quyền chọn dự kiến',
      'lãi lỗ quyền chọn dự kiến vnd',
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
      const estProfit = estimatedProfitVNDIdx !== -1 ? parseFloat(row[estimatedProfitVNDIdx]) || 0 : 0;
      const optEstProfit = optionsEstimatedProfitVNDIdx !== -1 ? parseFloat(row[optionsEstimatedProfitVNDIdx]) || 0 : 0;
      const net = netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
      const eodBal = eodBalanceIdx !== -1 ? parseFloat(row[eodBalanceIdx]) || 0 : 0;

      if (eodBalanceIdx !== -1 && !isNaN(eodBal)) {
        eodBalanceMap.set(investorCode, eodBal);
      }

      // Tiêu chuẩn nhận diện tài khoản âm ký quỹ mới (NegativeIMRAcc) chuẩn 100% C# Tool
      // (TransactionCheckingService.cs#L491):
      // initialRequiredMargin == 0 && estimatedProfitVND == 0 && optionsEstimatedProfitVND == 0 && netMargin == availableMargin && availableMargin < 0 && additionalMargin > 0
      const isNegativeIMR =
        init === 0 &&
        estProfit === 0 &&
        optEstProfit === 0 &&
        net === avail &&
        avail < 0 &&
        add > 0;

      if (isNegativeIMR) {
        negativeIMRAcc.push(investorCode);
      }

      records.push({
        investorCode,
        availableMargin: avail,
        additionalMargin: add,
        initialRequiredMargin: init,
        netMargin: net,
        estimatedProfitVND: estProfit,
        optionsEstimatedProfitVND: optEstProfit,
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
   * Phân tích file TTTT.xlsx (Thông tin thanh toán) để bóc tách lãi lỗ theo nguyên tệ (USD, JPY, MYR).
   * Chuẩn 100% theo Tool C# (FileUtils.cs#L1831-L1926).
   */
  public static parseTttt(
    input: Buffer | string,
  ): Map<string, { usd: number; jpy: number; myr: number }> {
    const pnlMap = new Map<string, { usd: number; jpy: number; myr: number }>();
    let workbook: XLSX.WorkBook;
    if (typeof input === 'string') {
      if (!fs.existsSync(input)) return pnlMap;
      workbook = XLSX.readFile(input, FAST_XLSX_OPTS);
    } else {
      if (!input || input.length === 0) return pnlMap;
      workbook = XLSX.read(input, { ...FAST_XLSX_OPTS, type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return pnlMap;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!rows || rows.length < 2) return pnlMap;

    const header = rows[0].map((h) => String(h || '').trim());
    const maTKGDIdx = this.findHeaderIndex(header, 'Mã TKGD', [
      'mã tài khoản',
      'tkgd',
      'account',
      'investor code',
    ]);
    const maHDIdx = this.findHeaderIndex(header, 'Mã HĐ', [
      'mã hợp đồng',
      'hợp đồng',
      'contract',
      'symbol',
      'ma hd',
    ]);
    const tongLaiLoIdx = this.findHeaderIndex(header, 'Lãi lỗ thực tế', [
      'lãi lỗ',
      'lai lo thuc te',
      'realized pnl',
      'pnl',
    ]);

    if (maTKGDIdx === -1 || maHDIdx === -1 || tongLaiLoIdx === -1) {
      return pnlMap;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const maTKGD = String(row[maTKGDIdx] || '').trim();
      const maHD = String(row[maHDIdx] || '').trim();
      const tongLaiLo = parseFloat(row[tongLaiLoIdx]) || 0;
      if (!maTKGD || !maHD) continue;

      let entry = pnlMap.get(maTKGD);
      if (!entry) {
        entry = { usd: 0, jpy: 0, myr: 0 };
        pnlMap.set(maTKGD, entry);
      }

      const upperHD = maHD.toUpperCase();
      // Phân loại nguyên tệ theo mã hàng hóa chuẩn C# statics.json:
      // TRU (Cao su RSS3) -> JPY/VND
      // MPO (Dầu cọ thô) -> MYR/VND
      // Các mã còn lại -> USD/VND
      if (upperHD.startsWith('TRU')) {
        entry.jpy += tongLaiLo;
      } else if (upperHD.startsWith('MPO')) {
        entry.myr += tongLaiLo;
      } else {
        entry.usd += tongLaiLo;
      }
    }

    return pnlMap;
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

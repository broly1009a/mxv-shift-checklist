import * as XLSX from 'xlsx';

export interface CcpTradeRecord {
  maHD: string;
  soTK: string;
  soHieuLenh?: string;
  thoiGianKhop?: string;
  loaiLenh?: string;
  giaKhop: number;
  klKhop: number;
}

export interface CcpOpenPositionRecord {
  maHD: string;
  soTK: string;
  klMua: number;
  klBan: number;
  totalVolume: number;
}

export interface CcpSettledPositionRecord {
  maHD: string;
  soTK: string;
  klMua: number;
  klBan: number;
  totalVolume: number;
}

export class CcpExcelParser {
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
      return normH === normTarget || normAliases.includes(normH);
    });
  }

  private static parseNumber(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Bóc tách file DSGD của CoreCCP (Lịch sử giao dịch / Khớp lệnh)
   * Sheet mục tiêu: 'Export' hoặc sheet đầu tiên.
   * Cột mục tiêu: 'KL khớp'
   */
  public static parseDSGD(buffer: Buffer): { totalKhop: number; records: CcpTradeRecord[] } {
    if (!buffer || buffer.length === 0) return { totalKhop: 0, records: [] };
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'export') || workbook.SheetNames[0];
    if (!sheetName) return { totalKhop: 0, records: [] };

    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return { totalKhop: 0, records: [] };

    const header = rows[0].map((h) => String(h || '').trim());
    const klKhopIdx = this.findHeaderIndex(header, 'KL khớp', ['Khối lượng khớp', 'KL khop', 'Matched Vol', 'Matched Volume']);
    const maHDIdx = this.findHeaderIndex(header, 'Mã hợp đồng', ['Ma hop dong', 'Hợp đồng', 'Contract']);
    const soTKIdx = this.findHeaderIndex(header, 'Số tài khoản', ['So tai khoan', 'Tài khoản', 'Account', 'Account No']);
    const giaKhopIdx = this.findHeaderIndex(header, 'Giá khớp', ['Gia khop', 'Price', 'Matched Price']);
    const soHieuLenhIdx = this.findHeaderIndex(header, 'Số hiệu lệnh', ['So hieu lenh', 'Order No', 'Order ID']);
    const thoiGianKhopIdx = this.findHeaderIndex(header, 'Thời gian khớp', ['Thoi gian khop', 'Matched Time', 'Time']);
    const loaiLenhIdx = this.findHeaderIndex(header, 'Loại lệnh', ['Loai lenh', 'Side', 'Type']);

    if (klKhopIdx === -1) {
      // Fallback nếu không có dòng tiêu đề chuẩn: thử kiểm tra cột 11 (index 10)
      return { totalKhop: 0, records: [] };
    }

    let totalKhop = 0;
    const records: CcpTradeRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const kl = this.parseNumber(row[klKhopIdx]);
      if (kl === 0 && (!row[soTKIdx] || String(row[soTKIdx]).trim() === '')) continue;

      totalKhop += kl;
      records.push({
        maHD: maHDIdx !== -1 ? String(row[maHDIdx] || '').trim() : '',
        soTK: soTKIdx !== -1 ? String(row[soTKIdx] || '').trim() : '',
        soHieuLenh: soHieuLenhIdx !== -1 ? String(row[soHieuLenhIdx] || '').trim() : undefined,
        thoiGianKhop: thoiGianKhopIdx !== -1 ? String(row[thoiGianKhopIdx] || '').trim() : undefined,
        loaiLenh: loaiLenhIdx !== -1 ? String(row[loaiLenhIdx] || '').trim() : undefined,
        giaKhop: giaKhopIdx !== -1 ? this.parseNumber(row[giaKhopIdx]) : 0,
        klKhop: kl,
      });
    }

    return { totalKhop, records };
  }

  /**
   * Bóc tách file TTM của CoreCCP (Trạng thái mở / Open Positions)
   * Sheet mục tiêu: 'Export' hoặc sheet đầu tiên.
   * Cột mục tiêu: 'Khối lượng mua' + 'Khối lượng bán'
   */
  public static parseTTM(buffer: Buffer): {
    totalTTM: number;
    totalMua: number;
    totalBan: number;
    records: CcpOpenPositionRecord[];
  } {
    if (!buffer || buffer.length === 0) return { totalTTM: 0, totalMua: 0, totalBan: 0, records: [] };
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'export') || workbook.SheetNames[0];
    if (!sheetName) return { totalTTM: 0, totalMua: 0, totalBan: 0, records: [] };

    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return { totalTTM: 0, totalMua: 0, totalBan: 0, records: [] };

    const header = rows[0].map((h) => String(h || '').trim());
    const klMuaIdx = this.findHeaderIndex(header, 'Khối lượng mua', ['KL Mua', 'Buy Volume', 'Long Vol', 'Long']);
    const klBanIdx = this.findHeaderIndex(header, 'Khối lượng bán', ['KL Bán', 'Sell Volume', 'Short Vol', 'Short']);
    const maHDIdx = this.findHeaderIndex(header, 'Mã hợp đồng', ['Ma hop dong', 'Hợp đồng', 'Contract']);
    const soTKIdx = this.findHeaderIndex(header, 'Số tài khoản', ['So tai khoan', 'Tài khoản', 'Account']);

    if (klMuaIdx === -1 && klBanIdx === -1) {
      return { totalTTM: 0, totalMua: 0, totalBan: 0, records: [] };
    }

    let totalMua = 0;
    let totalBan = 0;
    const records: CcpOpenPositionRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const mua = klMuaIdx !== -1 ? this.parseNumber(row[klMuaIdx]) : 0;
      const ban = klBanIdx !== -1 ? this.parseNumber(row[klBanIdx]) : 0;
      const vol = mua + ban;

      if (vol === 0 && (!row[soTKIdx] || String(row[soTKIdx]).trim() === '')) continue;

      totalMua += mua;
      totalBan += ban;
      records.push({
        maHD: maHDIdx !== -1 ? String(row[maHDIdx] || '').trim() : '',
        soTK: soTKIdx !== -1 ? String(row[soTKIdx] || '').trim() : '',
        klMua: mua,
        klBan: ban,
        totalVolume: vol,
      });
    }

    return {
      totalTTM: totalMua + totalBan,
      totalMua,
      totalBan,
      records,
    };
  }

  /**
   * Bóc tách file TTTT của CoreCCP (Trạng thái tất toán / Settled Positions)
   * Sheet mục tiêu: 'Export' hoặc sheet đầu tiên.
   * Cột mục tiêu: 'Khối lượng bán' (chuẩn chân ghép cặp tất toán để không bị double-count)
   */
  public static parseTTTT(buffer: Buffer): {
    totalTTTT: number;
    records: CcpSettledPositionRecord[];
  } {
    if (!buffer || buffer.length === 0) return { totalTTTT: 0, records: [] };
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'export') || workbook.SheetNames[0];
    if (!sheetName) return { totalTTTT: 0, records: [] };

    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return { totalTTTT: 0, records: [] };

    const header = rows[0].map((h) => String(h || '').trim());
    const klBanIdx = this.findHeaderIndex(header, 'Khối lượng bán', ['KL Bán', 'Sell Volume', 'Settled Vol']);
    const klMuaIdx = this.findHeaderIndex(header, 'Khối lượng mua', ['KL Mua', 'Buy Volume']);
    const maHDIdx = this.findHeaderIndex(header, 'Mã hợp đồng', ['Ma hop dong', 'Hợp đồng', 'Contract']);
    const soTKIdx = this.findHeaderIndex(header, 'Số tài khoản', ['So tai khoan', 'Tài khoản', 'Account']);

    // Cột ưu tiên là Khối lượng bán, nếu không có thì lấy Khối lượng mua
    const targetColIdx = klBanIdx !== -1 ? klBanIdx : klMuaIdx;
    if (targetColIdx === -1) {
      return { totalTTTT: 0, records: [] };
    }

    let totalTTTT = 0;
    const records: CcpSettledPositionRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const vol = this.parseNumber(row[targetColIdx]);
      const mua = klMuaIdx !== -1 ? this.parseNumber(row[klMuaIdx]) : vol;
      const ban = klBanIdx !== -1 ? this.parseNumber(row[klBanIdx]) : vol;

      if (vol === 0 && (!row[soTKIdx] || String(row[soTKIdx]).trim() === '')) continue;

      totalTTTT += vol;
      records.push({
        maHD: maHDIdx !== -1 ? String(row[maHDIdx] || '').trim() : '',
        soTK: soTKIdx !== -1 ? String(row[soTKIdx] || '').trim() : '',
        klMua: mua,
        klBan: ban,
        totalVolume: vol,
      });
    }

    return { totalTTTT, records };
  }
}

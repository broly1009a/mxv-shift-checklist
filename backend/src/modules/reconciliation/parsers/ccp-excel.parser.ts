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
   * Kiểm tra xem giá trị ô ngày/giờ có khớp với expectedDate (Date hoặc string YYYY-MM-DD / DD/MM/YYYY) hay không.
   */
  public static isMatchingDate(val: any, expectedDate?: string | Date): boolean {
    if (!expectedDate || val === undefined || val === null) return true;
    const d = expectedDate instanceof Date ? expectedDate : new Date(expectedDate);
    if (isNaN(d.getTime())) return true;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    if (typeof val === 'number') {
      // Excel serial date format (ví dụ 45550)
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) {
        return (
          jsDate.getDate() === d.getDate() &&
          jsDate.getMonth() === d.getMonth() &&
          jsDate.getFullYear() === d.getFullYear()
        );
      }
    }

    const str = String(val).trim();
    if (!str) return true;

    const p1 = `${day}/${month}/${year}`;
    const p2 = `${day}-${month}-${year}`;
    const p3 = `${day}.${month}.${year}`;
    const p4 = `${year}-${month}-${day}`;
    const p5 = `${year}/${month}/${day}`;

    return str.includes(p1) || str.includes(p2) || str.includes(p3) || str.includes(p4) || str.includes(p5);
  }

  /**
   * Chuyển đổi chuỗi ngày giờ từ Excel sang Date đối tượng chính xác
   */
  public static parseDateTime(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(jsDate.getTime()) ? null : jsDate;
    }
    const str = String(val).trim();
    const parts = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) {
      const d = parseInt(parts[1], 10);
      const m = parseInt(parts[2], 10) - 1;
      const y = parseInt(parts[3], 10);
      const hh = parts[4] ? parseInt(parts[4], 10) : 0;
      const mm = parts[5] ? parseInt(parts[5], 10) : 0;
      const ss = parts[6] ? parseInt(parts[6], 10) : 0;
      const res = new Date(y, m, d, hh, mm, ss);
      return isNaN(res.getTime()) ? null : res;
    }
    const isoParts = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (isoParts) {
      const y = parseInt(isoParts[1], 10);
      const m = parseInt(isoParts[2], 10) - 1;
      const d = parseInt(isoParts[3], 10);
      const hh = isoParts[4] ? parseInt(isoParts[4], 10) : 0;
      const mm = isoParts[5] ? parseInt(isoParts[5], 10) : 0;
      const ss = isoParts[6] ? parseInt(isoParts[6], 10) : 0;
      const res = new Date(y, m, d, hh, mm, ss);
      return isNaN(res.getTime()) ? null : res;
    }
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  /**
   * Bóc tách file DSGD của CoreCCP (Lịch sử giao dịch / Khớp lệnh)
   * Sheet mục tiêu: 'Export' hoặc sheet đầu tiên.
   * Cột mục tiêu: 'KL khớp'
   * @param expectedDate (Tùy chọn) Ngày giao dịch mục tiêu để bảo vệ loại bỏ file/dòng của ngày cũ (Date Guard)
   * @param sessionStart (Tùy chọn) Thời điểm bắt đầu phiên (05:00:00 ngày T)
   * @param checkTime (Tùy chọn) Thời điểm kết thúc phiên hoặc thời điểm hiện tại
   */
  public static parseDSGD(
    buffer: Buffer,
    expectedDate?: string | Date,
    sessionStart?: Date,
    checkTime?: Date,
  ): { totalKhop: number; records: CcpTradeRecord[] } {
    if (!buffer || buffer.length === 0) return { totalKhop: 0, records: [] };
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'export') || workbook.SheetNames[0];
    if (!sheetName) return { totalKhop: 0, records: [] };

    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return { totalKhop: 0, records: [] };

    const header = rows[0].map((h) => String(h || '').trim());
    const klKhopIdx = this.findHeaderIndex(header, 'KL khớp', ['Khối lượng khớp', 'KL khop', 'Matched Vol', 'Matched Volume']);
    const maHDIdx = this.findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Ma hop dong', 'Hợp đồng', 'Contract', 'Ma HD']);
    const soTKIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Số tài khoản', 'So tai khoan', 'Tài khoản', 'Account', 'Account No', 'Ma TKGD']);
    const giaKhopIdx = this.findHeaderIndex(header, 'Giá khớp trung bình', ['Giá khớp', 'Gia khop', 'Price', 'Matched Price', 'Gia khop trung binh']);
    const soHieuLenhIdx = this.findHeaderIndex(header, 'Mã lệnh', ['Số hiệu lệnh', 'So hieu lenh', 'Order No', 'Order ID', 'Ma lenh']);
    const thoiGianKhopIdx = this.findHeaderIndex(header, 'Thời gian khớp lệnh', [
      'Thời gian khớp', 'Thoi gian khop', 'Matched Time', 'Time', 'Thoi gian khop lenh',
      'Ngày khớp', 'Ngay khop', 'Thời gian',
    ]);
    const ngayPhienIdx = this.findHeaderIndex(header, 'Ngày phiên', [
      'Ngay phien', 'Session Date', 'Ngày GD', 'Ngay GD', 'Trading Date', 'Date', 'Ngày giao dịch', 'Ngay giao dich',
    ]);
    const loaiLenhIdx = this.findHeaderIndex(header, 'Loại lệnh', ['Loai lenh', 'Side', 'Type', 'Mua/Bán', 'Mua/Ban']);

    if (klKhopIdx === -1) {
      return { totalKhop: 0, records: [] };
    }

    let effSessionStart = sessionStart;
    let effCheckTime = checkTime;
    if (!effSessionStart && expectedDate) {
      const d = expectedDate instanceof Date ? new Date(expectedDate) : new Date(expectedDate);
      if (!isNaN(d.getTime())) {
        effSessionStart = new Date(d);
        effSessionStart.setHours(5, 0, 0, 0);
        effCheckTime = new Date(effSessionStart);
        effCheckTime.setDate(effCheckTime.getDate() + 1);
      }
    }

    let totalKhop = 0;
    const records: CcpTradeRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // 1. Date Guard: Nếu có cột Ngày phiên (Session Date), bắt buộc phải khớp với expectedDate
      if (expectedDate && ngayPhienIdx !== -1 && row[ngayPhienIdx]) {
        if (!this.isMatchingDate(row[ngayPhienIdx], expectedDate)) {
          continue;
        }
      }

      // 2. Session Window Guard: Lọc theo mốc giờ phiên (mặc định 05:00:00)
      if (thoiGianKhopIdx !== -1 && row[thoiGianKhopIdx]) {
        const timeVal = row[thoiGianKhopIdx];
        if (effSessionStart && effCheckTime) {
          const tradeTime = this.parseDateTime(timeVal);
          if (tradeTime) {
            if (tradeTime < effSessionStart || tradeTime > effCheckTime) {
              continue;
            }
          }
        } else if (expectedDate && ngayPhienIdx === -1) {
          if (!this.isMatchingDate(timeVal, expectedDate)) {
            continue;
          }
        }
      }

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
   * @param expectedDate (Tùy chọn) Ngày giao dịch mục tiêu để bảo vệ loại bỏ file/dòng của ngày cũ (Date Guard)
   */
  public static parseTTM(
    buffer: Buffer,
    expectedDate?: string | Date,
  ): {
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
    const maHDIdx = this.findHeaderIndex(header, 'Mã hợp đồng', ['Mã HĐ', 'Ma hop dong', 'Hợp đồng', 'Contract', 'Ma HD']);
    const soTKIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Số tài khoản', 'So tai khoan', 'Tài khoản', 'Account', 'Ma TKGD']);
    const ngayMoIdx = this.findHeaderIndex(header, 'Ngày mở', [
      'Ngay mo', 'Ngày giao dịch', 'Ngay giao dich', 'Trading Date', 'Date', 'Open Date', 'Ngày',
    ]);

    if (klMuaIdx === -1 && klBanIdx === -1) {
      return { totalTTM: 0, totalMua: 0, totalBan: 0, records: [] };
    }

    let totalMua = 0;
    let totalBan = 0;
    const records: CcpOpenPositionRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Date Guard: Bỏ qua dòng nếu có cột ngày và không khớp expectedDate
      if (expectedDate && ngayMoIdx !== -1 && row[ngayMoIdx] && !this.isMatchingDate(row[ngayMoIdx], expectedDate)) {
        continue;
      }

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
   * @param expectedDate (Tùy chọn) Ngày giao dịch mục tiêu để bảo vệ loại bỏ file/dòng của ngày cũ (Date Guard)
   */
  public static parseTTTT(
    buffer: Buffer,
    expectedDate?: string | Date,
  ): {
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
    const maHDIdx = this.findHeaderIndex(header, 'Mã hợp đồng', ['Mã HĐ', 'Ma hop dong', 'Hợp đồng', 'Contract', 'Ma HD']);
    const soTKIdx = this.findHeaderIndex(header, 'Mã TKGD', ['Số tài khoản', 'So tai khoan', 'Tài khoản', 'Account', 'Ma TKGD']);
    const ngayTatToanIdx = this.findHeaderIndex(header, 'Ngày tất toán', [
      'Ngay tat toan', 'Ngày giao dịch', 'Ngay giao dich', 'Trading Date', 'Date', 'Settled Date', 'Ngày',
    ]);

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

      // Date Guard: Bỏ qua dòng nếu có cột ngày và không khớp expectedDate
      if (expectedDate && ngayTatToanIdx !== -1 && row[ngayTatToanIdx] && !this.isMatchingDate(row[ngayTatToanIdx], expectedDate)) {
        continue;
      }

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

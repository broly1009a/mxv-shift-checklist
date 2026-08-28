import * as XLSX from 'xlsx';

export interface MsTradeRecord {
  maLenh: string;
  maTKGD: string;
  maHD: string;
  klGiaoDich: number;
  giaKhop: number;
  ngayGio: string;
  maGD: string;
  combinedKey: string;
}

export interface MsOpenPositionRecord {
  maTKGD: string;
  maHD: string;
  tongMua: number;
  tongBan: number;
  giaKhop?: number;
}

export class MsExcelParser {
  public static getNormalizedAccount(account: string): string {
    if (!account) return '';
    let acc = account.trim();
    acc = acc.replace(/F$/i, '');
    acc = acc.replace(/L$/i, '-L');
    acc = acc.replace(/S$/i, '-S');
    acc = acc.replace(/--/g, '-');
    return acc.toUpperCase();
  }

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

  /**
   * Parse M-System DSGD.xlsx
   */
  public static parseDSGD(buffer: Buffer): MsTradeRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());
    const maLenhIdx = header.indexOf('Mã lệnh');
    const maTKGDIdx = header.indexOf('Mã TKGD');
    const maHDIdx = header.indexOf('Mã HĐ');
    const klGiaoDichIdx = header.indexOf('KL giao dịch');
    const giaKhopIdx = header.indexOf('Giá khớp');
    const ngayGioIdx = header.indexOf('Ngày giờ thực hiện');
    const maGDIdx = header.indexOf('Mã giao dịch');

    if (
      maLenhIdx === -1 ||
      maTKGDIdx === -1 ||
      maHDIdx === -1 ||
      klGiaoDichIdx === -1 ||
      giaKhopIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)',
      );
    }

    const result: MsTradeRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maLenh = String(row[maLenhIdx] || '').trim();
      const maTKGD = this.getNormalizedAccount(String(row[maTKGDIdx] || ''));
      const maHD = String(row[maHDIdx] || '').trim();
      const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
      const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
      const ngayGio =
        ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';
      const maGD = maGDIdx !== -1 ? String(row[maGDIdx] || '').trim() : '';

      if (!maLenh || !maTKGD || !maHD) continue;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich,
        giaKhop,
        ngayGio,
        maGD,
        combinedKey: `${maTKGD}${maHD}${giaKhop}`,
      });
    }
    return result;
  }

  /**
   * Parse M-System TTM.xlsx
   */
  public static parseTTM(buffer: Buffer): MsOpenPositionRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());

    const maTKGDIdx = header.findIndex(
      (h) => h === 'Mã TKGD' || h === 'Mã tài khoản',
    );
    const maHDIdx = header.findIndex(
      (h) => h === 'Mã HĐ' || h === 'Mã hợp đồng',
    );

    const tongMuaIdx = header.findIndex((h) => h.toLowerCase() === 'kl mua');
    const tongBanIdx = header.findIndex((h) => h.toLowerCase() === 'kl bán');
    const giaKhopIdx = header.findIndex(
      (h) => h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình',
    );

    if (
      maTKGDIdx === -1 ||
      maHDIdx === -1 ||
      tongMuaIdx === -1 ||
      tongBanIdx === -1
    ) {
      throw new Error(
        'Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, KL Mua/Tổng mua, KL Bán/Tổng bán)',
      );
    }

    const result: MsOpenPositionRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = this.getNormalizedAccount(String(row[maTKGDIdx] || ''));
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
   * Parse M-System TTTT.xlsx (Thông tin tất toán)
   */
  public static parseTTTTForVolume(buffer: Buffer): MsOpenPositionRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const header = rows[0].map((h) => String(h || '').trim());

    const maTKGDIdx = this.findHeaderIndex(header, 'Mã TKGD', [
      'Mã tài khoản',
      'Account',
      'Mã khách hàng',
      'Mã KH',
    ]);
    const maHDIdx = this.findHeaderIndex(header, 'Mã HĐ', [
      'Mã hợp đồng',
      'Symbol',
      'Mã HH',
      'Mã hàng hóa',
    ]);
    const tongMuaIdx = this.findHeaderIndex(header, 'KL Mua', ['KL mua']);
    const tongBanIdx = this.findHeaderIndex(header, 'KL Bán', ['KL bán']);

    const finalAccIdx = maTKGDIdx !== -1 ? maTKGDIdx : 7;
    const finalSymIdx = maHDIdx !== -1 ? maHDIdx : 9;
    const finalMuaIdx = tongMuaIdx !== -1 ? tongMuaIdx : 15;
    const finalBanIdx = tongBanIdx !== -1 ? tongBanIdx : 16;

    const result: MsOpenPositionRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const maTKGD = this.getNormalizedAccount(String(row[finalAccIdx] || ''));
      const maHD = String(row[finalSymIdx] || '').trim();
      const tongMua = parseFloat(row[finalMuaIdx]) || 0;
      const tongBan = parseFloat(row[finalBanIdx]) || 0;

      if (!maTKGD || !maHD) continue;

      result.push({
        maTKGD,
        maHD,
        tongMua,
        tongBan,
      });
    }
    return result;
  }
}

/**
 * tkgd-normalizer.helper.ts
 *
 * BỘ CHUẨN HÓA & PHÂN TÍCH TÀI KHOẢN GIAO DỊCH (TKGD NORMALIZER & PARSER)
 * Thiết kế theo kiến trúc Clean Architecture & Domain-Driven Design (DDD).
 *
 * TÀI LIỆU VÀ NGUỒN DỮ LIỆU CHUẨN (SSoT):
 * 1. Bang_config_ma_TVKD_001-999.xlsx: Quy tắc mã hóa 2 ký tự đại diện TVKD (001-999).
 * 2. Rule về mã tài khoản tạo trên TT (14/10/2026): Giới hạn 12 ký tự trên ICE US.
 * 3. Lưu ý nghiệp vụ MXV:
 *    - Mã TKGD tiêu chuẩn (CoreCCP/MS/CE): 3 ký tự TVKD + 8 ký tự mã thêm (tổng 11 ký tự) + hậu tố (-F, -A, -M...) = 13 ký tự.
 *    - Trên sàn Trading Technologies (TT): Hiện tại giao dịch tiểu khoản -F, quy chuẩn định danh co gọn 12 ký tự:
 *      "A1" + [2 ký tự đại diện TVKD] + [8 ký tự mã thêm]
 *      Trong đó "A1" là ký hiệu đại diện của tiểu khoản -F trên sàn TT.
 */

export interface ParsedTkgdInfo {
  /** Chuỗi gốc ban đầu */
  rawAccount: string;
  /** Mã tiểu khoản tiêu chuẩn 13 ký tự của CoreCCP (Ví dụ: 004C0011778-F) */
  normalizedAccount: string;
  /** Mã TVKD 3 chữ số (Ví dụ: "004", "100", "360", "999") */
  tvkdCode: string;
  /** 2 ký tự đại diện TVKD trên sàn TT (Ví dụ: "04", "A0", "AA", "YP") */
  tvkdShortCode: string;
  /** 8 ký tự mã thêm tài khoản, bắt đầu bằng chữ cái (Ví dụ: "C0011778") */
  subAccountBase: string;
  /** 11 ký tự thân tài khoản: Mã TVKD (3 số) + Mã thêm (8 ký tự) (Ví dụ: "004C0011778") */
  fullAccount11: string;
  /** Hậu tố tiểu khoản (Ví dụ: "-F", "-A", "-M", "-L", "-S") */
  suffix: string;
  /** Tiền tố đại diện tiểu khoản trên TT (Ví dụ: "A1" cho -F, hoặc "P1", "S1", "X1") */
  ttPrefix?: string;
  /** Định dạng 12 ký tự co gọn tương ứng trên TT (Ví dụ: "A104C0011778") */
  ttAccount?: string;
  /** Loại cấu trúc nhận diện được */
  sourceFormat: 'TT_12CHAR' | 'FULL_13CHAR' | 'FULL_11CHAR' | 'LEGACY_MS' | 'UNKNOWN';
  /** Trạng thái hợp lệ của tài khoản */
  isValid: boolean;
}

/**
 * Mã hóa mã TVKD (001 - 999) sang 2 ký tự đại diện trên sàn TT.
 * Dựa trên Bang_config_ma_TVKD_001-999.xlsx:
 * - Dải 1 (001 - 099): 2 số cuối (01..99)
 * - Dải 2 (100 - 359): Chữ cái đại diện hàng chục (A..Z) + Chữ số hàng đơn vị (0..9) -> A0..Z9
 * - Dải 3 (360 - 999): Hệ đếm cơ số 26 gồm 2 chữ cái (AA..YP)
 */
export function encodeTvkdTo2Chars(tvkd: number | string): string {
  if (tvkd === undefined || tvkd === null || tvkd === '') return '';
  const num = typeof tvkd === 'string' ? parseInt(tvkd.trim(), 10) : tvkd;
  if (isNaN(num) || num < 1 || num > 999) {
    throw new Error(`Mã TVKD không hợp lệ (phải từ 001 đến 999): ${tvkd}`);
  }

  // Dải 1: 001 - 099 -> 2 số cuối
  if (num < 100) {
    return String(num).padStart(2, '0');
  }

  // Dải 2: 100 - 359 -> A0..Z9
  if (num < 360) {
    const tensChar = String.fromCharCode(55 + Math.floor(num / 10)); // 10 -> 'A' (65), ..., 35 -> 'Z' (90)
    const unitDigit = String(num % 10);
    return `${tensChar}${unitDigit}`;
  }

  // Dải 3: 360 - 999 -> AA..YP
  const diff = num - 360; // 0..639
  const firstLetter = String.fromCharCode(65 + Math.floor(diff / 26)); // 0..24 ('A'..'Y')
  const secondLetter = String.fromCharCode(65 + (diff % 26));          // 0..25 ('A'..'Z')
  return `${firstLetter}${secondLetter}`;
}

/**
 * Giải mã 2 ký tự đại diện TVKD trên sàn TT ngược về mã TVKD 3 chữ số (001 - 999).
 * Khớp chính xác 100% với Bang_config_ma_TVKD_001-999.xlsx.
 */
export function decodeTvkdFrom2Chars(shortCode: string): string {
  if (!shortCode) return '';
  const sc = shortCode.trim().toUpperCase();
  if (sc.length !== 2) return '';

  // Trường hợp 1: 2 chữ số (01..99) -> 001..099
  if (/^\d{2}$/.test(sc)) {
    return '0' + sc;
  }

  const c1 = sc.charCodeAt(0);
  const c2 = sc.charCodeAt(1);

  // Trường hợp 2: Chữ cái + Chữ số (A0..Z9) -> 100..359
  if (c1 >= 65 && c1 <= 90 && c2 >= 48 && c2 <= 57) {
    const tens = c1 - 55; // 'A' (65) -> 10, ..., 'Z' (90) -> 35
    const unit = c2 - 48; // '0'..'9' -> 0..9
    const val = tens * 10 + unit;
    if (val >= 100 && val <= 359) {
      return String(val).padStart(3, '0');
    }
  }

  // Trường hợp 3: 2 chữ cái (AA..YP) -> 360..999
  if (c1 >= 65 && c1 <= 90 && c2 >= 65 && c2 <= 90) {
    const v1 = c1 - 65;
    const v2 = c2 - 65;
    const diff = v1 * 26 + v2;
    const val = 360 + diff;
    if (val >= 360 && val <= 999) {
      return String(val).padStart(3, '0');
    }
  }

  return '';
}

/**
 * Alias tương thích ngược với code cũ trong symbol-normalizer.helper
 */
export const decodeTvkd2Chars = decodeTvkdFrom2Chars;

/**
 * Bóc tách chuyên sâu và chuẩn hóa thông tin Tài khoản Giao dịch (TKGD).
 * Hỗ trợ mọi loại định dạng trong hệ thống MXV & Sàn TT:
 * 1. Định dạng 12 ký tự ICE US trên sàn TT:
 *    - Ví dụ: "A104C0011778" -> 004C0011778-F (A1 là tiền tố tiểu khoản -F, 04 là TVKD 004, C0011778 là mã thêm)
 *    - Ví dụ: "A1A0C1234567" -> 100C1234567-F
 *    - Ví dụ: "A1AAC1234567" -> 360C1234567-F
 *    - Ví dụ: "A1YPC1234567" -> 999C1234567-F
 *    - Đồng thời hỗ trợ các tiền tố route FCM khác: P1..P5, S1, X1..X3...
 * 2. Định dạng đầy đủ 13 ký tự có route hoặc không:
 *    - Ví dụ: "MXV 1-004C0011778-F" -> 004C0011778-F
 *    - Ví dụ: "IT-601C9999990-F" -> 601C9999990-F
 * 3. Định dạng 11 ký tự thiếu hậu tố:
 *    - Ví dụ: "004C0011778" -> gán hậu tố mặc định (-F) -> 004C0011778-F
 * 4. Định dạng M-System cũ:
 *    - Ví dụ: "001C123456F" -> 001C123456-F, "001C123456L" -> 001C123456-L
 */
export function parseTkgd(rawAccount: string, defaultSuffix = '-F'): ParsedTkgdInfo {
  if (!rawAccount) {
    return {
      rawAccount: '',
      normalizedAccount: '',
      tvkdCode: '',
      tvkdShortCode: '',
      subAccountBase: '',
      fullAccount11: '',
      suffix: '',
      sourceFormat: 'UNKNOWN',
      isValid: false,
    };
  }

  const raw = rawAccount.trim();
  const upper = raw.toUpperCase();

  // 1. Kiểm tra định dạng tiêu chuẩn 13 ký tự (hoặc có prefix route như MXV 1-..., IT-...)
  // Cùng bắt cả các hậu tố: -F, -A, -M, -L, -S...
  const matchFull13 = upper.match(/([0-9]{3})([A-Z][0-9]{7})(-[A-Z0-9]+)/i);
  if (matchFull13) {
    const tvkdCode = matchFull13[1];
    const subAccountBase = matchFull13[2];
    const suffix = matchFull13[3];
    const fullAccount11 = `${tvkdCode}${subAccountBase}`;
    const normalizedAccount = `${fullAccount11}${suffix}`;
    let tvkdShortCode = '';
    try {
      tvkdShortCode = encodeTvkdTo2Chars(tvkdCode);
    } catch {
      // Bỏ qua nếu mã tvkd vượt ngoài 001-999
    }
    const ttPrefix = suffix === '-F' ? 'A1' : undefined;
    const ttAccount = ttPrefix && tvkdShortCode ? `${ttPrefix}${tvkdShortCode}${subAccountBase}` : undefined;

    return {
      rawAccount: raw,
      normalizedAccount,
      tvkdCode,
      tvkdShortCode,
      subAccountBase,
      fullAccount11,
      suffix,
      ttPrefix,
      ttAccount,
      sourceFormat: 'FULL_13CHAR',
      isValid: true,
    };
  }

  // 2. Kiểm tra định dạng 12 ký tự ICE US / TT:
  // [2 ký tự tiền tố TT (A1, P1-P5, S1, X1-X3)] + [2 ký tự đại diện TVKD] + [8 ký tự mã thêm Cxxxxxxx]
  const matchTt12 = upper.match(/^([A-Z0-9]{2})([A-Z0-9]{2})([A-Z][0-9]{7})$/i);
  if (matchTt12) {
    const ttPrefix = matchTt12[1];
    const tvkdShortCode = matchTt12[2];
    const subAccountBase = matchTt12[3];
    const tvkdCode = decodeTvkdFrom2Chars(tvkdShortCode);

    if (tvkdCode) {
      // Tiền tố A1 (hoặc các tiền tố hiện tại trên TT) đại diện cho tiểu khoản -F
      const suffix = defaultSuffix.startsWith('-') ? defaultSuffix : `-${defaultSuffix}`;
      const fullAccount11 = `${tvkdCode}${subAccountBase}`;
      const normalizedAccount = `${fullAccount11}${suffix}`;
      const ttAccount = upper;

      return {
        rawAccount: raw,
        normalizedAccount,
        tvkdCode,
        tvkdShortCode,
        subAccountBase,
        fullAccount11,
        suffix,
        ttPrefix,
        ttAccount,
        sourceFormat: 'TT_12CHAR',
        isValid: true,
      };
    }
  }

  // 3. Kiểm tra định dạng 11 ký tự thân tài khoản (3 chữ số TVKD + 8 ký tự mã thêm, thiếu hậu tố)
  const match11 = upper.match(/([0-9]{3})([A-Z][0-9]{7})/i);
  if (match11) {
    const tvkdCode = match11[1];
    const subAccountBase = match11[2];
    const suffix = defaultSuffix.startsWith('-') ? defaultSuffix : `-${defaultSuffix}`;
    const fullAccount11 = `${tvkdCode}${subAccountBase}`;
    const normalizedAccount = `${fullAccount11}${suffix}`;
    let tvkdShortCode = '';
    try {
      tvkdShortCode = encodeTvkdTo2Chars(tvkdCode);
    } catch {
      // Ignored
    }
    const ttPrefix = suffix === '-F' ? 'A1' : undefined;
    const ttAccount = ttPrefix && tvkdShortCode ? `${ttPrefix}${tvkdShortCode}${subAccountBase}` : undefined;

    return {
      rawAccount: raw,
      normalizedAccount,
      tvkdCode,
      tvkdShortCode,
      subAccountBase,
      fullAccount11,
      suffix,
      ttPrefix,
      ttAccount,
      sourceFormat: 'FULL_11CHAR',
      isValid: true,
    };
  }

  // 4. Kiểm tra định dạng M-System cũ (ví dụ: 001C123456F -> 001C123456-F, 001C123456L -> 001C123456-L)
  const legacyNormalized = getNormalizedAccount(upper);
  if (legacyNormalized && legacyNormalized !== upper) {
    return {
      rawAccount: raw,
      normalizedAccount: legacyNormalized,
      tvkdCode: legacyNormalized.substring(0, 3),
      tvkdShortCode: '',
      subAccountBase: '',
      fullAccount11: '',
      suffix: legacyNormalized.includes('-') ? '-' + legacyNormalized.split('-')[1] : '',
      sourceFormat: 'LEGACY_MS',
      isValid: true,
    };
  }

  // Fallback mặc định
  return {
    rawAccount: raw,
    normalizedAccount: upper,
    tvkdCode: '',
    tvkdShortCode: '',
    subAccountBase: '',
    fullAccount11: '',
    suffix: '',
    sourceFormat: 'UNKNOWN',
    isValid: false,
  };
}

/**
 * Chuẩn hóa số tài khoản từ TT sang định dạng tiêu chuẩn 13 ký tự của CoreCCP (ví dụ: 004C0011778-F).
 * Sử dụng trực tiếp bộ parseTkgd toàn năng.
 */
export function normalizeTtToCcpAccount(rawAccount: string, defaultSuffix = '-F'): string {
  if (!rawAccount) return '';
  return parseTkgd(rawAccount, defaultSuffix).normalizedAccount;
}

/**
 * Chuyển đổi mã tiểu khoản CoreCCP sang định dạng 12 ký tự co gọn trên sàn TT (ICE US).
 * @param account Mã tài khoản (13 ký tự ví dụ 004C0011778-F hoặc 11 ký tự 004C0011778)
 * @param prefix Tiền tố tiểu khoản trên TT. Mặc định là "A1" (đại diện tiểu khoản -F theo quy định)
 */
export function encodeCcpToTtAccount(account: string, prefix = 'A1'): string {
  if (!account) return '';
  const parsed = parseTkgd(account);
  if (!parsed.isValid || !parsed.tvkdCode || !parsed.subAccountBase) {
    throw new Error(`Không thể mã hóa sang TT Account: Mã tài khoản không hợp lệ (${account})`);
  }

  const shortTvkd = parsed.tvkdShortCode || encodeTvkdTo2Chars(parsed.tvkdCode);
  return `${prefix.toUpperCase()}${shortTvkd}${parsed.subAccountBase}`;
}

/**
 * Chuẩn hóa số tài khoản giao dịch theo M-System cũ (Account Normalizer)
 * Ví dụ: 001C123456F -> 001C123456, 001C123456L -> 001C123456-L, 001C123456S -> 001C123456-S
 */
export function getNormalizedAccount(account: string): string {
  if (!account) return '';
  let acc = account.trim();
  acc = acc.replace(/F$/i, '');
  acc = acc.replace(/L$/i, '-L');
  acc = acc.replace(/S$/i, '-S');
  acc = acc.replace(/--/g, '-');
  return acc.toUpperCase();
}

/**
 * Kiểm tra một mã tài khoản có phải định dạng 12 ký tự trên sàn TT hay không
 */
export function isTt12CharFormat(account: string): boolean {
  if (!account) return false;
  return /^[A-Z0-9]{2}[A-Z0-9]{2}[A-Z][0-9]{7}$/i.test(account.trim());
}

/**
 * Kiểm tra một mã tài khoản có phải định dạng chuẩn 13 ký tự của CoreCCP/MXV hay không
 */
export function isValidCcpAccountFormat(account: string): boolean {
  if (!account) return false;
  return /^[0-9]{3}[A-Z][0-9]{7}-[A-Z0-9]+$/i.test(account.trim());
}

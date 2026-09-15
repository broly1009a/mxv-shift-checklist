/**
 * cccd-validator.helper.ts
 * BỘ KIỂM ĐỊNH TÍNH HỢP LỆ & PHÁT HIỆN CCCD GIẢ MẠO (BỘ CÔNG AN STANDARD)
 *
 * Căn cứ pháp lý:
 * 1. Luật Căn cước số 26/2023/QH15.
 * 2. Nghị định số 137/2015/NĐ-CP (Điều 13: Cấu trúc số định danh cá nhân).
 * 3. Thông tư số 59/2021/TT-BCA (Phụ lục I, II, III: Mã tỉnh thành, mã giới tính - thế kỷ).
 * 4. Chuẩn ICAO Doc 9303 Part 5 (Dải mã đọc bằng máy MRZ 3 dòng).
 */

// Bảng tra cứu chuẩn 63 tỉnh/thành phố trực thuộc TW theo Thông tư 59/2021/TT-BCA
export const VIETNAM_PROVINCE_CODES: Record<string, string> = {
  '001': 'Hà Nội',           '002': 'Hà Giang',        '004': 'Cao Bằng',       '006': 'Bắc Kạn',
  '008': 'Tuyên Quang',     '010': 'Lào Cai',         '011': 'Điện Biên',      '012': 'Lai Châu',
  '014': 'Sơn La',          '015': 'Yên Bái',         '017': 'Hòa Bình',       '019': 'Thái Nguyên',
  '020': 'Lạng Sơn',        '022': 'Quảng Ninh',      '024': 'Bắc Giang',      '025': 'Phú Thọ',
  '026': 'Vĩnh Phúc',       '027': 'Bắc Ninh',        '030': 'Hải Dương',      '031': 'Hải Phòng',
  '033': 'Hưng Yên',        '034': 'Thái Bình',       '035': 'Hà Nam',         '036': 'Nam Định',
  '037': 'Ninh Bình',       '038': 'Thanh Hóa',       '040': 'Nghệ An',        '042': 'Hà Tĩnh',
  '044': 'Quảng Bình',      '045': 'Quảng Trị',       '046': 'Thừa Thiên Huế', '048': 'Đà Nẵng',
  '049': 'Quảng Nam',       '051': 'Quảng Ngãi',      '052': 'Bình Định',      '054': 'Phú Yên',
  '056': 'Khánh Hòa',       '058': 'Ninh Thuận',      '060': 'Bình Thuận',     '062': 'Kon Tum',
  '064': 'Gia Lai',         '066': 'Đắk Lắk',         '067': 'Đắk Nông',       '068': 'Lâm Đồng',
  '070': 'Bình Phước',      '072': 'Tây Ninh',        '074': 'Bình Dương',     '075': 'Đồng Nai',
  '077': 'Bà Rịa - Vũng Tàu','079': 'TP. Hồ Chí Minh', '080': 'Long An',        '082': 'Tiền Giang',
  '083': 'Bến Tre',         '084': 'Trà Vinh',        '086': 'Vĩnh Long',      '087': 'Đồng Tháp',
  '089': 'An Giang',        '091': 'Kiên Giang',      '092': 'Cần Thơ',        '093': 'Hậu Giang',
  '094': 'Sóc Trăng',       '095': 'Bạc Liêu',        '096': 'Cà Mau',
};

export interface CCCDValidationResult {
  isValid: boolean;
  severity: 'CLEAR' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  criticalErrors: string[];
  warnings: string[];
  provinceName?: string;
}

export class CCCDValidator {
  /**
   * RULE 03: Kiểm tra cấu trúc 12 số định danh cá nhân
   * Cấu trúc: [3 số mã tỉnh] + [1 số giới tính/thế kỷ] + [2 số năm sinh] + [6 số ngẫu nhiên]
   */
  public static validateCCCDNumber(
    idNumber: string,
    gender?: string, // 'Nam' | 'Nữ'
    birthYear?: number,
  ): CCCDValidationResult {
    const flags: string[] = [];
    const criticalErrors: string[] = [];
    const warnings: string[] = [];
    const cleanId = (idNumber || '').replace(/\D/g, '').trim();

    // 1. Kiểm tra định dạng 12 chữ số
    if (!cleanId) {
      return {
        isValid: false,
        severity: 'MEDIUM',
        flags: ['EMPTY_CCCD_NUMBER'],
        criticalErrors: [],
        warnings: ['Số CCCD trống'],
      };
    }

    if (cleanId.length !== 12) {
      // Nếu là CMND 9 số cũ hợp lệ
      if (cleanId.length === 9) {
        return {
          isValid: true,
          severity: 'CLEAR',
          flags: ['LEGACY_9_DIGIT_CMND'],
          criticalErrors: [],
          warnings: [],
        };
      }
      return {
        isValid: false,
        severity: 'CRITICAL',
        flags: ['INVALID_FORMAT_NOT_12_DIGITS'],
        criticalErrors: [`Số định danh không đúng 12 chữ số (${cleanId.length} số: ${cleanId})`],
        warnings: [],
      };
    }

    // 2. Tra cứu mã tỉnh khai sinh (3 số đầu)
    const provinceCode = cleanId.substring(0, 3);
    const provinceName = VIETNAM_PROVINCE_CODES[provinceCode];
    if (!provinceName) {
      flags.push(`INVALID_PROVINCE_CODE_${provinceCode}`);
      criticalErrors.push(`Mã tỉnh không tồn tại trên hệ thống Bộ Công An (Mã: ${provinceCode})`);
    }

    // 3. Kiểm tra Mã giới tính & Thế kỷ (ký tự thứ 4)
    const genderCenturyDigit = parseInt(cleanId.charAt(3), 10);
    const idBirthYearShort = parseInt(cleanId.substring(4, 6), 10);

    // Bảng kiểm tra giới tính: chẵn = Nam, lẻ = Nữ
    if (gender) {
      const isMaleInput = gender.toLowerCase().includes('nam');
      const isMaleCode = genderCenturyDigit % 2 === 0;
      if (isMaleInput !== isMaleCode) {
        flags.push('GENDER_MISMATCH_WITH_ID_CODE');
        criticalErrors.push(
          `Giới tính khai báo (${isMaleInput ? 'Nam' : 'Nữ'}) không khớp với mã định danh (Mã: ${genderCenturyDigit} -> ${isMaleCode ? 'Nam' : 'Nữ'})`,
        );
      }
    }

    // Kiểm tra thế kỷ sinh
    if (birthYear && birthYear > 1800 && birthYear < 2200) {
      let expectedCenturyDigit = -1;
      const isMale = !gender || gender.toLowerCase().includes('nam');

      if (birthYear >= 1900 && birthYear <= 1999) {
        expectedCenturyDigit = isMale ? 0 : 1;
      } else if (birthYear >= 2000 && birthYear <= 2099) {
        expectedCenturyDigit = isMale ? 2 : 3;
      }

      if (expectedCenturyDigit !== -1 && genderCenturyDigit !== expectedCenturyDigit) {
        // Cho phép dung sai nếu không rõ giới tính (chỉ check thế kỷ)
        const isCenturyMatch = Math.floor(genderCenturyDigit / 2) === Math.floor(expectedCenturyDigit / 2);
        if (!isCenturyMatch) {
          flags.push('CENTURY_MISMATCH_WITH_ID_CODE');
          criticalErrors.push(`Năm sinh (${birthYear}) không khớp với thế kỷ mã hóa trên số CCCD`);
        }
      }

      // Khớp 2 số cuối năm sinh
      if (birthYear % 100 !== idBirthYearShort) {
        flags.push('BIRTH_YEAR_MISMATCH_WITH_ID_CODE');
        criticalErrors.push(`Năm sinh (${birthYear}) không khớp 2 số năm sinh trên thẻ (${idBirthYearShort})`);
      }
    }

    const isCritical = criticalErrors.length > 0;

    return {
      isValid: flags.length === 0,
      severity: isCritical ? 'CRITICAL' : 'CLEAR',
      flags,
      criticalErrors,
      warnings,
      provinceName,
    };
  }

  /**
   * RULE 01: Kiểm tra tính hợp lệ của dải MRZ mặt sau
   */
  public static validateMRZ(backsideOcrText?: string): {
    hasMRZ: boolean;
    isCriticalFake: boolean;
    reason?: string;
  } {
    if (!backsideOcrText || !backsideOcrText.trim()) {
      return { hasMRZ: false, isCriticalFake: false, reason: 'Chưa có dữ liệu OCR mặt sau' };
    }

    const clean = backsideOcrText.toUpperCase().replace(/\s+/g, ' ');

    // 1. Kiểm tra tiền tố IDVNM bắt buộc theo chuẩn C06 / ICAO 9303
    const hasIDVNM = /IDVNM/i.test(clean);

    // 2. Tìm các dòng có định dạng MRZ (chứa chữ, số và ký tự <<)
    const hasMRZChevrons = clean.includes('<<') || clean.includes('&lt;&lt;');

    // 3. Nếu là ảnh mặt sau CCCD gắn chip (có text "Nơi cư trú" hoặc "CỤC TRƯỞNG" hoặc "Date of issue")
    // nhưng vùng đáy hoàn toàn không có IDVNM hoặc chevrons -> Nghi vấn phôi Photoshop
    const isBacksideCccd =
      clean.includes('NOI CU TRU') ||
      clean.includes('NƠI CƯ TRÚ') ||
      clean.includes('PLACE OF RESIDENCE') ||
      clean.includes('DATE OF ISSUE') ||
      clean.includes('NGAY THANG NAM CAP') ||
      clean.includes('CUC TRUONG') ||
      clean.includes('BO CONG AN');

    if (isBacksideCccd && !hasIDVNM && !hasMRZChevrons) {
      return {
        hasMRZ: false,
        isCriticalFake: true,
        reason: 'Ảnh mặt sau có tiêu đề CCCD nhưng vùng đáy trống trắng hoàn toàn dải mã máy ICAO (nghi vấn phôi Photoshop đồ họa)',
      };
    }

    return { hasMRZ: hasIDVNM || hasMRZChevrons, isCriticalFake: false };
  }

  /**
   * RULE 02: Kiểm tra ngày cấp hợp lý (chặn ngày tương lai)
   */
  public static validateIssueDate(issueDate?: Date | string): {
    isValid: boolean;
    severity?: 'CRITICAL' | 'HIGH';
    reason?: string;
  } {
    if (!issueDate) return { isValid: true };

    const dateObj = issueDate instanceof Date ? issueDate : new Date(issueDate);
    if (isNaN(dateObj.getTime())) return { isValid: true };

    const now = new Date();
    // 1. Chặn ngày cấp ở tương lai (cho phép dung sai 1 ngày do lệch múi giờ UTC/GMT+7)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (dateObj > tomorrow) {
      const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
      return {
        isValid: false,
        severity: 'CRITICAL',
        reason: `Ngày cấp ở tương lai (${dateStr}) - Phôi giả hoặc lỗi nhập liệu nghiêm trọng`,
      };
    }

    // 2. Thẻ CCCD gắn chip bắt đầu từ năm 2021 (mã vạch từ 2016)
    if (dateObj.getFullYear() < 2000) {
      return {
        isValid: false,
        severity: 'HIGH',
        reason: `Năm cấp (${dateObj.getFullYear()}) trước thời kỳ CCCD/CMND 12 số`,
      };
    }

    return { isValid: true };
  }
}

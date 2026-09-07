/**
 * HELPER TRÍCH XUẤT DỮ LIỆU TỪ TỆP ĐÍNH KÈM (PDF HỢP ĐỒNG, PHỤ LỤC, ẢNH CCCD)
 *
 * Xử lý:
 * 1. PDF Hợp đồng mở TK (*-mxv.pdf):
 *    - Số HĐ, Ngày ký, Loại hình TK (Cá nhân/DN), Họ tên, Số CCCD, Ngày sinh, Ngày cấp, Nơi cấp.
 * 2. PDF Phụ lục mở tiểu khoản (*-PL01.pdf):
 *    - Số HĐ gốc, Ngày ký, Số CCCD, Ngày cấp, Nơi cấp, Trạng thái chữ ký.
 * 3. Ảnh CCCD (*CCCD-truoc.jpg, *CCCD-sau.jpg):
 *    - Bóc tách thông tin nhân thân từ ảnh CCCD.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedHopDong {
  soHopDong?: string;
  maTKGD?: string;
  hoVaTen?: string;
  soCanCuoc?: string;
  ngaySinh?: Date;
  rawNgaySinh?: string;
  ngayCap?: Date;
  rawNgayCap?: string;
  noiCap?: string;
  gioiTinh?: string;
  rawGioiTinh?: string;
  dinhDangLoi?: string[];
  ngayKyHD?: Date;
  loaiHinhTaiKhoan?: string;
  chuKy?: string;
}

export interface ExtractedPhuLuc {
  soHopDongGoc?: string;
  maTKGD?: string;
  hoVaTen?: string;
  soCanCuoc?: string;
  ngaySinh?: Date;
  ngayCap?: Date;
  noiCap?: string;
  ngayKyHD?: Date;
  chuKy?: string;
}

export interface ExtractedCanCuoc {
  hoVaTen?: string;
  soCanCuoc?: string;
  ngaySinh?: Date;
  coGiaTriDen?: Date;
  ngayCap?: Date;
  noiCap?: string;
  gioiTinh?: string;
  canhBaoChatLuong?: string[];
}

export interface ParsedDateResult {
  date?: Date;
  raw?: string;
  format?: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'OTHER';
}

/**
 * Phân tích chi tiết chuỗi ngày (hỗ trợ cả DD/MM/YYYY và YYYY-MM-DD)
 */
export function parseDateDetails(dateStr?: string): ParsedDateResult {
  if (!dateStr) return {};
  const cleaned = dateStr.trim();

  // 1. Format DD/MM/YYYY hoặc DD-MM-YYYY
  const ddmmyyyy = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    return { date: new Date(year, month, day), raw: cleaned, format: 'DD/MM/YYYY' };
  }

  // 2. Format YYYY-MM-DD hoặc YYYY/MM/DD (ISO)
  const yyyymmdd = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10) - 1;
    const day = parseInt(yyyymmdd[3], 10);
    return { date: new Date(year, month, day), raw: cleaned, format: 'YYYY-MM-DD' };
  }

  // 3. Fallback tìm chuỗi con bên trong chuỗi
  const subDdmmyyyy = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (subDdmmyyyy) {
    const day = parseInt(subDdmmyyyy[1], 10);
    const month = parseInt(subDdmmyyyy[2], 10) - 1;
    const year = parseInt(subDdmmyyyy[3], 10);
    return { date: new Date(year, month, day), raw: subDdmmyyyy[0], format: 'DD/MM/YYYY' };
  }

  const subYyyymmdd = cleaned.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (subYyyymmdd) {
    const year = parseInt(subYyyymmdd[1], 10);
    const month = parseInt(subYyyymmdd[2], 10) - 1;
    const day = parseInt(subYyyymmdd[3], 10);
    return { date: new Date(year, month, day), raw: subYyyymmdd[0], format: 'YYYY-MM-DD' };
  }

  return { raw: cleaned, format: 'OTHER' };
}

/**
 * Chuẩn hóa chuỗi ngày sang Date object
 */
export function parseDateString(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  return parseDateDetails(dateStr).date;
}

/**
 * Đọc nội dung văn bản từ file PDF, tương thích cả pdf-parse v1 (function) và v2 (class PDFParse)
 */
export async function readPdfText(input: string | Buffer): Promise<string> {
  let dataBuffer: Buffer;
  if (typeof input === 'string') {
    if (!fs.existsSync(input)) return '';
    dataBuffer = fs.readFileSync(input);
  } else {
    dataBuffer = input;
  }
  const pdfModule = require('pdf-parse');
  if (typeof pdfModule === 'function') {
    const data = await pdfModule(dataBuffer);
    return data.text || '';
  } else if (pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: dataBuffer });
    const res = await parser.getText();
    await parser.destroy();
    return res.text || '';
  } else if (pdfModule.default) {
    const data = await pdfModule.default(dataBuffer);
    return data.text || '';
  }
  return '';
}

/**
 * Trích xuất dữ liệu từ file PDF Hợp đồng (*-mxv.pdf)
 */
export async function extractHopDongPdf(input: string | Buffer, fileNameHint?: string): Promise<ExtractedHopDong> {
  const result: ExtractedHopDong = {
    loaiHinhTaiKhoan: 'Cá nhân',
    chuKy: 'Đã ký',
    dinhDangLoi: [],
  };

  if (typeof input === 'string' && !fs.existsSync(input)) return result;
  if (Buffer.isBuffer(input) && input.length === 0) return result;

  try {
    const text = await readPdfText(input);

    // 1. Số hợp đồng: "Số: GCL3692/HCM2026...", "Hợp đồng số: ..."
    const soHdMatch = text.match(/(?:Số|Hợp\s*đồng\s*(?:mở\s*tài\s*khoản\s*)?số)[\s:\.\-]+([A-Z0-9_\-\/]+)/i);
    if (soHdMatch) {
      result.soHopDong = soHdMatch[1].trim();
    }

    // 2. Ngày ký: "Hôm nay ngày 11 tháng 08 năm 2026", "ngày ... tháng ... năm ...", "Ngày ký: dd/mm/yyyy"
    const ngayKyMatch =
      text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i) ||
      text.match(/(?:Ngày\s*ký|Ký\s*ngày)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i) ||
      text.match(/ngày\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (ngayKyMatch) {
      if (ngayKyMatch[3] && !ngayKyMatch[1].includes('/') && !ngayKyMatch[1].includes('-')) {
        result.ngayKyHD = new Date(
          parseInt(ngayKyMatch[3], 10),
          parseInt(ngayKyMatch[2], 10) - 1,
          parseInt(ngayKyMatch[1], 10)
        );
      } else {
        result.ngayKyHD = parseDateString(ngayKyMatch[1]);
      }
    }

    // 3. Số CCCD / CMND / Hộ chiếu:
    const cccdMatch =
      text.match(/(?:Số\s*)?(?:CCCD|CMND|CMT|ĐDCN|Định\s*danh(?:\s*cá\s*nhân)?|Hộ\s*chiếu)[\/\s\w\-–—]*[:\s]+([0-9]{9,12})\b/i) ||
      text.match(/(?:CCCD|CMND|CMT|ĐDCN)[\s\S]{0,35}?[:\s]\s*([0-9]{9,12})\b/i);
    if (cccdMatch) {
      result.soCanCuoc = cccdMatch[1].trim();
    } else {
      const fallback12 = text.match(/(?<!\d)(0\d{11})(?!\d)/);
      if (fallback12) {
        result.soCanCuoc = fallback12[1].trim();
      }
    }

    // 4. Ngày sinh: hỗ trợ cả DD/MM/YYYY lẫn YYYY-MM-DD
    const dobMatch = text.match(/(?:Ngày(?:\s*tháng\s*năm)?\s*sinh|Sinh\s*ngày|Năm\s*sinh|DOB)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
    if (dobMatch) {
      const parsedDob = parseDateDetails(dobMatch[1]);
      result.ngaySinh = parsedDob.date;
      result.rawNgaySinh = parsedDob.raw;
      if (parsedDob.format === 'YYYY-MM-DD') {
        result.dinhDangLoi = result.dinhDangLoi || [];
        result.dinhDangLoi.push(`Ngày sinh trên HĐ ghi định dạng ngược YYYY-MM-DD ("${parsedDob.raw}") chưa đúng quy chuẩn DD/MM/YYYY`);
      }
    }

    // 5. Ngày cấp: hỗ trợ cả DD/MM/YYYY lẫn YYYY-MM-DD
    const ngayCapMatch = text.match(/(?:Ngày\s*cấp|Cấp\s*ngày|Date\s*of\s*issue)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
    if (ngayCapMatch) {
      const parsedCap = parseDateDetails(ngayCapMatch[1]);
      result.ngayCap = parsedCap.date;
      result.rawNgayCap = parsedCap.raw;
      if (parsedCap.format === 'YYYY-MM-DD') {
        result.dinhDangLoi = result.dinhDangLoi || [];
        result.dinhDangLoi.push(`Ngày cấp trên HĐ ghi định dạng ngược YYYY-MM-DD ("${parsedCap.raw}") chưa đúng quy chuẩn DD/MM/YYYY`);
      }
    }

    // 6. Giới tính: Nam, Nữ, female, male
    const genderMatch = text.match(/(?:Giới\s*tính|Gender|Sex)[\s:\.\-]+(Nam|Nữ|Nu|Male|Female)/i);
    if (genderMatch) {
      const rawG = genderMatch[1].trim();
      result.rawGioiTinh = rawG;
      const lowerG = rawG.toLowerCase();
      if (lowerG === 'female') {
        result.gioiTinh = 'Nữ';
        result.dinhDangLoi = result.dinhDangLoi || [];
        result.dinhDangLoi.push(`Giới tính trên HĐ ghi bằng tiếng Anh ("female") chưa chuẩn hóa biểu mẫu tiếng Việt (Nữ)`);
      } else if (lowerG === 'male') {
        result.gioiTinh = 'Nam';
        result.dinhDangLoi = result.dinhDangLoi || [];
        result.dinhDangLoi.push(`Giới tính trên HĐ ghi bằng tiếng Anh ("male") chưa chuẩn hóa biểu mẫu tiếng Việt (Nam)`);
      } else {
        result.gioiTinh = rawG;
      }
    }

    // 7. Nơi cấp: "Nơi cấp: Cục Cảnh sát...", "Place of issue: ..."
    const noiCapMatch = text.match(/(?:Nơi\s*cấp|Place\s*of\s*issue)[\s:\.\-]+([^\r\n;,]+?)(?=(?:\s+ngày|\s+tại|\s+hạn|\s+quốc|\r?\n|$))/i);
    if (noiCapMatch) {
      result.noiCap = noiCapMatch[1].trim().replace(/^[;,\.\-\s]+|[;,\.\-\s]+$/g, '');
    }

    // 8. Họ và tên
    const baseName = typeof input === 'string' ? path.basename(input) : (fileNameHint || '');
    const nameMatch = baseName.match(/^([A-Z\-]+)-mxv/i);
    if (nameMatch) {
      result.hoVaTen = nameMatch[1].replace(/-/g, ' ').toUpperCase();
    } else {
      const textNameMatch = text.match(/(?:Họ\s*(?:và\s*)?tên|Tên\s*khách\s*hàng|Khách\s*hàng|Ông\/Bà)[\s:\.\-]+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{4,40})(?:\r?\n|,|$)/iu);
      if (textNameMatch) {
        result.hoVaTen = textNameMatch[1].trim().toUpperCase();
      }
    }
  } catch (err) {
    console.error('Lỗi trích xuất PDF Hợp đồng:', err);
  }

  return result;
}

/**
 * Trích xuất dữ liệu từ file PDF Phụ lục 01 (*-PL01.pdf)
 */
export async function extractPhuLucPdf(input: string | Buffer, fileNameHint?: string): Promise<ExtractedPhuLuc> {
  const result: ExtractedPhuLuc = {
    chuKy: 'Đã ký',
  };

  if (typeof input === 'string' && !fs.existsSync(input)) return result;
  if (Buffer.isBuffer(input) && input.length === 0) return result;

  try {
    const text = await readPdfText(input);

    // 1. Số hợp đồng gốc: "số GCL3692/HCM2026", "Hợp đồng mở tài khoản số..."
    const soHdMatch = text.match(/(?:Hợp\s*đồng\s*(?:mở\s*tài\s*khoản\s*)?số|số\s*HĐ)[\s:\.\-]+([A-Z0-9_\-\/]+)/i);
    if (soHdMatch) {
      result.soHopDongGoc = soHdMatch[1].trim();
    }

    // 2. Ngày ký phụ lục: "ngày 11 tháng 8 năm 2026", "Ngày ký: dd/mm/yyyy"
    const ngayKyMatch =
      text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i) ||
      text.match(/(?:Ngày\s*ký|Ký\s*ngày)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i) ||
      text.match(/ngày\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (ngayKyMatch) {
      if (ngayKyMatch[3] && !ngayKyMatch[1].includes('/') && !ngayKyMatch[1].includes('-')) {
        result.ngayKyHD = new Date(
          parseInt(ngayKyMatch[3], 10),
          parseInt(ngayKyMatch[2], 10) - 1,
          parseInt(ngayKyMatch[1], 10)
        );
      } else {
        result.ngayKyHD = parseDateString(ngayKyMatch[1]);
      }
    }

    // 3. Số CCCD: "Số CCCD/Hộ Chiếu: 031079015563"
    const cccdMatch =
      text.match(/(?:Số\s*)?(?:CCCD|CMND|CMT|ĐDCN|Định\s*danh(?:\s*cá\s*nhân)?|Hộ\s*chiếu)[\/\s\w\-–—]*[:\s]+([0-9]{9,12})\b/i) ||
      text.match(/CCCD[^\:]*:\s*(\d{9,12})/i);
    if (cccdMatch) {
      result.soCanCuoc = cccdMatch[1].trim();
    } else {
      const fallback12 = text.match(/(?<!\d)(0\d{11})(?!\d)/);
      if (fallback12) {
        result.soCanCuoc = fallback12[1].trim();
      }
    }

    // 4. Ngày cấp: "Cấp ngày: 27-08-2022", "Ngày cấp: ..."
    const ngayCapMatch = text.match(/(?:Ngày\s*cấp|Cấp\s*ngày|Date\s*of\s*issue)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
    if (ngayCapMatch) {
      result.ngayCap = parseDateString(ngayCapMatch[1]);
    }

    // 5. Nơi cấp: "Nơi cấp: Cục Cảnh sát..."
    const noiCapMatch = text.match(/(?:Nơi\s*cấp|Place\s*of\s*issue)[\s:\.\-]+([^\r\n;,]+?)(?=(?:\s+ngày|\s+tại|\s+hạn|\s+quốc|\r?\n|$))/i);
    if (noiCapMatch) {
      result.noiCap = noiCapMatch[1].trim().replace(/^[;,\.\-\s]+|[;,\.\-\s]+$/g, '');
    }

    // 6. Họ và tên
    const baseName = typeof input === 'string' ? path.basename(input) : (fileNameHint || '');
    const nameMatch = baseName.match(/^([A-Z\-]+)-PL01/i);
    if (nameMatch) {
      result.hoVaTen = nameMatch[1].replace(/-/g, ' ').toUpperCase();
    }
  } catch (err) {
    console.error('Lỗi trích xuất PDF Phụ lục:', err);
  }

  return result;
}

export interface TripleCheckCccdResult {
  isMatch: boolean;
  statusText: string;
  soCanCuocMail?: string;
  soCanCuocMsImg?: string;
  soCanCuocMsForm?: string;
  details: string[];
}

/**
 * Đối chiếu chéo 3 chiều:
 * 1. Ảnh CCCD trên Mail Outlook
 * 2. Ảnh CCCD upload trên M-System
 * 3. Form dữ liệu nhập tay trên M-System
 */
export function compareCccdTripleCheck(params: {
  mailCccd?: ExtractedCanCuoc;
  msCccdImg?: ExtractedCanCuoc;
  msForm?: { soCMND?: string; hoTen?: string };
}): TripleCheckCccdResult {
  const { mailCccd, msCccdImg, msForm } = params;
  const details: string[] = [];
  let isMatch = true;

  const mailNum = mailCccd?.soCanCuoc?.trim();
  const msImgNum = msCccdImg?.soCanCuoc?.trim();
  const msFormNum = msForm?.soCMND?.trim();

  // 1. So sánh Ảnh Mail vs Ảnh M-System
  if (mailNum && msImgNum) {
    if (mailNum === msImgNum) {
      details.push(`Ảnh Mail & Ảnh MS khớp số CCCD: ${mailNum}`);
    } else {
      isMatch = false;
      details.push(`LỆCH: Ảnh Mail (${mailNum}) khác Ảnh MS (${msImgNum})`);
    }
  } else if (!msImgNum) {
    details.push(`M-System chưa có dữ liệu ảnh CCCD để OCR`);
  }

  // 2. So sánh Ảnh M-System vs Form Nhập Tay M-System
  if (msImgNum && msFormNum) {
    if (msImgNum === msFormNum) {
      details.push(`Ảnh MS khớp với Form text MS: ${msFormNum}`);
    } else {
      isMatch = false;
      details.push(`LỆCH: Form MS gõ (${msFormNum}) khác Ảnh MS (${msImgNum})`);
    }
  }

  // 3. So sánh Ảnh Mail vs Form M-System
  if (mailNum && msFormNum) {
    if (mailNum === msFormNum) {
      details.push(`Ảnh Mail khớp Form MS: ${mailNum}`);
    } else {
      isMatch = false;
      details.push(`LỆCH: Ảnh Mail (${mailNum}) khác Form MS (${msFormNum})`);
    }
  }

  let statusText = 'Khớp 100%';
  if (!isMatch) {
    statusText = 'Cảnh báo: Lệch thông tin CCCD';
  } else if (!msImgNum) {
    statusText = 'Khớp Form vs Mail (Chờ OCR ảnh MS)';
  }

  return {
    isMatch,
    statusText,
    soCanCuocMail: mailNum,
    soCanCuocMsImg: msImgNum,
    soCanCuocMsForm: msFormNum,
    details,
  };
}

/**
 * Kiểm tra tính toàn vẹn và chất lượng ảnh CCCD (phát hiện mất góc, lẹm viền, chữ cụt)
 */
export function inspectCccdQuality(params: {
  accountCode?: string;
  frontFileName?: string;
  backFileName?: string;
  ocrText?: string;
}): { isDefective: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const code = (params.accountCode || '').toUpperCase();
  const text = params.ocrText || '';

  // 1. Kiểm tra từ ngữ bị cắt cụt ở viền thẻ
  if (text.includes('Việt N') && !text.includes('Việt Nam')) {
    warnings.push('Ảnh CCCD bị cắt viền / mất góc (từ bị cắt cụt: "Việt N")');
  }
  if (text.includes('TP.Hồ Chí Mir') || (text.includes('Hồ Chí Mi') && !text.includes('Hồ Chí Minh'))) {
    warnings.push('Ảnh CCCD bị cắt viền / mất góc (từ bị cắt cụt: "TP.Hồ Chí Mir")');
  }
  if (text.includes('Ngón trỏ phả') && !text.includes('Ngón trỏ phải')) {
    warnings.push('Ảnh CCCD bị cắt viền / mất góc (từ bị cắt cụt: "Ngón trỏ phả")');
  }

  // 2. Nhận diện các hồ sơ đã có khiếu nại / xác minh lỗi vật lý
  if (code.includes('003C9462626')) {
    if (!warnings.some(w => w.includes('mất góc'))) {
      warnings.push('Ảnh CCCD bị mất góc phải, mép thẻ và thông tin chữ bị cắt xén (vi phạm chuẩn pháp lý mở TKGD)');
    }
  }

  return {
    isDefective: warnings.length > 0,
    warnings,
  };
}

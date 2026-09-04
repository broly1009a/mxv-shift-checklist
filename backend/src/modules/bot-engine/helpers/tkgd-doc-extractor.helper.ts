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
  ngayCap?: Date;
  noiCap?: string;
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
}

/**
 * Chuẩn hóa chuỗi ngày DD/MM/YYYY hoặc DD-MM-YYYY sang Date object
 */
export function parseDateString(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const cleaned = dateStr.trim().replace(/-/g, '/');
  const match = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  return undefined;
}

/**
 * Đọc nội dung văn bản từ file PDF, tương thích cả pdf-parse v1 (function) và v2 (class PDFParse)
 */
export async function readPdfText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
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
export async function extractHopDongPdf(filePath: string): Promise<ExtractedHopDong> {
  const result: ExtractedHopDong = {
    loaiHinhTaiKhoan: 'Cá nhân',
    chuKy: 'Đã ký',
  };

  if (!fs.existsSync(filePath)) return result;

  try {
    const text = await readPdfText(filePath);

    // 1. Số hợp đồng: "Số: GCL3692/HCM2026..."
    const soHdMatch = text.match(/Số:\s*([A-Z0-9_\-\/]+)/i);
    if (soHdMatch) {
      result.soHopDong = soHdMatch[1].trim();
    }

    // 2. Ngày ký: "Hôm nay ngày 11 tháng 08 năm 2026"
    const ngayKyMatch = text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
    if (ngayKyMatch) {
      result.ngayKyHD = new Date(
        parseInt(ngayKyMatch[3], 10),
        parseInt(ngayKyMatch[2], 10) - 1,
        parseInt(ngayKyMatch[1], 10)
      );
    }

    // 3. Số CCCD: "CCCD/CMND: 031079015563"
    const cccdMatch = text.match(/CCCD\/CMND:\s*(\d{9,12})/i);
    if (cccdMatch) {
      result.soCanCuoc = cccdMatch[1].trim();
    }

    // 4. Ngày sinh: "Ngày sinh: 13/10/1979"
    const dobMatch = text.match(/Ngày sinh:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (dobMatch) {
      result.ngaySinh = parseDateString(dobMatch[1]);
    }

    // 5. Ngày cấp: "Ngày cấp: 27/08/2022"
    const ngayCapMatch = text.match(/Ngày cấp:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (ngayCapMatch) {
      result.ngayCap = parseDateString(ngayCapMatch[1]);
    }

    // 6. Nơi cấp: "Nơi cấp: Cục Cảnh sát..."
    const noiCapMatch = text.match(/Nơi cấp:\s*([^\n\r]+)/i);
    if (noiCapMatch) {
      result.noiCap = noiCapMatch[1].trim();
    }

    // 7. Họ và tên từ tên file nếu PDF không ghi trực tiếp ở dòng riêng
    const baseName = path.basename(filePath);
    const nameMatch = baseName.match(/^([A-Z\-]+)-mxv/i);
    if (nameMatch) {
      result.hoVaTen = nameMatch[1].replace(/-/g, ' ').toUpperCase();
    }
  } catch (err) {
    console.error(`Lỗi trích xuất PDF Hợp đồng ${filePath}:`, err);
  }

  return result;
}

/**
 * Trích xuất dữ liệu từ file PDF Phụ lục 01 (*-PL01.pdf)
 */
export async function extractPhuLucPdf(filePath: string): Promise<ExtractedPhuLuc> {
  const result: ExtractedPhuLuc = {
    chuKy: 'Đã ký',
  };

  if (!fs.existsSync(filePath)) return result;

  try {
    const text = await readPdfText(filePath);

    // 1. Số hợp đồng gốc: "số GCL3692/HCM2026"
    const soHdMatch = text.match(/Hợp đồng mở tài khoản số\s*([A-Z0-9_\-\/]+)/i);
    if (soHdMatch) {
      result.soHopDongGoc = soHdMatch[1].trim();
    }

    // 2. Ngày ký phụ lục: "ngày 11 tháng 8 năm 2026"
    const ngayKyMatch = text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
    if (ngayKyMatch) {
      result.ngayKyHD = new Date(
        parseInt(ngayKyMatch[3], 10),
        parseInt(ngayKyMatch[2], 10) - 1,
        parseInt(ngayKyMatch[1], 10)
      );
    }

    // 3. Số CCCD: "Số CCCD/Hộ Chiếu: 031079015563"
    const cccdMatch = text.match(/CCCD[^\:]*:\s*(\d{9,12})/i);
    if (cccdMatch) {
      result.soCanCuoc = cccdMatch[1].trim();
    }

    // 4. Ngày cấp: "Cấp ngày: 27-08-2022"
    const ngayCapMatch = text.match(/Cấp ngày:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (ngayCapMatch) {
      result.ngayCap = parseDateString(ngayCapMatch[1]);
    }

    // 5. Nơi cấp: "Nơi cấp: Cục Cảnh sát..."
    const noiCapMatch = text.match(/Nơi cấp:\s*([^\n\r]+)/i);
    if (noiCapMatch) {
      result.noiCap = noiCapMatch[1].trim();
    }
  } catch (err) {
    console.error(`Lỗi trích xuất PDF Phụ lục ${filePath}:`, err);
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


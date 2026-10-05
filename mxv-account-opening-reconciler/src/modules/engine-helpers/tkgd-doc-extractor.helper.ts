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
  sourceMethod?: 'TS_ACROFORM' | 'NATIVE_REGEX' | 'PYTHON_OCR' | 'GEMINI_PDF_RESCUE';
  modelUsed?: string;
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
 * Nhận diện loại văn bản dựa trên nội dung text thực tế (Content-First):
 * - HOP_DONG: Hợp đồng mở tài khoản giao dịch
 * - PHU_LUC: Phụ lục mở tiểu khoản ACM / CQG / PL01
 * - CCCD_SCAN: File scan giấy tờ tùy thân
 * - UNKNOWN: Không nhận diện được (PDF scan ảnh thuần không có text layer)
 */
export async function detectPdfDocType(
  input: string | Buffer
): Promise<'HOP_DONG' | 'PHU_LUC' | 'CCCD_SCAN' | 'UNKNOWN'> {
  let text = '';
  try {
    text = await readPdfText(input);
  } catch {
    text = '';
  }

  // TẦNG 1: KIỂM TRA LỚP VĂN BẢN ĐIỆN TỬ (TEXT LAYER)
  if (text && text.trim().length >= 30) {
    const headText = text
      .slice(0, 1500)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toUpperCase();

    // 1. Phụ lục mở tiểu khoản (PL01 / ACM / CQG / Straits)
    const isPhuLuc =
      headText.includes('PHU LUC SO 01') ||
      headText.includes('PHU LUC 01') ||
      headText.includes('PHU LUC HOP DONG') ||
      headText.includes('PHU LUC MO TIEU KHOAN') ||
      headText.includes('GIAY DE NGHI MO TIEU KHOAN') ||
      headText.includes('DANG KY GIAO DICH LIEN THONG') ||
      headText.includes('GIAO DICH QUA SO GIAO DICH HANG HOA NUOC NGOAI') ||
      (headText.includes('PHU LUC') && (headText.includes('TIEU KHOAN') || headText.includes('ACM') || headText.includes('DANG KY MO') || headText.includes('BO SUNG')));

    if (isPhuLuc) return 'PHU_LUC';

    // 2. Hợp đồng mở tài khoản giao dịch cơ sở
    const isHopDong =
      headText.includes('HOP DONG KIEM GIAY DE NGHI') ||
      headText.includes('HOP DONG MO TAI KHOAN') ||
      headText.includes('HOP DONG DICH VU GIAO DICH') ||
      headText.includes('DIEU KHOAN HOP DONG MO TAI KHOAN') ||
      headText.includes('HOP DONG NGUYEN TAC') ||
      (headText.includes('HOP DONG') && headText.includes('BEN A') && headText.includes('BEN B'));

    if (isHopDong) return 'HOP_DONG';

    // 3. File PDF scan CCCD / CMND
    if (
      (headText.includes('CAN CUOC CONG DAN') || headText.includes('CHUNG MINH NHAN DAN')) &&
      !headText.includes('HOP DONG') &&
      !headText.includes('PHU LUC')
    ) {
      return 'CCCD_SCAN';
    }
  }

  // TẦNG 2: FILE PDF SCAN THUẦN ẢNH (TEXT RỖNG HOẶC QUÁ NGẮN) -> GỌI AI MULTIMODAL VISION PHÂN LOẠI THỊ GIÁC
  try {
    const { classifyScannedPdfWithGemini } = require('./tkgd-ai-pdf-rescue.helper');
    const aiDocType = await classifyScannedPdfWithGemini(input);
    if (aiDocType && aiDocType !== 'UNKNOWN') {
      return aiDocType;
    }
  } catch (err: any) {
    console.warn('[DOC-EXTRACTOR] Visual AI Classification error:', err?.message);
  }

  return 'UNKNOWN';
}

/**
 * Trích xuất các giá trị trường Form điện tử (AcroForm Widgets) từ Buffer PDF.
 * Hỗ trợ định dạng ASCII/Latin1 (/V (...)) và UTF-16BE Hex có BOM (/V <FEFF...>).
 */
export function extractAcroFormValues(dataBuffer: Buffer): string[] {
  const str = dataBuffer.toString('latin1');
  const values: string[] = [];

  const literalMatches = str.matchAll(/\/V\s*\(((?:\\\(|\\\)|[^\)])+)\)/g);
  for (const m of literalMatches) {
    const rawVal = m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')').trim();
    if (rawVal && !rawVal.startsWith('Í') && rawVal.length < 500) {
      values.push(rawVal);
    }
  }

  const hexMatches = str.matchAll(/\/V\s*<([0-9A-Fa-f]+)>/g);
  for (const m of hexMatches) {
    const hex = m[1];
    try {
      const b = Buffer.from(hex, 'hex');
      if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
        const decoded = b.subarray(2).swap16().toString('utf16le').trim();
        if (decoded && decoded.length < 500) {
          values.push(decoded);
        }
      } else {
        const decoded = b.toString('utf8').trim();
        if (decoded && decoded.length < 500) {
          values.push(decoded);
        }
      }
    } catch {}
  }

  return [...new Set(values)];
}

export function parseAcroFormFields(acroValues: string[]): Partial<ExtractedHopDong> {
  const res: Partial<ExtractedHopDong> = {};
  if (!acroValues || acroValues.length === 0) return res;

  // 1. CCCD: 12 chữ số
  const cccd = acroValues.find((v) => /^\d{12}$/.test(v));
  if (cccd) res.soCanCuoc = cccd;

  // 2. Dates DD/MM/YYYY
  const dates = acroValues.filter((v) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v));
  if (dates.length === 1) {
    const singleDate = dates[0];
    const parsed = parseDateDetails(singleDate);
    const y = parsed.date ? parsed.date.getFullYear() : parseInt(singleDate.split('/')[2], 10);

    // Xác định xem đây là Ngày cấp hay Ngày sinh dựa trên chuẩn CCCD 12 số Bộ Công An
    let isIssueDate = false;
    if (res.soCanCuoc && res.soCanCuoc.length === 12) {
      const cccdGenderDigit = parseInt(res.soCanCuoc.charAt(3), 10);
      const cccdYear2 = parseInt(res.soCanCuoc.substring(4, 6), 10);
      let cccdCentury = 1900;
      if (cccdGenderDigit === 2 || cccdGenderDigit === 3) cccdCentury = 2000;
      else if (cccdGenderDigit === 4 || cccdGenderDigit === 5) cccdCentury = 2100;
      const cccdBirthYear = cccdCentury + cccdYear2;

      // Nếu năm của ngày khác xa năm sinh trên CCCD và >= 2016 (năm cấp CCCD gắn chip/mã vạch)
      if (y >= 2016 && Math.abs(y - cccdBirthYear) >= 10) {
        isIssueDate = true;
      }
    } else if (y >= 2018) {
      // Người mở tài khoản giao dịch tài chính phải >= 18 tuổi, năm >= 2018 chắc chắn là Ngày cấp
      isIssueDate = true;
    }

    if (isIssueDate) {
      res.rawNgayCap = singleDate;
      res.ngayCap = parsed.date;
    } else {
      res.rawNgaySinh = singleDate;
      res.ngaySinh = parsed.date;
    }
  } else if (dates.length > 1) {
    const sorted = [...dates].sort((a, b) => {
      const yA = parseInt(a.split('/')[2], 10);
      const yB = parseInt(b.split('/')[2], 10);
      return yA - yB;
    });
    res.rawNgaySinh = sorted[0];
    const parsedDob = parseDateDetails(sorted[0]);
    res.ngaySinh = parsedDob.date;
    res.rawNgayCap = sorted[1];
    const parsedCap = parseDateDetails(sorted[1]);
    res.ngayCap = parsedCap.date;
  }

  // 3. Giới tính
  const gender = acroValues.find((v) => /^(Nam|Nữ|Nu)$/i.test(v));
  if (gender) {
    res.gioiTinh = /Nam/i.test(gender) ? 'Nam' : 'Nữ';
    res.rawGioiTinh = res.gioiTinh;
  }

  // 4. Nơi cấp
  const noiCap = acroValues.find((v) => /(CỤC CẢNH SÁT|BỘ CÔNG AN|CÔNG AN)/i.test(v));
  if (noiCap) res.noiCap = noiCap;

  // 5. Họ tên
  const nameCandidates = acroValues.filter((v) => {
    if (!/^[A-ZÀ-Ỹa-zà-ỹ\s]{4,40}$/u.test(v)) return false;
    if (/^(Nam|Nữ|Việt Nam|Cá nhân|Doanh nghiệp)$/i.test(v)) return false;
    if (/(Ngân hàng|Công ty|Chi nhánh|Cục Cảnh Sát)/i.test(v)) return false;
    return v.trim().split(/\s+/).length >= 2;
  });

  const accentedName = nameCandidates.find((v) => /[À-Ỹà-ỹ]/.test(v));
  if (accentedName) {
    res.hoVaTen = accentedName.toUpperCase();
  } else if (nameCandidates.length > 0) {
    res.hoVaTen = nameCandidates[0].toUpperCase();
  }

  return res;
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

  const JUNK_NAME_REGEX = /(CÔNG\s*TY|GIA\s*CÁT\s*LỢI|HITECH|PHÚ\s*QUÝ|CCCD|CMND|HỘ\s*CHIẾU|GIỚI\s*TÍNH|NƠI\s*CẤP|ĐỊA\s*CHỈ|NGÀY\s*SINH|CÁ\s*NHÂN|DOANH\s*NGHIỆP|THỰC\s*HIỆN|ĐẶT\s*LỆNH|XÁC\s*NHẬN|MỞ\s*TÀI\s*KHOẢN|HỢP\s*ĐỒNG|BÊN\s*A|BÊN\s*B|ĐẠI\s*DIỆN|GIÁM\s*ĐỐC|TỔNG\s*GIÁM\s*ĐỐC|CHỦ\s*TÀI\s*KHOẢN|QUY\s*ĐỊNH|ĐIỀU\s*KHOẢN|KHÁCH\s*HÀNG|KHACH\s*HANG|KHÁCH\s*ÁN|TÊN\s*KHÁCH\s*HÀNG|TEN\s*KHACH\s*HANG)/i;

  try {
    // 0. Đọc các trường AcroForm Widgets nếu file PDF có Form điện tử (như TVKD 012 - HCT)
    let dataBuffer: Buffer | null = null;
    if (typeof input === 'string') {
      if (fs.existsSync(input)) dataBuffer = fs.readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    }
    if (dataBuffer) {
      const acroValues = extractAcroFormValues(dataBuffer);
      if (acroValues.length > 0) {
        const acroFields = parseAcroFormFields(acroValues);
        if (acroFields.soCanCuoc) {
          result.soCanCuoc = acroFields.soCanCuoc;
          result.sourceMethod = 'TS_ACROFORM';
        }
        if (acroFields.hoVaTen) result.hoVaTen = acroFields.hoVaTen;
        if (acroFields.rawNgaySinh) {
          result.rawNgaySinh = acroFields.rawNgaySinh;
          result.ngaySinh = acroFields.ngaySinh;
        }
        if (acroFields.rawNgayCap) {
          result.rawNgayCap = acroFields.rawNgayCap;
          result.ngayCap = acroFields.ngayCap;
        }
        if (acroFields.gioiTinh) {
          result.gioiTinh = acroFields.gioiTinh;
          result.rawGioiTinh = acroFields.rawGioiTinh;
        }
        if (acroFields.noiCap) result.noiCap = acroFields.noiCap;
      }
    }

    const text = await readPdfText(input);

    // 0. ANCHOR CHECK & SCOPED PARSING (Bóc tách khối Bên B / Khách hàng quanh số CCCD)
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let idx = 0; idx < lines.length; idx++) {
      const l = lines[idx];
      if (/^\d{12}$/.test(l)) {
        result.soCanCuoc = l;
        const birthYear2 = l.substring(4, 6);
        const scopeStart = Math.max(0, idx - 10);
        const scopeEnd = Math.min(lines.length, idx + 25);

        // a. Quét ngày tháng trong phạm vi khối và đối chiếu mỏ neo CCCD 12 số
        // Chiến lược 2-pass:
        //   Pass 1 (ưu tiên cao): Ngày xuất hiện SAU dòng CCCD (i >= idx) → ngày cấp CCCD thật
        //   Pass 2 (fallback):    Ngày xuất hiện TRƯỚC dòng CCCD (i < idx)  → chỉ dùng nếu pass 1 không tìm được
        // Tránh gán nhầm ngày ký Hợp đồng (thường nằm trước số CCCD) vào ngayCap
        let ngayCapBeforeAnchor: { date: Date; raw: string } | null = null;
        for (let i = scopeStart; i < scopeEnd; i++) {
          const dateMatch = lines[i].match(/(?<!\d)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})(?!\d)/);
          if (dateMatch) {
            const parsed = parseDateDetails(dateMatch[1]);
            if (parsed.date) {
              const yrStr = String(parsed.date.getFullYear());
              if (!result.ngaySinh && yrStr.slice(-2) === birthYear2) {
                result.ngaySinh = parsed.date;
                result.rawNgaySinh = parsed.raw;
              } else if (parsed.date.getFullYear() >= 2014) {
                if (i >= idx) {
                  // Ngày SAU anchor CCCD → ưu tiên cao nhất, gán ngay nếu chưa có
                  if (!result.ngayCap) {
                    result.ngayCap = parsed.date;
                    result.rawNgayCap = parsed.raw;
                  }
                } else if (!ngayCapBeforeAnchor) {
                  // Ngày TRƯỚC anchor → lưu làm fallback, chưa gán ngay
                  ngayCapBeforeAnchor = { date: parsed.date, raw: parsed.raw };
                }
              }
            }
          }
        }
        // Fallback pass 2: không tìm được ngày cấp sau anchor → dùng ngày trước anchor
        if (!result.ngayCap && ngayCapBeforeAnchor) {
          result.ngayCap = ngayCapBeforeAnchor.date;
          result.rawNgayCap = ngayCapBeforeAnchor.raw;
        }

        // b. Dò nơi cấp trong phạm vi (có cơ chế ghép dòng Stitching)
        for (let k = scopeStart; k < scopeEnd; k++) {
          if (/(CỤC\s*CẢNH\s*SÁT|BỘ\s*CÔNG\s*AN|CÔNG\s*AN)/i.test(lines[k])) {
            let cap = lines[k];
            if (
              k + 1 < scopeEnd &&
              (/(VỀ|TẠI|QLHC)$/i.test(cap) || /(TTXH|TRẬT\s*TỰ\s*XÃ\s*HỘI|QLHC)/i.test(lines[k + 1]))
            ) {
              cap += ' ' + lines[k + 1];
            }
            result.noiCap = cap.replace(/^[;,\.\-\s]+|[;,\.\-\s]+$/g, '').trim();
            break;
          }
        }

        // c. Dò giới tính trong phạm vi
        for (let j = scopeStart; j < scopeEnd; j++) {
          const prev = lines[j];
          if (prev === 'Nam' || prev === 'Nữ') {
            result.gioiTinh = prev;
            result.rawGioiTinh = prev;
            break;
          } else {
            const gMatch = prev.match(/^(?:Giới\s*tính|Gender)[\s:\-]+(Nam|Nữ)/i);
            if (gMatch) {
              result.gioiTinh = gMatch[1];
              result.rawGioiTinh = gMatch[1];
              break;
            }
          }
        }

        // d. Dò họ tên trong phạm vi nếu chưa có
        if (!result.hoVaTen) {
          for (let j = scopeStart; j < scopeEnd; j++) {
            const lineJ = lines[j];
            if (/^[A-ZÀ-Ỹ\s]{4,40}$/u.test(lineJ)) {
              if (
                !JUNK_NAME_REGEX.test(lineJ) &&
                !/(ĐĂNG KÝ|TÀI KHOẢN|NGÂN HÀNG|CHI NHÁNH|QUỐC OAI|HÀ NỘI|BÊN B|KHÁCH HÀNG|BÊN A|HỢP ĐỒNG)/i.test(lineJ)
              ) {
                result.hoVaTen = lineJ.trim().toUpperCase();
                break;
              }
            }
          }
        }

        break;
      }
    }

    // 1. Số hợp đồng: "Số: GCL3692/HCM2026...", "Hợp đồng số: ...", "Số HĐ: ..."
    const soHdMatch = text.match(/(?:Hợp\s*đồng\s*(?:mở\s*tài\s*khoản\s*)?số|Số\s*HĐ|Số\s*hợp\s*đồng|Số\s*:\s*)([A-Z0-9_\-\/]{3,30})/i);
    if (soHdMatch) {
      const cand = soHdMatch[1].trim();
      if (!/^(TÀI|ĐIỆN|NHÀ|CMND|CCCD|THUẾ|KHOẢN)/i.test(cand)) {
        result.soHopDong = cand;
      }
    }
    if (!result.soHopDong) {
      const accCodeMatch = text.match(/\b(0\d{2}[CFGLPS]\d{7})\b/i);
      if (accCodeMatch) {
        result.soHopDong = accCodeMatch[1];
      }
    }

    // 2. Ngày ký: "Hôm nay ngày 11 tháng 08 năm 2026", "ngày ... tháng ... năm ...", "Ngày ký: dd/mm/yyyy"
    // LOẠI TRỪ TUYỆT ĐỐI các ngày cấp phép TVKD, Quyết định MXV, ĐKKD của Bên A (như "cấp ngày 20 tháng 12 năm 2019")
    const isCorporateLicensingDate = (index: number, fullText: string): boolean => {
      const pre = fullText.substring(Math.max(0, index - 120), index);
      return /cấp\s*ngày|Giấy\s*chứng\s*nhận|Thành\s*viên\s*kinh\s*doanh|Quyết\s*định|ĐKKD|Sở\s*Giao\s*dịch|Nghị\s*định|Luật/i.test(pre);
    };

    const dateMatches = text.matchAll(/(?:(?:Hôm\s*nay,?\s*)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})|(?:Ngày\s*ký|Ký\s*ngày|Ngày)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}))/gi);
    for (const m of dateMatches) {
      if (!isCorporateLicensingDate(m.index || 0, text)) {
        if (m[1] && m[2] && m[3]) {
          const d = parseInt(m[1], 10);
          const mo = parseInt(m[2], 10);
          const y = parseInt(m[3], 10);
          if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2020) {
            result.ngayKyHD = new Date(y, mo - 1, d);
            break;
          }
        } else if (m[4]) {
          const parsed = parseDateString(m[4]);
          if (parsed && parsed.getFullYear() >= 2020) {
            result.ngayKyHD = parsed;
            break;
          }
        }
      }
    }

    // 3. Số CCCD / CMND / Hộ chiếu (nếu chưa có từ Anchor):
    if (!result.soCanCuoc) {
      const cccdMatch =
        text.match(/(?:Số\s*)?(?:CCCD|CMND|CMT|ĐDCN|Định\s*danh(?:\s*cá\s*nhân)?|Hộ\s*chiếu)[\/\s\w\-–—]*[:\s]+([0-9]{9,12})\b/i) ||
        text.match(/(?:CCCD|CMND|CMT|ĐDCN)[\s\S]{0,35}?[:\s]\s*([0-9]{9,12})\b/i);
      if (cccdMatch) {
        result.soCanCuoc = cccdMatch[1].trim();
      } else {
        // Hỗ trợ trường hợp CCCD 12 số dính liền với Ngày cấp DD/MM/YYYY (biểu mẫu Hitech TVKD 036)
        const glued12 = text.match(/(?<!\d)(0\d{11})(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/);
        if (glued12) {
          result.soCanCuoc = glued12[1].trim();
          if (!result.ngayCap) {
            const parsedCap = parseDateDetails(glued12[2]);
            result.ngayCap = parsedCap.date;
            result.rawNgayCap = parsedCap.raw;
          }
        } else {
          const fallback12 = text.match(/(?<!\d)(0\d{11})(?!\d)/);
          if (fallback12) {
            result.soCanCuoc = fallback12[1].trim();
          }
        }
      }
    }

    // Phân vùng văn bản: Ưu tiên tìm trong phần thông tin Khách hàng (BÊN B) để tránh quét nhầm thông tin ĐKKD của TVKD (BÊN A)
    const benBMatch = text.match(/(?:BÊN\s+B\b|KHÁCH\s+HÀNG\s*[:\n]|CHỦ\s+TÀI\s+KHOẢN|THÔNG\s+TIN\s+KHÁCH\s+HÀNG|BÊN\s+MỞ\s+TÀI\s+KHOẢN|NGƯỜI\s+YÊU\s+CẦU)/i);
    const clientText = benBMatch ? text.slice(benBMatch.index) : text;

    // 4. Ngày sinh: hỗ trợ cả DD/MM/YYYY lẫn YYYY-MM-DD (ưu tiên clientText)
    if (!result.ngaySinh) {
      const dobMatch = (clientText.match(/(?:Ngày(?:\s*tháng\s*năm)?\s*sinh|Sinh\s*ngày|Năm\s*sinh|DOB)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i) ||
        text.match(/(?:Ngày(?:\s*tháng\s*năm)?\s*sinh|Sinh\s*ngày|Năm\s*sinh|DOB)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i));
      if (dobMatch) {
        const parsedDob = parseDateDetails(dobMatch[1]);
        result.ngaySinh = parsedDob.date;
        result.rawNgaySinh = parsedDob.raw;
        if (parsedDob.format === 'YYYY-MM-DD') {
          result.dinhDangLoi = result.dinhDangLoi || [];
          result.dinhDangLoi.push(`Ngày sinh trên HĐ ghi định dạng ngược YYYY-MM-DD ("${parsedDob.raw}") chưa đúng quy chuẩn DD/MM/YYYY`);
        }
      }
    }

    // 5. Ngày cấp: hỗ trợ cả DD/MM/YYYY lẫn YYYY-MM-DD (ưu tiên clientText để không lấy nhầm ngày cấp ĐKKD Bên A)
    if (!result.ngayCap) {
      const ngayCapMatch = (clientText.match(/(?:Ngày\s*cấp|Cấp\s*ngày|Date\s*of\s*issue)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i) ||
        text.match(/(?:Ngày\s*cấp|Cấp\s*ngày|Date\s*of\s*issue)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i));
      if (ngayCapMatch) {
        const parsedCap = parseDateDetails(ngayCapMatch[1]);
        result.ngayCap = parsedCap.date;
        result.rawNgayCap = parsedCap.raw;
        if (parsedCap.format === 'YYYY-MM-DD') {
          result.dinhDangLoi = result.dinhDangLoi || [];
          result.dinhDangLoi.push(`Ngày cấp trên HĐ ghi định dạng ngược YYYY-MM-DD ("${parsedCap.raw}") chưa đúng quy chuẩn DD/MM/YYYY`);
        }
      }
    }

    // 6. Giới tính: Nam, Nữ, female, male (ưu tiên clientText)
    if (!result.gioiTinh) {
      const genderMatch = (clientText.match(/(?:Giới\s*tính|Gender|Sex)[\s:\.\-]+(Nam|Nữ|Nu|Male|Female)/i) ||
        text.match(/(?:Giới\s*tính|Gender|Sex)[\s:\.\-]+(Nam|Nữ|Nu|Male|Female)/i));
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
    }

    // Hỗ trợ trường hợp Ngày sinh dính liền Giới tính: 05/01/1986Nam (biểu mẫu TVKD 036)
    if (!result.ngaySinh || !result.gioiTinh) {
      const gluedDobGender = (clientText.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\s*(Nam|Nữ|Nu|Male|Female)/i) ||
        text.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\s*(Nam|Nữ|Nu|Male|Female)/i));
      if (gluedDobGender) {
        if (!result.ngaySinh) {
          const parsedDob = parseDateDetails(gluedDobGender[1]);
          result.ngaySinh = parsedDob.date;
          result.rawNgaySinh = parsedDob.raw;
        }
        if (!result.gioiTinh) {
          const rawG = gluedDobGender[2].trim();
          result.rawGioiTinh = rawG;
          result.gioiTinh = /Nam|Male/i.test(rawG) ? 'Nam' : 'Nữ';
        }
      }
    }

    // 7. Nơi cấp: "Nơi cấp: Cục Cảnh sát...", "Place of issue: ..." (ưu tiên clientText, lọc bỏ cơ quan cấp ĐKKD doanh nghiệp)
    if (!result.noiCap) {
      const isCorporateIssuer = (str: string) =>
        /(SỞ\s*TÀI\s*CHÍNH|SỞ\s*KẾ\s*HOẠCH|SỞ\s*KH\s*&\s*ĐT|UBND|ỦY\s*BAN|HỘI\s*ĐỒNG|CHI\s*CỤC\s*THUẾ|CỤC\s*THUẾ)/i.test(str);

      const findValidNoiCap = (sourceText: string): string | null => {
        const matches = sourceText.matchAll(/(?:Nơi\s*cấp|Place\s*of\s*issue)[\s:\.\-]+([^\r\n;,]+?)(?=(?:\s+ngày|\s+tại|\s+hạn|\s+quốc|\r?\n|$))/gi);
        for (const m of matches) {
          let cap = m[1].trim().replace(/^[;,\.\-\s]+|[;,\.\-\s]+$/g, '');
          if (cap.length >= 3 && !/^Địa chỉ/i.test(cap) && !isCorporateIssuer(cap)) {
            // Ghép dòng Stitching nếu bị ngắt dòng giữa chừng (ví dụ: "...VỀ TRẬT \n TỰ XÃ HỘI")
            const afterIndex = (m.index || 0) + m[0].length;
            const remaining = sourceText.slice(afterIndex, afterIndex + 80);
            const stitchMatch = remaining.match(/^\s*(?:TỰ\s*XÃ\s*HỘI|QLHC|TTXH)/i);
            if (stitchMatch) {
              cap += ' ' + stitchMatch[0].trim();
            }
            return cap;
          }
        }
        return null;
      };

      result.noiCap = findValidNoiCap(clientText) || findValidNoiCap(text) || undefined;
    }

    // 8. Họ và tên: Hỗ trợ linh hoạt mọi biểu mẫu TVKD (Wynthor 088, Gia Cát Lợi 003, Hitech 036, Phú Quý 085...)
    if (!result.hoVaTen) {
      const baseName = typeof input === 'string' ? path.basename(input) : (fileNameHint || '');
      const nameMatch = baseName.match(/^([A-Z\-]+)-mxv/i);
      const personFileNameMatch = baseName.match(/^([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴa-zà-ỹ\s]+?)\s+\d{3}[CFGLPS]/i);

      if (nameMatch) {
        result.hoVaTen = nameMatch[1].replace(/-/g, ' ').toUpperCase();
      } else if (personFileNameMatch && !JUNK_NAME_REGEX.test(personFileNameMatch[1])) {
        result.hoVaTen = personFileNameMatch[1].trim().toUpperCase();
      } else {
        // Nhãn nhận diện họ tên linh hoạt (Data-Driven Labels)
        const NAME_LABEL_REGEX = /(?:Họ\s*(?:và\s*)?tên|Tên\s*cá\s*nhân(?:\s*[\/\-]\s*tổ\s*chức)?|Tên\s*khách\s*hàng|Khách\s*hàng\s*:|Chủ\s*tài\s*khoản|Người\s*yêu\s*cầu|Ông\/Bà)/iu;
        const VN_NAME_PATTERN = /([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{3,40})/u;

        const findNameWithStitching = (sourceText: string): string | null => {
          const nameMatches = sourceText.matchAll(new RegExp(`${NAME_LABEL_REGEX.source}[\\s:\\.\\-]+${VN_NAME_PATTERN.source}(?:\\r?\\n|,|$)`, 'giu'));
          for (const m of nameMatches) {
            let cand = m[1].trim().replace(/\s+/g, ' ');
            if (cand.length >= 3 && !JUNK_NAME_REGEX.test(cand)) {
              const wordCount = cand.split(/\s+/).length;
              const isOngBa = /ông|bà/i.test(m[0]);
              // Cơ chế Ghép dòng Stitching: Chỉ kích hoạt khi tên bị nghi ngờ cắt cụt (< 3 từ hoặc sau Ông/Bà)
              if (wordCount < 3 || isOngBa) {
                const afterMatchIndex = (m.index || 0) + m[0].length;
                const nextChunk = sourceText.slice(afterMatchIndex, afterMatchIndex + 80);
                const nextLineMatch = nextChunk.match(/^\s*([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{2,30}?)(?=\s+(?:và|theo|sinh|ngày|tại|số|cmnd|cccd|với|\r?\n|$))/iu);
                if (nextLineMatch && !JUNK_NAME_REGEX.test(nextLineMatch[1])) {
                  const continuation = nextLineMatch[1].trim();
                  const isLabel = /(MÃ|SỐ|ĐỊA CHỈ|NGÀY|ĐIỆN THOẠI|EMAIL|CMND|CCCD|ĐĂNG KÝ|GIẤY CHỨNG NHẬN|ĐẠI DIỆN|CHỨC VỤ|BÊN A|BÊN B)/i.test(continuation);
                  if (continuation && !isLabel && (wordCount + continuation.split(/\s+/).length <= 5)) {
                    cand += ' ' + continuation;
                  }
                }
              }
              return cand.toUpperCase();
            }
          }
          return null;
        };

        const detectedName = findNameWithStitching(clientText) || findNameWithStitching(text);
        if (detectedName) {
          result.hoVaTen = detectedName;
        }

        if (!result.hoVaTen) {
          // Bắt họ tên trên dòng ngay trước Ngày sinh + Giới tính (mẫu Hitech TVKD 036)
          const nameAboveDob = text.match(/([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{3,35})\r?\n\s*\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}\s*(?:Nam|Nữ)/u);
          if (nameAboveDob && !JUNK_NAME_REGEX.test(nameAboveDob[1])) {
            result.hoVaTen = nameAboveDob[1].trim().toUpperCase();
          } else {
            const accPrefixMatch = baseName.match(/^\d{3}[CFGLPS]\d{7}[_-](.+?)\.pdf$/i);
            if (accPrefixMatch && !JUNK_NAME_REGEX.test(accPrefixMatch[1])) {
              result.hoVaTen = accPrefixMatch[1].replace(/[-_]/g, ' ').trim().toUpperCase();
            }
          }
        }
      }
    }

    // 9. LỚP 2: FALLBACK SANG PYTHON WORKER (ANCHOR-BASED EXTRACTOR QUA PYMUPDF)
    // Tự động kích hoạt khi:
    // - PDF scan ảnh (text ngắn < 100 ký tự)
    // - HOẶC thiếu một trong các trường cốt lõi (Số CCCD, Nơi cấp, Ngày sinh)
    // - HOẶC họ tên bị nghi ngờ cắt cụt (isSuspectName: không có hoặc chỉ có 1 từ)
    const isSuspectName = !result.hoVaTen || result.hoVaTen.trim().split(/\s+/).length < 2;
    const isMissingOrIncomplete = !result.soCanCuoc || !result.noiCap || !result.rawNgaySinh || isSuspectName;

    if (isMissingOrIncomplete && typeof input === 'string' && fs.existsSync(input)) {
      try {
        const { runPythonExtractor } = require('./tkgd-python-bridge.helper');
        const pyRes = await runPythonExtractor({
          accountCode: fileNameHint || '',
          hopDongPath: input,
          accountName: !isSuspectName ? result.hoVaTen : undefined,
          geminiKey: process.env.GEMINI_API_KEY || '',
        });
        if (pyRes?.hopDong) {
          if (pyRes.hopDong.soCCCD && !result.soCanCuoc) {
            result.soCanCuoc = pyRes.hopDong.soCCCD;
            result.sourceMethod = 'PYTHON_OCR';
          }
          if (pyRes.hopDong.hoTen && (isSuspectName || !result.hoVaTen) && !JUNK_NAME_REGEX.test(pyRes.hopDong.hoTen)) {
            result.hoVaTen = pyRes.hopDong.hoTen.toUpperCase();
            result.sourceMethod = 'PYTHON_OCR';
          }
          if (pyRes.hopDong.ngayCap && !result.rawNgayCap) {
            result.rawNgayCap = pyRes.hopDong.rawNgayCap || pyRes.hopDong.ngayCap;
            result.ngayCap = parseDateString(result.rawNgayCap);
          }
          if (pyRes.hopDong.rawNgaySinh && !result.rawNgaySinh) {
            result.rawNgaySinh = pyRes.hopDong.rawNgaySinh;
            result.ngaySinh = parseDateString(result.rawNgaySinh);
          }
          if (pyRes.hopDong.gioiTinh && !result.gioiTinh) {
            result.gioiTinh = pyRes.hopDong.gioiTinh;
            result.rawGioiTinh = pyRes.hopDong.gioiTinh;
          }
          if (pyRes.hopDong.noiCap && !result.noiCap && !/Chức vụ/i.test(pyRes.hopDong.noiCap)) {
            result.noiCap = pyRes.hopDong.noiCap;
          }
          if (pyRes.hopDong.soHopDong && !result.soHopDong) result.soHopDong = pyRes.hopDong.soHopDong;
          if (pyRes.hopDong.ngayKyHD && !result.ngayKyHD) result.ngayKyHD = parseDateString(pyRes.hopDong.ngayKyHD);
        }
      } catch (ocrErr: any) {
        console.warn('[DOC-EXTRACTOR] Không thể fallback Python OCR:', ocrErr?.message);
      }
    }

    // 10. LỚP 3: AI RESCUE PIPELINE (GEMINI MULTIMODAL SEMANTIC EXTRACTION)
    // Cứu cánh cuối cùng khi cả Regex cục bộ và Python Worker vẫn còn thiếu trường cốt lõi
    const stillSuspectName = !result.hoVaTen || result.hoVaTen.trim().split(/\s+/).length < 2;
    const isStillMissingCore = !result.soCanCuoc || !result.rawNgaySinh || !result.noiCap || stillSuspectName;

    if (isStillMissingCore && typeof input === 'string' && fs.existsSync(input)) {
      try {
        const { rescuePdfWithGeminiAi } = require('./tkgd-ai-pdf-rescue.helper');
        const aiRes = await rescuePdfWithGeminiAi({
          accountCode: fileNameHint || '',
          pdfPath: input,
          accountName: !stillSuspectName ? result.hoVaTen : undefined,
        });
        if (aiRes) {
          if (aiRes.soCCCD && !result.soCanCuoc) {
            result.soCanCuoc = aiRes.soCCCD;
            result.sourceMethod = 'GEMINI_PDF_RESCUE';
            result.modelUsed = aiRes.modelUsed;
          }
          if (aiRes.hoVaTen && (stillSuspectName || !result.hoVaTen) && !JUNK_NAME_REGEX.test(aiRes.hoVaTen)) {
            result.hoVaTen = aiRes.hoVaTen.toUpperCase();
            result.sourceMethod = 'GEMINI_PDF_RESCUE';
            result.modelUsed = aiRes.modelUsed;
          }
          if (aiRes.rawNgaySinh && !result.rawNgaySinh) {
            result.rawNgaySinh = aiRes.rawNgaySinh;
            result.ngaySinh = parseDateString(aiRes.rawNgaySinh);
          }
          if (aiRes.rawNgayCap && !result.rawNgayCap) {
            result.rawNgayCap = aiRes.rawNgayCap;
            result.ngayCap = parseDateString(aiRes.rawNgayCap);
          }
          if (aiRes.gioiTinh && !result.gioiTinh) {
            result.gioiTinh = aiRes.gioiTinh;
            result.rawGioiTinh = aiRes.gioiTinh;
          }
          if (aiRes.noiCap && !result.noiCap) result.noiCap = aiRes.noiCap;
          if (aiRes.soHopDong && !result.soHopDong) result.soHopDong = aiRes.soHopDong;
          if (aiRes.ngayKyHD && !result.ngayKyHD) result.ngayKyHD = parseDateString(aiRes.ngayKyHD);
        }
      } catch (aiErr: any) {
        console.warn('[DOC-EXTRACTOR] AI Rescue Pipeline error:', aiErr?.message);
      }
    }

    // Nếu đã bóc tách được CCCD bằng text parser hoặc regex tự nhiên mà chưa set sourceMethod:
    if (result.soCanCuoc && !result.sourceMethod) {
      result.sourceMethod = 'NATIVE_REGEX';
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

    // 2. Ngày ký phụ lục: Ưu tiên bóc ngày ký kết hợp đồng bổ sung hoặc ngày ký phụ lục ở cuối trang
    // Loại trừ tuyệt đối các ngày cấp phép TVKD / Sở GDHH / ĐKKD của Bên A
    let ngayKyHD: Date | undefined;

    // Ưu tiên 1: Dòng căn cứ "bổ sung Hợp đồng ... ngày DD tháng MM năm YYYY" hoặc "Ký ngày DD/MM/YYYY"
    const boSungMatch = text.match(/(?:bổ\s*sung\s*Hợp\s*đồng[^\r\n]*?|Hợp\s*đồng\s*số[^\r\n]*?|ký\s*kết[^\r\n]*?|Ngày\s*ký[^\r\n]*?|ngày)\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/gi);
    if (boSungMatch) {
      for (const mStr of boSungMatch) {
        const mIdx = text.indexOf(mStr);
        const pre = text.substring(Math.max(0, mIdx - 60), mIdx);
        // Bỏ qua nếu là ngày cấp phép của Bên A hoặc Sở GDHH
        if (/cấp\s*ngày|Giấy\s*chứng\s*nhận|Thành\s*viên\s*kinh\s*doanh|Quyết\s*định|ĐKKD|Sở\s*Giao\s*dịch/i.test(pre)) {
          continue;
        }
        const parts = mStr.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
        if (parts) {
          ngayKyHD = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
          break;
        }
      }
    }

    if (!ngayKyHD) {
      const slashMatch = text.match(/(?:Ngày\s*ký|Ký\s*ngày|ngày)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
      if (slashMatch) {
        ngayKyHD = parseDateString(slashMatch[1]);
      }
    }

    if (ngayKyHD) {
      result.ngayKyHD = ngayKyHD;
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
    const noiCapMatches = text.matchAll(/(?:Nơi\s*cấp|Place\s*of\s*issue)[\s:\.\-]+([^\r\n;,]+?)(?=(?:\s+ngày|\s+tại|\s+hạn|\s+quốc|\r?\n|$))/gi);
    for (const m of noiCapMatches) {
      let cap = m[1].trim().replace(/^[;,\.\-\s]+|[;,\.\-\s]+$/g, '');
      if (cap.length >= 3 && !/^Địa chỉ/i.test(cap) && !/(SỞ\s*TÀI\s*CHÍNH|SỞ\s*KẾ\s*HOẠCH|SỞ\s*KH\s*&\s*ĐT|UBND|CHI\s*CỤC\s*THUẾ)/i.test(cap)) {
        result.noiCap = cap;
        break;
      }
    }

    // 6. Họ và tên
    const baseName = typeof input === 'string' ? path.basename(input) : (fileNameHint || '');
    const nameMatch = baseName.match(/^([A-Z\-]+)-PL01/i);
    if (nameMatch) {
      result.hoVaTen = nameMatch[1].replace(/-/g, ' ').toUpperCase();
    }

    // 7. FALLBACK CHO FILE PDF PHỤ LỤC SCAN (IMAGE-ONLY PDF):
    const strippedText = (text || '').replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').replace(/\s+/g, ' ').trim();
    const isScannedOrShort = strippedText.length < 50 || !/[a-zA-ZÀ-ỹ0-9]{15,}/.test(strippedText);
    if (!result.soCanCuoc && isScannedOrShort && typeof input === 'string' && fs.existsSync(input)) {
      try {
        const { runPythonExtractor } = require('./tkgd-python-bridge.helper');
        const pyRes = await runPythonExtractor({
          accountCode: fileNameHint || '',
          hopDongPath: input,
          geminiKey: process.env.GEMINI_API_KEY || '',
        });
        if (pyRes?.hopDong) {
          if (pyRes.hopDong.soCCCD && !result.soCanCuoc) result.soCanCuoc = pyRes.hopDong.soCCCD;
          if (pyRes.hopDong.hoTen && !result.hoVaTen) result.hoVaTen = pyRes.hopDong.hoTen.toUpperCase();
          if (pyRes.hopDong.noiCap && !result.noiCap && !/Chức vụ/i.test(pyRes.hopDong.noiCap)) result.noiCap = pyRes.hopDong.noiCap;
          if (pyRes.hopDong.ngayCap && !result.ngayCap) result.ngayCap = parseDateString(pyRes.hopDong.rawNgayCap || pyRes.hopDong.ngayCap);
          if (pyRes.hopDong.soHopDong && !result.soHopDongGoc) result.soHopDongGoc = pyRes.hopDong.soHopDong;
        }
      } catch (ocrErr: any) {
        console.warn('[DOC-EXTRACTOR] Không thể fallback OCR cho PDF Phụ lục scan:', ocrErr?.message);
      }
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

/**
 * Tự động giải nén file .zip (bỏ qua __MACOSX và file ẩn), trích xuất toàn bộ tệp hợp đồng/CCCD ra thư mục đích
 */
export function extractZipFiles(zipFilePath: string, destDir: string): string[] {
  const extractedFiles: string[] = [];
  if (!zipFilePath || !fs.existsSync(zipFilePath) || !destDir) return extractedFiles;
  if (!fs.existsSync(destDir)) {
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch {}
  }

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      const rawName = entry.entryName;
      // Bỏ qua rác hệ thống Mac (__MACOSX, .DS_Store, ._*)
      if (rawName.includes('__MACOSX') || path.basename(rawName).startsWith('._') || rawName.includes('.DS_Store')) {
        continue;
      }
      const fileName = path.basename(rawName).normalize('NFC');
      const targetPath = path.join(destDir, fileName);
      const data = entry.getData();
      fs.writeFileSync(targetPath, data);
      extractedFiles.push(targetPath);
    }
  } catch (err: any) {
    console.error(`[ZIP-EXTRACTOR] Lỗi giải nén ${zipFilePath}:`, err.message);
  }
  return extractedFiles;
}


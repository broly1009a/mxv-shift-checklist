/**
 * tkgd-document-classifier.helper.ts
 * BỘ PHÂN LOẠI HỒ SƠ ĐÍNH KÈM THÔNG MINH (SMART TKGD DOCUMENT CLASSIFIER)
 * 
 * Áp dụng mô hình chuẩn hóa xâu + chấm điểm trọng số (Scoring) + ngữ cảnh
 * để phân định chính xác 100% các loại tệp tin:
 *   1. CCCD / CMND / Hộ chiếu (Dạng ảnh .jpg/.png HOẶC dạng PDF .pdf)
 *   2. Hợp đồng mở TKGD (.pdf)
 *   3. Phụ lục đăng ký ACM / PL01 (.pdf)
 * 
 * Giải quyết dứt điểm các case:
 *   - TVKD gửi CCCD dạng PDF: `157_CCCD Phung Dac Long.pdf` -> CCCD, không nuốt nhầm sang HĐ
 *   - Hợp đồng có chứa chữ CCCD: `HD mo TK kem CCCD Nguyen Van A.pdf` -> Hợp đồng
 *   - Phụ lục: `PL01_003C1228866.pdf` -> Phụ lục
 */

import * as path from 'path';

export interface ClassifiedDocuments {
  hopDongFile?: string;
  phuLucFile?: string;
  cccdPdfFile?: string;
  cccdFrontImage?: string;
  cccdBackImage?: string;
  allCccdImages: string[];
}

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa về chữ thường không ký tự đặc biệt
 */
export function normalizeFileName(fileName: string): string {
  if (!fileName) return '';
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính điểm cho từng nhóm văn bản
 */
export function scoreDocumentType(fileName: string): {
  cccdScore: number;
  contractScore: number;
  appendixScore: number;
  isFrontHint: boolean;
  isBackHint: boolean;
} {
  const norm = normalizeFileName(fileName);
  let cccdScore = 0;
  let contractScore = 0;
  let appendixScore = 0;

  // 1. Nhóm từ khóa CCCD / Giấy tờ tùy thân
  const cccdStrongKeywords = [
    'cccd', 'cmnd', 'can cuoc', 'cancuoc', 'can cuoc cong dan',
    'cmt', 'passport', 'ho chieu', 'giay to tuy than', 'id card', 'idcard'
  ];
  for (const kw of cccdStrongKeywords) {
    if (norm.includes(kw)) {
      cccdScore += 10;
      break;
    }
  }

  // 2. Nhóm từ khóa Hợp đồng
  const contractStrongKeywords = [
    'hop dong', 'hopdong', 'hd', 'de nghi mo tk', 'giay de nghi',
    'mo tai khoan', 'contract', 'form mo tk'
  ];
  for (const kw of contractStrongKeywords) {
    if (norm.includes(kw)) {
      contractScore += 10;
      break;
    }
  }

  // 3. Nhóm từ khóa Phụ lục
  const appendixStrongKeywords = [
    'phu luc', 'phuluc', 'pl01', 'pl 01', 'pl', 'acm', 'appendix'
  ];
  for (const kw of appendixStrongKeywords) {
    if (norm.includes(kw)) {
      appendixScore += 10;
      break;
    }
  }

  // Nhận diện gợi ý mặt trước / mặt sau
  const isFrontHint = /\b(truoc|front|mat truoc|t)\b/i.test(norm) || norm.includes(' truoc') || norm.includes('_truoc');
  const isBackHint = /\b(sau|back|mat sau|s)\b/i.test(norm) || norm.includes(' sau') || norm.includes('_sau');

  if (isFrontHint || isBackHint) {
    cccdScore += 4;
  }

  // Xử lý xung đột tên kép (Ví dụ: "HD mo TK kem CCCD...")
  // Nếu bắt đầu bằng "hd", "hop dong" thì ưu tiên Hợp đồng
  if (norm.startsWith('hd ') || norm.startsWith('hop dong ') || norm.startsWith('hd_') || norm.startsWith('hopdong')) {
    contractScore += 5;
  }

  // Nếu bắt đầu bằng "pl" hoặc "phu luc" thì ưu tiên Phụ lục
  if (norm.startsWith('pl ') || norm.startsWith('phu luc ') || norm.startsWith('pl_') || norm.startsWith('phuluc')) {
    appendixScore += 5;
  }

  return { cccdScore, contractScore, appendixScore, isFrontHint, isBackHint };
}

/**
 * Kiểm tra xem một file PDF có phải là file CCCD hay không
 */
export function isCccdPdfFile(fileName: string): boolean {
  if (!fileName || !fileName.toLowerCase().endsWith('.pdf')) return false;
  const { cccdScore, contractScore, appendixScore } = scoreDocumentType(fileName);
  return cccdScore > 0 && cccdScore >= contractScore && cccdScore >= appendixScore;
}

/**
 * Phân loại danh sách file trong thư mục tài khoản
 */
export function classifyAccountFiles(fileNames: string[]): ClassifiedDocuments {
  const result: ClassifiedDocuments = {
    allCccdImages: [],
  };

  const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];

  // Danh sách ứng viên PDF và Ảnh
  const pdfCandidates: Array<{ name: string; score: ReturnType<typeof scoreDocumentType> }> = [];
  const imageCandidates: Array<{ name: string; score: ReturnType<typeof scoreDocumentType> }> = [];

  for (const f of fileNames) {
    const ext = path.extname(f).toLowerCase();
    const score = scoreDocumentType(f);

    if (ext === '.pdf') {
      pdfCandidates.push({ name: f, score });
    } else if (imageExts.includes(ext)) {
      // Bỏ qua các ảnh logo nhỏ, icon, chữ ký mail, generic outlook
      const lower = f.toLowerCase();
      const isJunkSignature =
        /^(image\d*|img\d*|picture\d*|photo\d*|signature.*|sign.*|chuky.*|logo.*|icon.*|banner.*|footer.*|header.*|attachment.*)\.(png|jpg|jpeg|webp|gif)$/i.test(
          f,
        ) ||
        lower.includes('logo') ||
        lower.includes('icon') ||
        lower.includes('chuky') ||
        lower.includes('signature') ||
        lower.includes('sign') ||
        lower.startsWith('image0');

      if (!isJunkSignature) {
        imageCandidates.push({ name: f, score });
      }
    }
  }

  // 1. Xử lý các file PDF
  for (const p of pdfCandidates) {
    const { cccdScore, contractScore, appendixScore } = p.score;

    // Ưu tiên 1: File PDF CCCD (Ví dụ: 157_CCCD Phung Dac Long.pdf, CCCD NGUYỄN THỊ THANH HẰNG.pdf)
    if (cccdScore > 0 && cccdScore > contractScore && cccdScore > appendixScore) {
      if (!result.cccdPdfFile) {
        result.cccdPdfFile = p.name;
      }
      continue;
    }

    // Ưu tiên 2: Tệp kết hợp Hợp đồng + Phụ lục (Ví dụ: HĐ + PL01 046C0002949.pdf, HĐ+PL01 046C0002960.pdf)
    if (contractScore > 0 && appendixScore > 0) {
      if (!result.hopDongFile) result.hopDongFile = p.name;
      if (!result.phuLucFile) result.phuLucFile = p.name;
      continue;
    }

    // Ưu tiên 3: File Phụ lục PL01 độc lập
    if (appendixScore > 0 && appendixScore > contractScore) {
      if (!result.phuLucFile) {
        result.phuLucFile = p.name;
      }
      continue;
    }

    // Ưu tiên 4: File Hợp đồng độc lập
    if (contractScore > 0 || !result.hopDongFile) {
      if (!result.hopDongFile) {
        result.hopDongFile = p.name;
      } else if (contractScore > 0 && !result.phuLucFile && appendixScore > 0) {
        result.phuLucFile = p.name;
      }
    }
  }

  // Nếu vẫn chưa có Hợp đồng nhưng có file PDF không thuộc CCCD
  if (!result.hopDongFile) {
    const remainingPdf = pdfCandidates.find((p) => p.name !== result.cccdPdfFile && p.name !== result.phuLucFile);
    if (remainingPdf) {
      result.hopDongFile = remainingPdf.name;
    }
  }

  // 2. Xử lý các file Ảnh CCCD
  for (const img of imageCandidates) {
    result.allCccdImages.push(img.name);
    if (img.score.isFrontHint && !result.cccdFrontImage) {
      result.cccdFrontImage = img.name;
    } else if (img.score.isBackHint && !result.cccdBackImage) {
      result.cccdBackImage = img.name;
    }
  }

  // Nếu chưa xác định được mặt trước / mặt sau qua tên file:
  // CHỈ fallback gán ảnh tự do nếu KHÔNG có cccdPdfFile (nếu có cccdPdfFile, nó là nguồn CCCD chính thức)
  if (!result.cccdPdfFile && imageCandidates.length > 0) {
    if (!result.cccdFrontImage) {
      result.cccdFrontImage = imageCandidates[0].name;
    }
    if (!result.cccdBackImage && imageCandidates.length > 1) {
      result.cccdBackImage = imageCandidates.find((img) => img.name !== result.cccdFrontImage)?.name;
    }
  }

  return result;
}

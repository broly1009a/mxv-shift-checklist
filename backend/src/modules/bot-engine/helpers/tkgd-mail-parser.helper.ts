/**
 * Helper bóc tách dữ liệu email yêu cầu mở TKGD
 * Tương thích 100% với form thực tế của TVKD 003 (Gia Cát Lợi) và các TVKD chuẩn tại MXV
 * Hỗ trợ chuẩn xác 4 phân hệ tài khoản: Futures, ACM (-A), LME (-L), Spread (-S)
 */

import * as fs from 'fs';

export type TkgdAccountType = 'FUTURES' | 'ACM' | 'LME' | 'SPREAD';

export interface ParsedEmailInfo {
  maTKGDFutures: string | null;
  maTKGDACM: string | null;
  maTKGDLME: string | null;
  maTKGDSpread: string | null;
  tenTK: string | null;
  maTVKD: string | null;
  hasACMRequest: boolean;
  hasLMERequest: boolean;
  hasSpreadRequest: boolean;
  hasPL01Mention: boolean;
  allAccountCodes: Array<{
    code: string;
    baseCode: string;
    type: TkgdAccountType;
  }>;
}

export function detectAccountType(code: string): TkgdAccountType {
  const clean = (code || '').toUpperCase().trim();
  if (clean.endsWith('-A')) return 'ACM';
  if (clean.endsWith('-L')) return 'LME';
  if (clean.endsWith('-S')) return 'SPREAD';
  return 'FUTURES';
}

export function extractBaseAccountCode(code: string): string {
  const clean = (code || '').toUpperCase().trim();
  return clean.replace(/-[ALS]$/i, '');
}

/** Ảnh/PDF hợp đồng — không được gán vào slot CCCD mặt trước/sau */
export function isNamedContractImage(fileName?: string): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase().trim();
  // Prefix HD / HĐ (kể cả Unicode)
  if (/^(hd|hđ|hợp)([_\s.\-]|$)/i.test(n)) return true;
  if (/^(hop[\s_-]*dong|hopdong|contract)([_\s.\-]|$)/i.test(n)) return true;
  if (/\b(hop[\s_-]*dong|hopdong|hợp[\s_-]*đồng|hop\s*dong|contract)\b/i.test(n)) return true;
  if (/hợp\s*đồng|hop\s*dong/i.test(n)) return true;
  if (/(^|[_\s\-])hd[_\s\-]/i.test(n) && !/cccd|cmnd/i.test(n)) return true;
  if (n.includes('mxv') && /\.(pdf|jpe?g|png|webp)$/i.test(n) && !/cccd/i.test(n)) return true;
  return false;
}

export function classifyAttachmentType(
  filename: string,
): 'hop_dong' | 'pl01' | 'pl_lme' | 'pl_spread' | 'cccd_truoc' | 'cccd_sau' | 'other' {
  const fn = filename.toLowerCase();
  if (fn.endsWith('-pl01.pdf') || fn.includes('pl01')) {
    return 'pl01';
  }
  if (fn.includes('lme') && fn.endsWith('.pdf')) {
    return 'pl_lme';
  }
  if (fn.includes('spread') && fn.endsWith('.pdf')) {
    return 'pl_spread';
  }
  if (isNamedContractImage(fn) || fn.endsWith('-mxv.pdf') || (fn.includes('hop') && fn.endsWith('.pdf'))) {
    return 'hop_dong';
  }
  if (fn.includes('truoc') || fn.includes('front') || fn.includes('mat-truoc')) {
    return 'cccd_truoc';
  }
  if (fn.includes('sau') || fn.includes('back') || fn.includes('mat-sau')) {
    return 'cccd_sau';
  }
  // Ảnh tên CCCD không ghi trước/sau → coi như mặt trước (thường là scan 2 mặt ghép)
  if (/\bcccd\b|\bcmnd\b|\bcmt\b|\bcan\s*cuoc\b|\bcăn\s*cước\b/i.test(fn)) {
    return 'cccd_truoc';
  }
  return 'other';
}

/** Tên rõ ràng là CCCD mặt trước (không dùng image001 — hay là logo Outlook) */
export function isNamedCccdFront(fileName?: string): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    /(^|[^a-z0-9])(truoc|front|mat[_-\s]?1|mattruoc)([^a-z0-9]|$)/i.test(n) ||
    n.includes('mặt trước') ||
    (n.includes('cccd') && /(truoc|front|(^|[^a-z0-9])mt([^a-z0-9]|$))/i.test(n)) ||
    /^mt[_\-.\s]/i.test(n) ||
    n.startsWith('mt.') ||
    /(^|[_\-\s])mt\.(jpe?g|png|webp)$/i.test(n)
  );
}

/** Tên rõ ràng là CCCD mặt sau */
export function isNamedCccdBack(fileName?: string): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    /(^|[^a-z0-9])(sau|back|mat[_-\s]?2|matsau)([^a-z0-9]|$)/i.test(n) ||
    n.includes('mặt sau') ||
    (n.includes('cccd') && /(sau|back|(^|[^a-z0-9])ms([^a-z0-9]|$))/i.test(n)) ||
    /^ms[_\-.\s]/i.test(n) ||
    n.startsWith('ms.') ||
    /(^|[_\-\s])ms\.(jpe?g|png|webp)$/i.test(n)
  );
}

export function isNamedCccdImage(fileName?: string): boolean {
  if (!fileName) return false;
  const n = fileName.toLowerCase();
  return (
    isNamedCccdFront(n) ||
    isNamedCccdBack(n) ||
    /cccd|cmnd|(^|[^a-z0-9])cmt([^a-z0-9]|$)|can\s*cuoc|căn\s*cước/i.test(n)
  );
}

import { isCccdPdfFile } from './tkgd-document-classifier.helper';

export function isNamedCccdPdf(fileName?: string): boolean {
  if (!fileName) return false;
  return isCccdPdfFile(fileName);
}

function isGenericOutlookImageName(lower: string): boolean {
  return (
    lower === 'image.png' ||
    lower === 'image.jpg' ||
    lower === 'image.jpeg' ||
    lower === 'image.gif' ||
    /^image\d+\.(png|jpe?g|gif|webp)$/i.test(lower) ||
    lower.startsWith('image0') ||
    /^img[_-]?\d+\.(png|jpe?g|gif|webp)$/i.test(lower) ||
    /^picture\d*\.(png|jpe?g|gif|webp)$/i.test(lower) ||
    /^photo\d*\.(png|jpe?g|gif|webp)$/i.test(lower) ||
    /^t[aả]i\s*xu[oố]ng.*\.(png|jpe?g|webp)$/i.test(lower)
  );
}

/** Tên hash kiểu e0b6f9cd.png — thường là logo/cid inline trong mail */
export function isHashNamedImage(fileName?: string): boolean {
  if (!fileName) return false;
  return /^[a-f0-9]{6,20}\.(png|jpe?g|gif|webp)$/i.test(fileName.trim());
}

/**
 * Logo/cid inline: tên hash hoặc ảnh không tên CCCD mà quá nhỏ để là thẻ thật.
 * Case 076C3131313: e0b6f9cd.png (397x275) logo Sai Gon Commodity.
 */
export function isLikelyEmailLogoImage(
  fileName?: string,
  size?: number,
  dims?: { width: number; height: number } | null,
): boolean {
  if (!fileName) return true;
  if (isNamedCccdImage(fileName) || isNamedContractImage(fileName)) return false;
  if (isDecorativeOrLogoAttachment(fileName)) return true;
  if (isHashNamedImage(fileName)) return true;

  const lower = fileName.toLowerCase();
  if (!/\.(png|jpe?g|gif|webp)$/i.test(lower)) return false;

  if (dims?.width && dims?.height) {
    const minSide = Math.min(dims.width, dims.height);
    const maxSide = Math.max(dims.width, dims.height);
    // Thẻ CCCD scan thường >= ~500px cạnh ngắn; logo mail hay < 400
    if (minSide < 400 || maxSide < 520) return true;
  } else if (size !== undefined && size < 55_000) {
    return true;
  }
  return false;
}

/** Logo / banner / chữ ký / icon social / watermark TVKD */
export function isDecorativeOrLogoAttachment(fileName?: string): boolean {
  if (!fileName) return true;
  const lower = fileName.trim().toLowerCase();
  if (lower === 'thumbs.db' || lower === 'desktop.ini') return true;

  const junkNamePatterns = [
    /^logo/i,
    /[-_\s]logo/i,
    /logo[-_\s]/i,
    /mxv[-_\s]?logo/i,
    /company[-_\s]?logo/i,
    /^banner/i,
    /[-_\s]banner/i,
    /^footer/i,
    /^header/i,
    /signature/i,
    /ch[uữ][\s_-]*k[yý]/i,
    /^outlook[-_]/i,
    /^icon/i,
    /[-_\s]icon/i,
    /favicon/i,
    /spacer|pixel|tracking|beacon/i,
    /firetext|mailchimp|sendgrid|fireant/i,
    /@2x\.(png|jpe?g|webp)$/i,
    /horizontal@/i,
    /facebook|linkedin|youtube|zalo|telegram|whatsapp|instagram|twitter/i,
    /social[-_\s]?media/i,
    /btn_|button_|cta_/i,
    /watermark|qr[-_\s]?code[-_\s]?only/i,
    /^cid[-_]/i,
    /untitled\s*diagram/i,
  ];
  return junkNamePatterns.some((p) => p.test(lower));
}

/**
 * Đọc width/height từ header PNG/JPEG/WEBP (không cần sharp).
 */
export function probeImageDimensions(
  input: string | Buffer,
): { width: number; height: number } | null {
  try {
    const buf = typeof input === 'string' ? fs.readFileSync(input) : input;
    if (!buf || buf.length < 24) return null;

    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }

    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        const size = buf.readUInt16BE(offset + 2);
        // SOF0 / SOF2
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        offset += 2 + size;
      }
    }

    // WEBP RIFF
    if (
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8 ' && buf.length >= 30) {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
      if (chunk === 'VP8X' && buf.length >= 30) {
        const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
        const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * CCCD chuẩn ~1.586. Chấp nhận scan 2 mặt / nghiêng trong khoảng rộng hơn.
 * Banner/logo thường ratio >= 2.8 hoặc rất nhỏ.
 */
export function isLikelyCccdAspect(width?: number, height?: number): boolean {
  if (!width || !height || width < 1 || height < 1) return false;
  const ratio = Math.max(width, height) / Math.min(width, height);
  // Banner ngang dài / thanh chữ ký (scan 2 mặt ghép ~2.8–3.4 vẫn chấp nhận ở tầng named)
  if (ratio >= 2.75) return false;
  // Quá nhỏ để đọc chữ CCCD
  if (Math.min(width, height) < 220) return false;
  if (Math.max(width, height) < 320) return false;
  return true;
}

/** Tỉ lệ thẻ đơn hoặc scan 2 mặt nằm ngang (composite) */
export function isLikelyCccdOrCompositeAspect(width?: number, height?: number): boolean {
  if (!width || !height || width < 1 || height < 1) return false;
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio >= 3.6) return false; // banner quá dài
  if (Math.min(width, height) < 220) return false;
  if (Math.max(width, height) < 320) return false;
  return true;
}

export function scoreCccdImageCandidate(opts: {
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
}): number {
  const { fileName, size, width, height } = opts;
  if (isDecorativeOrLogoAttachment(fileName)) return -1000;
  if (isNamedContractImage(fileName)) return -1000;
  if (
    isLikelyEmailLogoImage(fileName, size, width && height ? { width, height } : null)
  ) {
    return -1000;
  }
  let score = 0;
  if (isNamedCccdImage(fileName)) score += 80;
  if (isNamedCccdFront(fileName) || isNamedCccdBack(fileName)) score += 40;
  if (size !== undefined) {
    if (size < 20_000) score -= 50;
    else if (size < 40_000) score -= 10;
    else if (size >= 80_000) score += 20;
    else score += 8;
  }
  if (width && height) {
    const named = isNamedCccdImage(fileName);
    const aspectOk = named
      ? isLikelyCccdOrCompositeAspect(width, height)
      : isLikelyCccdAspect(width, height);
    if (!aspectOk) score -= 80;
    else {
      score += 30;
      const ratio = Math.max(width, height) / Math.min(width, height);
      // Gần tỉ lệ thẻ CCCD đơn
      if (ratio >= 1.35 && ratio <= 1.85) score += 25;
      // Scan 2 mặt ghép ngang
      if (named && ratio > 1.85 && ratio <= 3.5) score += 15;
    }
  } else if (isGenericOutlookImageName((fileName || '').toLowerCase())) {
    // Chưa có kích thước: generic Outlook rất dễ là logo → phạt nhẹ
    score -= 15;
  }
  return score;
}

/**
 * Bỏ qua logo / banner / icon chữ ký / ảnh Outlook không phải hồ sơ.
 * Có thể truyền width/height nếu đã probe được file.
 */
export function isIgnoredEmailAttachment(
  fileName?: string,
  size?: number,
  dims?: { width: number; height: number } | null,
): boolean {
  if (!fileName) return true;
  const lower = fileName.trim().toLowerCase();
  if (lower === 'thumbs.db' || lower === 'desktop.ini') return true;
  if (isDecorativeOrLogoAttachment(lower)) return true;
  if (isLikelyEmailLogoImage(fileName, size, dims)) return true;

  // Hợp đồng (kể cả .jpg) — không bỏ qua file, nhưng không dùng làm CCCD (xử lý ở pick/manifest)
  // Ảnh đã đặt tên CCCD rõ → giữ (kể cả scan 2 mặt ghép rộng hơn thẻ đơn)
  if (isNamedCccdImage(lower)) {
    if (
      dims &&
      !isLikelyCccdOrCompositeAspect(dims.width, dims.height) &&
      (size || 0) < 30_000
    ) {
      return true;
    }
    return false;
  }

  const isImage =
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(lower) || isGenericOutlookImageName(lower);
  if (!isImage) return false;

  if (dims && !isLikelyCccdAspect(dims.width, dims.height)) {
    return true;
  }

  // Generic Outlook image001/image.png: trước đây >=25KB vẫn giữ → nhiều logo lọt
  if (isGenericOutlookImageName(lower)) {
    if (size === undefined) return true; // không rõ size → an toàn bỏ
    if (size < 45_000) return true;
    // >=45KB nhưng đã có dims xấu → bỏ ở trên; không dims thì tạm giữ để probe sau
    return false;
  }

  // Ảnh khác tên lạ nhưng quá nhỏ
  if (size !== undefined && size < 18_000) return true;

  return false;
}

/**
 * Chọn tối đa 2 ảnh CCCD (mặt trước/sau) từ danh sách ứng viên đã lưu ra disk.
 * - Không lấy ảnh HĐ/contract làm mặt sau (case 001C0120575: CCCD 2 mặt ghép + HD.jpg).
 * - Chỉ 1 ảnh tên CCCD (composite) → front only, không bịa back.
 */
export function pickCccdImagePaths(
  candidates: Array<{ name: string; filePath: string; size?: number }>,
): { frontPath?: string; backPath?: string; isCompositeFront?: boolean } {
  const scored = candidates
    .map((c) => {
      if (isNamedContractImage(c.name)) return null;
      const dims = probeImageDimensions(c.filePath);
      if (isIgnoredEmailAttachment(c.name, c.size, dims)) {
        return null;
      }
      const score = scoreCccdImageCandidate({
        fileName: c.name,
        size: c.size,
        width: dims?.width,
        height: dims?.height,
      });
      return { ...c, dims, score };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.score >= 0)
    .sort((a, b) => b.score - a.score);

  let frontPath: string | undefined;
  let backPath: string | undefined;

  for (const c of scored) {
    if (!frontPath && isNamedCccdFront(c.name)) {
      frontPath = c.filePath;
      continue;
    }
    if (!backPath && isNamedCccdBack(c.name)) {
      backPath = c.filePath;
      continue;
    }
  }

  // Ảnh tên CCCD chung (không trước/sau) — ưu tiên làm mặt trước; ảnh CCCD thứ 2 → mặt sau
  for (const c of scored) {
    if (frontPath && backPath) break;
    if (!isNamedCccdImage(c.name)) continue;
    if (!frontPath && c.filePath !== backPath) {
      frontPath = c.filePath;
      continue;
    }
    // Ảnh CCCD đặt tên riêng thứ 2 (vd: "CCCD A.jpg" + "CCCD A 1.jpg") → back
    if (!backPath && c.filePath !== frontPath) {
      backPath = c.filePath;
    }
  }

  // Fallback cuối: CHỈ nhận ảnh không tên nếu đủ lớn / gần tỉ lệ thẻ — không nhận logo hash
  for (const c of scored) {
    if (frontPath) break;
    if (c.filePath === backPath) continue;
    if (isNamedContractImage(c.name)) continue;
    if (isLikelyEmailLogoImage(c.name, c.size, c.dims)) continue;
    if ((c.score || 0) < 80) continue; // yêu cầu tín hiệu mạnh (tỉ lệ + size)
    frontPath = c.filePath;
  }

  const frontName = scored.find((c) => c.filePath === frontPath)?.name || '';
  const backName = scored.find((c) => c.filePath === backPath)?.name || '';
  const isCompositeFront =
    !!frontPath &&
    !backPath &&
    isNamedCccdImage(frontName) &&
    !isNamedCccdFront(frontName) &&
    !isNamedCccdBack(frontName);

  // Không bao giờ để back là HĐ (phòng thủ)
  if (backPath && isNamedContractImage(backName)) {
    backPath = undefined;
  }

  return { frontPath, backPath, isCompositeFront };
}

export function normalizeVietnameseName(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

export function parseAccountOpeningEmailBody(bodyContent: string): ParsedEmailInfo {
  let text = bodyContent || '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = htmlToPlainText(text);
  }

  // 1. Mã TK Futures: 3 số + 1 chữ cái + 7 số (không có hậu tố -)
  let maTKGDFutures: string | null = null;
  const mFuturesSection = text.match(/Tài khoản giao dịch Futures[^\n]*\n.*?Mã TKGD\s*:\s*([0-9]{3}[A-Z][0-9]{7})\b(?!\s*-[ALS])/is);
  if (mFuturesSection) {
    maTKGDFutures = mFuturesSection[1].trim();
  } else {
    const mFuturesGeneral = text.match(/Mã TKGD\s*:\s*([0-9]{3}[A-Z][0-9]{7})\b(?!\s*-[ALS])/i);
    if (mFuturesGeneral) {
      maTKGDFutures = mFuturesGeneral[1].trim();
    }
  }

  // 2. Mã TK ACM: 3 số + 1 chữ cái + 7 số + -A
  let maTKGDACM: string | null = null;
  const mACM = text.match(/Mã TKGD\s*:\s*([0-9]{3}[A-Z][0-9]{7}-A)\b/i);
  if (mACM) {
    maTKGDACM = mACM[1].trim();
  }

  // 3. Mã TK LME: 3 số + 1 chữ cái + 7 số + -L
  let maTKGDLME: string | null = null;
  const mLME = text.match(/Mã TKGD\s*:\s*([0-9]{3}[A-Z][0-9]{7}-L)\b/i);
  if (mLME) {
    maTKGDLME = mLME[1].trim();
  }

  // 4. Mã TK Spread: 3 số + 1 chữ cái + 7 số + -S
  let maTKGDSpread: string | null = null;
  const mSpread = text.match(/Mã TKGD\s*:\s*([0-9]{3}[A-Z][0-9]{7}-S)\b/i);
  if (mSpread) {
    maTKGDSpread = mSpread[1].trim();
  }

  // 5. Tên tài khoản
  let tenTK: string | null = null;
  const mTen = text.match(/Tên tài khoản\s*:\s*([^\r\n\t]+?)(?=\s*(?:\r?\n|TVKD|Tài khoản|Mã TKGD|Bản scan|Phụ lục|Chi tiết|2\.|\.|$))/i);
  if (mTen) {
    const clean = cleanPersonName(mTen[1]);
    tenTK = clean || null;
  }

  // 6. Mã TVKD từ 3 ký tự đầu
  const baseSample = maTKGDFutures || maTKGDACM || maTKGDLME || maTKGDSpread;
  const maTVKD = baseSample ? baseSample.substring(0, 3) : null;

  // 7. Cờ phân hệ
  const hasACMRequest = /Ti[eê]u kho[aả]n ACM|ACM.*?TKGD/i.test(text) || maTKGDACM !== null;
  const hasLMERequest = /Ti[eê]u kho[aả]n LME|LME.*?TKGD/i.test(text) || maTKGDLME !== null;
  const hasSpreadRequest = /Ti[eê]u kho[aả]n Spread|Spread.*?TKGD/i.test(text) || maTKGDSpread !== null;
  const hasPL01Mention = /Ph[uụ] l[uụ]c\s*(s[oố]\s*01|01)|PL[\s-]?01/i.test(text);

  // 8. Tập hợp tất cả các mã phát hiện được
  const allAccountCodes: Array<{ code: string; baseCode: string; type: TkgdAccountType }> = [];
  if (maTKGDFutures) {
    allAccountCodes.push({ code: maTKGDFutures, baseCode: maTKGDFutures, type: 'FUTURES' });
  }
  if (maTKGDACM) {
    allAccountCodes.push({ code: maTKGDACM, baseCode: extractBaseAccountCode(maTKGDACM), type: 'ACM' });
  }
  if (maTKGDLME) {
    allAccountCodes.push({ code: maTKGDLME, baseCode: extractBaseAccountCode(maTKGDLME), type: 'LME' });
  }
  if (maTKGDSpread) {
    allAccountCodes.push({ code: maTKGDSpread, baseCode: extractBaseAccountCode(maTKGDSpread), type: 'SPREAD' });
  }

  return {
    maTKGDFutures,
    maTKGDACM,
    maTKGDLME,
    maTKGDSpread,
    tenTK,
    maTVKD,
    hasACMRequest,
    hasLMERequest,
    hasSpreadRequest,
    hasPL01Mention,
    allAccountCodes,
  };
}

export const parseTkgdEmailBody = parseAccountOpeningEmailBody;

export interface ParsedAccountGroup extends ParsedEmailInfo {
  maTKGDBase: string;
  tenTaiKhoan: string;
}

export function isLikelyValidPersonName(name?: string): boolean {
  if (!name) return false;
  const s = name.trim();
  if (s.length < 3) return false;

  // Đếm số lượng ký tự chữ cái (bao gồm cả tiếng Việt có dấu)
  const letters = s.match(/[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/g);
  if (!letters || letters.length < 3) return false;

  // Danh mục từ khóa rác / hệ thống / loại tài khoản / câu chào / OCR PDF hỏng
  const junkPatterns = [
    /^(ACM|LME|SPREAD|FUTURES|TIỂU KHOẢN|TÀI KHOẢN|SUB\s*ACCOUNT)$/i,
    /^(HỢP ĐỒNG|HĐ|PHỤ LỤC|PL01|PL|CCCD|CMND|PASSPORT|HỘ CHIẾU)$/i,
    /^(KÍNH GỬI|BẢN SCAN|FILE ĐÍNH KÈM|THÔNG BÁO|YÊU CẦU|KÍNH CHÀO|DEAR|GỬI|XIN CHÀO)$/i,
    /^(MXV|TVKD|SỞ GIAO DỊCH|CÔNG TY|CHI NHÁNH)$/i,
    /^(MỞ TÀI KHOẢN|KÍCH HOẠT|ĐĂNG KÝ|ĐỐI CHIẾU)$/i,
    /để\s*thực\s*hiện/i,
    /được\s*quét|cam\s*scanner|camscanner/i,
    /^(lối|loi|error|null|undefined|n\/a|none)$/i,
    /mã\s*tiểu\s*khoản|mở\s*tài\s*khoản\s*tkgd/i,
    /^[0-9A-Z]{3,4}[0-9]{7}/i, // chuỗi trông giống mã tài khoản
    /^[-:\s/\\.,|]+$/,
  ];

  for (const pattern of junkPatterns) {
    if (pattern.test(s)) return false;
  }

  // Nếu chuỗi bắt đầu bằng từ khóa văn phòng phẩm / kính gửi
  if (/^(kính gửi|bản scan|yêu cầu mở|thông báo mở|hồ sơ đính kèm)/i.test(s)) return false;

  return true;
}

export function cleanPersonName(name?: string): string {
  if (!name) return '';
  let s = name.split(/[\r\n]/)[0].trim();
  // Loại bỏ các đoạn văn bản thừa theo sau
  s = s.replace(/\s+(TVKD|đã đính kèm|đề nghị|cam kết|kính gửi|Bản scan|HĐ|CCCD|CMND)[\s\S]*$/i, '').trim();
  s = s.replace(/^[ -:\t/|]+/, '').replace(/[;,.\-:\t/|]+$/, '').trim();

  // Bỏ các hậu tố rác phân hệ kiểu "- ACM", "- A", "(ACM)" nếu lọt vào sau tên
  s = s.replace(/\s*[-–]\s*[ALS]\b/i, '').replace(/\s*\((ACM|LME|SPREAD)\)/i, '').trim();

  if (!isLikelyValidPersonName(s)) {
    return '';
  }
  return s;
}

/** Chuẩn hóa tên để so sánh: bỏ dấu, khoảng trắng, ký tự đặc biệt */
export function normalizePersonNameKey(name?: string): string {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * So khớp họ tên chịu lỗi OCR:
 * - THUANK ≈ THUAN (lệch 1 ký tự)
 * - NMDANG THI NGOC DIEP ≈ DANG THI NGOC DIEP (prefix OCR)
 * - bỏ dấu / khoảng trắng
 */
export function isPersonNameMatch(a?: string, b?: string): boolean {
  const na = normalizePersonNameKey(a);
  const nb = normalizePersonNameKey(b);
  if (!na || !nb) return true; // thiếu 1 bên → không kết luận lệch tên
  if (na === nb) return true;

  // Một bên chứa bên kia (tên đủ dài)
  if (na.length >= 6 && nb.includes(na)) return true;
  if (nb.length >= 6 && na.includes(nb)) return true;

  // Prefix OCR ngắn (1–3 ký tự) dính trước tên: NM + DANG...
  if (na.length >= 8 && nb.length >= 8) {
    if (na.endsWith(nb) && na.length - nb.length <= 3) return true;
    if (nb.endsWith(na) && nb.length - na.length <= 3) return true;
  }

  // Lệch ký tự OCR (THUANK vs THUAN)
  const maxLen = Math.max(na.length, nb.length);
  const maxDist = maxLen <= 10 ? 1 : maxLen <= 18 ? 2 : 3;
  if (Math.abs(na.length - nb.length) <= maxDist && levenshteinDistance(na, nb) <= maxDist) {
    return true;
  }

  return false;
}

/**
 * Có bất kỳ ứng viên tên nào khớp MS không (HĐ / CCCD / mail).
 */
export function anyPersonNameMatchesMs(
  msName: string | undefined | null,
  ...candidates: Array<string | undefined | null>
): boolean {
  const ms = cleanPersonName(msName || undefined) || String(msName || '').trim();
  if (!ms) return true;
  const cleaned = candidates
    .map((c) => cleanPersonName(c || undefined) || String(c || '').trim())
    .filter((c) => c.length >= 3);
  if (cleaned.length === 0) return true;
  return cleaned.some((c) => isPersonNameMatch(c, ms));
}

/**
 * Bóc tách Email Đa Hình: Tự động nhận diện Email Đơn lẻ (1 khách) hoặc Email Gom (nhiều khách)
 */
export function parseAccountOpeningEmailMulti(bodyContent: string): ParsedAccountGroup[] {
  let text = bodyContent || '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = htmlToPlainText(text);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const groupsMap = new Map<string, ParsedAccountGroup>();

  // Regex nhận diện mã TKGD: 3 số + 1 chữ cái + 7 số (hỗ trợ có hoặc không có khoảng trắng quanh -A, -L, -S)
  const codeRegex = /\b([0-9]{3}[A-Z][0-9]{7}(?:\s*-\s*[ALS])?)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(codeRegex);
    if (!match) continue;

    // Chuẩn hóa mã tài khoản (loại bỏ khoảng trắng bên trong ví dụ "009C2268268 - A" -> "009C2268268-A")
    const rawCode = match[1].replace(/\s+/g, '').toUpperCase().trim();
    const baseCode = extractBaseAccountCode(rawCode);
    const maTVKD = baseCode.substring(0, 3);
    const accType = detectAccountType(rawCode);

    // 1. Trích xuất tên đi kèm trên cùng dòng (phần nằm sau mã TKGD - Form TVKD 036, v.v.)
    const afterCode = line.substring(match.index! + match[0].length);
    let candidateName = cleanPersonName(afterCode);

    // 2. Nếu trên cùng dòng không có tên hợp lệ (do không có hoặc do cleanPersonName lọc bỏ rác "- A")
    // Quét tìm ở 3 dòng tiếp theo (Form TVKD 003: "Tên tài khoản: ĐÀO TUẤN HẢI", "Họ và tên: ...")
    if (!candidateName) {
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextLine = lines[j];
        if (codeRegex.test(nextLine)) break; // gặp mã tài khoản khác thì dừng

        const mName = nextLine.match(/(?:Tên\s*(?:tài\s*khoản|khách\s*hàng|KH)?|Họ\s*(?:và|&)?\s*tên)\s*[:\-]\s*([^\r\n]+)/i);
        if (mName) {
          const parsedNext = cleanPersonName(mName[1]);
          if (parsedNext) {
            candidateName = parsedNext;
            break;
          }
        }
      }
    }

    let existing = groupsMap.get(baseCode);
    if (!existing) {
      existing = {
        maTKGDFutures: accType === 'FUTURES' ? rawCode : baseCode,
        maTKGDACM: accType === 'ACM' ? rawCode : null,
        maTKGDLME: accType === 'LME' ? rawCode : null,
        maTKGDSpread: accType === 'SPREAD' ? rawCode : null,
        maTKGDBase: baseCode,
        maTVKD,
        tenTaiKhoan: candidateName || '',
        tenTK: candidateName || '',
        hasACMRequest: accType === 'ACM',
        hasLMERequest: accType === 'LME',
        hasSpreadRequest: accType === 'SPREAD',
        hasPL01Mention: accType === 'ACM',
        allAccountCodes: [{ code: rawCode, baseCode, type: accType }],
      };
      groupsMap.set(baseCode, existing);
    } else {
      if (accType === 'FUTURES') existing.maTKGDFutures = rawCode;
      if (accType === 'ACM') {
        existing.maTKGDACM = rawCode;
        existing.hasACMRequest = true;
        existing.hasPL01Mention = true;
      }
      if (accType === 'LME') {
        existing.maTKGDLME = rawCode;
        existing.hasLMERequest = true;
      }
      if (accType === 'SPREAD') {
        existing.maTKGDSpread = rawCode;
        existing.hasSpreadRequest = true;
      }
      if (!existing.tenTaiKhoan && candidateName) {
        existing.tenTaiKhoan = candidateName;
        existing.tenTK = candidateName;
      }
      if (!existing.allAccountCodes.some((c) => c.code === rawCode)) {
        existing.allAccountCodes.push({ code: rawCode, baseCode, type: accType });
      }
    }
  }

  // Bổ sung: Nếu email chỉ có 1 khách hàng mà chưa tìm thấy tên qua quét dòng, kết hợp bộ phân tích đơn lẻ cũ
  if (groupsMap.size === 1) {
    const single = parseAccountOpeningEmailBody(bodyContent);
    const firstGroup = Array.from(groupsMap.values())[0];
    if (!firstGroup.tenTaiKhoan && single.tenTK) {
      firstGroup.tenTaiKhoan = single.tenTK;
      firstGroup.tenTK = single.tenTK;
    }
  }

  // Nếu phát hiện được từ 1 nhóm trở lên theo từng dòng
  if (groupsMap.size > 0) {
    return Array.from(groupsMap.values());
  }

  // Fallback: Nếu không khớp theo từng dòng, chạy bộ phân tích đơn lẻ cũ
  const single = parseAccountOpeningEmailBody(bodyContent);
  const baseCode = single.maTKGDFutures || (single.maTKGDACM ? single.maTKGDACM.replace(/-A$/i, '') : '') || '';
  if (!baseCode) return [];

  return [
    {
      ...single,
      maTKGDBase: baseCode,
      tenTaiKhoan: single.tenTK || '',
    },
  ];
}

/**
 * Phân phối tệp đính kèm thông minh cho từng khách hàng trong email gom
 * Hỗ trợ tự động gom cụm các ảnh CCCD (dù có tên chung chung như mt.png, ms.png, tải xuống...) đi liền sau file PDF của khách hàng
 */
export function dispatchAttachmentsForAccount(
  group: ParsedAccountGroup,
  allAttachments: any[],
): any[] {
  if (!allAttachments || allAttachments.length === 0) return [];

  // Loại logo/banner khỏi pool trước khi gom cụm — tránh bốc logo thành CCCD
  const usableAttachments = allAttachments.filter(
    (att) => !isIgnoredEmailAttachment(att.name, att.size),
  );
  if (usableAttachments.length === 0) return [];

  const baseCode = group.maTKGDBase.toUpperCase();
  const normName = normalizeVietnameseName(group.tenTaiKhoan);

  // Helper kiểm tra file có tên chứa thông tin nhận diện của khách hàng này không
  const isMatchAccount = (attName: string) => {
    const fn = (attName || '').toUpperCase();
    const fnNorm = normalizeVietnameseName(attName || '');
    if (fn.includes(baseCode)) return true;
    if (normName && normName.length > 5 && fnNorm.includes(normName)) return true;
    return false;
  };

  // Helper kiểm tra file có phải ảnh hay không
  const isImageFile = (attName: string) => {
    const fn = (attName || '').toLowerCase();
    return fn.endsWith('.jpg') || fn.endsWith('.jpeg') || fn.endsWith('.png') || fn.endsWith('.webp');
  };

  // 1. Lọc các tệp thuộc về khách hàng này theo tên tệp (Mã TK hoặc Họ tên không dấu)
  const matched = usableAttachments.filter((att) => isMatchAccount(att.name));

  // Kiểm tra xem trong danh sách matched đã có ảnh CCCD chưa
  const hasImages = matched.some((att) => isImageFile(att.name));

  // 2. Thuật toán Gom cụm (Clustering):
  // Nếu đã match được file PDF nhưng CHƯA có ảnh (do ảnh CCCD mang tên ngẫu nhiên: mt.png, ms.png, tải xuống...)
  if (matched.length > 0 && !hasImages) {
    const allImages = usableAttachments.filter((att) => isImageFile(att.name));
    // Nếu tổng số ảnh trong email <= 4 (trường hợp email đơn lẻ hoặc ít ảnh), gom toàn bộ ảnh cho khách này
    if (allImages.length <= 4) {
      for (const img of allImages) {
        if (!matched.some((m) => m.name === img.name && m.size === img.size)) {
          matched.push(img);
        }
      }
    } else {
      // Trường hợp email gom nhiều khách: gom ảnh xung quanh vị trí file PDF (cả trước và sau)
      for (let i = 0; i < usableAttachments.length; i++) {
        const att = usableAttachments[i];
        if (isMatchAccount(att.name) && (att.name || '').toLowerCase().endsWith('.pdf')) {
          // Gom tất cả các ảnh nằm ngay sau file PDF này cho đến khi gặp file PDF của khách hàng tiếp theo
          for (let j = i + 1; j < usableAttachments.length; j++) {
            const nextAtt = usableAttachments[j];
            const nextName = (nextAtt.name || '').toLowerCase();
            if (nextName.endsWith('.pdf')) break;
            if (isImageFile(nextAtt.name)) {
              if (!matched.some((m) => m.name === nextAtt.name && m.size === nextAtt.size)) {
                matched.push(nextAtt);
              }
            }
          }
          // Gom cả các ảnh nằm ngay trước file PDF này (ảnh dán trên thân thư trước file PDF đính kèm)
          for (let j = i - 1; j >= 0; j--) {
            const prevAtt = usableAttachments[j];
            const prevName = (prevAtt.name || '').toLowerCase();
            if (prevName.endsWith('.pdf')) break;
            if (isImageFile(prevAtt.name)) {
              if (!matched.some((m) => m.name === prevAtt.name && m.size === prevAtt.size)) {
                matched.push(prevAtt);
              }
            }
          }
        }
      }
    }
  }

  // Nếu đã tìm thấy tệp riêng cho khách này (bao gồm cả ảnh được gom cụm) -> trả về
  if (matched.length > 0) {
    return matched;
  }

  // Nếu email chỉ có 1 khách hàng duy nhất -> gán toàn bộ tệp đính kèm (đã lọc logo)
  return usableAttachments;
}




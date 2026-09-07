/**
 * Helper bóc tách dữ liệu email yêu cầu mở TKGD
 * Tương thích 100% với form thực tế của TVKD 003 (Gia Cát Lợi) và các TVKD chuẩn
 */

/**
 * Helper bóc tách dữ liệu email yêu cầu mở TKGD
 * Tương thích 100% với form thực tế của TVKD 003 (Gia Cát Lợi) và các TVKD chuẩn tại MXV
 * Hỗ trợ chuẩn xác 4 phân hệ tài khoản: Futures, ACM (-A), LME (-L), Spread (-S)
 */

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
  if (fn.endsWith('-mxv.pdf') || (fn.includes('hop') && fn.endsWith('.pdf'))) {
    return 'hop_dong';
  }
  if (fn.includes('truoc') || fn.includes('front') || fn.includes('mat-truoc')) {
    return 'cccd_truoc';
  }
  if (fn.includes('sau') || fn.includes('back') || fn.includes('mat-sau')) {
    return 'cccd_sau';
  }
  return 'other';
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
    let clean = mTen[1].trim();
    clean = clean.replace(/\s+(TVKD|đã đính kèm|đề nghị|cam kết|kính gửi).*$/i, '').trim();
    clean = clean.replace(/[;,.\-]+$/, '').trim();
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



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

  // Danh mục từ khóa rác / hệ thống / loại tài khoản / câu chào
  const junkPatterns = [
    /^(ACM|LME|SPREAD|FUTURES|TIỂU KHOẢN|TÀI KHOẢN|SUB\s*ACCOUNT)$/i,
    /^(HỢP ĐỒNG|HĐ|PHỤ LỤC|PL01|PL|CCCD|CMND|PASSPORT|HỘ CHIẾU)$/i,
    /^(KÍNH GỬI|BẢN SCAN|FILE ĐÍNH KÈM|THÔNG BÁO|YÊU CẦU|KÍNH CHÀO|DEAR|GỬI|XIN CHÀO)$/i,
    /^(MXV|TVKD|SỞ GIAO DỊCH|CÔNG TY|CHI NHÁNH)$/i,
    /^(MỞ TÀI KHOẢN|KÍCH HOẠT|ĐĂNG KÝ|ĐỐI CHIẾU)$/i,
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
  const matched = allAttachments.filter((att) => isMatchAccount(att.name));

  // Kiểm tra xem trong danh sách matched đã có ảnh CCCD chưa
  const hasImages = matched.some((att) => isImageFile(att.name));

  // 2. Thuật toán Gom cụm (Clustering):
  // Nếu đã match được file PDF nhưng CHƯA có ảnh (do ảnh CCCD mang tên ngẫu nhiên: mt.png, ms.png, tải xuống, image001...)
  if (matched.length > 0 && !hasImages) {
    const allImages = allAttachments.filter((att) => isImageFile(att.name));
    // Nếu tổng số ảnh trong email <= 4 (trường hợp email đơn lẻ hoặc ít ảnh), gom toàn bộ ảnh cho khách này
    if (allImages.length <= 4) {
      for (const img of allImages) {
        if (!matched.some((m) => m.name === img.name && m.size === img.size)) {
          matched.push(img);
        }
      }
    } else {
      // Trường hợp email gom nhiều khách: gom ảnh xung quanh vị trí file PDF (cả trước và sau)
      for (let i = 0; i < allAttachments.length; i++) {
        const att = allAttachments[i];
        if (isMatchAccount(att.name) && (att.name || '').toLowerCase().endsWith('.pdf')) {
          // Gom tất cả các ảnh nằm ngay sau file PDF này cho đến khi gặp file PDF của khách hàng tiếp theo
          for (let j = i + 1; j < allAttachments.length; j++) {
            const nextAtt = allAttachments[j];
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
            const prevAtt = allAttachments[j];
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

  // Nếu email chỉ có 1 khách hàng duy nhất -> gán toàn bộ tệp đính kèm
  return allAttachments;
}




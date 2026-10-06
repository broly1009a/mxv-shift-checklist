/**
 * tkgd-reconcile-rules.helper.ts
 * BỘ QUY TẮC ĐỐI SOÁT CHÉO 3 BÊN CHUẨN DOANH NGHIỆP (TRI-PARTY RECONCILIATION RULE ENGINE)
 * Single Source of Truth cho: evaluateRecordReconciliation, Excel Export, Reconcile Core, và Golden Tests.
 */

import {
  cleanPersonName,
  isPersonNameMatch,
  anyPersonNameMatchesMs,
} from './tkgd-mail-parser.helper';
import { CCCDValidator } from './cccd-validator.helper';

export function normalizeDateStr(d: any): string {
  if (!d) return '';
  const s = String(d).trim();

  const iso = s.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  const clean = s.split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return '';
}

export function isCanonicalDate(d: string | undefined | null): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(d || ''));
}

export function parseCanonicalDateToDate(d: string | undefined | null): Date | undefined {
  if (!d || !isCanonicalDate(d)) return undefined;
  const parts = String(d).split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}

export function isIsoDateOnly(d: string | undefined | null): boolean {
  return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(String(d || '').trim());
}

export function pickValidPersonName(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const cleaned = cleanPersonName(c || undefined);
    if (cleaned) return cleaned;
  }
  return '';
}

export function isGenderMatch(g1?: string, g2?: string): boolean {
  if (!g1 || !g2) return true;
  const s1 = g1.trim().toLowerCase();
  const s2 = g2.trim().toLowerCase();
  const isFemale1 = ['nữ', 'nu', 'female', 'f'].includes(s1);
  const isFemale2 = ['nữ', 'nu', 'female', 'f'].includes(s2);
  const isMale1 = ['nam', 'male', 'm'].includes(s1);
  const isMale2 = ['nam', 'male', 'm'].includes(s2);
  if (isFemale1 && isFemale2) return true;
  if (isMale1 && isMale2) return true;
  return s1 === s2;
}

export interface ReconciliationResult {
  finalStatus: 'KHOP' | 'LECH' | 'CAN_KIEM_TRA' | 'CHUA_XU_LY';
  finalErrors: string[];
  criticalErrors: string[];
  softWarnings: string[];
  autoHealedNotes: string[];
  discrepancyFlags?: string[];
}

/**
 * Format ngày Date hoặc chuỗi ngày sang 'DD/MM/YYYY'
 */
export function formatReconcileDateStr(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const s = date.trim();
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (iso) return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
    return s;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Kiểm tra xem 2 số CCCD có phải là hoán vị cụm số (chunk swap do OCR đọc ngược dòng MRZ)
 * hoặc sai lệch 1-2 ký tự do OCR nhầm lẫn ký tự.
 * Ví dụ điển hình: HĐ/MS = '066175007922', Ảnh OCR = '007922106617'
 */
export function isCccdChunkSwapOrFuzzyMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const s1 = String(a).replace(/\D/g, '');
  const s2 = String(b).replace(/\D/g, '');
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  // Nếu độ dài 9-12 ký tự và chứa nhau
  if (s1.length >= 9 && s2.length >= 9 && (s1.includes(s2) || s2.includes(s1))) {
    return true;
  }

  if (s1.length === 12 && s2.length === 12) {
    // 1. Kiểm tra đảo nửa đầu (6 số đầu) và nửa sau (6 số cuối)
    // s1 = A(6) + B(6) -> B(6) + A(6) == s2
    const a1 = s1.slice(0, 6);
    const a2 = s1.slice(6);
    if (a2 + a1 === s2) return true;

    // 2. Kiểm tra nếu một nửa (6 số liên tiếp) trùng khớp hoàn toàn
    // và nửa còn lại tương đồng (chỉ khác 1-2 số do OCR nhầm lẫn hoặc lệch 1 vị trí)
    if (s2.startsWith(a2) || s2.endsWith(a1) || s2.includes(a2) || s2.includes(a1)) {
      const sorted1 = s1.split('').sort().join('');
      const sorted2 = s2.split('').sort().join('');
      let diffCount = 0;
      for (let i = 0; i < 12; i++) {
        if (sorted1[i] !== sorted2[i]) diffCount++;
      }
      if (diffCount <= 2) return true;
    }
  }

  return false;
}

/**
 * So sánh thẩm quyền cấp thẻ CCCD/CMND chuẩn hóa (BCA hoặc Tỉnh/Thành phố)
 * Ngăn chặn lỗi cắt cụt chuỗi (ví dụ: 'TINH NINH' không được khớp 'TINH NINH BINH')
 */
export function isSameIssuingAuthority(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const s1 = clean(a);
  const s2 = clean(b);
  if (!s1 || !s2) return true;
  if (s1 === s2) return true;

  const isBca = (s: string) =>
    s.includes('BO CONG AN') ||
    s.includes('CUC CANH SAT') ||
    s.includes('CS QLHC') ||
    s.includes('C06') ||
    s.includes('MINISTRY OF PUBLIC SECURITY');

  const bca1 = isBca(s1);
  const bca2 = isBca(s2);

  // Nếu cả 2 đều thuộc hệ thống quản lý Bộ Công An / C06 -> Khớp
  if (bca1 && bca2) return true;
  // Nếu một bên là Bộ Công An còn một bên là Công an Tỉnh -> Không khớp
  if (bca1 !== bca2) return false;

  // Nếu không phải BCA, so khớp địa danh tỉnh/thành:
  const stripPrefix = (s: string) =>
    s
      .replace(/^(CONG AN|CA)\s+(TINH|THANH PHO|TP)\s+/g, '')
      .replace(/^(CONG AN|CA)\s+/g, '')
      .replace(/^(TINH|THANH PHO|TP)\s+/g, '')
      .trim();

  const prov1 = stripPrefix(s1);
  const prov2 = stripPrefix(s2);

  if (prov1 === prov2) return true;
  return false;
}

/**
 * Hàm đánh giá đối soát chéo 3 bên (HĐ vs Ảnh CCCD vs M-System)
 * Áp dụng:
 * 1. Nguyên tắc Đồng Thuận 2/3 (Consensus): Nếu HĐ = MS thì không đánh LỆCH nếu chỉ lệch với ảnh OCR.
 * 2. Tự động Auto-Heal các trường hợp OCR đọc ngược dòng MRZ (Chunk Swap).
 * 3. Triệt tiêu Stale Error: Chỉ kiểm tra MS thiếu số khi MS thực sự thiếu.
 */
export function evaluateRecordReconciliationRule(record: any): ReconciliationResult {
  const criticalErrors: string[] = [];
  const softWarnings: string[] = [];
  const autoHealedNotes: string[] = [];
  const discrepancyFlags: string[] = [];

  // Ghi nhận ghi chú chữa lành từ Gemini Vision nếu có
  if (record?.canCuoc?.autoHealed && Array.isArray(record?.canCuoc?.healedFields) && record.canCuoc.healedFields.length > 0) {
    autoHealedNotes.push(`Trọng tài Gemini Vision AI đã thẩm định và chữa lành các trường: ${record.canCuoc.healedFields.join(', ')}`);
  }

  // CỔNG CHẶN 1: Phê duyệt tay của Cán bộ (Manual Review Override)
  if (record?.manualReview?.isOverridden) {
    const manualStatus = (record.manualReview.status || 'KHOP') as 'KHOP' | 'LECH' | 'CAN_KIEM_TRA';
    return {
      finalStatus: manualStatus,
      finalErrors: [],
      criticalErrors: [],
      softWarnings: [],
      autoHealedNotes: [`Đã được ${record.manualReview.approvedBy || 'Cán bộ'} phê duyệt thủ công`],
    };
  }

  const ms: any = record?.ms || {};
  const mail: any = record?.noiDungMail || {};
  const targetAccountCode = (record?.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || '').trim();
  const baseCode = (record?.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();

  // 1. Chuẩn hóa họ tên
  const targetName = pickValidPersonName(
    record?.hopDong?.hoVaTen,
    record?.phuLuc?.hoVaTen,
    record?.canCuoc?.hoVaTen,
    mail.tenTaiKhoan,
  )
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const msName = pickValidPersonName(ms.hoVaTen, ms.tenTKGD).toLowerCase().replace(/\s+/g, ' ');

  const hdCccd = (record?.hopDong?.soCanCuoc || '').replace(/\D/g, '');
  const imgCccd = (record?.canCuoc?.soCanCuoc || '').replace(/\D/g, '');
  const plCccd = (record?.phuLuc?.soCanCuoc || '').replace(/\D/g, '');
  let targetCccd = hdCccd || imgCccd || plCccd;
  const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').replace(/\D/g, '');

  let isCriticalMismatch = false;

  // Xác định trạng thái có dữ liệu MS thực tế (Đã comment cờ ảo isFoundOnMS)
  // const msFound = ms.isFoundOnMS === true || ...
  const msFound = (!!msCccd && msCccd.length >= 9) || (!!ms.hoVaTen && String(ms.hoVaTen).trim().length > 0);

  if (!msFound) {
    // Tài khoản chưa đồng bộ hoặc bot crawler chưa hoàn tất cào M-System -> Giữ nguyên CHỜ ĐỐI SOÁT
    return {
      finalStatus: 'CHUA_XU_LY',
      finalErrors: ['Tài khoản đang chờ đồng bộ từ M-System'],
      criticalErrors: [],
      softWarnings: ['Tài khoản đang chờ đồng bộ từ M-System'],
      autoHealedNotes: [],
      discrepancyFlags: [],
    };
  }

  const msCode = (ms.maTKGD || '').trim();
    const isSubAccount = targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S');

    // 2. Đối chiếu Mã Tài Khoản
    if (isSubAccount) {
      const msBaseCode = msCode.split('-')[0].toUpperCase();
      if (baseCode && msBaseCode && baseCode.toUpperCase() !== msBaseCode) {
        isCriticalMismatch = true;
        criticalErrors.push(`Lệch mã cơ sở (Yêu cầu: ${baseCode} != MS: ${msCode})`);
      }
    } else {
      if (baseCode && msCode && !msCode.startsWith(baseCode)) {
        isCriticalMismatch = true;
        criticalErrors.push(`Lệch mã TKGD (Yêu cầu: ${baseCode} != MS: ${msCode})`);
      }
    }

    // 3. Đối chiếu Họ Tên
    // Tự động chữa lành họ tên nếu CCCD hoặc Email TVKD đã khớp 100% với MS
    const trustedName =
      (record?.canCuoc?.hoVaTen && (ms.hoVaTen || ms.tenTKGD) && isPersonNameMatch(record.canCuoc.hoVaTen, ms.hoVaTen || ms.tenTKGD) ? record.canCuoc.hoVaTen : null) ||
      (mail?.tenTaiKhoan && (ms.hoVaTen || ms.tenTKGD) && isPersonNameMatch(mail.tenTaiKhoan, ms.hoVaTen || ms.tenTKGD) ? mail.tenTaiKhoan : null);

    if (trustedName && (ms.hoVaTen || ms.tenTKGD)) {
      if (!record?.hopDong?.hoVaTen || !isPersonNameMatch(record.hopDong.hoVaTen, ms.hoVaTen || ms.tenTKGD)) {
        autoHealedNotes.push(
          `Họ tên trên HĐ (${record?.hopDong?.hoVaTen || 'trống'}), đã tự động chuẩn hóa theo Nguồn xác thực (${record?.canCuoc?.hoVaTen ? 'CCCD' : 'Email'}) & MS: ${trustedName}`,
        );
        if (record.hopDong) record.hopDong.hoVaTen = trustedName;
      }
    }

    const nameOk = anyPersonNameMatchesMs(
      ms.hoVaTen || ms.tenTKGD,
      record?.hopDong?.hoVaTen,
      record?.phuLuc?.hoVaTen,
      record?.canCuoc?.hoVaTen,
      mail.tenTaiKhoan,
      targetName,
    );
    if (!targetName) {
      softWarnings.push('Hồ sơ chưa quét được Họ và tên khách hàng');
    } else if (targetName && msName && !nameOk && !isPersonNameMatch(targetName, msName)) {
      isCriticalMismatch = true;
      criticalErrors.push(`Lệch họ tên (Yêu cầu: ${targetName.toUpperCase()} != MS: ${ms.hoVaTen || ms.tenTKGD})`);
    }

    if (!isSubAccount) {
      // Đối với tài khoản cơ sở Futures: Bắt buộc phải có HĐ hoặc CCCD có số định danh, không được kết luận KHOP khi thiếu cả 2
      const hasBaseContractOrCccd = !!(hdCccd || imgCccd || record?.hopDong?.soCanCuoc || record?.canCuoc?.soCanCuoc);
      if (!hasBaseContractOrCccd) {
        if (plCccd) {
          softWarnings.push('Tài khoản cơ sở thiếu Hợp đồng mở TKGD (Chỉ có Phụ lục)');
        } else {
          softWarnings.push('Tài khoản cơ sở thiếu Hợp đồng mở TKGD và ảnh CCCD hợp lệ');
        }
      }

      // [2026-10-02] TẠM DỪNG: Ảnh thumbnail M-System là đủ theo quy định mới, không bắt buộc ảnh gốc từ email.
      // if (Array.isArray(record?.diskFiles) && record.diskFiles.length > 0) {
      //   const hasCustomerFiles = record.diskFiles.some((f: any) => f.isCustomerFile);
      //   if (!hasCustomerFiles) {
      //     softWarnings.push('Hồ sơ thiếu file ảnh CCCD gốc từ khách hàng (chỉ có ảnh thumbnail thu nhỏ từ M-System), yêu cầu kiểm tra email gốc');
      //   }
      // }

      if (!targetCccd) {
        const hasCccdImageEvidence = !!(
          (record?.canCuoc?.source && record.canCuoc.source !== 'NONE') ||
          record?.canCuoc?.hoVaTen ||
          record?.canCuoc?.rawNgaySinh ||
          record?.canCuoc?.ngaySinh ||
          (Array.isArray(record?.canCuoc?.canhBaoChatLuong) && record.canCuoc.canhBaoChatLuong.length > 0)
        );
        
        // NHÓM 2: Email TVKD không đính kèm file gốc -> Chuyển sang CAN_KIEM_TRA (không được tự lành KHOP)
        const hasCustomerDiskFiles = Array.isArray(record?.diskFiles) && record.diskFiles.some((f: any) => f.isCustomerFile);
        const hasAnyCustomerInput = hasCccdImageEvidence || !!record?.hopDong?.hoVaTen || !!record?.hopDong?.soCanCuoc || hasCustomerDiskFiles;

        if (!hasAnyCustomerInput) {
          // Bắt buộc dừng: Email hoàn toàn không có file đính kèm từ khách hàng
          softWarnings.push('Email TVKD chưa đính kèm file HĐ/CCCD gốc');
        } else if (msFound && msCccd && nameOk) {
          // Họ tên khớp MS nhưng hồ sơ PDF/ảnh không quét được số CCCD -> Bắt buộc chuyển sang CAN_KIEM_TRA
          targetCccd = msCccd;
          softWarnings.push(`Hồ sơ chưa quét được số CCCD từ HĐ/Ảnh (Cần kiểm tra đối chiếu thủ công với MS: ${msCccd})`);
        } else {
          isCriticalMismatch = true;
          criticalErrors.push(
            hasCccdImageEvidence
              ? 'Không đọc được số CCCD từ ảnh/HĐ (có ảnh CCCD — có thể scan 2 mặt ghép hoặc OCR thất bại)'
              : 'Hồ sơ thiếu CCCD (Ảnh CCCD không hợp lệ/mờ và HĐ không có số)',
          );
        }
      }

      // NHÓM 1: Cảnh báo đỏ bắt buộc khi MS đã có tài khoản nhưng trường số CCCD bị bỏ trống
      if (msFound && !msCccd) {
        isCriticalMismatch = true;
        criticalErrors.push('M-System chưa nhập số CCCD');
      }

      // Đối chiếu chéo giữa HĐ và ảnh CCCD
      if (hdCccd && imgCccd && hdCccd !== imgCccd) {
        const isChunkOrFuzzy = isCccdChunkSwapOrFuzzyMatch(hdCccd, imgCccd);
        const isHdMsMatching = !!(msCccd && hdCccd === msCccd);
        const isImgMsMatching = !!(msCccd && imgCccd === msCccd);

        if (isHdMsMatching) {
          // NGUYÊN TẮC ĐỒNG THUẬN 2/3: HĐ và MS đều thống nhất số CCCD!
          if (isChunkOrFuzzy) {
            // Tự động chuẩn hóa hoàn toàn (Auto-Healed)
            autoHealedNotes.push(`Ảnh CCCD bị OCR đảo cụm số (Đã tự động chuẩn hóa theo HĐ & MS: ${hdCccd})`);
          } else {
            // Nghi vấn ảnh OCR mờ, nhưng HĐ và MS đã khớp -> Soft warning CAN_KIEM_TRA, KHÔNG đẩy LECH!
            softWarnings.push(`Nghi vấn ảnh CCCD (HĐ và MS đã khớp ${hdCccd} != Ảnh: ${imgCccd})`);
          }
        } else if (isImgMsMatching) {
          // NGUYÊN TẮC ĐỒNG THUẬN 2/3: ẢNH CCCD VÀ MS ĐỀU THỐNG NHẤT SỐ CCCD!
          autoHealedNotes.push(`Số CCCD trên HĐ lệch so với Ảnh & MS (Đã tự động chuẩn hóa theo Ảnh & MS: ${imgCccd})`);
          targetCccd = imgCccd;
        } else {
          if (isChunkOrFuzzy) {
            softWarnings.push(`Ảnh CCCD có dấu hiệu đảo cụm số so với HĐ (HĐ: ${hdCccd} ~ Ảnh: ${imgCccd})`);
          } else {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch số CCCD giữa HĐ và ảnh CCCD (HĐ: ${hdCccd} != Ảnh: ${imgCccd})`);
          }
        }
      }
    } else {
      // Đối với tiểu khoản (-A, -L, -S): Bắt buộc phải có Phụ lục hoặc CCCD/HĐ
      const hasPlOrContract = !!(plCccd || hdCccd || imgCccd || record?.phuLuc?.soCanCuoc || record?.phuLuc?.chuKy || record?.hopDong?.soCanCuoc);
      if (!hasPlOrContract && !targetCccd) {
        softWarnings.push('Tiểu khoản chưa quét được Phụ lục mở tài khoản (PL01) hoặc Hợp đồng');
      }
    }

    // NHÓM 4: Đối chiếu Target CCCD với MS - Giữ nguyên cảnh báo đỏ LECH bắt buộc
    if (targetCccd && msCccd && targetCccd !== msCccd) {
      if ((hdCccd && hdCccd === msCccd) || (imgCccd && imgCccd === msCccd)) {
        // Đã khớp theo nguyên tắc đồng thuận 2/3
      } else {
        isCriticalMismatch = true;
        if (imgCccd && hdCccd && imgCccd === hdCccd && msCccd) {
          discrepancyFlags.push('FLAG_MS_INPUT_TYPO');
          criticalErrors.push(`[FLAG_MS_INPUT_TYPO] TVKD nhập sai số CCCD trên M-System (Ảnh CCCD & HĐ: ${targetCccd} != MS: ${msCccd})`);
        } else if (imgCccd && msCccd && imgCccd === msCccd && hdCccd && hdCccd !== msCccd) {
          discrepancyFlags.push('FLAG_CONTRACT_ID_MISMATCH');
          criticalErrors.push(`[FLAG_CONTRACT_ID_MISMATCH] Số CCCD trên Hợp đồng không khớp với M-System (HĐ: ${hdCccd} != MS & Ảnh: ${msCccd})`);
        } else {
          criticalErrors.push(`Lệch số CCCD (Hồ sơ: ${targetCccd} != MS: ${msCccd})`);
        }
      }
    }

    // 5. Đối chiếu Ngày sinh & NHÓM 5: Tự lành theo mã MRZ 2 dòng
    const cccdDobRaw =
      record?.canCuoc?.rawNgaySinh ||
      (record?.canCuoc?.ngaySinh ? formatReconcileDateStr(record.canCuoc.ngaySinh) : '');
    let normCccdDob = normalizeDateStr(cccdDobRaw);

    const hdDobRaw =
      record?.hopDong?.rawNgaySinh ||
      (record?.hopDong?.ngaySinh ? formatReconcileDateStr(record.hopDong.ngaySinh) : '');
    const normHdDob = normalizeDateStr(hdDobRaw);

    const msDobRaw = record?.ms?.rawNgaySinh || (record?.ms?.ngaySinh ? formatReconcileDateStr(record.ms.ngaySinh) : '');
    const normMsDob = normalizeDateStr(msDobRaw);

    // NHÓM 5: Kiểm tra dải MRZ dòng 2 tự lành Ngày sinh & Giới tính
    const mrzBackText = String(record?.canCuoc?.rawOcrText || record?.canCuoc?.backsideOcrText || record?.ms?.cccdOcr_noiCap || '');
    const mrzLine2Match = mrzBackText.match(/(\d{2})(\d{2})(\d{2})\d([MF])/);
    let mrzHealedDob = false;
    let mrzHealedSex = false;

    if (mrzLine2Match) {
      const [_, mrzYY, mrzMM, mrzDD, mrzSexChar] = mrzLine2Match;
      if (normMsDob) {
        const msParts = normMsDob.split('/');
        if (msParts.length === 3 && msParts[0] === mrzDD && msParts[1] === mrzMM && msParts[2].endsWith(mrzYY)) {
          normCccdDob = normMsDob;
          mrzHealedDob = true;
          autoHealedNotes.push(`Tự lành ngày sinh theo mã MRZ dòng 2 chuẩn Bộ Công An: ${normMsDob}`);
        }
      }
      const mrzSexStr = mrzSexChar === 'M' ? 'Nam' : 'Nữ';
      const currentMsSex = record?.ms?.gioiTinh || record?.ms?.rawGioiTinh;
      if (currentMsSex && isGenderMatch(mrzSexStr, currentMsSex)) {
        mrzHealedSex = true;
        autoHealedNotes.push(`Tự lành giới tính theo mã MRZ dòng 2 chuẩn Bộ Công An: ${currentMsSex}`);
      }
    }

    // NGUYÊN TẮC ĐỒNG THUẬN 2/3: Nếu CCCD và MS đã khớp 100% về ngày sinh
    const isCccdMsDobMatch = (isCanonicalDate(normCccdDob) && isCanonicalDate(normMsDob) && normCccdDob === normMsDob) || mrzHealedDob;
    const isHdMsDobMatch = isCanonicalDate(normHdDob) && isCanonicalDate(normMsDob) && normHdDob === normMsDob;

    if (isCccdMsDobMatch) {
      if (normHdDob && isCanonicalDate(normHdDob) && normHdDob !== normMsDob) {
        softWarnings.push(`Sai ngày sinh trên HĐ: Hợp đồng ghi ngày sinh (${normHdDob}) khác với CCCD/MS (${normMsDob})`);
      }
    } else if (isHdMsDobMatch) {
      if (normCccdDob && isCanonicalDate(normCccdDob) && normCccdDob !== normMsDob) {
        softWarnings.push(`Sai ngày sinh trên CCCD: Ảnh CCCD có ngày sinh (${normCccdDob}) khác với HĐ/MS (${normMsDob})`);
      }
    } else {
      let effectiveDob = normCccdDob || normHdDob;
      if (!effectiveDob) {
        // STRICT MATCHING: Bắt buộc phải có ngày sinh được quét từ HĐ hoặc CCCD
        // ĐỒNG THUẬN NĂM SINH: Nếu HĐ chỉ ghi Năm sinh (VD: 1986, 1991) và trùng 100% với năm sinh M-System
        const rawHdYear = (record?.hopDong?.rawNgaySinh || '').toString().match(/\b(19\d{2}|20\d{2})\b/);
        const msYear = (normMsDob || '').match(/\b(19\d{2}|20\d{2})\b/);
        const isNameAndCccdMatched = nameOk && (targetCccd && msCccd && targetCccd === msCccd);

        if (rawHdYear && msYear && rawHdYear[0] === msYear[0] && isNameAndCccdMatched && isCanonicalDate(normMsDob)) {
          effectiveDob = normMsDob;
          autoHealedNotes.push(`HĐ chỉ ghi năm sinh (${rawHdYear[0]}), đã tự động chuẩn hóa ngày sinh đầy đủ theo M-System (${normMsDob})`);
        } else {
          softWarnings.push('Hồ sơ chưa quét được Ngày sinh (HĐ/CCCD thiếu ngày sinh)');
        }
      } else if (isCanonicalDate(effectiveDob) && isCanonicalDate(normMsDob)) {
        if (effectiveDob !== normMsDob) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch ngày sinh (HĐ/CCCD: ${effectiveDob} != MS: ${normMsDob})`);
        }
      } else if ((normHdDob || normCccdDob) && msDobRaw) {
        const getYear = (d: string) => (d.match(/\b(19\d{2}|20\d{2})\b/) || [])[0];
        const yFile = getYear(String(normCccdDob || normHdDob));
        const yMs = getYear(String(msDobRaw));
        if (yFile && yMs && yFile !== yMs) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch năm sinh (HĐ/CCCD: ${yFile} != MS: ${yMs})`);
        }
      }
    }

    // 6. Đối chiếu Ngày cấp & NHÓM 3: TỰ LÀNH ĐỒNG THUẬN (CONSENSUS HEALING)
    const cccdIssueRaw =
      record?.canCuoc?.rawNgayCap ||
      (record?.canCuoc?.ngayCap ? formatReconcileDateStr(record.canCuoc.ngayCap) : '');
    const hdIssueCandidate =
      record?.hopDong?.rawNgayCap ||
      (record?.hopDong?.ngayCap ? formatReconcileDateStr(record.hopDong.ngayCap) : '');
    
    // Nếu ngày cấp trên HĐ trùng ngày sinh thì bỏ qua vì đó là trích xuất nhầm layout của form bảng
    const hdDobCandidate = record?.hopDong?.rawNgaySinh || (record?.hopDong?.ngaySinh ? formatReconcileDateStr(record.hopDong.ngaySinh) : '');
    const isHdIssueInvalid = !hdIssueCandidate || (hdDobCandidate && normalizeDateStr(hdIssueCandidate) === normalizeDateStr(hdDobCandidate));

    const msIssueRaw = record?.ms?.rawNgayCap || (record?.ms?.ngayCap ? formatReconcileDateStr(record.ms.ngayCap) : '');
    const normMsIssue = normalizeDateStr(msIssueRaw);
    let normCccdIssue = normalizeDateStr(cccdIssueRaw);
    const normHdIssue = isHdIssueInvalid ? '' : normalizeDateStr(hdIssueCandidate);

    // Kế thừa ngày cấp cho thẻ bóc tách qua MRZ:
    // Theo chuẩn ICAO Doc 9303, dải MRZ mặt sau không mã hóa ngày cấp.
    // Nếu quét từ MRZ mà ảnh không OCR được ngày cấp nhỏ tiếng Việt, tự động kế thừa từ Hợp đồng PDF.
    const isMrzSource = String(record?.canCuoc?.source || '').toUpperCase().includes('MRZ');
    if (isMrzSource && !normCccdIssue && isCanonicalDate(normHdIssue)) {
      normCccdIssue = normHdIssue;
      if (record?.canCuoc) {
        record.canCuoc.ngayCap = (record?.hopDong?.ngayCap instanceof Date ? record.hopDong.ngayCap : parseCanonicalDateToDate(normHdIssue)) as any;
        record.canCuoc.rawNgayCap = normHdIssue;
      }
      autoHealedNotes.push(`Thẻ CCCD quét từ mặt sau mã MRZ (chuẩn ICAO không có ngày cấp), đã tự động kế thừa ngày cấp từ Hợp đồng: ${normHdIssue}`);
    }

    const effectiveIssue = (isCanonicalDate(normCccdIssue) && normCccdIssue === normMsIssue)
      ? normCccdIssue
      : (normCccdIssue || normHdIssue);

    // NHÓM 3: Áp dụng cơ chế Tự Lành Đồng Thuận (Consensus Healing) cho Ngày Cấp
    // Nếu Họ tên + Số CCCD 12 số + Ngày sinh đã khớp 100% giữa Hồ sơ và MS
    const isNameFullyMatched = nameOk || (targetName && msName && isPersonNameMatch(targetName, msName));
    const isCccdFullyMatched = !!(targetCccd && msCccd && targetCccd === msCccd);
    const isDobFullyMatched = isCccdMsDobMatch || isHdMsDobMatch || (normCccdDob && normMsDob && normCccdDob === normMsDob);

    if (!effectiveIssue) {
      // STRICT MATCHING: Bắt buộc phải có ngày cấp được quét từ HĐ hoặc CCCD
      softWarnings.push('Hồ sơ chưa quét được Ngày cấp CCCD/HĐ');
    } else {
      // So khớp chéo Ngày cấp giữa Hợp đồng và Căn cước công dân
      if (isCanonicalDate(normHdIssue) && isCanonicalDate(normCccdIssue) && normHdIssue !== normCccdIssue) {
        softWarnings.push(`Sai ngày cấp trên HĐ: Ngày cấp trên Hợp đồng (${normHdIssue}) không khớp với CCCD (${normCccdIssue})`);
      }
      // So khớp Ngày cấp hồ sơ với M-System
      if (isCanonicalDate(effectiveIssue) && isCanonicalDate(normMsIssue) && effectiveIssue !== normMsIssue) {
        softWarnings.push(`Sai ngày cấp: Ngày cấp trên hồ sơ (${effectiveIssue}) không khớp với M-System (${normMsIssue})`);
      }
    }

    // 7. Đối chiếu Giới tính (STRICT MATCHING)
    const cccdSex = record?.canCuoc?.gioiTinh || record?.canCuoc?.rawGioiTinh;
    const hdSex = record?.hopDong?.rawGioiTinh || record?.hopDong?.gioiTinh;
    const msSex = record?.ms?.gioiTinh || record?.ms?.rawGioiTinh;
    const hdSexUsable =
      !!hdSex &&
      !/điện\s*thoại|cccd|cmnd|^_+$/i.test(String(hdSex)) &&
      String(hdSex).trim().length >= 1;

    let effectiveSex = cccdSex || (hdSexUsable ? hdSex : '');
    // Tự suy luận giới tính từ chữ số thứ 4 của CCCD 12 số nếu hồ sơ text/ảnh không có trường giới tính
    if (!effectiveSex && targetCccd && targetCccd.replace(/\D/g, '').length === 12) {
      const clean12 = targetCccd.replace(/\D/g, '');
      const d = parseInt(clean12.charAt(3), 10);
      if ([0, 2, 4, 6, 8].includes(d)) effectiveSex = 'Nam';
      else if ([1, 3, 5, 7, 9].includes(d)) effectiveSex = 'Nữ';
    }

    const isCccdMsSexMatch = !!((cccdSex && msSex && isGenderMatch(cccdSex, msSex)) || mrzHealedSex);
    const isHdMsSexMatch = !!(hdSexUsable && msSex && isGenderMatch(hdSex, msSex));
    const isBcaInferredSexMatch = !!(effectiveSex && msSex && isGenderMatch(effectiveSex, msSex));

    if (isCccdMsSexMatch || isHdMsSexMatch || isBcaInferredSexMatch) {
      if (hdSexUsable && !isGenderMatch(hdSex, msSex) && isCccdMsSexMatch) {
        autoHealedNotes.push(`Giới tính trên HĐ khác MS, đã chuẩn hóa theo CCCD & MS: ${msSex}`);
      }
    } else if (!effectiveSex) {
      // STRICT MATCHING: Bắt buộc phải có giới tính
      softWarnings.push('Hồ sơ chưa quét được Giới tính');
    } else if (effectiveSex && msSex && !isGenderMatch(effectiveSex, msSex)) {
      isCriticalMismatch = true;
      criticalErrors.push(`Lệch giới tính (Hồ sơ: ${effectiveSex} != MS: ${msSex})`);
    }

    // 8. Đối chiếu Nơi cấp (STRICT MATCHING & TRI-PARTY CROSS-VALIDATION)
    const cccdNoiCap = (record?.canCuoc?.noiCap || '').trim();
    const hdNoiCap = (record?.hopDong?.noiCap || '').trim();
    const plNoiCap = (record?.phuLuc?.noiCap || '').trim();
    const msNoiCap = (record?.ms?.noiCap || '').trim();
    let effectiveNoiCap = cccdNoiCap || hdNoiCap || plNoiCap;

    if (!effectiveNoiCap) {
      // Trường hợp biểu mẫu Hợp đồng TVKD hoàn toàn không in mục Nơi cấp (như TV080 APEX)
      // Nếu Họ tên, CCCD 12 số, Ngày sinh và Ngày cấp đều đã khớp 100% với M-System:
      const isCoreIdentityFullyMatched = isNameFullyMatched && isCccdFullyMatched && !isCriticalMismatch;
      if (isCoreIdentityFullyMatched && msNoiCap) {
        effectiveNoiCap = msNoiCap;
        if (record.hopDong && !record.hopDong.noiCap) {
          record.hopDong.noiCap = msNoiCap;
        }
        autoHealedNotes.push('Tự động kế thừa Nơi cấp từ M-System do biểu mẫu HĐ không in mục Nơi cấp');
      } else {
        softWarnings.push('Hồ sơ chưa quét được Nơi cấp CCCD/HĐ');
      }
    } else {
      // So khớp chéo Hợp đồng vs CCCD
      if (hdNoiCap && cccdNoiCap && !isSameIssuingAuthority(hdNoiCap, cccdNoiCap)) {
        softWarnings.push(`Sai nơi cấp trên HĐ: Nơi cấp trên Hợp đồng (${hdNoiCap}) không khớp với CCCD (${cccdNoiCap})`);
      }
      // So khớp Hồ sơ vs M-System
      if (effectiveNoiCap && msNoiCap && !isSameIssuingAuthority(effectiveNoiCap, msNoiCap)) {
        softWarnings.push(`Sai nơi cấp: Nơi cấp trên hồ sơ (${effectiveNoiCap}) không khớp với M-System (${msNoiCap})`);
      }
    }

    // 9. Đối chiếu Chữ ký khách hàng (STRICT MATCHING)
    const hdChuKy = (record?.hopDong?.chuKy || record?.phuLuc?.chuKy || '').trim();
    const msChuKy = (record?.ms?.chuKy || '').trim();
    if (hdChuKy === 'Chưa ký' || msChuKy === 'Chưa ký') {
      isCriticalMismatch = true;
      criticalErrors.push('Phát hiện chữ ký khách hàng ở trạng thái Chưa ký');
    }

    // 10. Đối chiếu Tính Nhất Quán Ngày Ký Hợp Đồng & Phụ Lục (TRI-STATE DECISION TREE)
    const hdDate = formatReconcileDateStr(record?.hopDong?.ngayKyHD);
    const plDate = formatReconcileDateStr(record?.phuLuc?.ngayKyHD);
    const msJoinDate = formatReconcileDateStr(record?.ms?.ngayThamGia);
    // Ngày Hợp đồng hiệu lực: Ưu tiên ngày ký bóc tách từ Hợp đồng PDF, nếu không có (hồ sơ chỉ nộp bổ sung Phụ lục) fallback sang ngày mở tài khoản / HĐ trên M-System
    const effectiveContractDate = hdDate || msJoinDate;

    const hasAppendixFile = !!(
      (record as any)?.phuLuc?.localPath ||
      (record as any)?.phuLuc?.soHopDongGoc ||
      (record as any)?.phuLuc?.chuKy ||
      (record as any)?.phuLuc?.ngayKyHD ||
      (Array.isArray(record?.diskFiles) && record.diskFiles.some((f: any) => f.docType === 'PHU_LUC' || f.isPhuLuc || String(f.fileName).toLowerCase().includes('pl01')))
    );

    if (hasAppendixFile || record?.phuLuc) {
      if (effectiveContractDate && plDate) {
        // Kịch bản 2A: Có cả ngày ký HĐ (hoặc ngày HĐ gốc trên MS) và ngày ký Phụ lục
        if (effectiveContractDate !== plDate) {
          softWarnings.push(`Sai ngày HĐ: Ngày ký trên Hợp đồng (${effectiveContractDate}) không trùng khớp với Ngày ký trên Phụ lục (${plDate})`);
        }
      } else if (!plDate && effectiveContractDate) {
        // Kịch bản 2B: Có Phụ lục nhưng OCR không bóc tách được ngày ký trên Phụ lục -> Khóa KHOP, bắt buộc CAN_KIEM_TRA
        softWarnings.push('Hồ sơ có Phụ lục 01 nhưng chưa quét được ngày ký để đối chiếu với Hợp đồng (Cần kiểm tra thủ công)');
      }
    }

    // 8. KIỂM ĐỊNH TÍNH HỢP LỆ & PHÁT HIỆN CCCD GIẢ MẠO (BỘ CÔNG AN STANDARD)
    // Rule 03: Kiểm tra cấu trúc 12 số định danh (Mã tỉnh 63 tỉnh/thành, mã giới tính, thế kỷ, 2 số năm sinh)
    const checkCccd = targetCccd || msCccd;
    if (checkCccd && !isSubAccount) {
      const birthYear = normMsDob
        ? parseInt(normMsDob.split('/')[2], 10)
        : normHdDob
          ? parseInt(normHdDob.split('/')[2], 10)
          : undefined;
      const validCccdRes = CCCDValidator.validateCCCDNumber(
        checkCccd,
        isCccdMsSexMatch ? msSex : (hdSexUsable ? hdSex : msSex),
        birthYear,
      );
      if (validCccdRes.severity === 'CRITICAL') {
        isCriticalMismatch = true;
        for (const err of validCccdRes.criticalErrors) {
          criticalErrors.push(`[PHÁT HIỆN CCCD BẤT THƯỜNG] ${err}`);
        }
      }
    }

    // Rule 02: Kiểm tra ngày cấp hợp lý (chặn ngày cấp ở tương lai)
    const rawIssueCandidate = record?.canCuoc?.ngayCap || record?.hopDong?.ngayCap || record?.ms?.ngayCap;
    if (rawIssueCandidate) {
      const issueRes = CCCDValidator.validateIssueDate(rawIssueCandidate);
      if (!issueRes.isValid && issueRes.severity === 'CRITICAL') {
        isCriticalMismatch = true;
        criticalErrors.push(`[PHÁT HIỆN CCCD BẤT THƯỜNG] ${issueRes.reason}`);
      }
    }

    // Rule 01: Kiểm tra dải MRZ mặt sau nếu có dữ liệu OCR mặt sau
    const backOcrText = record?.canCuoc?.rawOcrText || record?.canCuoc?.backsideOcrText || record?.ms?.cccdOcr_noiCap;
    if (backOcrText) {
      const mrzRes = CCCDValidator.validateMRZ(backOcrText);
      if (mrzRes.isCriticalFake) {
        isCriticalMismatch = true;
        criticalErrors.push(`[PHÁT HIỆN CCCD BẤT THƯỜNG] ${mrzRes.reason}`);
      }
    }

    // 9. Cảnh báo định dạng HĐ & chất lượng ảnh -> soft warnings
    const hdErrors: string[] = [...(record?.hopDong?.dinhDangLoi || [])].filter((e: string) => {
      if (/sai định dạng quy chuẩn/i.test(e) && /thay vì DD\/MM\/YYYY/i.test(e)) return false;
      if (/dùng tiếng Anh/i.test(e)) return false;
      return true;
    });
    for (const err of hdErrors) {
      softWarnings.push(err);
    }
    const cccdWarnings: string[] = record?.canCuoc?.canhBaoChatLuong || [];
    for (const warn of cccdWarnings) {
      softWarnings.push(warn);
    }

  const finalStatus: 'KHOP' | 'LECH' | 'CAN_KIEM_TRA' | 'CHUA_XU_LY' = isCriticalMismatch
    ? 'LECH'
    : softWarnings.length > 0
      ? 'CAN_KIEM_TRA'
      : 'KHOP';

  const finalErrors = isCriticalMismatch ? criticalErrors : softWarnings;

  return {
    finalStatus,
    finalErrors,
    criticalErrors,
    softWarnings,
    autoHealedNotes,
    discrepancyFlags,
  };
}

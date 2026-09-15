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
  finalStatus: 'KHOP' | 'LECH' | 'CAN_KIEM_TRA';
  finalErrors: string[];
  criticalErrors: string[];
  softWarnings: string[];
  autoHealedNotes: string[];
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
  const targetCccd = hdCccd || imgCccd || plCccd;
  const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').replace(/\D/g, '');

  let isCriticalMismatch = false;

  // Xác định trạng thái có dữ liệu MS thực tế
  const msFound = !!(
    ms.isFoundOnMS ||
    msCccd ||
    (ms.hoVaTen && String(ms.hoVaTen).trim()) ||
    (ms.maTKGD && String(ms.maTKGD).trim())
  );

  if (!msFound) {
    isCriticalMismatch = true;
    criticalErrors.push('Tài khoản chưa được tạo trên M-System');
  } else {
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
    const nameOk = anyPersonNameMatchesMs(
      ms.hoVaTen || ms.tenTKGD,
      record?.hopDong?.hoVaTen,
      record?.phuLuc?.hoVaTen,
      record?.canCuoc?.hoVaTen,
      mail.tenTaiKhoan,
      targetName,
    );
    if (targetName && msName && !nameOk && !isPersonNameMatch(targetName, msName)) {
      isCriticalMismatch = true;
      criticalErrors.push(`Lệch họ tên (Yêu cầu: ${targetName.toUpperCase()} != MS: ${ms.hoVaTen || ms.tenTKGD})`);
    }

    // 4. ĐỐI CHIẾU CCCD 3 BÊN THÔNG MINH (TRI-PARTY CONSENSUS)
    if (!isSubAccount) {
      if (!targetCccd) {
        isCriticalMismatch = true;
        const hasCccdImageEvidence = !!(
          record?.canCuoc?.source ||
          record?.canCuoc?.hoVaTen ||
          record?.canCuoc?.rawNgaySinh ||
          record?.canCuoc?.ngaySinh ||
          record?.canCuoc?.theGeneration ||
          (Array.isArray(record?.canCuoc?.canhBaoChatLuong) && record.canCuoc.canhBaoChatLuong.length > 0)
        );
        criticalErrors.push(
          hasCccdImageEvidence
            ? 'Không đọc được số CCCD từ ảnh/HĐ (có ảnh CCCD — có thể scan 2 mặt ghép hoặc OCR thất bại)'
            : 'Hồ sơ thiếu CCCD (Ảnh CCCD không hợp lệ/mờ và HĐ không có số)',
        );
      }

      // Chỉ cảnh báo khi MS đã có tài khoản nhưng trường số CCCD bị bỏ trống
      if (msFound && !msCccd) {
        isCriticalMismatch = true;
        criticalErrors.push('M-System chưa nhập số CCCD');
      }

      // Đối chiếu chéo giữa HĐ và ảnh CCCD
      if (hdCccd && imgCccd && hdCccd !== imgCccd) {
        const isChunkOrFuzzy = isCccdChunkSwapOrFuzzyMatch(hdCccd, imgCccd);
        const isHdMsMatching = !!(msCccd && hdCccd === msCccd);

        if (isHdMsMatching) {
          // NGUYÊN TẮC ĐỒNG THUẬN 2/3: HĐ và MS đều thống nhất số CCCD!
          if (isChunkOrFuzzy) {
            // Tự động chuẩn hóa hoàn toàn (Auto-Healed)
            autoHealedNotes.push(`Ảnh CCCD bị OCR đảo cụm số (Đã tự động chuẩn hóa theo HĐ & MS: ${hdCccd})`);
          } else {
            // Nghi vấn ảnh OCR mờ, nhưng HĐ và MS đã khớp -> Soft warning CAN_KIEM_TRA, KHÔNG đẩy LECH!
            softWarnings.push(`Nghi vấn ảnh CCCD (HĐ và MS đã khớp ${hdCccd} != Ảnh: ${imgCccd})`);
          }
        } else {
          // HĐ và MS chưa khớp nhau
          if (isChunkOrFuzzy) {
            softWarnings.push(`Ảnh CCCD có dấu hiệu đảo cụm số so với HĐ (HĐ: ${hdCccd} ~ Ảnh: ${imgCccd})`);
          } else {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch số CCCD giữa HĐ và ảnh CCCD (HĐ: ${hdCccd} != Ảnh: ${imgCccd})`);
          }
        }
      }
    }

    // Đối chiếu Target CCCD với MS
    if (targetCccd && msCccd && targetCccd !== msCccd) {
      // Ngoại lệ: nếu Target CCCD lấy từ Ảnh bị chunk swap nhưng HĐ khớp MS
      if (hdCccd && hdCccd === msCccd) {
        // HĐ đã khớp MS
      } else {
        isCriticalMismatch = true;
        criticalErrors.push(`Lệch số CCCD (Hồ sơ: ${targetCccd} != MS: ${msCccd})`);
      }
    }

    // 5. Đối chiếu Ngày sinh
    const hdDobRaw =
      record?.hopDong?.rawNgaySinh ||
      (record?.hopDong?.ngaySinh ? formatReconcileDateStr(record.hopDong.ngaySinh) : '') ||
      record?.canCuoc?.rawNgaySinh ||
      (record?.canCuoc?.ngaySinh ? formatReconcileDateStr(record.canCuoc.ngaySinh) : '');
    const msDobRaw = record?.ms?.rawNgaySinh || (record?.ms?.ngaySinh ? formatReconcileDateStr(record.ms.ngaySinh) : '');
    const normHdDob = normalizeDateStr(hdDobRaw);
    const normMsDob = normalizeDateStr(msDobRaw);

    if (isCanonicalDate(normHdDob) && isCanonicalDate(normMsDob)) {
      if (normHdDob !== normMsDob) {
        isCriticalMismatch = true;
        criticalErrors.push(`Lệch ngày sinh (HĐ/CCCD: ${normHdDob} != MS: ${normMsDob})`);
      }
    } else if (hdDobRaw && msDobRaw) {
      const getYear = (d: string) => (d.match(/\b(19\d{2}|20\d{2})\b/) || [])[0];
      const yHd = getYear(String(hdDobRaw));
      const yMs = getYear(String(msDobRaw));
      if (yHd && yMs && yHd !== yMs) {
        isCriticalMismatch = true;
        criticalErrors.push(`Lệch năm sinh (HĐ/CCCD: ${yHd} != MS: ${yMs})`);
      }
    }

    // 6. Đối chiếu Ngày cấp
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
    const normCccdIssue = normalizeDateStr(cccdIssueRaw);
    const normHdIssue = isHdIssueInvalid ? '' : normalizeDateStr(hdIssueCandidate);

    // Ưu tiên ngày cấp CCCD (vì CCCD là văn bản định danh chuẩn do Bộ Công An cấp)
    const effectiveIssue = (isCanonicalDate(normCccdIssue) && normCccdIssue === normMsIssue)
      ? normCccdIssue
      : (normCccdIssue || normHdIssue);

    if (isCanonicalDate(effectiveIssue) && isCanonicalDate(normMsIssue) && effectiveIssue !== normMsIssue) {
      isCriticalMismatch = true;
      criticalErrors.push(`Lệch ngày cấp (HĐ/CCCD: ${effectiveIssue} != MS: ${normMsIssue})`);
    }

    // 7. Đối chiếu Giới tính
    const hdSex = record?.hopDong?.rawGioiTinh || record?.hopDong?.gioiTinh || record?.canCuoc?.gioiTinh;
    const msSex = record?.ms?.gioiTinh || record?.ms?.rawGioiTinh;
    const hdSexUsable =
      !!hdSex &&
      !/điện\s*thoại|cccd|cmnd|^_+$/i.test(String(hdSex)) &&
      String(hdSex).trim().length >= 1;
    if (hdSexUsable && msSex && !isGenderMatch(hdSex, msSex)) {
      isCriticalMismatch = true;
      criticalErrors.push(`Lệch giới tính (HĐ: ${hdSex} != MS: ${msSex})`);
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
        hdSexUsable ? hdSex : msSex,
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
  }

  const finalStatus: 'KHOP' | 'LECH' | 'CAN_KIEM_TRA' = isCriticalMismatch
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
  };
}

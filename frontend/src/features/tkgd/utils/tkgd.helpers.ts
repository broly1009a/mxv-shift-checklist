import React from 'react';
import { CleanRecord, BadgeInfo } from '../types/tkgd.types';

/**
 * Định dạng ngày chuẩn DD/MM/YYYY (đảm bảo pad 2 chữ số cho ngày và tháng)
 */
export function formatDateStr(val?: any): string {
  if (!val) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';

  // 0. Nếu chỉ là chuỗi năm 4 chữ số (ví dụ: "1967"): Giữ nguyên năm sinh, tuyệt đối không tự sinh ra ngày 01/01
  if (/^\d{4}$/.test(str)) {
    return `${str} (Năm sinh)`;
  }

  // 1. Dạng chuỗi thuần ngày DD/MM/YYYY hoặc D/M/YYYY hoặc DD-MM-YYYY hoặc D-M-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  // 2. Chuỗi có chứa time hoặc ISO (T hoặc Z): Bắt buộc dùng new Date() theo múi giờ client (+7 GMT)
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // 3. Dạng thuần ngày YYYY-MM-DD hoặc YYYY/MM/DD (không có thành phần giờ T)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return str;
  }
}

/**
 * Làm sạch tên khách hàng từ email, loại bỏ chữ ký và dòng cam kết thừa
 */
export function cleanMailName(name?: string): string {
  if (!name) return '-';
  let s = name.split(/[\r\n]/)[0].trim();
  s = s.replace(/\s+(TVKD|Tài khoản|Mã TKGD|đã đính kèm|đề nghị|cam kết|kính gửi|HĐ|CCCD)[\s\S]*$/i, '').trim();
  return s.replace(/[;,.\-:]+$/, '').trim() || '-';
}

/**
 * Nhận diện Căn cước cũ (CMND 9 số hoặc CCCD không chip) theo quy định của Sở & TTTT
 */
export function checkIsOldIdCard(r?: CleanRecord | null): boolean {
  if (!r) return false;
  const num = (r.ms?.soCMND_HoChieu || r.canCuoc?.soCanCuoc || r.hopDong?.soCanCuoc || '').replace(/\D/g, '');
  if (num && num.length === 9) return true;
  if (r.ketLuan?.danhSachLoi?.some((err) => err.toLowerCase().includes('căn cước cũ'))) return true;
  if (r.canCuoc?.canhBaoChatLuong?.some((w) => w.toLowerCase().includes('căn cước cũ'))) return true;
  return false;
}

/**
 * Lấy màu sắc và nhãn badge phân hệ đơn lẻ (FUTURES, ACM, LME, SPREAD)
 */
export function getBadgeInfo(accountType?: string, code?: string): BadgeInfo {
  const target = (accountType || (code?.endsWith('-A') ? 'ACM' : code?.endsWith('-L') ? 'LME' : code?.endsWith('-S') ? 'SPREAD' : 'FUTURES')).toUpperCase();
  switch (target) {
    case 'ACM':
      return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)', label: 'ACM (-A)' };
    case 'LME':
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'LME (-L)' };
    case 'SPREAD':
      return { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)', label: 'SPREAD (-S)' };
    default:
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'FUTURES' };
  }
}

/**
 * Lấy danh sách badge phân hệ của toàn bộ tài khoản
 */
export function getAccountTypeBadges(record: CleanRecord): BadgeInfo[] {
  const types = new Set<string>();
  if (record.accountTypes && record.accountTypes.length > 0) {
    record.accountTypes.forEach((t) => types.add(t.toUpperCase()));
  } else {
    if (record.accountType) types.add(record.accountType.toUpperCase());
    if (record.noiDungMail?.hasACMRequest || record.maTKGD?.includes('-A')) types.add('ACM');
    if (types.size === 0) types.add('FUTURES');
  }
  return Array.from(types).map((t) => getBadgeInfo(t));
}


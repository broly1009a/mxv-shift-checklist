import { cleanPersonName } from '../bot-engine/helpers/tkgd-mail-parser.helper';

export function parseDate(dStr?: string): Date | undefined {
  if (!dStr) return undefined;
  const s = dStr.trim().replace(/-/g, '/');
  const p = s.split('/');
  if (p.length === 3) {
    let dd: number, mm: number, yyyy: number;
    if (p[0].length === 4) {
      yyyy = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      dd = parseInt(p[2], 10);
    } else {
      dd = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      yyyy = parseInt(p[2], 10);
    }
    const d = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? undefined : d;
}

export function formatDateStr(d?: Date | string | null): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const s = d.trim();
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }
  }
  const date = d instanceof Date ? d : parseDate(String(d));
  if (!date || isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = String(d).trim();
  const iso = s.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (iso) return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  const parts = s.split('T')[0].split(' ')[0].replace(/-/g, '/').split('/');
  if (parts.length !== 3) return '';
  if (parts[0].length === 4) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
}

export function isCanonicalDate(d: string | undefined | null): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(d || ''));
}

export function isIsoDateOnly(d: string | undefined | null): boolean {
  return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(String(d || '').trim());
}

export function pickValidPersonName(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    const cleaned = cleanPersonName(candidate || undefined);
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

export function inferFromCCCD(soCCCD?: string): { gioiTinh?: string; namSinh?: number } {
  if (!soCCCD) return {};
  const clean = soCCCD.replace(/\D/g, '');
  if (clean.length !== 12) return {};
  const genderCenturyDigit = parseInt(clean.charAt(3), 10);
  let gioiTinh: string | undefined;
  let century = 1900;
  if (genderCenturyDigit === 0 || genderCenturyDigit === 1) {
    gioiTinh = genderCenturyDigit === 0 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 2 || genderCenturyDigit === 3) {
    century = 2000;
    gioiTinh = genderCenturyDigit === 2 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 4 || genderCenturyDigit === 5) {
    century = 2100;
    gioiTinh = genderCenturyDigit === 4 ? 'Nam' : 'Nữ';
  }
  return { gioiTinh, namSinh: century + parseInt(clean.substring(4, 6), 10) };
}
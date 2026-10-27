/**
 * symbol-normalizer.helper.ts
 *
 * BỘ CHUẨN HÓA MÃ HỢP ĐỒNG (SYMBOL NORMALIZER) & HỢP NHẤT NORMALIZERS
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 *
 * Điểm chặn duy nhất (Single Point of Truth) để chuẩn hóa mã giữa:
 * - MS (M-System lõi MXV)
 * - CQG (Gateway giao dịch quốc tế)
 * - CE (CoreExchange sàn hàng hóa tập trung nội bộ)
 * - CCP (CoreCCP / VNCLEAR trung tâm bù trừ)
 * - TT (Trading Technologies sàn quốc tế mới)
 */

import {
  TT_TO_MXV_COMMODITY_MAP,
  TT_MONTH_TO_CODE,
} from './tt-symbol-mapping.config';

// Tái xuất toàn bộ bộ chuẩn hóa tài khoản giao dịch (TKGD Normalizer)
export * from './tkgd-normalizer.helper';

// Mappings for LME symbols (from statics.json)
export const LME_CODE_MAP: Record<string, string> = {
  LALZ: 'AHD',
  LDKZ: 'CAD',
  LEDZ: 'PBD',
  LNIZ: 'NID',
  LTIZ: 'SND',
  LZHZ: 'ZDS',
};

export const REVERSE_MONTH_CODE: Record<string, string> = {
  '01': 'F',
  '02': 'G',
  '03': 'H',
  '04': 'J',
  '05': 'K',
  '06': 'M',
  '07': 'N',
  '08': 'Q',
  '09': 'U',
  '10': 'V',
  '11': 'X',
  '12': 'Z',
};

/**
 * Quy đổi mã LME của CQG sang chuẩn M-System
 */
export function convertLMESymbol(symbol: string, date: Date, holidays: string[] = []): string {
  if (!symbol || !LME_CODE_MAP[symbol]) {
    return symbol;
  }

  const adjustedDate = new Date(date);
  adjustedDate.setMonth(adjustedDate.getMonth() + 3);

  const dayOfWeek = adjustedDate.getDay();
  if (dayOfWeek === 6) {
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  } else if (dayOfWeek === 0) {
    adjustedDate.setDate(adjustedDate.getDate() + 1);
  }

  const formatDDMMYYYY = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  let adjustedDateStr = formatDDMMYYYY(adjustedDate);
  const dayoffMap = new Map<string, string>();
  holidays.forEach((h: any) => {
    if (typeof h === 'string') {
      const parts = h.split(',');
      if (parts.length >= 2) {
        dayoffMap.set(parts[0].trim(), parts[1].trim());
      }
    } else if (h && typeof h === 'object' && h.originalDate && h.replacementDate) {
      dayoffMap.set(String(h.originalDate).trim(), String(h.replacementDate).trim());
    }
  });

  while (dayoffMap.has(adjustedDateStr)) {
    const nextDateStr = dayoffMap.get(adjustedDateStr);
    if (!nextDateStr) break;
    adjustedDateStr = nextDateStr;
    const [d, m, y] = adjustedDateStr.split('/').map(Number);
    adjustedDate.setFullYear(y, m - 1, d);
  }

  const newDay = String(adjustedDate.getDate()).padStart(2, '0');
  const newMonth = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const newYear = String(adjustedDate.getFullYear());

  const mapped = LME_CODE_MAP[symbol];
  const monthCode = REVERSE_MONTH_CODE[newMonth];
  if (!monthCode) {
    throw new Error(`Convert month failed for: ${newMonth}`);
  }
  const yearShort = newYear.substring(2);

  return `${mapped}D${newDay}${monthCode}${yearShort}`;
}

/**
 * Chuẩn hóa mã hợp đồng từ Trading Technologies (TT) sang CoreCCP / MXV
 * Hỗ trợ:
 * - Futures chuẩn: "CL Jan27" -> "CLEF27", "KE Dec26" -> "KWEZ26"
 * - Options: "C.CL Dec26 10000" -> "C.CLEZ26 10000"
 * - LME: "AH 21Jul26" -> "AHDD21N26"
 */
export function normalizeTTContractCode(ttContract: string): string {
  if (!ttContract) return '';
  const s = ttContract.trim();

  // 1. Phân loại Option: e.g. C.CL Dec26 10000 hoặc P.CL Jan27 9500
  const optMatch = s.match(/^(C\.|P\.)([A-Z0-9]+)\s+([A-Za-z]{3})(\d{2})\s*(.*)$/i);
  if (optMatch) {
    const optType = optMatch[1].toUpperCase();
    const ttFam = optMatch[2].toUpperCase();
    const month = optMatch[3].toUpperCase();
    const year = optMatch[4];
    const strike = optMatch[5].trim();
    const mxvFam = TT_TO_MXV_COMMODITY_MAP[ttFam] || ttFam;
    const mCode = TT_MONTH_TO_CODE[month] || month;
    const strikePart = strike ? ` ${strike}` : '';
    return `${optType}${mxvFam}${mCode}${year}${strikePart}`;
  }

  // 2. Phân loại LME: e.g. AH 21Jul26 -> AHDD21N26
  const lmeMatch = s.match(/^([A-Z0-9]+)\s+(\d{1,2})([A-Za-z]{3})(\d{2})$/i);
  if (lmeMatch) {
    const ttFam = lmeMatch[1].toUpperCase();
    const day = lmeMatch[2].padStart(2, '0');
    const month = lmeMatch[3].toUpperCase();
    const year = lmeMatch[4];
    const mxvFam = TT_TO_MXV_COMMODITY_MAP[ttFam] || ttFam;
    const mCode = TT_MONTH_TO_CODE[month] || month;
    return `${mxvFam}D${day}${mCode}${year}`;
  }

  // 3. Phân loại Futures tiêu chuẩn: e.g. CL Jan27 -> CLEF27, KE Dec26 -> KWEZ26
  const futMatch = s.match(/^([A-Z0-9]+)\s+([A-Za-z]{3})(\d{2})$/i);
  if (futMatch) {
    const ttFam = futMatch[1].toUpperCase();
    const month = futMatch[2].toUpperCase();
    const year = futMatch[3];
    const mxvFam = TT_TO_MXV_COMMODITY_MAP[ttFam] || ttFam;
    const mCode = TT_MONTH_TO_CODE[month] || month;
    return `${mxvFam}${mCode}${year}`;
  }

  return s;
}

/**
 * Điểm chặn duy nhất (Single Point of Truth) để chuẩn hóa mã hợp đồng trên toàn hệ thống.
 * Sẵn sàng đón nhận dữ liệu từ CoreExchange (CE), CoreCCP (CCP), TT và Ingress API mới.
 */
export function normalizeContractCode(
  rawSymbol: string,
  source: 'MS' | 'CQG' | 'CE' | 'CCP' | 'TT',
  context?: { date?: Date; holidays?: string[] },
): string {
  if (!rawSymbol) return '';
  let sym = rawSymbol.trim().toUpperCase();

  switch (source) {
    case 'TT': {
      return normalizeTTContractCode(rawSymbol);
    }
    case 'CQG': {
      // Bỏ tiền tố Option nếu có
      if (sym.startsWith('C.') || sym.startsWith('P.')) {
        sym = sym.substring(2);
      }
      // Quy đổi mã LME nếu thuộc danh mục LME
      return convertLMESymbol(sym, context?.date || new Date(), context?.holidays || []);
    }
    case 'MS': {
      return sym;
    }
    case 'CE':
    case 'CCP': {
      // Chuẩn hóa mã sàn nội bộ CoreExchange / CoreCCP:
      // Xóa bỏ khoảng trống thừa, chuẩn hóa dấu gạch ngang/dưới nếu có
      return sym.replace(/[\s_]+/g, '');
    }
    default:
      return sym;
  }
}

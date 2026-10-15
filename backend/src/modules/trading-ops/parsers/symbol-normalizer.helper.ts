/**
 * symbol-normalizer.helper.ts
 *
 * Bộ chuẩn hóa mã hợp đồng (Symbol Normalizer) & Tài khoản (Account Normalizer)
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 *
 * Làm điểm chặn duy nhất (Single Point of Truth) để chuẩn hóa mã giữa:
 * - MS (M-System lõi MXV)
 * - CQG (Gateway giao dịch quốc tế)
 * - CE (CoreExchange sàn hàng hóa tập trung nội bộ)
 * - CCP (CoreCCP / VNCLEAR trung tâm bù trừ)
 */

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
 * Chuẩn hóa số tài khoản giao dịch (Account Normalizer)
 * Ví dụ: 001C123456F -> 001C123456, 001C123456L -> 001C123456-L
 */
export function getNormalizedAccount(account: string): string {
  if (!account) return '';
  let acc = account.trim();
  acc = acc.replace(/F$/i, '');
  acc = acc.replace(/L$/i, '-L');
  acc = acc.replace(/S$/i, '-S');
  acc = acc.replace(/--/g, '-');
  return acc.toUpperCase();
}

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
 * Điểm chặn duy nhất (Single Point of Truth) để chuẩn hóa mã hợp đồng trên toàn hệ thống.
 * Sẵn sàng đón nhận dữ liệu từ CoreExchange (CE), CoreCCP (CCP) và Ingress API mới.
 */
export function normalizeContractCode(
  rawSymbol: string,
  source: 'MS' | 'CQG' | 'CE' | 'CCP',
  context?: { date?: Date; holidays?: string[] },
): string {
  if (!rawSymbol) return '';
  let sym = rawSymbol.trim().toUpperCase();

  switch (source) {
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
      // Xóa bỏ khoảng trắng thừa, chuẩn hóa dấu gạch ngang/dưới nếu có
      return sym.replace(/[\s_]+/g, '');
    }
    default:
      return sym;
  }
}

import * as fs from 'fs';
import * as path from 'path';

/**
 * BỘ TỪ ĐIỂN MẪU TỆP CHUẨN DUY NHẤT (SINGLE SOURCE OF TRUTH FOR FILE PATTERNS)
 *
 * Tất cả các phân hệ: Pre-flight Inspector, RPA/Crawler, Macro Worker, Reconciliation
 * BẮT BUỘC phải dùng chung từ điển này.
 * TUYỆT ĐỐI không viết regex riêng rẽ ở các service/worker khác nhau để loại bỏ 100% nguy cơ lệch pha (Pattern Drift).
 *
 * Tuân thủ nghiêm ngặt:
 * - AGENTS.md Mục 2 Rule 1: Duy nhất Straits CSV cho ACM Nano.
 * - AGENTS.md Mục 2 Rule 2: Cặp file thô CQG (FR1/FR2, PS1/PS2, OP1/OP2, OD1/OD2).
 */
export const TRADING_FILE_PATTERNS = {
  // ── 1. CoreCCP (Toàn thị trường) ──────────────────────────────────────────
  CCP_DSGD: [
    /^DSGD(?!\s*MM).*\.csv$/i,
    /^DSGD(?!\s*MM).*\.xlsx$/i,
    /^DSGD(?!\s*MM).*\.xls$/i,
    /^ORDERMATCH_DETAIL.*\.xlsx$/i,
    /^ORDERMATCH.*\.xlsx$/i,
    /^ORDERMATCH.*\.csv$/i,
    /^DSGD.*\.csv$/i,
    /^DSGD.*\.xlsx$/i,
    /^DSGD.*\.xls$/i,
  ],
  CCP_TTM: [
    /^TTM.*\.xlsx$/i,
    /^TTM.*\.xls$/i,
    /^TTM.*\.csv$/i,
    /^OPEN_POSITION.*\.xlsx$/i,
    /^OPEN_POSITION.*\.csv$/i,
  ],
  CCP_TTTT: [
    /^TTTT.*\.xlsx$/i,
    /^TTTT.*\.xls$/i,
    /^TTTT.*\.csv$/i,
    /^PNL_EXECUTED.*\.xlsx$/i,
    /^PNL_EXECUTED.*\.csv$/i,
  ],
  TY_GIA: [
    /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate|TYGIA).*\.xlsx$/i,
    /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate|TYGIA).*\.xls$/i,
    /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate|TYGIA).*\.csv$/i,
  ],
  MA_HD_COMMODITY: [
    /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xlsx$/i,
    /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xls$/i,
    /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.csv$/i,
  ],

  // ── 2. CoreEX (ACM Nano & Kim loại) ───────────────────────────────────────
  CE_DSGD: [
    /^DSGD.*ACM.*CE.*\.xlsx$/i,
    /^DSGD.*CE.*\.xlsx$/i,
    /^DSGD.*\.xlsx$/i,
    /^DSGD.*\.csv$/i,
    /.*Straits.*\.csv$/i,
  ],
  CE_TTM: [
    /^TTM.*CE.*\.xlsx$/i,
    /^TTM.*\.xlsx$/i,
    /^TTM.*\.csv$/i,
  ],
  CE_GTT: [
    /^GTT.*ACM.*\.xlsx$/i,
    /^GTT.*\.xlsx$/i,
    /^GTT.*\.csv$/i,
  ],
  CE_HH: [
    /^HH.*ACM.*\.xlsx$/i,
    /^HH.*\.xlsx$/i,
    /^HH.*\.csv$/i,
  ],
  CE_HD: [
    /^HĐ.*\.xlsx$/i,
    /^HD.*\.xlsx$/i,
  ],

  // ── 3. M-System ───────────────────────────────────────────────────────────
  MS_TKGD: [
    /.*TKGD.*\.xlsx$/i,
    /.*TKGD.*\.csv$/i,
    /^DSGD.*\.xlsx$/i,
  ],
  MS_DSGD: [
    /^DSGD(?!\s*MM).*\.xlsx$/i,
    /^DSGD(?!\s*MM).*\.csv$/i,
    /.*DSGD.*MS.*\.xlsx$/i,
    /^DSGD.*\.xlsx$/i,
  ],
  MS_TTM: [
    /^TTM.*\.xlsx$/i,
    /^TTM.*\.csv$/i,
  ],
  MS_TTTT: [
    /^TTTT.*\.xlsx$/i,
    /^TTTT.*\.csv$/i,
  ],

  // ── 4. CQG Futures ────────────────────────────────────────────────────────
  CQG_FR: [
    /^FR\.xlsx$/i,
    /^FR1\.xlsx$/i,
    /^FR2\.xlsx$/i,
    /.*FR.*\.xlsx$/i,
  ],
  CQG_OP: [
    /^OP\.xlsx$/i,
    /^OP1\.xlsx$/i,
    /^OP2\.xlsx$/i,
    /.*OP.*\.xlsx$/i,
  ],
  CQG_PS: [
    /^PS\.xlsx$/i,
    /^PS1\.xlsx$/i,
    /^PS2\.xlsx$/i,
    /.*PS.*\.xlsx$/i,
  ],
  CQG_OD: [
    /^Od\.xlsx$/i,
    /^OD1\.xlsx$/i,
    /^OD2\.xlsx$/i,
    /.*Od.*\.xlsx$/i,
  ],

  // ── 5. Straits CSV (ACM Nano Chuẩn) ───────────────────────────────────────
  STRAITS_CSV: [
    /.*Straits.*\.csv$/i,
    /^Straits.*\.csv$/i,
  ],

  // ── 6. Margin Checker & Post-EOD ──────────────────────────────────────────
  MARGIN_DETAIL: [
    /.*Margin.*Requirement.*Detail.*\.xlsx$/i,
    /.*Margin.*Detail.*\.xlsx$/i,
  ],
  NET_POSITION: [
    /.*Net.*Position.*\.xlsx$/i,
  ],
};

/**
 * Kiểm tra một tên tệp có khớp với danh sách pattern không.
 * Tự động bỏ qua các tệp khóa tạm thời của Excel (~$...).
 */
export function matchTradingFileName(
  filename: string,
  patterns: (RegExp | string)[],
): boolean {
  if (!filename || filename.startsWith('~$')) return false;

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (filename.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    } else if (pattern.test(filename)) {
      return true;
    }
  }
  return false;
}

/**
 * Tìm tệp đầu tiên trong thư mục khớp với danh sách pattern đã cho.
 * Dùng chung giữa Pre-flight Service và các Worker/Services tính toán thật.
 */
export function findMatchingTradingFile(
  dirPath: string,
  patterns: (RegExp | string)[],
): { filename: string; fullPath: string; size: number } | null {
  if (!fs.existsSync(dirPath)) return null;

  try {
    const files = fs.readdirSync(dirPath);
    for (const pattern of patterns) {
      const match = files.find((f) => matchTradingFileName(f, [pattern]));
      if (match) {
        const fullPath = path.join(dirPath, match);
        try {
          const stat = fs.statSync(fullPath);
          return {
            filename: match,
            fullPath,
            size: stat.size,
          };
        } catch {
          // Bỏ qua lỗi stat và tiếp tục
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

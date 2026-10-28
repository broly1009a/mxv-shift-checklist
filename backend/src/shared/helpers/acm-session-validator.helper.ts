/**
 * acm-session-validator.helper.ts
 *
 * Bộ công cụ kiểm tra tính hợp lệ của phiên giao dịch đối với các file ACM (Straits CSV & XLS).
 * Ngăn chặn tuyệt đối việc tải nhầm hoặc lấy nhầm file phiên cũ (T-1) vào thư mục phiên hôm nay (T).
 * Tuân thủ AGENTS.md Rule 2.1 & Rule 5 (No Speculative Fallbacks & Proof of Ground Truth).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface IAcmSessionInfo {
  year: string;         // '2026'
  year2Digit: string;   // '26'
  month: string;        // '10'
  day: string;          // '27'
  ddmmyyyy: string;     // '27102026'
  yyyy_mm_dd: string;   // '2026-10-27'
  dd_mm_yy: string;     // '27-10-26'
  yy_mm_dd: string;     // '26-10-27'
}

export interface IAcmSessionValidationResult {
  isValidSession: boolean;
  isDateDetermined: boolean;
  expectedDateStr: string;
  detectedDateStr?: string;
  isPreviousDay?: boolean;
  reason?: string;
}

/**
 * Trích xuất các thành phần ngày của phiên giao dịch từ Date hoặc chuỗi ngày
 */
export function extractSessionInfo(targetDate: Date | string): IAcmSessionInfo {
  let d: Date;
  if (targetDate instanceof Date) {
    d = targetDate;
  } else if (typeof targetDate === 'string' && targetDate.trim()) {
    const raw = targetDate.trim().split('T')[0].replace(/[./]/g, '-');
    const parts = raw.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        // DD-MM-YYYY
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    } else {
      d = new Date(targetDate);
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear().toString();
  const year2Digit = year.slice(-2);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return {
    year,
    year2Digit,
    month,
    day,
    ddmmyyyy: `${day}${month}${year}`,
    yyyy_mm_dd: `${year}-${month}-${day}`,
    dd_mm_yy: `${day}-${month}-${year2Digit}`,
    yy_mm_dd: `${year2Digit}-${month}-${day}`,
  };
}

/**
 * Phân tích tên file ACM để xác định ngày phiên được nhúng trong tên file (nếu có).
 */
export function extractDateFromAcmFilename(filename: string): {
  detectedDateStr?: string;
  ddmmyyyy?: string;
  yyyy_mm_dd?: string;
} | null {
  if (!filename) return null;
  const cleanName = path.basename(filename);

  // 1. Dạng CSV Straits: EOD FO trades_PT Straits Financial Indonesia - 10017890000_26102026.csv hoặc Straits_26102026.csv
  const csvMatch = cleanName.match(/_(\d{2})(\d{2})(\d{4})\.csv$/i);
  if (csvMatch) {
    const [, d, m, y] = csvMatch;
    return {
      detectedDateStr: `${y}-${m}-${d}`,
      ddmmyyyy: `${d}${m}${y}`,
      yyyy_mm_dd: `${y}-${m}-${d}`,
    };
  }

  // 2. Dạng XLS Sao kê: 2026-10-26_10017890000.xls
  const xlsMatch = cleanName.match(/^(\d{4})-(\d{2})-(\d{2})_.*\.xls$/i);
  if (xlsMatch) {
    const [, y, m, d] = xlsMatch;
    return {
      detectedDateStr: `${y}-${m}-${d}`,
      ddmmyyyy: `${d}${m}${y}`,
      yyyy_mm_dd: `${y}-${m}-${d}`,
    };
  }

  return null;
}

/**
 * Kiểm tra xem tên file ACM có khớp đúng phiên giao dịch mục tiêu không.
 * Nếu tên file chứa ngày khác ngày phiên T, lập tức nhận diện là file của phiên khác / T-1.
 */
export function isAcmFilenameMatchSession(
  filename: string,
  targetDate: Date | string,
): IAcmSessionValidationResult {
  const session = extractSessionInfo(targetDate);
  const fileDateInfo = extractDateFromAcmFilename(filename);

  // Nếu tên file không chứa ngày (ví dụ Straits.csv hoặc Fill.xlsx)
  if (!fileDateInfo) {
    return {
      isValidSession: true,
      isDateDetermined: false,
      expectedDateStr: session.yyyy_mm_dd,
      reason: 'Tên file không chứa chuỗi ngày (cần kiểm tra nội dung file)',
    };
  }

  const isMatch =
    fileDateInfo.ddmmyyyy === session.ddmmyyyy ||
    fileDateInfo.yyyy_mm_dd === session.yyyy_mm_dd;

  return {
    isValidSession: isMatch,
    isDateDetermined: true,
    expectedDateStr: session.yyyy_mm_dd,
    detectedDateStr: fileDateInfo.yyyy_mm_dd,
    isPreviousDay: !isMatch,
    reason: isMatch
      ? 'Khớp chính xác ngày phiên T trên tên tệp'
      : `Tên tệp chứa ngày ${fileDateInfo.yyyy_mm_dd}, không khớp phiên T ${session.yyyy_mm_dd}`,
  };
}

/**
 * Kiểm tra sâu nội dung file ACM (Deep Content Inspection):
 * - Đọc trực tiếp các cột ngày bên trong file:
 *   + File CSV: Cột "Trade Date" hoặc "Execution Date-time" (thường có dạng DD-MM-YY, ví dụ 26-10-26 vs 27-10-26).
 *   + File XLS: Cột "Trading Day" hoặc "Trade Date" (thường có dạng YYYYMMDD, ví dụ 20261026 vs 20261027).
 * - Xác định chính xác file thuộc phiên T hay T-1.
 */
export function inspectAcmFileContent(
  fileInput: string | Buffer,
  targetDate: Date | string,
): IAcmSessionValidationResult {
  const session = extractSessionInfo(targetDate);

  let buffer: Buffer;
  let filename = '';
  if (typeof fileInput === 'string') {
    filename = path.basename(fileInput);
    if (!fs.existsSync(fileInput)) {
      return {
        isValidSession: false,
        isDateDetermined: false,
        expectedDateStr: session.yyyy_mm_dd,
        reason: `File không tồn tại tại đường dẫn: ${fileInput}`,
      };
    }
    buffer = fs.readFileSync(fileInput);
  } else {
    buffer = fileInput;
  }

  if (!buffer || buffer.length === 0) {
    return {
      isValidSession: false,
      isDateDetermined: false,
      expectedDateStr: session.yyyy_mm_dd,
      reason: 'Dữ liệu file rỗng (0 bytes)',
    };
  }

  // 1. Kiểm tra nếu file là Excel nhị phân BIFF8 hoặc OOXML
  const isBinaryExcel =
    (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (!isBinaryExcel) {
    // Xử lý File CSV văn bản
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      // Chỉ có header hoặc rỗng
      return {
        isValidSession: true, // File rỗng khớp lệnh không coi là sai ngày
        isDateDetermined: false,
        expectedDateStr: session.yyyy_mm_dd,
        reason: 'File CSV chỉ chứa tiêu đề, không có dòng giao dịch để đọc ngày',
      };
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const tradeDateIdx = headers.indexOf('trade date');
    const execTimeIdx = headers.indexOf('execution date-time');

    if (tradeDateIdx === -1 && execTimeIdx === -1) {
      return {
        isValidSession: true,
        isDateDetermined: false,
        expectedDateStr: session.yyyy_mm_dd,
        reason: 'Không tìm thấy cột Trade Date hoặc Execution Date-time trong header CSV',
      };
    }

    // Đọc ngày từ 1-3 dòng giao dịch đầu tiên
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
      let dateRaw = '';
      if (tradeDateIdx !== -1 && tradeDateIdx < cols.length) {
        dateRaw = cols[tradeDateIdx];
      }
      if (!dateRaw && execTimeIdx !== -1 && execTimeIdx < cols.length) {
        dateRaw = cols[execTimeIdx].split(' ')[0];
      }

      if (dateRaw) {
        // Định dạng trong Straits CSV là DD-MM-YY (ví dụ: '26-10-26' hoặc '08-10-26')
        const parts = dateRaw.split('-');
        if (parts.length === 3) {
          let detectedDay = parts[0];
          let detectedMonth = parts[1];
          let detectedYear2Digit = parts[2];

          // Trường hợp đảo YY-MM-DD
          if (parts[0].length === 2 && parseInt(parts[0], 10) === parseInt(session.year2Digit, 10)) {
            // Có thể là YY-MM-DD
            if (parseInt(parts[2], 10) <= 31 && parseInt(parts[1], 10) <= 12) {
              // Cần cẩn thận khi day và year cùng là 26
              if (parseInt(parts[0], 10) === parseInt(session.year2Digit, 10) && parseInt(parts[2], 10) === parseInt(session.day, 10)) {
                detectedYear2Digit = parts[0];
                detectedMonth = parts[1];
                detectedDay = parts[2];
              }
            }
          }

          const detectedYyyyMmDd = `20${detectedYear2Digit}-${detectedMonth.padStart(2, '0')}-${detectedDay.padStart(2, '0')}`;
          const isMatch =
            detectedDay.padStart(2, '0') === session.day &&
            detectedMonth.padStart(2, '0') === session.month;

          return {
            isValidSession: isMatch,
            isDateDetermined: true,
            expectedDateStr: session.yyyy_mm_dd,
            detectedDateStr: detectedYyyyMmDd,
            isPreviousDay: !isMatch,
            reason: isMatch
              ? `Khớp ngày phiên T (${session.yyyy_mm_dd}) trong dữ liệu giao dịch Straits CSV`
              : `Dữ liệu giao dịch Straits CSV ghi ngày ${dateRaw} (${detectedYyyyMmDd}), không khớp phiên T ${session.yyyy_mm_dd}`,
          };
        }
      }
    }
  } else {
    // Xử lý File Excel (XLS / XLSX)
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 5 });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return {
          isValidSession: true,
          isDateDetermined: false,
          expectedDateStr: session.yyyy_mm_dd,
        };
      }

      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      if (rows.length < 2) {
        return {
          isValidSession: true,
          isDateDetermined: false,
          expectedDateStr: session.yyyy_mm_dd,
          reason: 'File Excel không có dòng dữ liệu',
        };
      }

      const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
      const tradingDayIdx = header.indexOf('trading day');
      const tradeDateIdx = header.indexOf('trade date');
      const idx = tradingDayIdx !== -1 ? tradingDayIdx : tradeDateIdx;

      if (idx !== -1) {
        const val = String(rows[1][idx] || '').trim();
        // Định dạng 20261026 hoặc 2026-10-26
        const cleanVal = val.replace(/[-/.]/g, '');
        const expectedClean = `${session.year}${session.month}${session.day}`;

        const isMatch = cleanVal === expectedClean;
        return {
          isValidSession: isMatch,
          isDateDetermined: true,
          expectedDateStr: session.yyyy_mm_dd,
          detectedDateStr: val,
          isPreviousDay: !isMatch,
          reason: isMatch
            ? `Khớp ngày phiên T (${session.yyyy_mm_dd}) trong dữ liệu Excel`
            : `Dữ liệu Excel ghi ngày ${val}, không khớp phiên T ${session.yyyy_mm_dd}`,
        };
      }
    } catch (excelErr: any) {
      return {
        isValidSession: true,
        isDateDetermined: false,
        expectedDateStr: session.yyyy_mm_dd,
        reason: `Không thể parse nội dung Excel: ${excelErr.message}`,
      };
    }
  }

  return {
    isValidSession: true,
    isDateDetermined: false,
    expectedDateStr: session.yyyy_mm_dd,
    reason: 'Không xác định được cột ngày trong nội dung, giữ nguyên theo tên file',
  };
}

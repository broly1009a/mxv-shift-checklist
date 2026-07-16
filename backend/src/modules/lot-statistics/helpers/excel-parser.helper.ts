/**
 * excel-parser.helper.ts
 * Đọc file Excel từ Buffer (multipart upload)
 * Thay thế: Workbooks.Open() trong VBA
 */

import * as ExcelJS from 'exceljs';

export interface ParsedRow {
  [key: string]: string | number | boolean | Date | null;
}

export interface ParsedSheet {
  headers: string[];
  rows: ParsedRow[];
  /** Dữ liệu thô theo index (1-based col, 0-based row) */
  rawRows: (string | number | boolean | Date | null)[][];
}

/**
 * Đọc sheet từ Buffer Excel
 * @param buffer   - Buffer của file xlsx
 * @param sheetIndex - index sheet (0-based), mặc định 0 = sheet đầu
 * @param hasHeader  - dòng 1 có phải header không, mặc định true
 */
export async function parseExcelBuffer(
  buffer: any,
  sheetIndex = 0,
  hasHeader = true,
): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheets = workbook.worksheets;
  if (worksheets.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const ws = worksheets[Math.min(sheetIndex, worksheets.length - 1)];
  const rawRows: (string | number | boolean | Date | null)[][] = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = (row.values as ExcelJS.CellValue[]).slice(1); // bỏ index 0
    const normalized = cells.map((cell): string | number | boolean | Date | null => {
      if (cell === null || cell === undefined) return null;
      if (cell instanceof Date) return cell;
      if (typeof cell === 'object') {
        if ('result' in cell) {
          const r = (cell as ExcelJS.CellFormulaValue).result;
          if (r instanceof Date) return r;
          return (r as string | number | boolean | null) ?? null;
        }
        if ('richText' in cell) {
          return (cell as ExcelJS.CellRichTextValue).richText
            .map((rt) => rt.text)
            .join('');
        }
        if ('text' in (cell as object)) {
          return String((cell as { text: string }).text);
        }
        // Hyperlink, etc.
        return String(cell);
      }
      return cell as string | number | boolean;
    });
    rawRows.push(normalized);
  });

  if (rawRows.length === 0) return { headers: [], rows: [], rawRows: [] };

  if (!hasHeader) {
    // Không có header: tạo col1, col2, ...
    const maxCols = Math.max(...rawRows.map((r) => r.length));
    const headers = Array.from({ length: maxCols }, (_, i) => `col${i + 1}`);
    const rows: ParsedRow[] = rawRows.map((raw) => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => (obj[h] = raw[i] ?? null));
      return obj;
    });
    return { headers, rows, rawRows };
  }

  // Có header: dòng 0 là header
  const headerRow = rawRows[0];
  const headers = headerRow.map((h, i) =>
    h !== null && h !== undefined && String(h).trim()
      ? String(h).trim()
      : `col${i + 1}`,
  );

  const dataRows = rawRows.slice(1);
  const rows: ParsedRow[] = dataRows.map((raw) => {
    const obj: ParsedRow = {};
    headers.forEach((h, i) => {
      obj[h] = raw[i] ?? null;
      obj[`col${i + 1}`] = raw[i] ?? null; // luôn có fallback theo index
    });
    return obj;
  });

  return { headers, rows, rawRows: dataRows };
}

/**
 * Lấy giá trị số từ cell (VALUE() trong Excel)
 */
export function toNum(val: string | number | boolean | Date | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return 0;
  const n = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

/**
 * Lấy giá trị string từ cell
 */
export function toStr(val: string | number | boolean | Date | null | undefined): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val).trim();
}

/**
 * Phân tích chuỗi ngày dạng ngày/tháng/năm (ví dụ 3/7/26 hoặc 06-07-2026)
 */
export function parseDateDMY(val: string): Date | null {
  const match = val.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?)?/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-based month
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;
  const hour = match[4] ? parseInt(match[4], 10) : 0;
  const min = match[5] ? parseInt(match[5], 10) : 0;
  const sec = match[6] ? parseInt(match[6], 10) : 0;
  const ms = match[7] ? parseInt(match[7].substring(0, 3).padEnd(3, '0'), 10) : 0;
  return new Date(year, month, day, hour, min, sec, ms);
}

/**
 * Lấy giá trị Date từ cell (hoặc Excel serial number)
 */
export function toDate(
  val: string | number | boolean | Date | null | undefined,
): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel date serial: 1 = Jan 1, 1900
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  const strVal = String(val);
  const dmy = parseDateDMY(strVal);
  if (dmy) return dmy;

  const d = new Date(strVal);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Utility: Đọc file Excel (.xlsx / .xlsm / .csv)
 * Thay thế cho Workbooks.Open() + sheet.Cells.Copy trong VBA
 */

import * as ExcelJS from 'exceljs';
import * as path from 'path';

export interface SheetData {
  headers: string[];
  rows: Record<string, unknown>[];
  rawRows: (string | number | boolean | Date | null)[][];
}

/**
 * Đọc tất cả các dòng từ một sheet Excel
 * @param filePath Đường dẫn file
 * @param sheetNameOrIndex Tên sheet hoặc index (0-based). Mặc định: sheet đầu tiên.
 * @param headerRow Dòng header (1-based). Mặc định: 1
 */
export async function readExcelSheet(
  filePath: string,
  sheetNameOrIndex: string | number = 0,
  headerRow = 1,
): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  let worksheet: ExcelJS.Worksheet | undefined;
  if (typeof sheetNameOrIndex === 'number') {
    worksheet = workbook.worksheets[sheetNameOrIndex];
  } else {
    worksheet = workbook.getWorksheet(sheetNameOrIndex);
  }

  if (!worksheet) {
    throw new Error(
      `Sheet "${sheetNameOrIndex}" không tìm thấy trong file: ${filePath}`,
    );
  }

  const rawRows: (string | number | boolean | Date | null)[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = row.values as (ExcelJS.CellValue)[];
    // row.values có index bắt đầu từ 1, bỏ phần tử 0
    const normalized = cells.slice(1).map((cell) => {
      if (cell === null || cell === undefined) return null;
      if (cell instanceof Date) return cell;
      if (typeof cell === 'object' && 'result' in (cell as object)) {
        // Formula cell
        return (cell as ExcelJS.CellFormulaValue).result as string | number | boolean | null;
      }
      if (typeof cell === 'object' && 'richText' in (cell as object)) {
        // Rich text: join all text segments
        const rtv = cell as ExcelJS.CellRichTextValue;
        return rtv.richText.map((rt) => rt.text).join('');
      }
      return cell as string | number | boolean;
    });
    rawRows.push(normalized);
  });

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // Lấy headers từ headerRow (1-based trong worksheet = index headerRow-1 trong rawRows)
  const headerRowData = rawRows[headerRow - 1] ?? [];
  const headers = headerRowData.map((h) =>
    h !== null && h !== undefined ? String(h).trim() : '',
  );

  // Map các dòng data (sau headerRow) thành object
  const dataRows = rawRows.slice(headerRow);
  const rows: Record<string, unknown>[] = dataRows.map((rawRow) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, colIdx) => {
      if (header) {
        obj[header] = rawRow[colIdx] ?? null;
      }
    });
    // Cũng lưu theo index để fallback
    rawRow.forEach((val, colIdx) => {
      obj[`col${colIdx + 1}`] = val;
    });
    return obj;
  });

  return { headers, rows, rawRows: dataRows };
}

/**
 * Đọc toàn bộ workbook (tất cả sheets)
 */
export async function readWorkbook(
  filePath: string,
): Promise<Map<string, SheetData>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const result = new Map<string, SheetData>();
  for (const ws of workbook.worksheets) {
    try {
      const data = await readExcelSheet(filePath, ws.name);
      result.set(ws.name, data);
    } catch {
      // skip empty/protected sheets
    }
  }
  return result;
}

/**
 * Lấy sheet cuối cùng trong workbook (VBA: Sheets(Sheets.Count))
 */
export async function readLastSheet(filePath: string): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets = workbook.worksheets;
  if (sheets.length === 0) {
    throw new Error(`File không có sheet nào: ${filePath}`);
  }
  const lastSheet = sheets[sheets.length - 1];
  return readExcelSheet(filePath, lastSheet.name);
}

/**
 * Ghi dữ liệu vào file Excel hiện tại (append/update một dòng theo vị trí)
 * Tương đương với: ws.Cells(i, col).PasteSpecial xlPasteValues
 */
export async function writeRowToExcel(
  filePath: string,
  sheetName: string,
  rowIndex: number,  // 1-based
  colIndex: number,  // 1-based
  values: (string | number | Date | null)[],
  transpose = false,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const ws = workbook.getWorksheet(sheetName);
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" không tìm thấy: ${filePath}`);
  }

  if (transpose) {
    // Paste transposed: values đi theo cột
    values.forEach((val, idx) => {
      ws.getCell(rowIndex + idx, colIndex).value = val;
    });
  } else {
    // Paste theo dòng: values đi theo cột
    values.forEach((val, idx) => {
      ws.getCell(rowIndex, colIndex + idx).value = val;
    });
  }

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Tìm dòng theo giá trị trong cột (tương đương MATCH trong VBA)
 * @returns row index (1-based) hoặc -1 nếu không tìm thấy
 */
export function matchRowIndex(
  rows: Record<string, unknown>[],
  columnKey: string,
  searchValue: unknown,
): number {
  for (let i = 0; i < rows.length; i++) {
    const cellVal = rows[i][columnKey];
    // So sánh linh hoạt: Date, number, string
    if (compareCellValues(cellVal, searchValue)) {
      return i + 1; // 1-based như VBA
    }
  }
  return -1;
}

/**
 * So sánh hai giá trị cell Excel (xử lý Date, number, string)
 */
function compareCellValues(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.toDateString() === b.toDateString();
  }
  if (a instanceof Date && typeof b === 'string') {
    return formatDate(a) === b.trim();
  }
  if (typeof b === 'string' && typeof a === 'number') {
    return String(a) === b.trim();
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Format date thành dd/mm/yyyy
 */
export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Chuyển Excel serial date number thành Date object
 * Excel date serial: 1 = Jan 1 1900
 */
export function excelSerialToDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

/**
 * Lấy số value từ cell (xử lý string số, null)
 * Tương đương VALUE() trong Excel
 */
export function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

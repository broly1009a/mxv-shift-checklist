import * as ExcelJS from 'exceljs';

/**
 * Robust date comparison matcher for Excel cell values against target date
 */
export function isSameDate(cellVal: any, targetDate: Date): boolean {
  if (cellVal === null || cellVal === undefined || !targetDate) return false;
  const targetDateObj =
    targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (isNaN(targetDateObj.getTime())) return false;

  let d: Date | null = null;

  if (cellVal instanceof Date) {
    if (!isNaN(cellVal.getTime())) d = cellVal;
  } else if (typeof cellVal === 'number') {
    const epoch = new Date(1899, 11, 30);
    const parsed = new Date(epoch.getTime() + cellVal * 86400000);
    if (!isNaN(parsed.getTime())) d = parsed;
  } else if (typeof cellVal === 'object' && cellVal !== null) {
    if (
      'result' in cellVal &&
      cellVal.result !== undefined &&
      cellVal.result !== null
    ) {
      return isSameDate(cellVal.result, targetDateObj);
    }
  } else {
    const str = String(cellVal).trim();
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      let year = parseInt(match[3], 10);
      if (year < 100) year += 2000;
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
  }

  if (!d || isNaN(d.getTime())) return false;

  const formatYMD = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const formatUtcYMD = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  const tLocal = formatYMD(targetDateObj);
  const tUtc = formatUtcYMD(targetDateObj);
  const dLocal = formatYMD(d);
  const dUtc = formatUtcYMD(d);

  return (
    dLocal === tLocal ||
    dLocal === tUtc ||
    dUtc === tLocal ||
    dUtc === tUtc
  );
}

export function getNextWorkday(d: Date): Date | null {
  if (!d || isNaN(d.getTime())) return null;
  const next = new Date(d);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);
  return isNaN(next.getTime()) ? null : next;
}

/**
 * Lấy tên Sheet tháng chuẩn (ví dụ: T10.2026)
 */
export function getSheetName(filename: string, date: Date): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (filename.toLowerCase().includes('options')) {
    return `T${month}.${year}`;
  }
  const monthStr = month.toString().padStart(2, '0');
  return `T${monthStr}.${year}`;
}

/**
 * Tìm hoặc tạo dòng cho ngày giao dịch trong bảng Số Lot (Cột STT ở A, Ngày ở B)
 */
export function findOrCreateTargetRow(
  ws: ExcelJS.Worksheet,
  ngayGD: Date,
): number {
  let targetRowIndex = -1;
  let tongRowIndex = -1;
  let currentCalculatedDate: Date | null = null;

  for (let r = 5; r <= ws.rowCount; r++) {
    const sttVal = ws.getCell(r, 1).value;
    const dateCellVal = ws.getCell(r, 2).value;

    const sttStr =
      sttVal !== null && sttVal !== undefined
        ? String(sttVal).trim().toLowerCase()
        : '';
    const dateStr =
      dateCellVal !== null && dateCellVal !== undefined
        ? String(dateCellVal).trim().toLowerCase()
        : '';

    if (sttStr === 'tổng' || dateStr === 'tổng' || sttStr === 'total' || dateStr === 'total') {
      tongRowIndex = r;
      break;
    }

    let rowDateVal: any = dateCellVal;
    if (dateCellVal instanceof Date) {
      if (!isNaN(dateCellVal.getTime())) {
        currentCalculatedDate = new Date(dateCellVal);
      }
    } else if (
      typeof dateCellVal === 'object' &&
      dateCellVal !== null &&
      (dateCellVal as any).result
    ) {
      const res = (dateCellVal as any).result;
      if (res instanceof Date && !isNaN(res.getTime())) {
        currentCalculatedDate = new Date(res);
      } else if (typeof res === 'number') {
        const epoch = new Date(1899, 11, 30);
        const parsed = new Date(epoch.getTime() + res * 86400000);
        if (!isNaN(parsed.getTime())) currentCalculatedDate = parsed;
      } else if (typeof res === 'string') {
        const parsed = new Date(res);
        if (!isNaN(parsed.getTime())) currentCalculatedDate = parsed;
      }
    } else if (currentCalculatedDate) {
      const next = getNextWorkday(currentCalculatedDate);
      if (next) {
        currentCalculatedDate = next;
        rowDateVal = currentCalculatedDate;
      }
    }

    if (isSameDate(rowDateVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    if (tongRowIndex !== -1) {
      ws.insertRow(tongRowIndex, []);
      targetRowIndex = tongRowIndex;
    } else {
      let lastContentRow = 4;
      for (let r = 5; r <= ws.rowCount; r++) {
        const c1 = ws.getCell(r, 1).value;
        const c2 = ws.getCell(r, 2).value;
        if (
          (c1 !== null && c1 !== undefined && c1 !== '') ||
          (c2 !== null && c2 !== undefined && c2 !== '')
        ) {
          lastContentRow = r;
        }
      }
      targetRowIndex = lastContentRow + 1;
    }

    let maxStt = 0;
    for (let r = 5; r < targetRowIndex; r++) {
      const stt = parseInt(String(ws.getCell(r, 1).value || 0), 10);
      if (stt > maxStt) maxStt = stt;
    }
    ws.getCell(targetRowIndex, 1).value = maxStt + 1;
    ws.getCell(targetRowIndex, 2).value = ngayGD;
    ws.getCell(targetRowIndex, 2).numFmt = 'yyyy-mm-dd';
  }

  return targetRowIndex;
}

/**
 * Tìm hoặc tạo dòng cho ngày giao dịch trong bảng Giá Trị (Ngày ở Cột A)
 */
export function findOrCreateValueTargetRow(
  ws: ExcelJS.Worksheet,
  ngayGD: Date,
): number {
  let targetRowIndex = -1;
  let tongRowIndex = -1;
  let currentCalculatedDate: Date | null = null;

  for (let r = 6; r <= ws.rowCount; r++) {
    const dateCellVal = ws.getCell(r, 1).value;
    const dateStr =
      dateCellVal !== null && dateCellVal !== undefined
        ? String(dateCellVal).trim().toLowerCase()
        : '';

    if (dateStr === 'tổng' || dateStr === 'total' || dateStr === 'tong') {
      tongRowIndex = r;
      break;
    }

    let rowDateVal: any = dateCellVal;
    if (dateCellVal instanceof Date) {
      if (!isNaN(dateCellVal.getTime())) {
        currentCalculatedDate = new Date(dateCellVal);
      }
    } else if (
      typeof dateCellVal === 'object' &&
      dateCellVal !== null &&
      (dateCellVal as any).result
    ) {
      const res = (dateCellVal as any).result;
      if (res instanceof Date && !isNaN(res.getTime())) {
        currentCalculatedDate = new Date(res);
      } else if (typeof res === 'number') {
        const epoch = new Date(1899, 11, 30);
        const parsed = new Date(epoch.getTime() + res * 86400000);
        if (!isNaN(parsed.getTime())) currentCalculatedDate = parsed;
      } else if (typeof res === 'string') {
        const parsed = new Date(res);
        if (!isNaN(parsed.getTime())) currentCalculatedDate = parsed;
      }
    } else if (currentCalculatedDate) {
      const next = getNextWorkday(currentCalculatedDate);
      if (next) {
        currentCalculatedDate = next;
        rowDateVal = currentCalculatedDate;
      }
    }

    if (isSameDate(rowDateVal, ngayGD)) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    if (tongRowIndex !== -1) {
      ws.insertRow(tongRowIndex, []);
      targetRowIndex = tongRowIndex;
    } else {
      let lastContentRow = 5;
      for (let r = 6; r <= ws.rowCount; r++) {
        const c1 = ws.getCell(r, 1).value;
        if (c1 !== null && c1 !== undefined && c1 !== '') {
          lastContentRow = r;
        }
      }
      targetRowIndex = lastContentRow + 1;
    }

    ws.getCell(targetRowIndex, 1).value = ngayGD;
    ws.getCell(targetRowIndex, 1).numFmt = 'yyyy-mm-dd';
  }

  return targetRowIndex;
}

/**
 * Xử lý an toàn shared formulas của ExcelJS trước khi save
 */
export function fixSharedFormulas(ws: ExcelJS.Worksheet): void {
  const masters = new Set<string>();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value as any;
        if (val && val.shareType === 'shared' && val.ref) {
          masters.add(cell.address);
        }
      }
    });
  });

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value as any;
        if (val && val.sharedFormula && !masters.has(val.sharedFormula)) {
          if (val.result !== undefined && val.result !== null) {
            cell.value = val.result;
          } else {
            cell.value = null;
          }
        }
      }
    });
  });
}

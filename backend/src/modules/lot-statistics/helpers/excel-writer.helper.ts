/**
 * excel-writer.helper.ts
 * Xuất kết quả tổng hợp ra file Excel
 * Thay thế: Sub baocao() phần ghi vào file lịch sử, tạo PivotTable
 */

import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LotByProduct, LotByTvkd } from './lot-aggregator.helper';
import { LotSummaryResult } from '../lot-statistics.service';

/**
 * Tạo file Excel kết quả từ LotSummaryResult
 * Trả về Buffer của file Excel
 */
export async function createResultExcel(
  result: LotSummaryResult,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MXV Shift Checklist';
  workbook.created = new Date();

  // ─── Sheet 1: Tổng hợp ───────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Tổng hợp');
  addSummarySheet(summarySheet, result);

  // ─── Sheet 2: Theo Sản Phẩm ───────────────────────────────────────────────
  if (result.byProduct.length > 0) {
    const productSheet = workbook.addWorksheet('Theo Sản Phẩm');
    addByProductSheet(productSheet, result.byProduct);
  }

  // ─── Sheet 3: Theo TVKD ───────────────────────────────────────────────────
  if (result.byTvkd.length > 0) {
    const tvkdSheet = workbook.addWorksheet('Theo TVKD');
    addByTvkdSheet(tvkdSheet, result.byTvkd);
  }

  // ─── Sheet 4: Validation ──────────────────────────────────────────────────
  const validationSheet = workbook.addWorksheet('Validation');
  addValidationSheet(validationSheet, result.validations);

  // Xuất Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function addSummarySheet(
  ws: ExcelJS.Worksheet,
  result: LotSummaryResult,
): void {
  const ngayStr =
    result.ngayGD instanceof Date
      ? result.ngayGD.toLocaleDateString('vi-VN')
      : String(result.ngayGD);

  ws.addRow(['THỐNG KÊ SỐ LOT GIAO DỊCH']);
  ws.addRow([`Ngày: ${ngayStr}`]);
  ws.addRow([]);

  // Header row
  const headerRow = ws.addRow([
    'Chỉ tiêu',
    'Product',
    'Spread',
    'LME',
    'Options',
    'Tổng',
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const s = result.summary;

  const addDataRow = (
    label: string,
    product: number,
    spread: number,
    lme: number,
    options: number,
  ) => {
    const row = ws.addRow([
      label,
      product,
      spread,
      lme,
      options,
      product + spread + lme + options,
    ]);
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
    return row;
  };

  addDataRow(
    'DSGD (CQG)',
    s.dsgdProduct,
    s.dsgdSpread,
    s.dsgdLme,
    s.dsgdOptions,
  );
  addDataRow('FR (MXV)', s.frProduct, s.frSpread, s.frLme, s.frOptions);
  addDataRow(
    'Tất toán (TTTT)',
    s.ttttProduct,
    s.ttttSpread,
    s.ttttLme,
    s.ttttOptions,
  );
  addDataRow(
    'Trạng thái mở (TTM)',
    s.ttmProduct,
    s.ttmSpread,
    s.ttmLme,
    s.ttmOptions,
  );
  addDataRow('OP', s.opProduct, s.opSpread, s.opLme, s.opOptions);
  addDataRow('PS', s.psProduct, s.psSpread, s.psLme, s.psOptions);

  ws.addRow([]);
  ws.addRow(['ACM', s.acmLot]).getCell(2).numFmt = '#,##0';

  // Auto width
  ws.columns.forEach((col) => {
    col.width = 20;
  });
  ws.getColumn(1).width = 25;
}

function addByProductSheet(ws: ExcelJS.Worksheet, data: LotByProduct[]): void {
  const header = ws.addRow(['Mã SP', 'KLM (Mua)', 'KLB (Bán)', 'Tổng']);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let totalKlm = 0,
    totalKlb = 0;
  for (const row of data) {
    ws.addRow([row.maSP, row.klm, row.klb, row.total]).eachCell(
      (cell, colNum) => {
        if (colNum > 1) cell.numFmt = '#,##0';
      },
    );
    totalKlm += row.klm;
    totalKlb += row.klb;
  }

  const totalRow = ws.addRow(['TỔNG', totalKlm, totalKlb, totalKlm + totalKlb]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell, colNum) => {
    if (colNum > 1) cell.numFmt = '#,##0';
  });

  ws.columns.forEach((col) => {
    col.width = 15;
  });
}

function addByTvkdSheet(ws: ExcelJS.Worksheet, data: LotByTvkd[]): void {
  const header = ws.addRow(['TVKD', 'KLM (Mua)', 'KLB (Bán)', 'Tổng']);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' },
  };
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let totalKlm = 0,
    totalKlb = 0;
  for (const row of data) {
    ws.addRow([row.tvkd, row.klm, row.klb, row.total]).eachCell(
      (cell, colNum) => {
        if (colNum > 1) cell.numFmt = '#,##0';
      },
    );
    totalKlm += row.klm;
    totalKlb += row.klb;
  }

  const totalRow = ws.addRow(['TỔNG', totalKlm, totalKlb, totalKlm + totalKlb]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell, colNum) => {
    if (colNum > 1) cell.numFmt = '#,##0';
  });

  ws.columns.forEach((col) => {
    col.width = 15;
  });
}

function addValidationSheet(
  ws: ExcelJS.Worksheet,
  validations: LotSummaryResult['validations'],
): void {
  const header = ws.addRow([
    'Chỉ tiêu',
    'Giá trị kỳ vọng',
    'Giá trị thực tế',
    'Kết quả',
  ]);
  header.font = { bold: true };

  for (const v of validations) {
    const row = ws.addRow([
      v.field,
      v.expected,
      v.actual,
      v.passed ? 'OK' : 'LỆCH',
    ]);
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '#,##0';
    if (!v.passed) {
      row.getCell(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' },
      };
      row.getCell(4).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    } else {
      row.getCell(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' },
      };
      row.getCell(4).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  }

  ws.columns.forEach((col) => {
    col.width = 30;
  });
}

/**
 * Lưu file tạm vào disk và trả về đường dẫn
 * Dùng cho streaming response
 */
export async function saveTempExcel(
  result: LotSummaryResult,
  filename: string,
): Promise<string> {
  const buffer = await createResultExcel(result);
  const tmpPath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

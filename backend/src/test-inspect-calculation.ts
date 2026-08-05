import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { parseExcelBuffer, toNum, toStr, ParsedRow } from './modules/lot-statistics/helpers/excel-parser.helper';
import { getMaHHFromDsgd, getMaHHFromSpread } from './modules/lot-statistics/value-statistics.service';

function getVal(cell: ExcelJS.Cell): any {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      const r = (val as ExcelJS.CellFormulaValue).result;
      if (r instanceof Date) return r;
      return (r as string | number | boolean | null) ?? null;
    }
    if ('richText' in val) {
      return val.richText.map((rt) => rt.text).join('');
    }
    if ('text' in val) {
      return (val as any).text;
    }
  }
  return val;
}

async function main() {
  const macroPath = "c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm";
  const dsgdPath = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T06.2026\\22.06\\DSGD.xlsx";
  const tvkdPath = "c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Thong ke gia tri giao dich theo TVKD\\Thong ke gia tri giao dich 2026 theo TVKD.xlsx";

  console.log("Loading Macro workbook...");
  const macroWb = new ExcelJS.Workbook();
  await macroWb.xlsx.readFile(macroPath);

  // Read HH
  const hhWs = macroWb.worksheets.find((w) => w.name.toLowerCase() === 'hh')!;
  const hhMap = new Map<string, string>();
  for (let r = 2; r <= hhWs.rowCount; r++) {
    const prefix = toStr(getVal(hhWs.getCell(r, 1))).toUpperCase();
    const baseHH = toStr(getVal(hhWs.getCell(r, 2))).toUpperCase();
    if (prefix) hhMap.set(prefix, baseHH);
  }

  // Read Hhoa Vlookup
  const vlookupWs = macroWb.worksheets.find((w) => w.name.toLowerCase() === 'hhoa vlookup')!;
  const vlookupMap = new Map<string, { heSo: number; donVi: number }>();
  for (let r = 2; r <= vlookupWs.rowCount; r++) {
    const baseHH = toStr(getVal(vlookupWs.getCell(r, 1))).toUpperCase();
    const heSo = toNum(getVal(vlookupWs.getCell(r, 2)));
    const donVi = toNum(getVal(vlookupWs.getCell(r, 3)));
    if (baseHH) {
      vlookupMap.set(baseHH, { heSo: heSo || 1, donVi: donVi || 1 });
    }
  }

  // Read Exchange rates
  const sheet1 = macroWb.worksheets.find((w) => w.name.toLowerCase() === 'sheet1')!;
  const tyGiaDefault = toNum(getVal(sheet1.getCell('D2'))) || 26260;
  const tyGiaTru = toNum(getVal(sheet1.getCell('D3'))) || 165;
  const tyGiaMpo = toNum(getVal(sheet1.getCell('D4'))) || 6330;

  console.log(`Exchange rates: Default=${tyGiaDefault}, TRU=${tyGiaTru}, MPO=${tyGiaMpo}`);

  console.log("Loading DSGD...");
  const dsgdBuffer = fs.readFileSync(dsgdPath);
  const parsedDsgd = await parseExcelBuffer(dsgdBuffer);
  console.log(`Total rows in DSGD: ${parsedDsgd.rows.length}`);

  // Let's print out the first few rows to verify column names
  console.log("Columns found:", parsedDsgd.headers);
  console.log("Row 0 keys & values:", parsedDsgd.rows[0]);

  // Let's perform calculation
  const tvkdGtgdMap = new Map<string, number>();
  const productGtgdMap = new Map<string, number>();
  let totalCalculated = 0;
  let skippedRowsCount = 0;

  for (const row of parsedDsgd.rows) {
    const maTKGD = toStr(row['Mã TKGD'] ?? row['col4']).toUpperCase();
    const lot = toNum(row['KL giao dịch'] ?? row['col13']);
    const price = toNum(row['Giá khớp'] ?? row['col14']);

    if (lot <= 0 || price <= 0 || !maTKGD) {
      skippedRowsCount++;
      continue;
    }

    const prefixNormal = getMaHHFromDsgd(row);
    const baseHHNormal = hhMap.get(prefixNormal) ?? prefixNormal;
    const multNormal = vlookupMap.get(baseHHNormal) ?? { heSo: 1, donVi: 1 };

    let rateNormal = tyGiaDefault;
    if (baseHHNormal === 'TRU') rateNormal = tyGiaTru;
    else if (baseHHNormal === 'MPO') rateNormal = tyGiaMpo;

    const gtgdNormal = lot * price * multNormal.heSo * multNormal.donVi * rateNormal;
    totalCalculated += gtgdNormal;

    const tvkd = maTKGD.substring(0, 3);
    if (tvkd.length >= 3) {
      tvkdGtgdMap.set(tvkd, (tvkdGtgdMap.get(tvkd) || 0) + gtgdNormal);
    }
    productGtgdMap.set(baseHHNormal, (productGtgdMap.get(baseHHNormal) || 0) + gtgdNormal);
  }

  console.log(`Skipped rows count: ${skippedRowsCount}`);
  console.log(`Total calculated GTGD: ${totalCalculated}`);
  console.log("TVKD breakdown:");
  const sortedTvkd = Array.from(tvkdGtgdMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [tvkd, val] of sortedTvkd) {
    console.log(`  ${tvkd}: ${val.toLocaleString('en-US')}`);
  }
}

main().catch(console.error);

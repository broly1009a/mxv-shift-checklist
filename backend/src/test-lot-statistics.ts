import * as dotenv from 'dotenv';
dotenv.config();

import { parseExcelBuffer, toDate } from './modules/lot-statistics/helpers/excel-parser.helper';
import { classifyPs } from './modules/lot-statistics/helpers/trade-classifier.helper';
import { LotStatisticsService } from './modules/lot-statistics/lot-statistics.service';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

async function test() {
  const baseDir = path.join(process.cwd(), '..', 'TTTT-PS', '07-07');
  const loadFileIfExists = (filename: string): Buffer | undefined => {
    const fullPath = path.join(baseDir, filename);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath) : undefined;
  };

  const files = {
    fileDsgd: loadFileIfExists('DSGD.xlsx')!,
    fileFr: loadFileIfExists('FR.xlsx')!,
    fileTtm: loadFileIfExists('TTM.xlsx'),
    fileTttt: loadFileIfExists('TTTT 3.xlsx'),
    fileOp: loadFileIfExists('OP.xlsx'),
    filePs: loadFileIfExists('PS 1.xlsx'),
  };

  // For ngayGD = 2026-07-07:
  // A15 = 2026-07-06 (WORKDAY(ngayGD, -1))
  // A28 = 2026-07-03 (WORKDAY(ngayGD, -2))
  // A32 = 2026-07-02 (WORKDAY(ngayGD, -3))
  // A34 = 2026-07-01 (WORKDAY(ngayGD, -4))
  const toNum = (val: any) => parseFloat(String(val).replace(/,/g, '')) || 0;
  const getQty_Fr = (r: any) => toNum(r['Qty'] || r['col6']);
  const getFrMaSP = (r: any) => {
    const symbol = String(r['Symbol'] || r['col3'] || '').trim();
    return symbol.length > 3 ? symbol.substring(0, symbol.length - 3).toUpperCase() : symbol.toUpperCase();
  };
  const params = {
    ngayGD: '2026-07-06',
    truDates: ['2026-07-03', '2026-07-02', '2026-07-01', '2026-06-30'],
    fefDates: ['2026-07-03', '2026-07-02'],
    zftDates: ['2026-07-03', '2026-07-02'],
    deadline: 46217.208333, // 2026-07-06 05:00:00 (46217 + 5/24)
    filterLmeKyHan: 'U26'
  };

  const service = new LotStatisticsService(null as any);
  const result = await service.processLotStatistics(files, params);

  console.log('--- TEST RESULT ---');
  console.log(`DSGD Spread: ${result.summary.dsgdSpread}`);
  console.log(`DSGD LME: ${result.summary.dsgdLme}`);
  console.log(`DSGD Options: ${result.summary.dsgdOptions}`);
  console.log(`DSGD Product (Expected: 7853): ${result.summary.dsgdProduct}`);
  console.log('-------------------');
  console.log(`FR Spread: ${result.summary.frSpread}`);
  console.log(`FR LME: ${result.summary.frLme}`);
  console.log(`FR Options: ${result.summary.frOptions}`);
  console.log(`FR Product (Expected: 7853): ${result.summary.frProduct}`);
  console.log('-------------------');
  console.log(`TTTT Spread: ${result.summary.ttttSpread}`);
  console.log(`TTTT LME: ${result.summary.ttttLme}`);
  console.log(`TTTT Options: ${result.summary.ttttOptions}`);
  console.log(`TTTT Product (Expected: 4026): ${result.summary.ttttProduct}`);
  console.log('-------------------');
  console.log(`PS Spread: ${result.summary.psSpread}`);
  console.log(`PS LME: ${result.summary.psLme}`);
  console.log(`PS Options: ${result.summary.psOptions}`);
  console.log(`PS Product (Expected: 4026 / 4027): ${result.summary.psProduct}`);
  console.log('-------------------');
  console.log(`ACM Lot Total: ${result.summary.acmLot}`);
  console.log('-------------------');
  const psParsed = await parseExcelBuffer(files.filePs!, 0, true);
  console.log(`PS Raw Row count: ${psParsed.rows.length}`);
  console.log(`PS Raw Sample 1:`, psParsed.rows[0]);
  console.log(`PS Raw Sample 2:`, psParsed.rows[1]);
  console.log(`PS Raw Sample 3:`, psParsed.rows[2]);
  console.log(`PS Raw Sample 4:`, psParsed.rows[3]);

  const { ps } = classifyPs(psParsed.rows);
  console.log(`PS Classified Row count: ${ps.length}`);
  console.log(`PS Classified Sample 1:`, ps[0]);

  // Read TTTT rows to see if there are any ending in L
  const ttttParsed = await parseExcelBuffer(files.fileTttt!, 0, true);
  console.log(`TTTT Raw Sample 1:`, ttttParsed.rows[0]);
  const ttttLmeRows = ttttParsed.rows.filter((r: any) => {
    const acc = String(r['Mã TKGD'] ?? r['col8'] ?? '').trim().toUpperCase();
    return acc.endsWith('L');
  });
  console.log(`TTTT LME rows count found manually: ${ttttLmeRows.length}`);
  if (ttttLmeRows.length > 0) {
    console.log(`TTTT LME rows:`, ttttLmeRows);
  }

  const psLmeRows = psParsed.rows.filter((r: any) => {
    const acc = String(r['Account'] ?? r['Mã TKGD'] ?? r['col1'] ?? '').trim().toUpperCase();
    return acc.endsWith('L');
  });
  console.log(`PS LME rows count found manually: ${psLmeRows.length}`);
  if (psLmeRows.length > 0) {
    console.log(`PS LME rows:`, psLmeRows);
  }

  const dsgdParsed = await parseExcelBuffer(files.fileDsgd, 0, true);
  
  // Test session filtering for FR
  const frParsedSession = await parseExcelBuffer(files.fileFr, 0, true);
  const startSession = new Date('2026-07-06T05:00:00+07:00');
  const endSession = new Date('2026-07-07T05:00:00+07:00');

  let sessionFrTotal = 0;
  let sessionFrSpread = 0;
  let sessionFrLme = 0;
  let sessionFrOptions = 0;

  let sessionTru = 0;
  let sessionFef = 0;
  let sessionZft = 0;
  let sessionSpecial = 0;
  let sessionL = 0;

  const targetNgayGD = new Date('2026-07-06');
  
  frParsedSession.rows.forEach((r: any) => {
    const timeVal = r['Time'] ?? r['Thời gian'] ?? r['col2'];
    if (!timeVal) return;
    let d: Date;
    if (timeVal instanceof Date) {
      d = timeVal;
    } else if (typeof timeVal === 'number') {
      const epoch = new Date(1899, 11, 30);
      d = new Date(epoch.getTime() + timeVal * 86400000);
    } else {
      const str = String(timeVal).trim();
      if (str.includes('/')) {
        const parts = str.split(' ');
        const dateParts = parts[0].split('/');
        const timePart = parts[1] || '00:00:00';
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        let year = parseInt(dateParts[2], 10);
        if (year < 100) year += 2000;
        const timeSubparts = timePart.split(':');
        const hour = parseInt(timeSubparts[0], 10);
        const minute = parseInt(timeSubparts[1], 10);
        const second = parseFloat(timeSubparts[2] || '0');
        d = new Date(year, month, day, hour, minute, Math.floor(second));
      } else {
        const nextDay = new Date(targetNgayGD);
        nextDay.setDate(nextDay.getDate() + 1);
        const timeSubparts = str.split(':');
        const hour = parseInt(timeSubparts[0], 10) || 0;
        const minute = parseInt(timeSubparts[1], 10) || 0;
        const second = parseFloat(timeSubparts[2] || '0');
        nextDay.setHours(hour, minute, Math.floor(second), 0);
        d = nextDay;
      }
    }

    // Check if in session
    if (d >= startSession && d < endSession) {
      const qty = toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9'] ?? 0);
      const symbol = String(r['Symbol'] ?? r['col3'] ?? '').toUpperCase();
      const account = String(r['Account'] ?? r['col1'] ?? '').toUpperCase();

      sessionFrTotal += qty;

      if (account.endsWith('S')) {
        sessionFrSpread += qty;
      } else if (account.endsWith('L')) {
        sessionFrLme += qty;
      } else if (symbol.startsWith('C.') || symbol.startsWith('P.')) {
        sessionFrOptions += qty;
      } else {
        // Exclusions
        const sp = symbol.length > 3 ? symbol.substring(0, symbol.length - 3) : symbol;
        if (sp === 'TRU') {
          sessionTru += qty;
        } else if (sp === 'FEF') {
          sessionFef += qty;
        } else if (sp === 'ZFT') {
          sessionZft += qty;
        } else if (['QO', 'QP', 'BM', 'MPO'].includes(sp)) {
          // Special: only exclude if before Y1 (July 7 05:00:00)
          // Since endSession is July 7 05:00:00, all trades in session are < July 7 05:00:00!
          // So they are all excluded!
          sessionSpecial += qty;
        } else if (account === 'MX1111111111') {
          sessionL += qty;
        }
      }
    }
  });

  const sessionFrProduct = sessionFrTotal - sessionFrSpread - sessionFrLme - sessionFrOptions - sessionTru - sessionFef - sessionZft - sessionSpecial - sessionL;
  console.log(`--- SESSION FILTERED FR ---`);
  console.log(`Total Lots: ${sessionFrTotal}`);
  console.log(`Spread: ${sessionFrSpread}`);
  console.log(`LME: ${sessionFrLme}`);
  console.log(`Options: ${sessionFrOptions}`);
  console.log(`TRU: ${sessionTru}`);
  console.log(`FEF: ${sessionFef}`);
  console.log(`ZFT: ${sessionZft}`);
  console.log(`Special (QO/QP/BM/MPO): ${sessionSpecial}`);
  console.log(`L (MX1111111111): ${sessionL}`);
  console.log(`Calculated FR Product: ${sessionFrProduct}`);
  
  // Print breakdown of session-filtered products
  const sessionProductCounts: { [sp: string]: number } = {};
  frParsedSession.rows.forEach((r: any) => {
    const timeVal = r['Time'] ?? r['Thời gian'] ?? r['col2'];
    if (!timeVal) return;
    let d: Date;
    if (timeVal instanceof Date) {
      d = timeVal;
    } else if (typeof timeVal === 'number') {
      const epoch = new Date(1899, 11, 30);
      d = new Date(epoch.getTime() + timeVal * 86400000);
    } else {
      d = toDate(timeVal) || new Date(0);
    }
    if (d >= startSession && d < endSession) {
      const sp = getFrMaSP(r);
      const qty = toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9'] ?? 0);
      sessionProductCounts[sp] = (sessionProductCounts[sp] || 0) + qty;
    }
  });
  console.log('Session Filtered Product Lots:', sessionProductCounts);
  console.log(`---------------------------`);





  console.log(`PS Classified Sample 2:`, ps[1]);

  const { sumPsLot } = require('./modules/lot-statistics/helpers/lot-aggregator.helper');
  const { psSpread, psLme, psOptions } = classifyPs(psParsed.rows);
  const psTotal = sumPsLot(ps);
  const psSpreadLot = sumPsLot(psSpread);
  const psLmeLot = sumPsLot(psLme);
  const psOptionsLot = sumPsLot(psOptions);
  console.log(`PS Raw Sums - psTotal: ${psTotal}, psSpreadLot: ${psSpreadLot}, psLmeLot: ${psLmeLot}, psOptionsLot: ${psOptionsLot}`);


  const frParsed = await parseExcelBuffer(files.fileFr!, 0, true);
  const uniqueProducts = new Set<string>();
  frParsed.rows.forEach((r: any) => {
    uniqueProducts.add(getFrMaSP(r));
  });
  console.log(`Unique products in FR.xlsx:`, Array.from(uniqueProducts));

  const truRows = frParsed.rows.filter(r => getFrMaSP(r) === 'TRU');
  console.log(`TRU rows count: ${truRows.length}`);
  if (truRows.length > 0) {
    console.log(`TRU row sample 1 time:`, truRows[0]['Time'] ?? truRows[0]['col2']);
  }

  const zftRows = frParsed.rows.filter(r => getFrMaSP(r) === 'ZFT');
  console.log(`ZFT rows count: ${zftRows.length}`);
  if (zftRows.length > 0) {
    console.log(`ZFT row sample 1 time:`, zftRows[0]['Time'] ?? zftRows[0]['col2']);
  }

  console.log(`FR Row 1 Keys:`, Object.keys(frParsed.rows[0]));
  console.log(`FR Row 1:`, frParsed.rows[0]);

  const frGroups: { [key: string]: { [date: string]: number } } = {};
  frParsed.rows.forEach((r: any) => {
    const sp = getFrMaSP(r);
    const timeVal = r['Time'] ?? r['col2'] ?? '';
    let dateStr = 'CURRENT';
    if (String(timeVal).includes('/')) {
      dateStr = String(timeVal).split(' ')[0];
    }
    const qty = toNum(r['Qty'] ?? r['col6'] ?? r['col9']);
    if (!frGroups[sp]) frGroups[sp] = {};
    frGroups[sp][dateStr] = (frGroups[sp][dateStr] || 0) + qty;
  });
  console.log('FR Product & Date Breakdown:', frGroups);


  // Audit TTTT and PS
  console.log('--- AUDITING TTTT vs PS ---');
  const ttttAccounts = new Set<string>();
  const ttttAcmAccounts = new Set<string>();
  let ttttAcmSum = 0;
  ttttParsed.rows.forEach((r: any) => {
    const acc = String(r['Mã TKGD'] ?? r['col8'] ?? '').trim().toUpperCase();
    const qty = toNum(r['KL Mua'] ?? r['col16'] ?? 0);
    if (acc.includes('-A')) {
      ttttAcmAccounts.add(acc);
      ttttAcmSum += qty;
    } else {
      ttttAccounts.add(acc);
    }
  });
  console.log(`TTTT ACM Accounts:`, Array.from(ttttAcmAccounts), `Sum:`, ttttAcmSum);

  const psAccounts = new Set<string>();
  const psAcmAccounts = new Set<string>();
  let psAcmSum = 0;
  let psRawSumColE = 0;
  let psRawSumColF = 0;
  psParsed.rows.forEach((r: any) => {
    const acc = String(r['Account'] ?? r['col1'] ?? '').trim().toUpperCase();
    const qtyE = toNum(r['L (3844)'] ?? r['col5'] ?? 0);
    const qtyF = toNum(r['S (3844)'] ?? r['col6'] ?? 0);
    psRawSumColE += qtyE;
    psRawSumColF += qtyF;
    if (acc) {
      if (acc.includes('-A')) {
        psAcmAccounts.add(acc);
        psAcmSum += qtyE;
      } else {
        psAccounts.add(acc);
      }
    }
  });
  console.log(`PS Raw Sum Column E:`, psRawSumColE, `Column F:`, psRawSumColF);
  console.log(`PS ACM Accounts:`, Array.from(psAcmAccounts), `Sum E:`, psAcmSum);

  // Group by Account and Symbol for non-ACM
  const ttttGroup: any = {};
  ttttParsed.rows.forEach((r: any) => {
    const acc = String(r['Mã TKGD'] ?? r['col8'] ?? '').trim().toUpperCase();
    if (acc.includes('-A') || !acc) return;
    const sym = String(r['Mã HĐ'] ?? r['col10'] ?? '').trim().toUpperCase();
    const qty = toNum(r['KL Mua'] ?? r['col16'] ?? 0);
    const key = `${acc}_${sym}`;
    ttttGroup[key] = (ttttGroup[key] || 0) + qty;
  });

  const psGroup: any = {};
  psParsed.rows.forEach((r: any) => {
    const acc = String(r['Account'] ?? r['col1'] ?? '').trim().toUpperCase();
    if (acc.includes('-A') || !acc) return;
    const sym = String(r['Symbol'] ?? r['col4'] ?? '').trim().toUpperCase();
    const qty = toNum(r['L (3844)'] ?? r['col5'] ?? 0);
    const key = `${acc}_${sym}`;
    psGroup[key] = (psGroup[key] || 0) + qty;
  });

  console.log('--- DIFFERENCES TTTT vs PS ---');
  const allKeys = new Set([...Object.keys(ttttGroup), ...Object.keys(psGroup)]);
  let diffCount = 0;
  allKeys.forEach(k => {
    const tVal = ttttGroup[k] ?? 0;
    const pVal = psGroup[k] ?? 0;
    if (tVal !== pVal) {
      diffCount++;
      if (diffCount <= 20) {
        console.log(`Key ${k}: TTTT=${tVal}, PS=${pVal}, diff=${tVal - pVal}`);
      }
    }
  });
  console.log(`Total key differences: ${diffCount}`);

  const xlsmPath = path.join(process.cwd(), '..', 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm');
  console.log(`Checking XLSM at: ${xlsmPath}`);
  try {
    if (fs.existsSync(xlsmPath)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsmPath);
      const ws2 = wb.getWorksheet('sheet2') || wb.getWorksheet('Sheet2');
      if (ws2) {
        console.log('--- EXCEL MACRO FILE PATHS ---');
        ['A5', 'A9', 'A10', 'A11', 'A13', 'A14', 'A15', 'A76', 'A77', 'A158', 'X2', 'X4', 'Y1'].forEach(cellId => {
          const cell = ws2.getCell(cellId);
          console.log(`${cellId}:`, JSON.stringify(cell.value));
        });
        console.log(`k2 (TRU K1): ${ws2.getCell('K2').value}`);
        console.log(`k3 (TRU K2): ${ws2.getCell('K3').value}`);
        console.log(`k4 (TRU K3): ${ws2.getCell('K4').value}`);
        console.log(`l1 (L - MX1111111111): ${ws2.getCell('L1').value}`);
        console.log(`r1 (FEF R): ${ws2.getCell('R1').value}`);
        console.log(`r2 (FEF R1): ${ws2.getCell('R2').value}`);
        console.log(`s1 (ZFT S): ${ws2.getCell('S1').value}`);
        console.log(`s2 (ZFT S1): ${ws2.getCell('S2').value}`);
        console.log(`t1 (QO): ${ws2.getCell('T1').value}`);
        console.log(`u1 (QP): ${ws2.getCell('U1').value}`);
        console.log(`v1 (BM): ${ws2.getCell('V1').value}`);
        console.log(`w1 (MPO): ${ws2.getCell('W1').value}`);
        console.log('--------------------------------');
      } else {
        console.log('sheet2 not found in xlsm workbook');
      }
    } else {
      console.log('XLSM macro file not found');
    }
  } catch (err: any) {
    console.error('Error reading XLSM workbook:', err.message || err);
  }

  const summaryPath = path.join(process.cwd(), '..', 'marco', 'Thong ke so lot giao dich có ACM', 'Thong ke so lot giao dich 2026.xlsx');
  console.log(`Checking Summary Workbook at: ${summaryPath}`);
  if (fs.existsSync(summaryPath)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(summaryPath);
    console.log('Summary workbook sheets:', wb.worksheets.map(w => w.name));
    const ws = wb.worksheets[wb.worksheets.length - 1]; // get last worksheet
    console.log(`Last sheet name: ${ws.name}`);
    // Find row for 7/7/2026 or 2026-07-07 or 46218
    let targetRowIndex = -1;
    console.log('--- ALL ROWS IN LAST SHEET ---');
    for (let r = 1; r <= ws.rowCount; r++) {
      const cellVal = ws.getCell(r, 2).value;
      if (cellVal) {
        console.log(`Row ${r}: Date cell =`, JSON.stringify(cellVal));
        if (valStr.includes('2026-07-07') || valStr.includes('7/7/26') || valStr.includes('7/7/2026') || 
            (typeof cellVal === 'object' && cellVal !== null && String((cellVal as any).result || '').includes('2026-07-07'))) {
          targetRowIndex = r;
        }
        if (cellVal instanceof Date) {
          if (cellVal.toISOString().startsWith('2026-07-07')) {
            targetRowIndex = r;
          }
        }
      }
    }
    if (targetRowIndex !== -1) {
      console.log(`Found target row at index: ${targetRowIndex}`);
      const row = ws.getRow(targetRowIndex);
      console.log(`--- ROW ${targetRowIndex} DETAILS ---`);
      for (let c = 1; c <= 30; c++) {
        const cell = row.getCell(c);
        console.log(`Col ${c}: value=${JSON.stringify(cell.value)}, type=${cell.type}`);
      }
    } else {
      console.log('Target date row not found in last sheet. Printing Row 8 columns:');
      const row8 = ws.getRow(8);
      for (let c = 1; c <= 30; c++) {
        const cell = row8.getCell(c);
        console.log(`Col ${c}: value=${JSON.stringify(cell.value)}, type=${cell.type}`);
      }
    }
  } else {
    console.log('Summary workbook not found');
  }

  console.log('Validations:');
  result.validations.forEach(v => {
    console.log(`- ${v.field}: passed=${v.passed}, expected=${v.expected}, actual=${v.actual}, message=${v.message}`);
  });
}

test().catch(err => console.error('Lỗi:', err));

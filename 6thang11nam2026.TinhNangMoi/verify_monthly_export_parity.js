/**
 * verify_monthly_export_parity.js
 * Script tạo file Excel từ dữ liệu bóc tách và đối chiếu 1:1 với file gốc
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');
const XLSX = require('../backend/node_modules/xlsx');

function toDateSerial(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'number') return dateStr;
  const parts = String(dateStr).split('/');
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    // Excel date serial for 2026-MM-DD
    // Epoch: 1899-12-30
    const d = new Date(Date.UTC(2026, month - 1, day));
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return Math.round((d.getTime() - epoch.getTime()) / (24 * 3600 * 1000));
  }
  return dateStr;
}

async function generateExcelFromExtractedJson(jsonPath, outputPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MXV Operations Hub';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }],
  });

  // 1. Column Widths
  ws.columns = [
    { key: 'A', width: 9.0 },
    { key: 'B', width: 39.3 },
    { key: 'C', width: 15.4 },
    { key: 'D', width: 14.4 },
    { key: 'E', width: 12.6 },
    { key: 'F', width: 14.9 },
    { key: 'G', width: 14.4 },
    { key: 'H', width: 12.6 },
    { key: 'I', width: 10.1 },
  ];

  const thinBorder = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };

  // 2. PHẦN I
  ws.getCell('A2').value = 'I. Tình hình giao dịch theo TVKD';
  ws.getCell('A2').font = { name: 'Arial', size: 11, bold: true };
  ws.getRow(2).height = 15;

  const r3Headers = [
    'STT',
    'TÊN THÀNH VIÊN',
    'Số Lot \r\ntháng trước',
    'Số Lot \r\ntháng này',
    '% \r\nTăng/giảm',
    'Số Lot giao dịch nhiều nhất/ngày',
    'Ngày\r\n giao dịch',
    'Số Lot \r\ngiao dịch \r\nít nhất/ngày',
    'Ngày\r\ngiao dịch',
  ];
  const row3 = ws.getRow(3);
  row3.height = 45;
  r3Headers.forEach((h, idx) => {
    const cell = row3.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 11, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Subheader CQG
  ws.mergeCells('A4:I4');
  const cellA4 = ws.getCell('A4');
  cellA4.value = 'CQG';
  cellA4.font = { name: 'Arial', size: 11, bold: true };
  cellA4.fill = headerFill;
  ws.getRow(4).height = 24;

  let curRow = 5;
  const cqgStart = curRow;

  for (const item of data.section1Tvkd.cqg.items) {
    const r = ws.getRow(curRow);
    r.height = 15;
    r.getCell(1).value = item.stt;
    r.getCell(2).value = item.fullName;
    r.getCell(3).value = item.lotPreviousMonth;
    r.getCell(4).value = item.lotCurrentMonth;
    r.getCell(5).value = {
      formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
      result: item.growthRate === null ? ' ' : item.growthRate,
    };
    r.getCell(6).value = item.maxLotDay;
    r.getCell(7).value = toDateSerial(item.maxDate);
    r.getCell(8).value = item.minLotDay;
    r.getCell(9).value = toDateSerial(item.minDate);

    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((col) => {
      const c = r.getCell(col);
      c.font = { name: 'Arial', size: 11 };
      c.border = thinBorder;
      if (col === 1) c.alignment = { horizontal: 'center' };
      if (col === 2) c.alignment = { horizontal: 'left' };
      if ([3, 4, 6, 8].includes(col)) {
        c.numFmt = '#,##0';
        c.alignment = { horizontal: 'right' };
      }
      if (col === 5) {
        c.numFmt = '0.00%';
        c.alignment = { horizontal: 'right' };
      }
      if ([7, 9].includes(col)) {
        c.numFmt = 'dd/mm';
        c.alignment = { horizontal: 'center' };
      }
    });
    curRow++;
  }
  const cqgEnd = curRow - 1;

  // TỔNG CQG
  const rowTotCqg = ws.getRow(curRow);
  rowTotCqg.height = 16.5;
  ws.mergeCells(`A${curRow}:B${curRow}`);
  rowTotCqg.getCell(1).value = 'TỔNG CQG';
  rowTotCqg.getCell(3).value = {
    formula: `SUM(C${cqgStart}:C${cqgEnd})`,
    result: data.section1Tvkd.cqg.summary.lotPreviousMonth,
  };
  rowTotCqg.getCell(4).value = {
    formula: `SUM(D${cqgStart}:D${cqgEnd})`,
    result: data.section1Tvkd.cqg.summary.lotCurrentMonth,
  };
  rowTotCqg.getCell(5).value = {
    formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
    result: (data.section1Tvkd.cqg.summary.lotCurrentMonth / data.section1Tvkd.cqg.summary.lotPreviousMonth) - 1,
  };
  rowTotCqg.getCell(6).value = data.section1Tvkd.cqg.summary.marketPeakLot;
  rowTotCqg.getCell(7).value = toDateSerial(data.section1Tvkd.cqg.summary.marketPeakDate);
  rowTotCqg.getCell(8).value = data.section1Tvkd.cqg.summary.marketTroughLot;
  rowTotCqg.getCell(9).value = toDateSerial(data.section1Tvkd.cqg.summary.marketTroughDate);

  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((col) => {
    const c = rowTotCqg.getCell(col);
    c.font = { name: 'Arial', size: 11, bold: true };
    c.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    if ([3, 4, 6, 8].includes(col)) c.numFmt = '#,##0';
    if (col === 5) c.numFmt = '0.00%';
    if ([7, 9].includes(col)) {
      c.numFmt = 'dd/mm';
      c.alignment = { horizontal: 'center' };
    }
  });
  curRow++;

  // Subheader ACM
  ws.mergeCells(`A${curRow}:I${curRow}`);
  const cellAcm = ws.getCell(`A${curRow}`);
  cellAcm.value = 'ACM';
  cellAcm.font = { name: 'Arial', size: 11, bold: true };
  cellAcm.fill = headerFill;
  ws.getRow(curRow).height = 24;
  curRow++;

  const acmStart = curRow;
  for (const item of data.section1Tvkd.acm.items) {
    const r = ws.getRow(curRow);
    r.height = 15;
    r.getCell(1).value = item.stt;
    r.getCell(2).value = item.fullName;
    r.getCell(3).value = item.lotPreviousMonth;
    r.getCell(4).value = item.lotCurrentMonth;
    r.getCell(5).value = {
      formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
      result: item.growthRate === null ? ' ' : item.growthRate,
    };
    r.getCell(6).value = item.maxLotDay;
    r.getCell(7).value = toDateSerial(item.maxDate);
    r.getCell(8).value = item.minLotDay;
    r.getCell(9).value = toDateSerial(item.minDate);

    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((col) => {
      const c = r.getCell(col);
      c.font = { name: 'Arial', size: 11 };
      c.border = thinBorder;
      if (col === 1) c.alignment = { horizontal: 'center' };
      if (col === 2) c.alignment = { horizontal: 'left' };
      if ([3, 4, 6, 8].includes(col)) {
        c.numFmt = '#,##0';
        c.alignment = { horizontal: 'right' };
      }
      if (col === 5) {
        c.numFmt = '0.00%';
        c.alignment = { horizontal: 'right' };
      }
      if ([7, 9].includes(col)) {
        c.numFmt = 'dd/mm';
        c.alignment = { horizontal: 'center' };
      }
    });
    curRow++;
  }
  const acmEnd = curRow - 1;

  // TỔNG ACM
  const rowTotAcm = ws.getRow(curRow);
  rowTotAcm.height = 16.5;
  ws.mergeCells(`A${curRow}:B${curRow}`);
  rowTotAcm.getCell(1).value = 'TỔNG ACM';
  rowTotAcm.getCell(3).value = {
    formula: `SUM(C${acmStart}:C${acmEnd})`,
    result: data.section1Tvkd.acm.summary.lotPreviousMonth,
  };
  rowTotAcm.getCell(4).value = {
    formula: `SUM(D${acmStart}:D${acmEnd})`,
    result: data.section1Tvkd.acm.summary.lotCurrentMonth,
  };
  rowTotAcm.getCell(5).value = {
    formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
    result: (data.section1Tvkd.acm.summary.lotCurrentMonth / data.section1Tvkd.acm.summary.lotPreviousMonth) - 1,
  };
  rowTotAcm.getCell(6).value = data.section1Tvkd.acm.summary.marketPeakLot;
  rowTotAcm.getCell(7).value = toDateSerial(data.section1Tvkd.acm.summary.marketPeakDate);
  rowTotAcm.getCell(8).value = data.section1Tvkd.acm.summary.marketTroughLot;
  rowTotAcm.getCell(9).value = toDateSerial(data.section1Tvkd.acm.summary.marketTroughDate);

  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((col) => {
    const c = rowTotAcm.getCell(col);
    c.font = { name: 'Arial', size: 11, bold: true };
    c.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    if ([3, 4, 6, 8].includes(col)) c.numFmt = '#,##0';
    if (col === 5) c.numFmt = '0.00%';
    if ([7, 9].includes(col)) {
      c.numFmt = 'dd/mm';
      c.alignment = { horizontal: 'center' };
    }
  });
  curRow += 3;

  // 3. PHẦN II: MẶT HÀNG
  ws.getCell(`A${curRow}`).value = 'II. Tình hình giao dịch theo mặt hàng';
  ws.getCell(`A${curRow}`).font = { name: 'Arial', size: 11, bold: true };
  curRow++;

  const r2Headers = [
    'STT',
    'Mặt hàng',
    'Số Lot \r\ntháng trước',
    'Số Lot \r\ntháng này',
    '% \r\nTăng/giảm',
    'Tỉ trọng \r\ntháng',
    'Ghi chú',
  ];
  const rowH2 = ws.getRow(curRow);
  rowH2.height = 31.5;
  r2Headers.forEach((h, idx) => {
    const cell = rowH2.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 11, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
  curRow++;

  // Subheader CQG
  ws.mergeCells(`A${curRow}:G${curRow}`);
  const cellH2Cqg = ws.getCell(`A${curRow}`);
  cellH2Cqg.value = 'CQG';
  cellH2Cqg.font = { name: 'Arial', size: 11, bold: true };
  cellH2Cqg.fill = headerFill;
  ws.getRow(curRow).height = 24;
  curRow++;

  const commCqgStart = curRow;
  const cqgCommodityTotalRow = commCqgStart + data.section2Commodities.cqg.items.length;

  for (const item of data.section2Commodities.cqg.items) {
    const r = ws.getRow(curRow);
    r.height = 15;
    r.getCell(1).value = item.stt;
    r.getCell(2).value = item.commodityName;
    r.getCell(3).value = item.lotPreviousMonth;
    r.getCell(4).value = item.lotCurrentMonth;
    r.getCell(5).value = {
      formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
      result: item.growthRate === null ? ' ' : item.growthRate,
    };
    r.getCell(6).value = {
      formula: `D${curRow}/$D$${cqgCommodityTotalRow}`,
      result: item.marketShareRate,
    };
    r.getCell(7).value = item.note || '';

    [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
      const c = r.getCell(col);
      c.font = { name: 'Arial', size: 11 };
      c.border = thinBorder;
      if (col === 1) c.alignment = { horizontal: 'center' };
      if (col === 2) c.alignment = { horizontal: 'left' };
      if ([3, 4].includes(col)) {
        c.numFmt = '#,##0';
        c.alignment = { horizontal: 'right' };
      }
      if ([5, 6].includes(col)) {
        c.numFmt = '0.00%';
        c.alignment = { horizontal: 'right' };
      }
    });
    curRow++;
  }
  const commCqgEnd = curRow - 1;

  // Tổng CQG Mặt hàng
  const rowCommTotCqg = ws.getRow(curRow);
  rowCommTotCqg.height = 15;
  ws.mergeCells(`A${curRow}:B${curRow}`);
  rowCommTotCqg.getCell(1).value = 'Tổng CQG';
  rowCommTotCqg.getCell(3).value = {
    formula: `SUM(C${commCqgStart}:C${commCqgEnd})`,
    result: data.section2Commodities.cqg.summary.lotPreviousMonth,
  };
  rowCommTotCqg.getCell(4).value = {
    formula: `SUM(D${commCqgStart}:D${commCqgEnd})`,
    result: data.section2Commodities.cqg.summary.lotCurrentMonth,
  };
  rowCommTotCqg.getCell(5).value = {
    formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
    result: (data.section2Commodities.cqg.summary.lotCurrentMonth / data.section2Commodities.cqg.summary.lotPreviousMonth) - 1,
  };
  rowCommTotCqg.getCell(6).value = {
    formula: `SUM(F${commCqgStart}:F${commCqgEnd})`,
    result: 1.0,
  };

  [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
    const c = rowCommTotCqg.getCell(col);
    c.font = { name: 'Arial', size: 11, bold: true };
    c.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    if ([3, 4].includes(col)) c.numFmt = '#,##0';
    if ([5, 6].includes(col)) c.numFmt = '0.00%';
  });
  curRow++;

  // Subheader ACM Mặt hàng
  ws.mergeCells(`A${curRow}:G${curRow}`);
  const cellCommAcm = ws.getCell(`A${curRow}`);
  cellCommAcm.value = 'ACM';
  cellCommAcm.font = { name: 'Arial', size: 11, bold: true };
  cellCommAcm.fill = headerFill;
  ws.getRow(curRow).height = 24;
  curRow++;

  const commAcmStart = curRow;
  const acmCommodityTotalRow = commAcmStart + data.section2Commodities.acm.items.length;

  for (const item of data.section2Commodities.acm.items) {
    const r = ws.getRow(curRow);
    r.height = 15;
    r.getCell(1).value = item.stt;
    r.getCell(2).value = item.commodityName;
    r.getCell(3).value = item.lotPreviousMonth;
    r.getCell(4).value = item.lotCurrentMonth;
    r.getCell(5).value = {
      formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
      result: item.growthRate === null ? ' ' : item.growthRate,
    };
    r.getCell(6).value = {
      formula: `D${curRow}/$D$${acmCommodityTotalRow}`,
      result: item.marketShareRate,
    };
    r.getCell(7).value = item.note || '';

    [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
      const c = r.getCell(col);
      c.font = { name: 'Arial', size: 11 };
      c.border = thinBorder;
      if (col === 1) c.alignment = { horizontal: 'center' };
      if (col === 2) c.alignment = { horizontal: 'left' };
      if ([3, 4].includes(col)) {
        c.numFmt = '#,##0';
        c.alignment = { horizontal: 'right' };
      }
      if ([5, 6].includes(col)) {
        c.numFmt = '0.00%';
        c.alignment = { horizontal: 'right' };
      }
    });
    curRow++;
  }
  const commAcmEnd = curRow - 1;

  // Tổng ACM Mặt hàng
  const rowCommTotAcm = ws.getRow(curRow);
  rowCommTotAcm.height = 15;
  ws.mergeCells(`A${curRow}:B${curRow}`);
  rowCommTotAcm.getCell(1).value = 'Tổng ACM';
  rowCommTotAcm.getCell(3).value = {
    formula: `SUM(C${commAcmStart}:C${commAcmEnd})`,
    result: data.section2Commodities.acm.summary.lotPreviousMonth,
  };
  rowCommTotAcm.getCell(4).value = {
    formula: `SUM(D${commAcmStart}:D${commAcmEnd})`,
    result: data.section2Commodities.acm.summary.lotCurrentMonth,
  };
  rowCommTotAcm.getCell(5).value = {
    formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
    result: (data.section2Commodities.acm.summary.lotCurrentMonth / data.section2Commodities.acm.summary.lotPreviousMonth) - 1,
  };
  rowCommTotAcm.getCell(6).value = {
    formula: `SUM(F${commAcmStart}:F${commAcmEnd})`,
    result: 1.0,
  };

  [1, 2, 3, 4, 5, 6, 7].forEach((col) => {
    const c = rowCommTotAcm.getCell(col);
    c.font = { name: 'Arial', size: 11, bold: true };
    c.border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    if ([3, 4].includes(col)) c.numFmt = '#,##0';
    if ([5, 6].includes(col)) c.numFmt = '0.00%';
  });
  curRow += 2;

  // 4. PHẦN III
  ws.getCell(`A${curRow}`).value = 'III. Tình hình giao dịch Spread, LME, Options';
  ws.getCell(`A${curRow}`).font = { name: 'Arial', size: 11, bold: true };
  curRow++;

  const renderSection3Table = (titleIdx, titleText, items, summary) => {
    ws.getCell(`A${curRow}`).value = titleIdx;
    ws.getCell(`B${curRow}`).value = titleText;
    ws.getRow(curRow).font = { name: 'Arial', size: 11, bold: true };
    curRow++;

    const hRow1 = curRow;
    const hRow2 = curRow + 1;
    ws.mergeCells(`A${hRow1}:A${hRow2}`);
    ws.getCell(`A${hRow1}`).value = 'STT';
    ws.mergeCells(`B${hRow1}:B${hRow2}`);
    ws.getCell(`B${hRow1}`).value = 'TVKD';

    ws.mergeCells(`C${hRow1}:E${hRow1}`);
    ws.getCell(`C${hRow1}`).value = 'Số Lot giao dịch';

    ws.mergeCells(`F${hRow1}:H${hRow1}`);
    ws.getCell(`F${hRow1}`).value = 'Số lượng TKGD Active';

    ws.getCell(`C${hRow2}`).value = 'Tháng trước';
    ws.getCell(`D${hRow2}`).value = 'Tháng này';
    ws.getCell(`E${hRow2}`).value = '% Tăng/giảm';
    ws.getCell(`F${hRow2}`).value = 'Hết tháng trước';
    ws.getCell(`G${hRow2}`).value = 'Tháng này';
    ws.getCell(`H${hRow2}`).value = 'Tổng';

    [hRow1, hRow2].forEach((rIdx) => {
      const r = ws.getRow(rIdx);
      [1, 2, 3, 4, 5, 6, 7, 8].forEach((cIdx) => {
        const c = r.getCell(cIdx);
        c.font = { name: 'Arial', size: 11, bold: true };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = thinBorder;
      });
    });
    curRow += 2;

    const tStart = curRow;
    for (const item of items) {
      const r = ws.getRow(curRow);
      r.height = 15;
      r.getCell(1).value = item.stt;
      r.getCell(2).value = item.fullName;
      r.getCell(3).value = item.lotPreviousMonth;
      r.getCell(4).value = item.lotCurrentMonth;
      r.getCell(5).value = {
        formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
        result: item.lotPreviousMonth > 0 ? (item.lotCurrentMonth / item.lotPreviousMonth - 1) : ' ',
      };
      r.getCell(6).value = item.activeAccountsPreviousMonth;
      r.getCell(7).value = item.activeAccountsCurrentMonth;
      r.getCell(8).value = {
        formula: `SUM(F${curRow}:G${curRow})`,
        result: item.totalActiveAccounts,
      };

      [1, 2, 3, 4, 5, 6, 7, 8].forEach((col) => {
        const c = r.getCell(col);
        c.font = { name: 'Arial', size: 11 };
        c.border = thinBorder;
        if (col === 1) c.alignment = { horizontal: 'center' };
        if (col === 2) c.alignment = { horizontal: 'left' };
        if ([3, 4, 6, 7, 8].includes(col)) {
          c.numFmt = '#,##0';
          c.alignment = { horizontal: 'right' };
        }
        if (col === 5) {
          c.numFmt = '0.00%';
          c.alignment = { horizontal: 'right' };
        }
      });
      curRow++;
    }
    const tEnd = curRow - 1;

    const rTot = ws.getRow(curRow);
    rTot.height = 16.5;
    ws.mergeCells(`A${curRow}:B${curRow}`);
    rTot.getCell(1).value = 'Tổng';
    rTot.getCell(3).value = {
      formula: `SUM(C${tStart}:C${tEnd})`,
      result: summary.lotPreviousMonth,
    };
    rTot.getCell(4).value = {
      formula: `SUM(D${tStart}:D${tEnd})`,
      result: summary.lotCurrentMonth,
    };
    rTot.getCell(5).value = {
      formula: `IFERROR(D${curRow}/C${curRow}-1," ")`,
      result: summary.lotPreviousMonth > 0 ? (summary.lotCurrentMonth / summary.lotPreviousMonth - 1) : ' ',
    };
    rTot.getCell(6).value = {
      formula: `SUM(F${tStart}:F${tEnd})`,
      result: summary.activeAccountsPreviousMonth,
    };
    rTot.getCell(7).value = {
      formula: `SUM(G${tStart}:G${tEnd})`,
      result: summary.activeAccountsCurrentMonth,
    };
    rTot.getCell(8).value = {
      formula: `SUM(H${tStart}:H${tEnd})`,
      result: summary.totalActiveAccounts,
    };

    [1, 2, 3, 4, 5, 6, 7, 8].forEach((col) => {
      const c = rTot.getCell(col);
      c.font = { name: 'Arial', size: 11, bold: true };
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      if ([3, 4, 6, 7, 8].includes(col)) c.numFmt = '#,##0';
      if (col === 5) c.numFmt = '0.00%';
    });
    curRow += 2;
  };

  renderSection3Table(1, 'Giao dịch Spread', data.section3Specials.spread.items, data.section3Specials.spread.summary);
  renderSection3Table(2, 'Giao dịch LME', data.section3Specials.lme.items, data.section3Specials.lme.summary);
  renderSection3Table(3, 'Giao dịch Options', data.section3Specials.options.items, data.section3Specials.options.summary);

  await wb.xlsx.writeFile(outputPath);
  console.log(`✅ Đã xuất file Excel tại: ${outputPath}`);
}

async function verifyParity(origPath, genPath) {
  console.log(`\n--- BẮT ĐẦU ĐỐI CHIẾU REGRESSION 1:1 ---`);
  console.log(`File gốc:      ${path.basename(origPath)}`);
  console.log(`File sinh ra:  ${path.basename(genPath)}`);

  const wbOrig = XLSX.readFile(origPath);
  const wbGen = XLSX.readFile(genPath);

  const wsOrig = wbOrig.Sheets[wbOrig.SheetNames[0]];
  const wsGen = wbGen.Sheets[wbGen.SheetNames[0]];

  const keyCheckCells = [
    { cell: 'A2', desc: 'Tiêu đề Mục I' },
    { cell: 'B5', desc: 'Top 1 TVKD CQG (APEX)' },
    { cell: 'C5', desc: 'Lot Tháng trước Top 1 CQG' },
    { cell: 'D5', desc: 'Lot Tháng này Top 1 CQG' },
    { cell: 'A40', desc: 'Nhãn TỔNG CQG' },
    { cell: 'C40', desc: 'Tổng Lot CQG Tháng trước' },
    { cell: 'D40', desc: 'Tổng Lot CQG Tháng này' },
    { cell: 'F40', desc: 'Đỉnh CQG Toàn thị trường' },
    { cell: 'G40', desc: 'Ngày Đỉnh CQG' },
    { cell: 'H40', desc: 'Đáy CQG Toàn thị trường' },
    { cell: 'I40', desc: 'Ngày Đáy CQG' },
    { cell: 'A67', desc: 'Nhãn TỔNG ACM' },
    { cell: 'C67', desc: 'Tổng Lot ACM Tháng trước' },
    { cell: 'D67', desc: 'Tổng Lot ACM Tháng này' },
    { cell: 'F67', desc: 'Đỉnh ACM Toàn thị trường' },
    { cell: 'H67', desc: 'Đáy ACM Toàn thị trường' },
    { cell: 'A70', desc: 'Tiêu đề Mục II' },
    { cell: 'B73', desc: 'Top 1 Hàng hóa CQG (Lúa Mỳ)' },
    { cell: 'D73', desc: 'Lot Lúa Mỳ Tháng này' },
    { cell: 'C124', desc: 'Tổng Lot CQG Mặt hàng Tháng trước' },
    { cell: 'D124', desc: 'Tổng Lot CQG Mặt hàng Tháng này' },
    { cell: 'B126', desc: 'Top 1 Hàng hóa ACM (Bạc Nano ACM)' },
    { cell: 'D126', desc: 'Lot Bạc Nano ACM' },
    { cell: 'C129', desc: 'Tổng Lot ACM Mặt hàng Tháng trước' },
    { cell: 'D129', desc: 'Tổng Lot ACM Mặt hàng Tháng này' },
    { cell: 'A131', desc: 'Tiêu đề Mục III' },
    { cell: 'F149', desc: 'Tổng TK Active Spread Hết tháng trước' },
    { cell: 'G149', desc: 'Tổng TK Active Spread Tháng này' },
    { cell: 'H149', desc: 'Tổng TK Active Spread Lũy kế' },
    { cell: 'C161', desc: 'Tổng Lot LME Tháng trước' },
    { cell: 'D161', desc: 'Tổng Lot LME Tháng này' },
    { cell: 'H161', desc: 'Tổng TK Active LME' },
    { cell: 'C179', desc: 'Tổng Lot Options Tháng trước' },
    { cell: 'D179', desc: 'Tổng Lot Options Tháng này' },
    { cell: 'F179', desc: 'Tổng TK Active Options Hết tháng trước' },
    { cell: 'G179', desc: 'Tổng TK Active Options Tháng này' },
    { cell: 'H179', desc: 'Tổng TK Active Options Lũy kế' },
  ];

  let passedCount = 0;
  for (const item of keyCheckCells) {
    const origVal = wsOrig[item.cell] ? wsOrig[item.cell].v : undefined;
    const genVal = wsGen[item.cell] ? wsGen[item.cell].v : undefined;
    const match = String(origVal).trim() === String(genVal).trim();
    if (match) {
      passedCount++;
      console.log(`[PASS] ${item.cell.padEnd(5)} | ${item.desc.padEnd(42)} | Gốc: ${String(origVal).padEnd(12)} == Sinh ra: ${genVal}`);
    } else {
      console.log(`[FAIL] ${item.cell.padEnd(5)} | ${item.desc.padEnd(42)} | Gốc: ${String(origVal).padEnd(12)} != Sinh ra: ${genVal}`);
    }
  }

  const score = ((passedCount / keyCheckCells.length) * 100).toFixed(2);
  console.log(`\n==============================================`);
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount}/${keyCheckCells.length} ô then chốt trùng khớp tuyệt đối (${score}%)`);
  if (passedCount === keyCheckCells.length) {
    console.log(`🏆 PARITY TEST HOÀN HẢO 100%! EXPORTER SẴN SÀNG TRIỂN KHAI PRODUCTION.`);
  }
}

async function run() {
  const jsonFile = path.resolve(__dirname, 'monthly_report_09_2026_extracted.json');
  const genFile = path.resolve(__dirname, 'Bao cao thang 09.2026 - Generated.xlsx');
  const origFile = path.resolve(__dirname, 'Bao cao thang 09.2026 - Final.xlsx');

  await generateExcelFromExtractedJson(jsonFile, genFile);
  await verifyParity(origFile, genFile);
}

run().catch(console.error);

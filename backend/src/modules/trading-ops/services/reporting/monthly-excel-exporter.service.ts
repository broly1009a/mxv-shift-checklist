import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

function toDateSerial(dateStr: any): any {
  if (!dateStr) return '';
  if (typeof dateStr === 'number') return dateStr;
  const parts = String(dateStr).split('/');
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    // Excel date serial for 2026-MM-DD (Epoch 1899-12-30)
    const d = new Date(Date.UTC(2026, month - 1, day));
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return Math.round((d.getTime() - epoch.getTime()) / (24 * 3600 * 1000));
  }
  return dateStr;
}

@Injectable()
export class MonthlyExcelExporterService {
  private readonly logger = new Logger(MonthlyExcelExporterService.name);

  /**
   * Đánh màu cell tăng trưởng (% Tăng/giảm):
   * - Xanh lá nhạt (FFC6EFCE) / chữ xanh đậm (FF006100) cho tăng trưởng > 0%
   * - Đỏ/hồng nhạt (FFFFC7CE) / chữ đỏ đậm (FF9C0006) cho tăng trưởng < 0%
   * - Vàng nhạt (FFFFEB9C) / chữ nâu vàng (FF9C5700) cho 0% / N/A / rỗng
   */
  private applyGrowthStyle(cell: ExcelJS.Cell, val: any, isBold = false): void {
    cell.numFmt = '0.00%';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };

    let num: number | null = null;
    if (typeof val === 'number') {
      num = val;
    } else if (val && val !== ' ' && !isNaN(Number(val))) {
      num = Number(val);
    }

    if (num === null || isNaN(num) || num === 0) {
      // Vàng nhạt (Neutral / Mới / Không đổi)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB9C' },
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: isBold,
        color: { argb: 'FF9C5700' },
      };
    } else if (num > 0) {
      // Xanh lá nhạt (Tăng trưởng dương)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' },
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: isBold,
        color: { argb: 'FF006100' },
      };
    } else {
      // Đỏ/Hồng nhạt (Tăng trưởng âm)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' },
      };
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: isBold,
        color: { argb: 'FF9C0006' },
      };
    }
  }

  /**
   * Tạo 3 rule định dạng có điều kiện (Conditional Formatting) chuẩn 100% template gốc QLGD
   */
  private getGrowthCfRules(firstCell: string): any[] {
    return [
      {
        type: 'containsText',
        operator: 'containsText',
        priority: 1,
        formulae: [`NOT(ISERROR(SEARCH(" ",${firstCell})))`],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFEB9C' },
            fgColor: { argb: 'FFFFEB9C' },
          },
          font: {
            color: { argb: 'FF9C5700' },
          },
        },
      },
      {
        type: 'cellIs',
        operator: 'lessThan',
        priority: 2,
        formulae: ['0'],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFC7CE' },
            fgColor: { argb: 'FFFFC7CE' },
          },
          font: {
            color: { argb: 'FF9C0006' },
          },
        },
      },
      {
        type: 'cellIs',
        operator: 'greaterThan',
        priority: 3,
        formulae: ['0'],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFC6EFCE' },
            fgColor: { argb: 'FFC6EFCE' },
          },
          font: {
            color: { argb: 'FF006100' },
          },
        },
      },
    ];
  }

  /**
   * Tạo Workbook Excel Báo Cáo Tháng hoàn chỉnh 100% khớp file mẫu gốc
   */
  async buildMonthlyReportWorkbook(data: any): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MXV Operations Hub';
    wb.created = new Date();

    const ws = wb.addWorksheet('Sheet1', {
      views: [{ showGridLines: true }],
    });

    // 1. Cấu hình độ rộng các cột (Col A -> I)
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

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCE6F1' }, // Accent 6 Tint 0.4
    };

    // 2. PHẦN I: TÌNH HÌNH GIAO DỊCH THEO TVKD
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
          this.applyGrowthStyle(c, item.growthRate, false);
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
      result:
        data.section1Tvkd.cqg.summary.lotPreviousMonth > 0
          ? data.section1Tvkd.cqg.summary.lotCurrentMonth /
              data.section1Tvkd.cqg.summary.lotPreviousMonth -
            1
          : ' ',
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
      if (col === 5) {
        const totRate =
          data.section1Tvkd.cqg.summary.lotPreviousMonth > 0
            ? data.section1Tvkd.cqg.summary.lotCurrentMonth /
                data.section1Tvkd.cqg.summary.lotPreviousMonth -
              1
            : null;
        this.applyGrowthStyle(c, totRate, true);
      }
      if ([7, 9].includes(col)) {
        c.numFmt = 'dd/mm';
        c.alignment = { horizontal: 'center' };
      }
    });

    ws.addConditionalFormatting({
      ref: `E${cqgStart}:E${curRow}`,
      rules: this.getGrowthCfRules(`E${cqgStart}`),
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
          this.applyGrowthStyle(c, item.growthRate, false);
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
      result:
        data.section1Tvkd.acm.summary.lotPreviousMonth > 0
          ? data.section1Tvkd.acm.summary.lotCurrentMonth /
              data.section1Tvkd.acm.summary.lotPreviousMonth -
            1
          : ' ',
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
      if (col === 5) {
        const totRate =
          data.section1Tvkd.acm.summary.lotPreviousMonth > 0
            ? data.section1Tvkd.acm.summary.lotCurrentMonth /
                data.section1Tvkd.acm.summary.lotPreviousMonth -
              1
            : null;
        this.applyGrowthStyle(c, totRate, true);
      }
      if ([7, 9].includes(col)) {
        c.numFmt = 'dd/mm';
        c.alignment = { horizontal: 'center' };
      }
    });

    ws.addConditionalFormatting({
      ref: `E${acmStart}:E${curRow}`,
      rules: this.getGrowthCfRules(`E${acmStart}`),
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
        if (col === 5) {
          this.applyGrowthStyle(c, item.growthRate, false);
        }
        if (col === 6) {
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
      result:
        data.section2Commodities.cqg.summary.lotPreviousMonth > 0
          ? data.section2Commodities.cqg.summary.lotCurrentMonth /
              data.section2Commodities.cqg.summary.lotPreviousMonth -
            1
          : ' ',
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
      if (col === 5) {
        const totRate =
          data.section2Commodities.cqg.summary.lotPreviousMonth > 0
            ? data.section2Commodities.cqg.summary.lotCurrentMonth /
                data.section2Commodities.cqg.summary.lotPreviousMonth -
              1
            : null;
        this.applyGrowthStyle(c, totRate, true);
      }
      if (col === 6) c.numFmt = '0.00%';
    });

    ws.addConditionalFormatting({
      ref: `E${commCqgStart}:E${curRow}`,
      rules: this.getGrowthCfRules(`E${commCqgStart}`),
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
        if (col === 5) {
          this.applyGrowthStyle(c, item.growthRate, false);
        }
        if (col === 6) {
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
      result:
        data.section2Commodities.acm.summary.lotPreviousMonth > 0
          ? data.section2Commodities.acm.summary.lotCurrentMonth /
              data.section2Commodities.acm.summary.lotPreviousMonth -
            1
          : ' ',
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
      if (col === 5) {
        const totRate =
          data.section2Commodities.acm.summary.lotPreviousMonth > 0
            ? data.section2Commodities.acm.summary.lotCurrentMonth /
                data.section2Commodities.acm.summary.lotPreviousMonth -
              1
            : null;
        this.applyGrowthStyle(c, totRate, true);
      }
      if (col === 6) c.numFmt = '0.00%';
    });

    ws.addConditionalFormatting({
      ref: `E${commAcmStart}:E${curRow}`,
      rules: this.getGrowthCfRules(`E${commAcmStart}`),
    });
    curRow += 2;

    // 4. PHẦN III: SPREAD, LME, OPTIONS
    ws.getCell(`A${curRow}`).value = 'III. Tình hình giao dịch Spread, LME, Options';
    ws.getCell(`A${curRow}`).font = { name: 'Arial', size: 11, bold: true };
    curRow++;

    const renderSection3Table = (
      titleIdx: number,
      titleText: string,
      items: any[],
      summary: any,
    ) => {
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
          result:
            item.lotPreviousMonth > 0
              ? item.lotCurrentMonth / item.lotPreviousMonth - 1
              : ' ',
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
            const rate =
              item.lotPreviousMonth > 0
                ? item.lotCurrentMonth / item.lotPreviousMonth - 1
                : null;
            this.applyGrowthStyle(c, rate, false);
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
        result:
          summary.lotPreviousMonth > 0
            ? summary.lotCurrentMonth / summary.lotPreviousMonth - 1
            : ' ',
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
        if (col === 5) {
          const totRate =
            summary.lotPreviousMonth > 0
              ? summary.lotCurrentMonth / summary.lotPreviousMonth - 1
              : null;
          this.applyGrowthStyle(c, totRate, true);
        }
      });

      ws.addConditionalFormatting({
        ref: `E${tStart}:E${curRow}`,
        rules: this.getGrowthCfRules(`E${tStart}`),
      });
      curRow += 2;
    };

    renderSection3Table(
      1,
      'Giao dịch Spread',
      data.section3Specials.spread.items,
      data.section3Specials.spread.summary,
    );
    renderSection3Table(
      2,
      'Giao dịch LME',
      data.section3Specials.lme.items,
      data.section3Specials.lme.summary,
    );
    renderSection3Table(
      3,
      'Giao dịch Options',
      data.section3Specials.options.items,
      data.section3Specials.options.summary,
    );

    return wb;
  }
}


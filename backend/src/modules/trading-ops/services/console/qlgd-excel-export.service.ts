/**
 * qlgd-excel-export.service.ts
 *
 * Service chuyên trách xuất file Excel Báo Cáo Ban Giám Đốc (Executive Dashboard QLGD).
 * Tái hiện 1:1 theo đúng định dạng mẫu chuẩn từ file Check BGS All.xlsm:
 * - 2 Khối thẻ tóm tắt trên cùng: "ACM" và "Còn lại" (KLGD, GTGD, mốc 4 phiên).
 * - Bảng chi tiết 17 mặt hàng chủ lực (hoặc 44 mặt hàng) gộp nhóm (Nông sản, Nguyên liệu công nghiệp, Kim loại...).
 * - Màu sắc cảnh báo trực quan: Đỏ nhạt cho Lãi lỗ dự kiến âm, Xanh lá cho vị thế mở/tất toán lớn nhất, Thanh % Mua màu xanh nước biển.
 * - Hàng tổng kết cuối bảng chuẩn công thức kế toán.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  QlgdDashboardService,
  QlgdDashboardResponse,
  CommodityDashboardItem,
} from './qlgd-dashboard.service';

@Injectable()
export class QlgdExcelExportService {
  private readonly logger = new Logger(QlgdExcelExportService.name);

  constructor(private readonly qlgdDashboardService: QlgdDashboardService) {}

  /**
   * Tạo buffer Excel báo cáo BGS theo chuẩn template 1:1
   */
  async generateExecutiveDashboardExcel(
    dateStr?: string,
    catalogScope: 'TOP17' | 'ALL' = 'TOP17',
  ): Promise<Buffer> {
    const data: QlgdDashboardResponse = await this.qlgdDashboardService.getExecutiveDashboard(
      dateStr,
      'ALL',
      catalogScope,
      false,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MXV Operations System';
    workbook.lastModifiedBy = 'MXV Executive Dashboard';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Báo Cáo BGS', {
      views: [{ showGridLines: true }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    // 1. Cấu hình độ rộng các cột (Col A đến J)
    sheet.columns = [
      { key: 'stt', width: 8 }, // Col A
      { key: 'category', width: 20 }, // Col B
      { key: 'symbol', width: 12 }, // Col C
      { key: 'name', width: 22 }, // Col D
      { key: 'expectedPnL', width: 24 }, // Col E
      { key: 'openPositions', width: 18 }, // Col F
      { key: 'longRatio', width: 12 }, // Col G
      { key: 'shortRatio', width: 12 }, // Col H
      { key: 'realizedPnL', width: 22 }, // Col I
      { key: 'liquidatedLots', width: 20 }, // Col J
    ];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' },
    };

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 1: HAI KHỐI TÓM TẮT TRÊN CÙNG ("ACM" VÀ "CÒN LẠI")
    // ─────────────────────────────────────────────────────────────────────────

    // --- Khối 1: ACM (Cột A đến D) ---
    // Row 2: Header "ACM"
    sheet.mergeCells('A2:D2');
    const cellAcmTitle = sheet.getCell('A2');
    cellAcmTitle.value = 'ACM';
    cellAcmTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } };
    cellAcmTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    cellAcmTitle.fill = headerFill;
    this.applyBorderRange(sheet, 2, 1, 2, 4, thinBorder);

    // Row 3: KLGD & GTGD
    sheet.mergeCells('A3:B3');
    const cellAcmKlgd = sheet.getCell('A3');
    cellAcmKlgd.value = `KLGD ${data.latestMetrics.acm.klgd.toLocaleString('en-US')}`;
    cellAcmKlgd.font = { name: 'Arial', size: 10, bold: true };
    cellAcmKlgd.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    this.applyBorderRange(sheet, 3, 1, 3, 2, thinBorder);

    sheet.mergeCells('C3:D3');
    const cellAcmGtgd = sheet.getCell('C3');
    cellAcmGtgd.value = `GTGD ${data.latestMetrics.acm.gtgdStr || '0 tỷ'}`;
    cellAcmGtgd.font = { name: 'Arial', size: 10, bold: true };
    cellAcmGtgd.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    this.applyBorderRange(sheet, 3, 3, 3, 4, thinBorder);

    // Row 4-6: Khu vực placeholder "Biểu đồ theo lần check"
    sheet.mergeCells('A4:D6');
    const cellAcmChart = sheet.getCell('A4');
    cellAcmChart.value = 'Biểu đồ theo lần check';
    cellAcmChart.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    cellAcmChart.alignment = { vertical: 'middle', horizontal: 'center' };
    this.applyBorderRange(sheet, 4, 1, 6, 4, thinBorder);

    // Row 7: Header 4 mốc phiên
    const sessions = ['Đầu phiên', 'Phiên Á', 'Phiên Âu', 'Phiên Mỹ'];
    const acmColKeys = ['A', 'B', 'C', 'D'];
    sessions.forEach((s, idx) => {
      const cell = sheet.getCell(`${acmColKeys[idx]}7`);
      cell.value = s;
      cell.font = { name: 'Arial', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // Row 8: Giá trị 4 mốc phiên ACM
    const acmValues = [
      data.milestones.acm.earlySession || 0,
      data.milestones.acm.asianSession || 0,
      data.milestones.acm.europeanSession || 0,
      data.milestones.acm.americanSession ?? (data.milestones.acm.isAmericanSessionPending ? '—' : 0),
    ];
    acmValues.forEach((val, idx) => {
      const cell = sheet.getCell(`${acmColKeys[idx]}8`);
      cell.value = typeof val === 'number' ? val : val;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (typeof val === 'number') {
        cell.numFmt = '#,##0';
      }
      cell.border = thinBorder;
    });

    // --- Khối 2: Còn lại (Cột G đến J) ---
    // Row 2: Header "Còn lại"
    sheet.mergeCells('G2:J2');
    const cellOthersTitle = sheet.getCell('G2');
    cellOthersTitle.value = 'Còn lại';
    cellOthersTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } };
    cellOthersTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    cellOthersTitle.fill = headerFill;
    this.applyBorderRange(sheet, 2, 7, 2, 10, thinBorder);

    // Row 3: KLGD & GTGD
    sheet.mergeCells('G3:H3');
    const cellOthersKlgd = sheet.getCell('G3');
    cellOthersKlgd.value = `KLGD ${data.latestMetrics.others.klgd.toLocaleString('en-US')}`;
    cellOthersKlgd.font = { name: 'Arial', size: 10, bold: true };
    cellOthersKlgd.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    this.applyBorderRange(sheet, 3, 7, 3, 8, thinBorder);

    sheet.mergeCells('I3:J3');
    const cellOthersGtgd = sheet.getCell('I3');
    cellOthersGtgd.value = `GTGD ${data.latestMetrics.others.gtgdStr || '0 tỷ'}`;
    cellOthersGtgd.font = { name: 'Arial', size: 10, bold: true };
    cellOthersGtgd.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    this.applyBorderRange(sheet, 3, 9, 3, 10, thinBorder);

    // Row 4-6: Khu vực placeholder "Biểu đồ theo lần check"
    sheet.mergeCells('G4:J6');
    const cellOthersChart = sheet.getCell('G4');
    cellOthersChart.value = 'Biểu đồ theo lần check';
    cellOthersChart.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    cellOthersChart.alignment = { vertical: 'middle', horizontal: 'center' };
    this.applyBorderRange(sheet, 4, 7, 6, 10, thinBorder);

    // Row 7: Header 4 mốc phiên
    const othersColKeys = ['G', 'H', 'I', 'J'];
    sessions.forEach((s, idx) => {
      const cell = sheet.getCell(`${othersColKeys[idx]}7`);
      cell.value = s;
      cell.font = { name: 'Arial', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // Row 8: Giá trị 4 mốc phiên Còn lại
    const othersValues = [
      data.milestones.others.earlySession || 0,
      data.milestones.others.asianSession || 0,
      data.milestones.others.europeanSession || 0,
      data.milestones.others.americanSession ?? (data.milestones.others.isAmericanSessionPending ? '—' : 0),
    ];
    othersValues.forEach((val, idx) => {
      const cell = sheet.getCell(`${othersColKeys[idx]}8`);
      cell.value = typeof val === 'number' ? val : val;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (typeof val === 'number') {
        cell.numFmt = '#,##0';
      }
      cell.border = thinBorder;
    });

    // Đặt chiều cao dòng cho khối trên
    sheet.getRow(2).height = 24;
    sheet.getRow(3).height = 20;
    sheet.getRow(4).height = 20;
    sheet.getRow(5).height = 20;
    sheet.getRow(6).height = 20;
    sheet.getRow(7).height = 20;
    sheet.getRow(8).height = 22;
    sheet.getRow(9).height = 14; // Dòng đệm cách bảng chính

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 2: HEADER BẢNG DỮ LIỆU CHÍNH (ROW 10 & ROW 11)
    // ─────────────────────────────────────────────────────────────────────────

    // Định dạng chuỗi ngày tháng: ví dụ 2026-10-08 -> 8/10/2026
    let displayDate = data.sessionDate;
    if (data.sessionDate && data.sessionDate.includes('-')) {
      const [year, month, day] = data.sessionDate.split('-');
      displayDate = `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
    }

    // Row 10 & 11: STT, Nhóm HH, Mã HH, Tên HH (Gộp 2 dòng)
    sheet.mergeCells('A10:A11');
    const hStt = sheet.getCell('A10');
    hStt.value = 'STT';
    hStt.font = { name: 'Arial', size: 10, bold: true };
    hStt.alignment = { vertical: 'middle', horizontal: 'center' };
    hStt.fill = headerFill;
    this.applyBorderRange(sheet, 10, 1, 11, 1, thinBorder);

    sheet.mergeCells('B10:B11');
    const hCat = sheet.getCell('B10');
    hCat.value = 'Nhóm HH';
    hCat.font = { name: 'Arial', size: 10, bold: true };
    hCat.alignment = { vertical: 'middle', horizontal: 'center' };
    hCat.fill = headerFill;
    this.applyBorderRange(sheet, 10, 2, 11, 2, thinBorder);

    sheet.mergeCells('C10:C11');
    const hSym = sheet.getCell('C10');
    hSym.value = 'Mã HH';
    hSym.font = { name: 'Arial', size: 10, bold: true };
    hSym.alignment = { vertical: 'middle', horizontal: 'center' };
    hSym.fill = headerFill;
    this.applyBorderRange(sheet, 10, 3, 11, 3, thinBorder);

    sheet.mergeCells('D10:D11');
    const hName = sheet.getCell('D10');
    hName.value = 'Tên HH';
    hName.font = { name: 'Arial', size: 10, bold: true };
    hName.alignment = { vertical: 'middle', horizontal: 'center' };
    hName.fill = headerFill;
    this.applyBorderRange(sheet, 10, 4, 11, 4, thinBorder);

    // Row 10: Ngày phiên làm việc (Gộp từ cột E đến J)
    sheet.mergeCells('E10:J10');
    const hDate = sheet.getCell('E10');
    hDate.value = displayDate;
    hDate.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
    hDate.alignment = { vertical: 'middle', horizontal: 'center' };
    hDate.fill = headerFill;
    this.applyBorderRange(sheet, 10, 5, 10, 10, thinBorder);

    // Row 11: Tiêu đề 6 cột số liệu
    const subHeaders = [
      { col: 'E', label: 'Tổng lãi lỗ dự kiến' },
      { col: 'F', label: 'Tổng vị thế mở' },
      { col: 'G', label: '% mở Mua' },
      { col: 'H', label: '% mở Bán' },
      { col: 'I', label: 'Lãi lỗ thực tế' },
      { col: 'J', label: 'Trạng thái tất toán' },
    ];

    subHeaders.forEach(({ col, label }) => {
      const cell = sheet.getCell(`${col}11`);
      cell.value = label;
      cell.font = { name: 'Arial', size: 9, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = headerFill;
      cell.border = thinBorder;
    });

    sheet.getRow(10).height = 22;
    sheet.getRow(11).height = 26;

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 3: DỮ LIỆU CÁC MẶT HÀNG (ROW 12 TRỞ ĐI) - GỘP DÒNG THEO NHÓM
    // ─────────────────────────────────────────────────────────────────────────

    // Tính toán động các mã nổi bật phục vụ phân tầng màu sắc Heatmap (Zero-Hardcoding - Hướng 1)
    const allItems = data.items || [];
    const topLossItem = [...allItems].filter((i) => (i.expectedPnL || 0) < 0).sort((a, b) => (a.expectedPnL || 0) - (b.expectedPnL || 0))[0] || null;
    const topOpenPositionItem = [...allItems].sort((a, b) => (b.openPositions || 0) - (a.openPositions || 0))[0] || null;
    const topLiquidatedItem = [...allItems].sort((a, b) => (b.liquidatedLots || 0) - (a.liquidatedLots || 0))[0] || null;
    const topRealizedProfitItem = [...allItems].filter((i) => (i.realizedPnL || 0) > 0).sort((a, b) => (b.realizedPnL || 0) - (a.realizedPnL || 0))[0] || null;
    const topRealizedLossItem = [...allItems].filter((i) => (i.realizedPnL || 0) < 0).sort((a, b) => (a.realizedPnL || 0) - (b.realizedPnL || 0))[0] || null;

    // Gom nhóm các mặt hàng theo category để gộp dòng Nhóm HH
    const categoryGroups: { category: string; items: CommodityDashboardItem[] }[] = [];
    data.items.forEach((item) => {
      const cat = item.category || 'Khác';
      let group = categoryGroups.find((g) => g.category === cat);
      if (!group) {
        group = { category: cat, items: [] };
        categoryGroups.push(group);
      }
      group.items.push(item);
    });

    let currentRow = 12;

    categoryGroups.forEach((group) => {
      const startRow = currentRow;
      const endRow = startRow + group.items.length - 1;

      group.items.forEach((item, itemIdx) => {
        const row = sheet.getRow(currentRow);
        row.height = 20;

        // Cờ động nhận diện phân tầng Heatmap tương đối (Hướng 1)
        const isTopExpectedLoss = !!(item.highlightExpectedLoss || (topLossItem && item.symbol === topLossItem.symbol));
        const isTopOpen = !!(item.highlightOpenPosition || (topOpenPositionItem && item.symbol === topOpenPositionItem.symbol));
        const isTopLiquidated = !!(item.highlightLiquidated || (topLiquidatedItem && item.symbol === topLiquidatedItem.symbol));
        const isTopProfit = !!(topRealizedProfitItem && item.symbol === topRealizedProfitItem.symbol && (item.realizedPnL || 0) > 0);
        const isTopRealizedLoss = !!(topRealizedLossItem && item.symbol === topRealizedLossItem.symbol && (item.realizedPnL || 0) < 0);

        // Col A: STT
        const cellA = sheet.getCell(`A${currentRow}`);
        cellA.value = item.stt;
        cellA.font = { name: 'Arial', size: 10 };
        cellA.alignment = { vertical: 'middle', horizontal: 'center' };
        cellA.border = thinBorder;

        // Col B: Nhóm HH (sẽ merge sau)
        const cellB = sheet.getCell(`B${currentRow}`);
        cellB.font = { name: 'Arial', size: 10, bold: true };
        cellB.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cellB.border = thinBorder;

        // Col C: Mã HH
        const cellC = sheet.getCell(`C${currentRow}`);
        cellC.value = item.symbol;
        cellC.font = { name: 'Arial', size: 10, bold: true };
        cellC.alignment = { vertical: 'middle', horizontal: 'center' };
        cellC.border = thinBorder;

        // Col D: Tên HH
        const cellD = sheet.getCell(`D${currentRow}`);
        cellD.value = item.name;
        cellD.font = { name: 'Arial', size: 10 };
        cellD.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cellD.border = thinBorder;

        // Col E: Tổng lãi lỗ dự kiến (Đa tầng Heatmap: Đỏ đậm nếu lỗ lớn nhất sàn, Hồng nhạt nếu lỗ thường, Xanh nhạt nếu lãi)
        const cellE = sheet.getCell(`E${currentRow}`);
        cellE.value = item.expectedPnL || 0;
        cellE.font = { name: 'Arial', size: 10 };
        cellE.alignment = { vertical: 'middle', horizontal: 'right' };
        cellE.numFmt = '#,##0;(#,##0);"-"';
        cellE.border = thinBorder;

        if ((item.expectedPnL || 0) < 0) {
          if (isTopExpectedLoss) {
            cellE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF87171' } }; // Đỏ đậm hơn cho mã lỗ lớn nhất sàn
            cellE.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF7F1D1D' } };
          } else {
            cellE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }; // Hồng nhạt cho các mã lỗ thông thường
            cellE.font = { name: 'Arial', size: 10, color: { argb: 'FF991B1B' } };
          }
        } else if ((item.expectedPnL || 0) > 0) {
          cellE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Xanh lá nhạt
          cellE.font = { name: 'Arial', size: 10, color: { argb: 'FF166534' } };
        }

        // Col F: Tổng vị thế mở (Đa tầng Heatmap: Vị thế lớn nhất Xanh đậm nổi bật)
        const cellF = sheet.getCell(`F${currentRow}`);
        cellF.value = item.openPositions || 0;
        cellF.font = { name: 'Arial', size: 10 };
        cellF.alignment = { vertical: 'middle', horizontal: 'right' };
        cellF.numFmt = '#,##0;(#,##0);"-"';
        cellF.border = thinBorder;

        if (isTopOpen) {
          cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } }; // Xanh lá nổi bật cho mã mở lớn nhất sàn
          cellF.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF14532D' } };
        } else {
          cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; // Xanh rất nhạt
        }

        // Col G: % mở Mua & Col H: % mở Bán (Động: Bên nào chiếm ưu thế hiển thị Xanh dương, bên thấp hơn hiển thị Xám)
        const cellG = sheet.getCell(`G${currentRow}`);
        cellG.value = (item.longRatio || 0) / 100;
        cellG.alignment = { vertical: 'middle', horizontal: 'right' };
        cellG.numFmt = '0%';
        cellG.border = thinBorder;

        const cellH = sheet.getCell(`H${currentRow}`);
        cellH.value = (item.shortRatio || 0) / 100;
        cellH.alignment = { vertical: 'middle', horizontal: 'right' };
        cellH.numFmt = '0%';
        cellH.border = thinBorder;

        const isLongHigher = (item.longRatio || 0) >= (item.shortRatio || 0);
        if (isLongHigher) {
          cellG.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } }; // Xanh dương đậm
          cellG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } }; // Xanh dương nhạt
          cellH.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } }; // Xám
          cellH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Xám rất nhạt
        } else {
          cellG.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } }; // Xám
          cellG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Xám rất nhạt
          cellH.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } }; // Xanh dương đậm
          cellH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } }; // Xanh dương nhạt
        }

        // Col I: Lãi lỗ thực tế (Đa tầng Heatmap: Lãi lớn nhất Xanh đậm, lỗ lớn nhất Đỏ đậm, lãi thường Xanh nhạt, lỗ thường Hồng nhạt)
        const cellI = sheet.getCell(`I${currentRow}`);
        cellI.value = item.realizedPnL || 0;
        cellI.font = { name: 'Arial', size: 10 };
        cellI.alignment = { vertical: 'middle', horizontal: 'right' };
        cellI.numFmt = '#,##0;(#,##0);"-"';
        cellI.border = thinBorder;

        if ((item.realizedPnL || 0) < 0) {
          if (isTopRealizedLoss) {
            cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF87171' } }; // Đỏ cảnh báo mã lỗ thực tế lớn nhất
            cellI.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF7F1D1D' } };
          } else {
            cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }; // Hồng nhạt
            cellI.font = { name: 'Arial', size: 10, color: { argb: 'FF991B1B' } };
          }
        } else if ((item.realizedPnL || 0) > 0) {
          if (isTopProfit) {
            cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } }; // Xanh lá đậm cho mã lãi khủng nhất sàn
            cellI.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF14532D' } };
          } else {
            cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Xanh lá nhạt
            cellI.font = { name: 'Arial', size: 10, color: { argb: 'FF166534' } };
          }
        }

        // Col J: Trạng thái tất toán (Đa tầng Heatmap: Tất toán lớn nhất Xanh đậm nổi bật)
        const cellJ = sheet.getCell(`J${currentRow}`);
        cellJ.value = item.liquidatedLots || 0;
        cellJ.font = { name: 'Arial', size: 10 };
        cellJ.alignment = { vertical: 'middle', horizontal: 'right' };
        cellJ.numFmt = '#,##0;(#,##0);"-"';
        cellJ.border = thinBorder;

        if (isTopLiquidated) {
          cellJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } }; // Xanh lá nổi bật cho mã tất toán nhiều nhất sàn
          cellJ.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF14532D' } };
        } else {
          cellJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        }

        currentRow++;
      });

      // Merge cột B cho toàn bộ nhóm mặt hàng này
      if (endRow > startRow) {
        sheet.mergeCells(`B${startRow}:B${endRow}`);
      }
      const catCell = sheet.getCell(`B${startRow}`);
      catCell.value = group.category;
      catCell.font = { name: 'Arial', size: 10, bold: true };
      catCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      this.applyBorderRange(sheet, startRow, 2, endRow, 2, thinBorder);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 4: HÀNG TỔNG KẾT (TOTAL ROW)
    // ─────────────────────────────────────────────────────────────────────────
    const totRow = currentRow;
    sheet.getRow(totRow).height = 24;

    // Gộp A đến D: "Tổng"
    sheet.mergeCells(`A${totRow}:D${totRow}`);
    const cellTotalLabel = sheet.getCell(`A${totRow}`);
    cellTotalLabel.value = 'Tổng';
    cellTotalLabel.font = { name: 'Arial', size: 10, bold: true };
    cellTotalLabel.alignment = { vertical: 'middle', horizontal: 'center' };
    this.applyBorderRange(sheet, totRow, 1, totRow, 4, thinBorder);

    // Col E: Tổng lãi lỗ dự kiến
    const cellTotE = sheet.getCell(`E${totRow}`);
    cellTotE.value = data.totals.expectedPnL || 0;
    cellTotE.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: (data.totals.expectedPnL || 0) < 0 ? { argb: 'FFDC2626' } : { argb: 'FF16A34A' },
    };
    cellTotE.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotE.numFmt = '#,##0;(#,##0);"-"';
    cellTotE.border = thinBorder;

    // Col F: Tổng vị thế mở
    const cellTotF = sheet.getCell(`F${totRow}`);
    cellTotF.value = data.totals.openPositions || 0;
    cellTotF.font = { name: 'Arial', size: 10, bold: true };
    cellTotF.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotF.numFmt = '#,##0;(#,##0);"-"';
    cellTotF.border = thinBorder;

    // Col G & H: Tỷ lệ Mua / Bán Toàn sàn (Động: bên nào cao hơn mang màu Xanh dương, bên thấp hơn mang màu Xám)
    const isTotLongHigher = (data.totals.avgLongRatio || 0) >= (data.totals.avgShortRatio || 0);

    const cellTotG = sheet.getCell(`G${totRow}`);
    cellTotG.value = (data.totals.avgLongRatio || 0) / 100;
    cellTotG.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotG.numFmt = '0%';
    cellTotG.border = thinBorder;

    const cellTotH = sheet.getCell(`H${totRow}`);
    cellTotH.value = (data.totals.avgShortRatio || 0) / 100;
    cellTotH.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotH.numFmt = '0%';
    cellTotH.border = thinBorder;

    if (isTotLongHigher) {
      cellTotG.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } }; // Xanh dương đậm
      cellTotG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } }; // Xanh dương nhạt
      cellTotH.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } }; // Xám
      cellTotH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Xám rất nhạt
    } else {
      cellTotG.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } }; // Xám
      cellTotG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Xám rất nhạt
      cellTotH.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } }; // Xanh dương đậm
      cellTotH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFDBFE' } }; // Xanh dương nhạt
    }

    // Col I: Tổng lãi lỗ thực tế
    const cellTotI = sheet.getCell(`I${totRow}`);
    cellTotI.value = data.totals.realizedPnL || 0;
    cellTotI.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: (data.totals.realizedPnL || 0) < 0 ? { argb: 'FFDC2626' } : { argb: 'FF16A34A' },
    };
    cellTotI.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotI.numFmt = '#,##0;(#,##0);"-"';
    cellTotI.border = thinBorder;

    // Col J: Tổng trạng thái tất toán
    const cellTotJ = sheet.getCell(`J${totRow}`);
    cellTotJ.value = data.totals.liquidatedLots || 0;
    cellTotJ.font = { name: 'Arial', size: 10, bold: true };
    cellTotJ.alignment = { vertical: 'middle', horizontal: 'right' };
    cellTotJ.numFmt = '#,##0;(#,##0);"-"';
    cellTotJ.border = thinBorder;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Helper áp dụng viền border cho dải ô (startRow -> endRow, startCol -> endCol)
   */
  private applyBorderRange(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    border: Partial<ExcelJS.Borders>,
  ) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        sheet.getRow(r).getCell(c).border = border;
      }
    }
  }
}

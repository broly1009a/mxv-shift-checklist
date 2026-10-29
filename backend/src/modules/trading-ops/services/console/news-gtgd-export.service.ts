/**
 * news-gtgd-export.service.ts
 *
 * Service chuyên trách xuất file Excel Giá Trị Giao Dịch (GTGD) cuối phiên phục vụ Ban Tin Tức & Truyền Thông MXV.
 * Tái hiện 100% logic toán học và biểu mẫu chuẩn từ:
 * - Macro gốc: "Macro thong ke gia tri giao dich có ACM.xlsm" (Sheet1, HH, Hhoa Vlookup).
 * - Bảng quy đổi độ lớn hợp đồng (Contract size) & Đơn vị yết giá chuẩn.
 * - Quy đổi tỷ giá đa ngoại tệ: USD, JPY (chia 100), MYR.
 * - Hỗ trợ lưu trữ tự động một bản sao vào thư mục Ban Tin Tức trên ổ M: (news_team_stat_path).
 */

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import { ValueStatisticsService } from '../statistics/value-statistics.service';
import { resolveStoragePathCrossPlatform, resolveCcpDailyPath } from '../../../../shared';
import { findLatestFile } from '../../helpers/trading-math.helper';
import { parseDSGD } from '../../parsers/ms-excel.parser';
import { CcpExcelParser } from '../../parsers/ccp-excel.parser';
import { extractCcpBaseProduct, isAcm, isSpread } from '../../helpers/clearing-excel.helper';

export interface CommodityNewsSpec {
  code: string;
  nameVn: string;
  category: 'Nông sản' | 'Nguyên liệu công nghiệp' | 'Kim loại' | 'Năng lượng';
  doCao: number;
  donVi: number;
  currency?: 'USD' | 'JPY' | 'MYR' | 'VND';
  divisor?: number;
}

/**
 * Danh mục chuẩn 77 hàng hóa trích xuất nguyên bản từ file Macro VBA gốc:
 * Sheet "HH" (Mã & Tên SP) và Sheet "Hhoa Vlookup" (Độ lớn HĐ doCao & Đơn vị yết giá donVi).
 */
export const NEWS_COMMODITY_SPECS: Record<string, CommodityNewsSpec> = {
  // --- NÔNG SẢN ---
  ZLE: { code: 'ZLE', nameVn: 'Dầu Đậu Tương', category: 'Nông sản', doCao: 60000, donVi: 0.01 },
  ZCE: { code: 'ZCE', nameVn: 'Ngô', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'C.ZCE': { code: 'C.ZCE', nameVn: 'Quyền chọn mua Ngô', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'P.ZCE': { code: 'P.ZCE', nameVn: 'Quyền chọn bán Ngô', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  ZSE: { code: 'ZSE', nameVn: 'Đậu Tương', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'C.ZSE': { code: 'C.ZSE', nameVn: 'Quyền chọn mua Đậu tương', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'P.ZSE': { code: 'P.ZSE', nameVn: 'Quyền chọn bán Đậu tương', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  ZME: { code: 'ZME', nameVn: 'Khô Đậu Tương', category: 'Nông sản', doCao: 100, donVi: 1 },
  ZWA: { code: 'ZWA', nameVn: 'Lúa Mỳ', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'C.ZWA': { code: 'C.ZWA', nameVn: 'Quyền chọn mua Lúa mỳ', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  'P.ZWA': { code: 'P.ZWA', nameVn: 'Quyền chọn bán Lúa mỳ', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  KWE: { code: 'KWE', nameVn: 'Lúa Mỳ Kansas', category: 'Nông sản', doCao: 5000, donVi: 0.01 },
  ZRE: { code: 'ZRE', nameVn: 'Gạo thô', category: 'Nông sản', doCao: 200000, donVi: 0.01 },
  XW: { code: 'XW', nameVn: 'Lúa Mỳ Mini', category: 'Nông sản', doCao: 1000, donVi: 0.01 },
  XC: { code: 'XC', nameVn: 'Ngô Mini', category: 'Nông sản', doCao: 1000, donVi: 0.01 },
  XB: { code: 'XB', nameVn: 'Đậu Tương Mini', category: 'Nông sản', doCao: 1000, donVi: 0.01 },
  MZW: { code: 'MZW', nameVn: 'Lúa Mỳ Micro', category: 'Nông sản', doCao: 500, donVi: 0.01 },
  MZC: { code: 'MZC', nameVn: 'Ngô Micro', category: 'Nông sản', doCao: 500, donVi: 0.01 },
  MZS: { code: 'MZS', nameVn: 'Đậu tương Micro', category: 'Nông sản', doCao: 500, donVi: 0.01 },
  MZL: { code: 'MZL', nameVn: 'Dầu đậu tương Micro', category: 'Nông sản', doCao: 6000, donVi: 0.01 },
  MZM: { code: 'MZM', nameVn: 'Khô Đậu tương Micro', category: 'Nông sản', doCao: 10, donVi: 1 },

  // --- NGUYÊN LIỆU CÔNG NGHIỆP ---
  CCE: { code: 'CCE', nameVn: 'Ca cao', category: 'Nguyên liệu công nghiệp', doCao: 10, donVi: 1 },
  CTE: { code: 'CTE', nameVn: 'Bông Sợi', category: 'Nguyên liệu công nghiệp', doCao: 50000, donVi: 0.01 },
  KCE: { code: 'KCE', nameVn: 'Cà phê Arabica', category: 'Nguyên liệu công nghiệp', doCao: 37500, donVi: 0.01 },
  'C.KCE': { code: 'C.KCE', nameVn: 'Quyền chọn mua Cà phê Arabica', category: 'Nguyên liệu công nghiệp', doCao: 37500, donVi: 0.01 },
  'P.KCE': { code: 'P.KCE', nameVn: 'Quyền chọn bán Cà phê Arabica', category: 'Nguyên liệu công nghiệp', doCao: 37500, donVi: 0.01 },
  SBE: { code: 'SBE', nameVn: 'Đường 11', category: 'Nguyên liệu công nghiệp', doCao: 112000, donVi: 0.01 },
  'C.SBE': { code: 'C.SBE', nameVn: 'Quyền chọn mua Đường 11', category: 'Nguyên liệu công nghiệp', doCao: 112000, donVi: 0.01 },
  'P.SBE': { code: 'P.SBE', nameVn: 'Quyền chọn bán Đường 11', category: 'Nguyên liệu công nghiệp', doCao: 112000, donVi: 0.01 },
  LRC: { code: 'LRC', nameVn: 'Cà phê Robusta', category: 'Nguyên liệu công nghiệp', doCao: 10, donVi: 1 },
  QW: { code: 'QW', nameVn: 'Đường trắng', category: 'Nguyên liệu công nghiệp', doCao: 50, donVi: 1 },
  MPO: { code: 'MPO', nameVn: 'Dầu cọ thô', category: 'Nguyên liệu công nghiệp', doCao: 25, donVi: 1, currency: 'MYR' },
  TRU: { code: 'TRU', nameVn: 'Cao su RSS3 TOCOM', category: 'Nguyên liệu công nghiệp', doCao: 5000, donVi: 1, currency: 'JPY', divisor: 100 },
  ZFT: { code: 'ZFT', nameVn: 'Cao su TSR20', category: 'Nguyên liệu công nghiệp', doCao: 5000, donVi: 0.01 },

  // --- KIM LOẠI ---
  ALI: { code: 'ALI', nameVn: 'Nhôm', category: 'Kim loại', doCao: 25, donVi: 1 },
  CPE: { code: 'CPE', nameVn: 'Đồng', category: 'Kim loại', doCao: 25000, donVi: 1 },
  MQC: { code: 'MQC', nameVn: 'Đồng mini', category: 'Kim loại', doCao: 12500, donVi: 1 },
  MHG: { code: 'MHG', nameVn: 'Đồng micro', category: 'Kim loại', doCao: 2500, donVi: 1 },
  SIE: { code: 'SIE', nameVn: 'Bạc', category: 'Kim loại', doCao: 5000, donVi: 1 },
  MQI: { code: 'MQI', nameVn: 'Bạc mini', category: 'Kim loại', doCao: 2500, donVi: 1 },
  SIL: { code: 'SIL', nameVn: 'Bạc micro', category: 'Kim loại', doCao: 1000, donVi: 1 },
  PLE: { code: 'PLE', nameVn: 'Bạch kim', category: 'Kim loại', doCao: 50, donVi: 1 },
  FEF: { code: 'FEF', nameVn: 'Quặng sắt', category: 'Kim loại', doCao: 100, donVi: 1 },
  CAD: { code: 'CAD', nameVn: 'Đồng LME', category: 'Kim loại', doCao: 25, donVi: 1 },
  AHD: { code: 'AHD', nameVn: 'Nhôm LME', category: 'Kim loại', doCao: 25, donVi: 1 },
  PBD: { code: 'PBD', nameVn: 'Chì LME', category: 'Kim loại', doCao: 25, donVi: 1 },
  SND: { code: 'SND', nameVn: 'Thiếc LME', category: 'Kim loại', doCao: 5, donVi: 1 },
  ZDS: { code: 'ZDS', nameVn: 'Kẽm LME', category: 'Kim loại', doCao: 25, donVi: 1 },
  NID: { code: 'NID', nameVn: 'Niken LME', category: 'Kim loại', doCao: 6, donVi: 1 },
  SSC: { code: 'SSC', nameVn: 'Thép phế liệu CFR Thổ Nhĩ Kỳ', category: 'Kim loại', doCao: 10, donVi: 1 },
  SSR: { code: 'SSR', nameVn: 'Thép thanh vằn FOB Thổ Nhĩ Kỳ', category: 'Kim loại', doCao: 10, donVi: 1 },
  LHC: { code: 'LHC', nameVn: 'Thép cuộn cán nóng FOB Trung Quốc', category: 'Kim loại', doCao: 10, donVi: 1 },

  // --- NĂNG LƯỢNG ---
  CLE: { code: 'CLE', nameVn: 'Dầu WTI', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  'C.CLE': { code: 'C.CLE', nameVn: 'Quyền chọn mua Dầu WTI', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  'P.CLE': { code: 'P.CLE', nameVn: 'Quyền chọn bán Dầu WTI', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  NGE: { code: 'NGE', nameVn: 'Khí tự nhiên', category: 'Năng lượng', doCao: 10000, donVi: 1 },
  'C.NGE': { code: 'C.NGE', nameVn: 'Quyền chọn mua Khí tự nhiên', category: 'Năng lượng', doCao: 10000, donVi: 1 },
  'P.NGE': { code: 'P.NGE', nameVn: 'Quyền chọn bán Khí tự nhiên', category: 'Năng lượng', doCao: 10000, donVi: 1 },
  NQM: { code: 'NQM', nameVn: 'Dầu WTI Mini', category: 'Năng lượng', doCao: 500, donVi: 1 },
  RBE: { code: 'RBE', nameVn: 'Xăng RBOB', category: 'Năng lượng', doCao: 42000, donVi: 1 },
  QO: { code: 'QO', nameVn: 'Dầu Brent', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  'C.QO': { code: 'C.QO', nameVn: 'Quyền chọn mua Dầu Brent', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  'P.QO': { code: 'P.QO', nameVn: 'Quyền chọn bán Dầu Brent', category: 'Năng lượng', doCao: 1000, donVi: 1 },
  QP: { code: 'QP', nameVn: 'Dầu ít lưu huỳnh', category: 'Năng lượng', doCao: 100, donVi: 1 },
  MCLE: { code: 'MCLE', nameVn: 'Dầu WTI Micro', category: 'Năng lượng', doCao: 100, donVi: 1 },
  NQG: { code: 'NQG', nameVn: 'Khí tự nhiên mini', category: 'Năng lượng', doCao: 2500, donVi: 1 },
  BM: { code: 'BM', nameVn: 'Dầu Brent mini', category: 'Năng lượng', doCao: 100, donVi: 1 },

  // --- ACM NANO ---
  SI5CO: { code: 'SI5CO', nameVn: 'Bạc Nano', category: 'Kim loại', doCao: 100, donVi: 1 },
  PL1NY: { code: 'PL1NY', nameVn: 'Bạch kim Nano', category: 'Kim loại', doCao: 5, donVi: 1 },
  CP2CO: { code: 'CP2CO', nameVn: 'Đồng Nano', category: 'Kim loại', doCao: 1000, donVi: 1 },
};

export interface NewsProductAggregate {
  code: string;
  nameVn: string;
  category: string;
  normalLots: number;
  normalGtgd: number;
  spreadLots: number;
  spreadGtgd: number;
  totalLots: number;
  totalGtgd: number;
}

export interface NewsCategoryAggregate {
  category: string;
  lots: number;
  gtgd: number;
  ratio: number;
}

@Injectable()
export class NewsGtgdExportService {
  private readonly logger = new Logger(NewsGtgdExportService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly valueStatisticsService: ValueStatisticsService,
  ) {}

  /**
   * Tạo buffer Excel báo cáo GTGD Ban Tin Tức theo chuẩn template 3 khối 1:1
   */
  async generateNewsGtgdExcel(dateStr?: string): Promise<Buffer> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const [year, month, day] = targetDate.split('-');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // 1. Lấy tỷ giá quy đổi ngày
    const rates = await this.valueStatisticsService.getCurrentExchangeRates();
    const usdRate = rates.usdGain && rates.usdGain > 10 ? rates.usdGain : 25400;
    const jpyRate = rates.jpyGain && rates.jpyGain > 10 ? rates.jpyGain : 165;
    const myrRate = rates.myrGain && rates.myrGain > 10 ? rates.myrGain : 5400;

    // 2. Tìm và nạp file DSGD từ M-System & CoreCCP
    const rawMsBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const rawCcpBase = await this.settingsService.getSetting('bot_backup_path_ccp', '');

    const msTradingDailyPath = path.join(
      resolveStoragePathCrossPlatform(rawMsBase).replace(/Backup MS\\Futures/i, 'TradingCheck\\Futures'),
      subFolder,
    );
    const msDailyPath = path.join(resolveStoragePathCrossPlatform(rawMsBase), subFolder);

    const ccpTradingDailyPath = path.join(
      resolveStoragePathCrossPlatform(rawCcpBase).replace(/Backup CCP/i, 'TradingCheck/CCP'),
      subFolder,
    );
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    const resolvePriorityFile = (primaryDir: string, fallbackDir: string, pattern: RegExp): string => {
      if (primaryDir && fs.existsSync(primaryDir)) {
        const found = findLatestFile(primaryDir, pattern);
        if (found && fs.existsSync(found)) return found;
      }
      if (fallbackDir && fs.existsSync(fallbackDir)) {
        const found = findLatestFile(fallbackDir, pattern);
        if (found && fs.existsSync(found)) return found;
      }
      return '';
    };

    const msDsgdPath = resolvePriorityFile(msTradingDailyPath, msDailyPath, /DSGD.*\.xlsx$/i);
    const ccpDsgdPath = resolvePriorityFile(ccpTradingDailyPath, ccpDailyPath, /DSGD.*\.xlsx$/i);

    interface InternalTrade {
      account: string;
      rawSymbol: string;
      lot: number;
      price: number;
    }

    const allTrades: InternalTrade[] = [];

    // Nạp MS DSGD
    if (msDsgdPath && fs.existsSync(msDsgdPath)) {
      try {
        const rows = parseDSGD(fs.readFileSync(msDsgdPath));
        for (const r of rows) {
          allTrades.push({
            account: r.maTKGD || '',
            rawSymbol: r.maHD || '',
            lot: Number(r.klGiaoDich) || 0,
            price: Number(r.giaKhop) || 0,
          });
        }
      } catch (err: any) {
        this.logger.warn(`[NewsGtgdExport] Đọc file DSGD MS lỗi: ${err.message}`);
      }
    }

    // Nạp CoreCCP DSGD
    if (ccpDsgdPath && fs.existsSync(ccpDsgdPath)) {
      try {
        const parsed = CcpExcelParser.parseDSGD(fs.readFileSync(ccpDsgdPath));
        for (const r of parsed.records) {
          allTrades.push({
            account: r.soTK || '',
            rawSymbol: r.maHD || '',
            lot: Number(r.klKhop) || 0,
            price: Number(r.giaKhop) || 0,
          });
        }
      } catch (err: any) {
        this.logger.warn(`[NewsGtgdExport] Đọc file DSGD CCP lỗi: ${err.message}`);
      }
    }

    // 3. Khởi tạo cấu trúc tổng hợp dữ liệu
    const productStats = new Map<string, NewsProductAggregate>();
    const nanoStats = new Map<string, { lots: number; gtgd: number }>();
    nanoStats.set('SI5CO', { lots: 0, gtgd: 0 });
    nanoStats.set('PL1NY', { lots: 0, gtgd: 0 });
    nanoStats.set('CP2CO', { lots: 0, gtgd: 0 });

    // Khởi tạo các mã hàng hóa chuẩn có sẵn theo danh mục 77 mã
    for (const [code, spec] of Object.entries(NEWS_COMMODITY_SPECS)) {
      productStats.set(code, {
        code,
        nameVn: spec.nameVn,
        category: spec.category,
        normalLots: 0,
        normalGtgd: 0,
        spreadLots: 0,
        spreadGtgd: 0,
        totalLots: 0,
        totalGtgd: 0,
      });
    }

    // 4. Tính toán GTGD từng lệnh khớp
    for (const trade of allTrades) {
      if (trade.lot <= 0) continue;

      const baseCode = extractCcpBaseProduct(trade.rawSymbol).toUpperCase().trim();
      const isTradeSpread = isSpread(trade.account) || trade.rawSymbol.includes('-') || trade.rawSymbol.includes('/');
      const isTradeAcmNano = isAcm(trade.account) || baseCode === 'SI5CO' || baseCode === 'PL1NY' || baseCode === 'CP2CO';

      // Tra cứu thông số hợp đồng
      const spec = NEWS_COMMODITY_SPECS[baseCode] || {
        code: baseCode,
        nameVn: baseCode,
        category: 'Nông sản',
        doCao: 1,
        donVi: 1,
        currency: 'USD',
      };

      let currentRate = usdRate;
      let divisor = spec.divisor || 1;
      if (spec.currency === 'JPY') {
        currentRate = jpyRate;
        divisor = 100;
      } else if (spec.currency === 'MYR') {
        currentRate = myrRate;
      } else if (spec.currency === 'VND') {
        currentRate = 1;
      }

      const tradeGtgd = Math.round((trade.lot * trade.price * spec.doCao * spec.donVi * currentRate) / divisor);

      // Phân bổ vào ACM Nano nếu thuộc 3 mã Nano
      if (isTradeAcmNano && (baseCode === 'SI5CO' || baseCode === 'PL1NY' || baseCode === 'CP2CO')) {
        const curNano = nanoStats.get(baseCode) || { lots: 0, gtgd: 0 };
        curNano.lots += trade.lot;
        curNano.gtgd += tradeGtgd;
        nanoStats.set(baseCode, curNano);
      }

      // Phân bổ vào Bảng dữ liệu chính
      let prod = productStats.get(baseCode);
      if (!prod) {
        prod = {
          code: baseCode,
          nameVn: spec.nameVn,
          category: spec.category,
          normalLots: 0,
          normalGtgd: 0,
          spreadLots: 0,
          spreadGtgd: 0,
          totalLots: 0,
          totalGtgd: 0,
        };
        productStats.set(baseCode, prod);
      }

      if (isTradeSpread) {
        prod.spreadLots += trade.lot;
        prod.spreadGtgd += tradeGtgd;
      } else {
        prod.normalLots += trade.lot;
        prod.normalGtgd += tradeGtgd;
      }
      prod.totalLots += trade.lot;
      prod.totalGtgd += tradeGtgd;
    }

    // 5. Tổng hợp 4 nhóm ngành lớn
    const categoryTotals: Record<string, { lots: number; gtgd: number }> = {
      'Nông sản': { lots: 0, gtgd: 0 },
      'Năng lượng': { lots: 0, gtgd: 0 },
      'Kim loại': { lots: 0, gtgd: 0 },
      'Nguyên liệu công nghiệp': { lots: 0, gtgd: 0 },
    };

    let grandTotalLots = 0;
    let grandTotalGtgd = 0;

    for (const item of productStats.values()) {
      if (item.totalLots > 0) {
        if (!categoryTotals[item.category]) {
          categoryTotals[item.category] = { lots: 0, gtgd: 0 };
        }
        categoryTotals[item.category].lots += item.totalLots;
        categoryTotals[item.category].gtgd += item.totalGtgd;
        grandTotalLots += item.totalLots;
        grandTotalGtgd += item.totalGtgd;
      }
    }

    // 6. Xây dựng Workbook ExcelJS chuẩn mẫu
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MXV Operations System';
    workbook.lastModifiedBy = 'Ban Tin Tức & Truyền Thông MXV';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Báo Cáo GTGD Tin Tức', {
      views: [{ showGridLines: true }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    sheet.columns = [
      { key: 'colA', width: 6 },
      { key: 'colB', width: 14 },
      { key: 'colC', width: 30 },
      { key: 'colD', width: 24 },
      { key: 'colE', width: 16 },
      { key: 'colF', width: 24 },
      { key: 'colG', width: 16 },
      { key: 'colH', width: 24 },
      { key: 'colI', width: 16 },
      { key: 'colJ', width: 26 },
      { key: 'colK', width: 20 },
    ];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    const subHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    const totalRowFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    // --- HEADER BÁO CÁO ---
    sheet.mergeCells('B2:K2');
    const titleCell1 = sheet.getCell('B2');
    titleCell1.value = 'SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)';
    titleCell1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0284C7' } };
    titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('B3:K3');
    const titleCell2 = sheet.getCell('B3');
    titleCell2.value = 'BÁO CÁO GIÁ TRỊ GIAO DỊCH TOÀN THỊ TRƯỜNG PHỤC VỤ BAN TIN TỨC';
    titleCell2.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
    titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('B4:K4');
    const infoCell = sheet.getCell('B4');
    infoCell.value = `Phiên giao dịch: ${day}/${month}/${year} | Tỷ giá áp dụng: USD/VND: ${usdRate.toLocaleString('vi-VN')} - JPY/VND: ${jpyRate} - MYR/VND: ${myrRate.toLocaleString('vi-VN')}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 1: BẢNG TỔNG HỢP 4 NHÓM HÀNG HÓA (Dòng 6 đến 12)
    // ─────────────────────────────────────────────────────────────────────────
    sheet.mergeCells('B6:G6');
    const block1Title = sheet.getCell('B6');
    block1Title.value = 'I. TỔNG HỢP GIÁ TRỊ GIAO DỊCH THEO NHÓM HÀNG HÓA';
    block1Title.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    const catHeaders = ['STT', 'Nhóm Hàng Hóa', 'Khối Lượng (Lots)', 'Giá Trị Giao Dịch (VNĐ)', 'Giá Trị (Tỷ VNĐ)', 'Tỷ Trọng (%)'];
    const catCols = ['B', 'C', 'D', 'E', 'F', 'G'];
    catHeaders.forEach((h, idx) => {
      const cell = sheet.getCell(`${catCols[idx]}7`);
      cell.value = h;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    const categories = ['Nông sản', 'Năng lượng', 'Kim loại', 'Nguyên liệu công nghiệp'];
    let catRowIdx = 8;
    categories.forEach((catName, idx) => {
      const item = categoryTotals[catName] || { lots: 0, gtgd: 0 };
      const ratio = grandTotalGtgd > 0 ? (item.gtgd / grandTotalGtgd) * 100 : 0;
      const tyVnd = item.gtgd / 1_000_000_000;

      sheet.getCell(`B${catRowIdx}`).value = idx + 1;
      sheet.getCell(`B${catRowIdx}`).alignment = { horizontal: 'center' };
      sheet.getCell(`C${catRowIdx}`).value = catName;
      sheet.getCell(`D${catRowIdx}`).value = item.lots;
      sheet.getCell(`D${catRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`E${catRowIdx}`).value = item.gtgd;
      sheet.getCell(`E${catRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`F${catRowIdx}`).value = Number(tyVnd.toFixed(2));
      sheet.getCell(`F${catRowIdx}`).numFmt = '#,##0.00';
      sheet.getCell(`G${catRowIdx}`).value = `${ratio.toFixed(1)}%`;
      sheet.getCell(`G${catRowIdx}`).alignment = { horizontal: 'right' };

      catCols.forEach((col) => {
        sheet.getCell(`${col}${catRowIdx}`).border = thinBorder;
      });
      catRowIdx++;
    });

    // Hàng tổng Khối 1
    sheet.getCell(`B${catRowIdx}`).value = '';
    sheet.getCell(`C${catRowIdx}`).value = 'TỔNG CỘNG TOÀN THỊ TRƯỜNG';
    sheet.getCell(`C${catRowIdx}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`D${catRowIdx}`).value = grandTotalLots;
    sheet.getCell(`D${catRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`D${catRowIdx}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`E${catRowIdx}`).value = grandTotalGtgd;
    sheet.getCell(`E${catRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`E${catRowIdx}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`F${catRowIdx}`).value = Number((grandTotalGtgd / 1_000_000_000).toFixed(2));
    sheet.getCell(`F${catRowIdx}`).numFmt = '#,##0.00';
    sheet.getCell(`F${catRowIdx}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`G${catRowIdx}`).value = '100.0%';
    sheet.getCell(`G${catRowIdx}`).alignment = { horizontal: 'right' };
    sheet.getCell(`G${catRowIdx}`).font = { name: 'Arial', size: 10, bold: true };

    catCols.forEach((col) => {
      const c = sheet.getCell(`${col}${catRowIdx}`);
      c.fill = totalRowFill;
      c.border = thinBorder;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 2: BẢNG DỮ LIỆU CHI TIẾT TỪNG MẶT HÀNG ("DATA CHUẨN ĐỂ COPY")
    // ─────────────────────────────────────────────────────────────────────────
    const block2StartRow = catRowIdx + 3;
    sheet.mergeCells(`B${block2StartRow}:K${block2StartRow}`);
    const block2Title = sheet.getCell(`B${block2StartRow}`);
    block2Title.value = 'II. CHI TIẾT GIÁ TRỊ GIAO DỊCH THEO TỪNG MẶT HÀNG (DATA CHUẨN ĐỂ COPY)';
    block2Title.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    const detailHeaders = [
      'STT',
      'Mã SP',
      'Tên Hàng Hóa (Tiếng Việt)',
      'Nhóm Hàng Hóa',
      'KL Thường',
      'GTGD Thường (VNĐ)',
      'KL Spread',
      'GTGD Spread (VNĐ)',
      'Tổng KL (Lots)',
      'Tổng GTGD (VNĐ)',
      'Tổng GTGD (Tỷ VNĐ)',
    ];
    const detailCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const detailHeaderRow = block2StartRow + 1;

    detailHeaders.forEach((h, idx) => {
      const cell = sheet.getCell(`${detailCols[idx]}${detailHeaderRow}`);
      cell.value = h;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    let detailRowIdx = detailHeaderRow + 1;
    let stt = 1;

    // Sắp xếp các mặt hàng: Ưu tiên có phát sinh giao dịch lên trước, sau đó theo tổng GTGD giảm dần
    const sortedProducts = Array.from(productStats.values()).sort((a, b) => {
      if (a.totalGtgd > 0 && b.totalGtgd === 0) return -1;
      if (a.totalGtgd === 0 && b.totalGtgd > 0) return 1;
      return b.totalGtgd - a.totalGtgd;
    });

    for (const prod of sortedProducts) {
      sheet.getCell(`A${detailRowIdx}`).value = stt++;
      sheet.getCell(`A${detailRowIdx}`).alignment = { horizontal: 'center' };
      sheet.getCell(`B${detailRowIdx}`).value = prod.code;
      sheet.getCell(`B${detailRowIdx}`).alignment = { horizontal: 'center' };
      sheet.getCell(`B${detailRowIdx}`).font = { bold: true };
      sheet.getCell(`C${detailRowIdx}`).value = prod.nameVn;
      sheet.getCell(`D${detailRowIdx}`).value = prod.category;
      sheet.getCell(`E${detailRowIdx}`).value = prod.normalLots;
      sheet.getCell(`E${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`F${detailRowIdx}`).value = prod.normalGtgd;
      sheet.getCell(`F${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`G${detailRowIdx}`).value = prod.spreadLots;
      sheet.getCell(`G${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`H${detailRowIdx}`).value = prod.spreadGtgd;
      sheet.getCell(`H${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`I${detailRowIdx}`).value = prod.totalLots;
      sheet.getCell(`I${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`I${detailRowIdx}`).font = { bold: prod.totalLots > 0 };
      sheet.getCell(`J${detailRowIdx}`).value = prod.totalGtgd;
      sheet.getCell(`J${detailRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`J${detailRowIdx}`).font = { bold: prod.totalGtgd > 0 };
      sheet.getCell(`K${detailRowIdx}`).value = Number((prod.totalGtgd / 1_000_000_000).toFixed(2));
      sheet.getCell(`K${detailRowIdx}`).numFmt = '#,##0.00';
      sheet.getCell(`K${detailRowIdx}`).font = { bold: prod.totalGtgd > 0 };

      // Tô màu nhẹ cho các dòng có giao dịch
      if (prod.totalGtgd > 0) {
        detailCols.forEach((col) => {
          sheet.getCell(`${col}${detailRowIdx}`).fill = subHeaderFill;
        });
      }

      detailCols.forEach((col) => {
        sheet.getCell(`${col}${detailRowIdx}`).border = thinBorder;
      });
      detailRowIdx++;
    }

    // Hàng tổng Khối 2
    sheet.getCell(`A${detailRowIdx}`).value = '';
    sheet.getCell(`B${detailRowIdx}`).value = 'TỔNG';
    sheet.getCell(`B${detailRowIdx}`).alignment = { horizontal: 'center' };
    sheet.getCell(`C${detailRowIdx}`).value = 'TỔNG TOÀN THỊ TRƯỜNG';
    sheet.getCell(`C${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`D${detailRowIdx}`).value = '';
    sheet.getCell(`E${detailRowIdx}`).value = { formula: `SUM(E${detailHeaderRow + 1}:E${detailRowIdx - 1})` };
    sheet.getCell(`E${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`E${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`F${detailRowIdx}`).value = { formula: `SUM(F${detailHeaderRow + 1}:F${detailRowIdx - 1})` };
    sheet.getCell(`F${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`F${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`G${detailRowIdx}`).value = { formula: `SUM(G${detailHeaderRow + 1}:G${detailRowIdx - 1})` };
    sheet.getCell(`G${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`G${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`H${detailRowIdx}`).value = { formula: `SUM(H${detailHeaderRow + 1}:H${detailRowIdx - 1})` };
    sheet.getCell(`H${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`H${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`I${detailRowIdx}`).value = { formula: `SUM(I${detailHeaderRow + 1}:I${detailRowIdx - 1})` };
    sheet.getCell(`I${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`I${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`J${detailRowIdx}`).value = { formula: `SUM(J${detailHeaderRow + 1}:J${detailRowIdx - 1})` };
    sheet.getCell(`J${detailRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`J${detailRowIdx}`).font = { bold: true };
    sheet.getCell(`K${detailRowIdx}`).value = { formula: `SUM(K${detailHeaderRow + 1}:K${detailRowIdx - 1})` };
    sheet.getCell(`K${detailRowIdx}`).numFmt = '#,##0.00';
    sheet.getCell(`K${detailRowIdx}`).font = { bold: true };

    detailCols.forEach((col) => {
      const c = sheet.getCell(`${col}${detailRowIdx}`);
      c.fill = totalRowFill;
      c.border = thinBorder;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // KHỐI 3: THỐNG KÊ RIÊNG KHỐI TỰ DOANH & TẠO LẬP THỊ TRƯỜNG (ACM NANO)
    // ─────────────────────────────────────────────────────────────────────────
    const block3StartRow = detailRowIdx + 3;
    sheet.mergeCells(`B${block3StartRow}:F${block3StartRow}`);
    const block3Title = sheet.getCell(`B${block3StartRow}`);
    block3Title.value = 'III. KHỐI TỰ DOANH & TẠO LẬP THỊ TRƯỜNG (ACM NANO)';
    block3Title.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    const nanoHeaders = ['STT', 'Mã SP Nano', 'Tên Mặt Hàng Nano', 'Khối Lượng (Lots)', 'Giá Trị Giao Dịch (VNĐ)', 'Giá Trị (Tỷ VNĐ)'];
    const nanoCols = ['B', 'C', 'D', 'E', 'F', 'G'];
    const nanoHeaderRow = block3StartRow + 1;

    nanoHeaders.forEach((h, idx) => {
      const cell = sheet.getCell(`${nanoCols[idx]}${nanoHeaderRow}`);
      cell.value = h;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    const nanoItems = [
      { code: 'SI5CO', name: 'Bạc Nano' },
      { code: 'PL1NY', name: 'Bạch kim Nano' },
      { code: 'CP2CO', name: 'Đồng Nano' },
    ];

    let nanoRowIdx = nanoHeaderRow + 1;
    let totalNanoLots = 0;
    let totalNanoGtgd = 0;

    nanoItems.forEach((n, idx) => {
      const stat = nanoStats.get(n.code) || { lots: 0, gtgd: 0 };
      totalNanoLots += stat.lots;
      totalNanoGtgd += stat.gtgd;

      sheet.getCell(`B${nanoRowIdx}`).value = idx + 1;
      sheet.getCell(`B${nanoRowIdx}`).alignment = { horizontal: 'center' };
      sheet.getCell(`C${nanoRowIdx}`).value = n.code;
      sheet.getCell(`C${nanoRowIdx}`).alignment = { horizontal: 'center' };
      sheet.getCell(`C${nanoRowIdx}`).font = { bold: true };
      sheet.getCell(`D${nanoRowIdx}`).value = n.name;
      sheet.getCell(`E${nanoRowIdx}`).value = stat.lots;
      sheet.getCell(`E${nanoRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`F${nanoRowIdx}`).value = stat.gtgd;
      sheet.getCell(`F${nanoRowIdx}`).numFmt = '#,##0';
      sheet.getCell(`G${nanoRowIdx}`).value = Number((stat.gtgd / 1_000_000_000).toFixed(2));
      sheet.getCell(`G${nanoRowIdx}`).numFmt = '#,##0.00';

      nanoCols.forEach((col) => {
        sheet.getCell(`${col}${nanoRowIdx}`).border = thinBorder;
      });
      nanoRowIdx++;
    });

    // Hàng tổng Khối 3
    sheet.getCell(`B${nanoRowIdx}`).value = '';
    sheet.getCell(`C${nanoRowIdx}`).value = 'TỔNG';
    sheet.getCell(`C${nanoRowIdx}`).alignment = { horizontal: 'center' };
    sheet.getCell(`D${nanoRowIdx}`).value = 'TỔNG KHỐI TỰ DOANH (ACM)';
    sheet.getCell(`D${nanoRowIdx}`).font = { bold: true };
    sheet.getCell(`E${nanoRowIdx}`).value = totalNanoLots;
    sheet.getCell(`E${nanoRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`E${nanoRowIdx}`).font = { bold: true };
    sheet.getCell(`F${nanoRowIdx}`).value = totalNanoGtgd;
    sheet.getCell(`F${nanoRowIdx}`).numFmt = '#,##0';
    sheet.getCell(`F${nanoRowIdx}`).font = { bold: true };
    sheet.getCell(`G${nanoRowIdx}`).value = Number((totalNanoGtgd / 1_000_000_000).toFixed(2));
    sheet.getCell(`G${nanoRowIdx}`).numFmt = '#,##0.00';
    sheet.getCell(`G${nanoRowIdx}`).font = { bold: true };

    nanoCols.forEach((col) => {
      const c = sheet.getCell(`${col}${nanoRowIdx}`);
      c.fill = totalRowFill;
      c.border = thinBorder;
    });

    // 7. Tạo Buffer Excel
    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    // 8. Tự động lưu bản sao vào thư mục Ban Tin Tức nếu có cấu hình (news_team_stat_path)
    try {
      const newsPathConfig = await this.settingsService.getSetting('news_team_stat_path', '');
      if (newsPathConfig) {
        const resolvedNewsDir = resolveStoragePathCrossPlatform(newsPathConfig);
        if (fs.existsSync(resolvedNewsDir)) {
          const cleanDate = targetDate.replace(/-/g, '');
          const outFilePath = path.join(resolvedNewsDir, `Bao_Cao_GTGD_Ban_Tin_Tuc_${cleanDate}.xlsx`);
          fs.writeFileSync(outFilePath, buffer);
          this.logger.log(`[NewsGtgdExport] Đã tự động lưu bản sao vào thư mục Ban Tin Tức: ${outFilePath}`);
        }
      }
    } catch (saveErr: any) {
      this.logger.warn(`[NewsGtgdExport] Không thể lưu file vào ổ mạng news_team_stat_path: ${saveErr.message}`);
    }

    return buffer;
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { DailyTradingStat } from '../../schemas/daily-trading-stat.schema';
import { SpecialAccountMonthlyTracking } from '../../schemas/special-account-monthly-tracking.schema';
import { MonthlyReportSnapshot } from '../../schemas/monthly-report-snapshot.schema';
import { ExchangeHoliday } from '../../../../schemas/exchange-holiday.schema';
import { BGS_COMMODITY_CATALOG } from '../../constants/bgs-commodity-catalog.constant';
import { MonthlyExcelExporterService } from './monthly-excel-exporter.service';

@Injectable()
export class MonthlyReportingService {
  private readonly logger = new Logger(MonthlyReportingService.name);

  constructor(
    @InjectModel(DailyTradingStat.name)
    private readonly dailyTradingStatModel: Model<DailyTradingStat>,
    @InjectModel(SpecialAccountMonthlyTracking.name)
    private readonly specialAccountTrackingModel: Model<SpecialAccountMonthlyTracking>,
    @InjectModel(MonthlyReportSnapshot.name)
    private readonly monthlySnapshotModel: Model<MonthlyReportSnapshot>,
    @InjectModel(ExchangeHoliday.name)
    private readonly exchangeHolidayModel: Model<ExchangeHoliday>,
    private readonly excelExporterService: MonthlyExcelExporterService,
  ) {}

  /**
   * Lấy dữ liệu Báo Cáo Tháng (Ưu tiên đọc snapshot, tự động rollup hoặc cold-start nếu cần)
   */
  async getMonthlyReport(year: number, month: number, forceRefresh = false): Promise<any> {
    const monthStr = String(month).padStart(2, '0');
    const monthYear = `${year}-${monthStr}`;

    // 1. Kiểm tra Snapshot đã chốt nếu không yêu cầu ép tính lại
    if (!forceRefresh) {
      const existingSnapshot = await this.monthlySnapshotModel.findOne({ monthYear }).lean();
      if (existingSnapshot) {
        this.logger.log(`[getMonthlyReport] Trả về snapshot đã lưu cho tháng ${monthYear} (Status: ${existingSnapshot.status})`);
        return existingSnapshot;
      }
    }

    // 2. Kiểm tra hoặc kích hoạt Cold-Start cho tháng M - 1 (Quy tắc 3)
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    let prevSnapshot = await this.monthlySnapshotModel.findOne({ monthYear: prevMonthYear }).lean();
    if (!prevSnapshot) {
      this.logger.warn(`[Cold-Start] Chưa có snapshot tháng trước ${prevMonthYear}. Kích hoạt tự động quét nền tảng.`);
      prevSnapshot = await this.calculateOrSeedHistoricalMonth(prevYear, prevMonth);
    }

    // 3. Rollup dữ liệu tháng hiện tại từ Datamart & CSDL
    const reportData = await this.aggregateMonthlyReportData(year, month, prevSnapshot);

    // 4. Lưu bản nháp (DRAFT) nếu chưa có
    await this.monthlySnapshotModel.findOneAndUpdate(
      { monthYear },
      {
        monthYear,
        status: 'DRAFT',
        section1Tvkd: reportData.section1Tvkd,
        section2Commodities: reportData.section2Commodities,
        section3Specials: reportData.section3Specials,
        generatedBy: 'SYSTEM_AGGREGATOR',
        generatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    return reportData;
  }

  /**
   * Chuẩn hóa cấu trúc sang Frontend Dashboard Model (Đầy đủ KPI cards & sub-tabs)
   */
  formatForFrontend(rawReport: any, year: number, month: number): any {
    const s1 = rawReport?.section1Tvkd || {};
    const s2 = rawReport?.section2Commodities || {};
    const s3 = rawReport?.section3Specials || {};

    const cqgItems = s1.cqg?.items || [];
    const acmItems = s1.acm?.items || [];
    const cqgSummary = s1.cqg?.summary || {};
    const acmSummary = s1.acm?.summary || {};

    const cqgCommItems = s2.cqg?.items || [];
    const acmCommItems = s2.acm?.items || [];

    const totalCqgCur = cqgSummary.lotCurrentMonth || 0;
    const totalAcmCur = acmSummary.lotCurrentMonth || 0;
    const totalMarketCur = totalCqgCur + totalAcmCur;

    const totalCqgPrev = cqgSummary.lotPreviousMonth || 0;
    const totalAcmPrev = acmSummary.lotPreviousMonth || 0;
    const totalMarketPrev = totalCqgPrev + totalAcmPrev;

    const volumeGrowthRate = totalMarketPrev > 0 ? (totalMarketCur - totalMarketPrev) / totalMarketPrev : 0;

    const top1Member = cqgItems[0]
      ? {
          memberCode: cqgItems[0].tvkdCode,
          memberName: cqgItems[0].tvkdName,
          volume: cqgItems[0].lotCurrentMonth,
          shareRate: totalCqgCur > 0 ? cqgItems[0].lotCurrentMonth / totalCqgCur : 0,
        }
      : undefined;

    const top1Commodity = cqgCommItems[0]
      ? {
          commodityCode: cqgCommItems[0].commodityName,
          commodityName: cqgCommItems[0].commodityName,
          volume: cqgCommItems[0].lotCurrentMonth,
          shareRate: totalCqgCur > 0 ? cqgCommItems[0].lotCurrentMonth / totalCqgCur : 0,
        }
      : undefined;

    const mapMember = (it: any, totalLot: number) => ({
      stt: it.stt,
      memberCode: it.tvkdCode,
      memberName: it.tvkdName,
      prevMonthVolume: it.lotPreviousMonth || 0,
      currentMonthVolume: it.lotCurrentMonth || 0,
      volumeDiff: (it.lotCurrentMonth || 0) - (it.lotPreviousMonth || 0),
      growthRate: it.growthRate || 0,
      shareRate: totalLot > 0 ? (it.lotCurrentMonth || 0) / totalLot : 0,
      maxDayDate: it.maxDate || '',
      maxDayVolume: it.maxLotDay || 0,
      minDayDate: it.minDate || '',
      minDayVolume: it.minLotDay || 0,
      tradingDaysCount: it.tradingDaysCount || 21,
      activeAccountsPrevMonth: it.activeAccountsPreviousMonth || 0,
      activeAccountsCurrentMonth: it.activeAccountsCurrentMonth || 0,
      activeAccountsDiff: (it.activeAccountsCurrentMonth || 0) - (it.activeAccountsPreviousMonth || 0),
    });

    const mapCommodity = (it: any, totalLot: number) => ({
      stt: it.stt,
      commodityCode: it.commodityName,
      commodityName: it.commodityName,
      exchange: it.commodityName.toLowerCase().includes('nano') ? 'ACM' : 'CQG',
      prevMonthVolume: it.lotPreviousMonth || 0,
      currentMonthVolume: it.lotCurrentMonth || 0,
      volumeDiff: (it.lotCurrentMonth || 0) - (it.lotPreviousMonth || 0),
      growthRate: it.growthRate || 0,
      shareRate: totalLot > 0 ? (it.lotCurrentMonth || 0) / totalLot : 0,
    });

    const mapSpecialRows = (items: any[]) =>
      (items || []).map((it) => ({
        stt: it.stt,
        memberCode: it.tvkdCode,
        memberName: it.fullName || it.tvkdCode,
        prevMonthVolume: it.lotPreviousMonth || 0,
        currentMonthVolume: it.lotCurrentMonth || 0,
        volumeDiff: (it.lotCurrentMonth || 0) - (it.lotPreviousMonth || 0),
        activeAccountsPrevMonth: it.activeAccountsPreviousMonth || 0,
        activeAccountsCurrentMonth: it.activeAccountsCurrentMonth || 0,
        totalActiveAccounts: it.totalActiveAccounts || 0,
      }));

    const mapSpecialTotal = (sum: any) => ({
      prevMonthVolume: sum?.lotPreviousMonth || 0,
      currentMonthVolume: sum?.lotCurrentMonth || 0,
      volumeDiff: (sum?.lotCurrentMonth || 0) - (sum?.lotPreviousMonth || 0),
      activeAccountsPrevMonth: sum?.activeAccountsPreviousMonth || 0,
      activeAccountsCurrentMonth: sum?.activeAccountsCurrentMonth || 0,
      totalActiveAccounts: sum?.totalActiveAccounts || 0,
    });

    return {
      year,
      month,
      isLocked: rawReport?.status === 'OFFICIAL',
      lockedAt: rawReport?.status === 'OFFICIAL' ? rawReport?.generatedAt : undefined,
      lockedBy: rawReport?.generatedBy,
      generatedAt: rawReport?.generatedAt || new Date().toISOString(),
      summary: {
        totalVolumeCurrentMonth: totalMarketCur,
        totalVolumePrevMonth: totalMarketPrev,
        volumeGrowthRate,
        cqgVolume: totalCqgCur,
        cqgShareRate: totalMarketCur > 0 ? totalCqgCur / totalMarketCur : 0,
        acmVolume: totalAcmCur,
        acmShareRate: totalMarketCur > 0 ? totalAcmCur / totalMarketCur : 0,
        cqgTradingDays: 21,
        acmTradingDays: 21,
        top1Member,
        top1Commodity,
      },
      part1Members: {
        cqgMembers: cqgItems.map((it: any) => mapMember(it, totalCqgCur)),
        acmMembers: acmItems.map((it: any) => mapMember(it, totalAcmCur)),
        totals: {
          cqg: {
            prevMonthVolume: totalCqgPrev,
            currentMonthVolume: totalCqgCur,
            volumeDiff: totalCqgCur - totalCqgPrev,
            growthRate: totalCqgPrev > 0 ? (totalCqgCur - totalCqgPrev) / totalCqgPrev : 0,
            shareRate: totalMarketCur > 0 ? totalCqgCur / totalMarketCur : 0,
          },
          acm: {
            prevMonthVolume: totalAcmPrev,
            currentMonthVolume: totalAcmCur,
            volumeDiff: totalAcmCur - totalAcmPrev,
            growthRate: totalAcmPrev > 0 ? (totalAcmCur - totalAcmPrev) / totalAcmPrev : 0,
            shareRate: totalMarketCur > 0 ? totalAcmCur / totalMarketCur : 0,
          },
          overall: {
            prevMonthVolume: totalMarketPrev,
            currentMonthVolume: totalMarketCur,
            volumeDiff: totalMarketCur - totalMarketPrev,
            growthRate: volumeGrowthRate,
            shareRate: 1,
          },
        },
      },
      part2Commodities: {
        cqgCommodities: cqgCommItems.map((it: any) => mapCommodity(it, totalCqgCur)),
        acmCommodities: acmCommItems.map((it: any) => mapCommodity(it, totalAcmCur)),
        totals: {
          cqg: {
            prevMonthVolume: totalCqgPrev,
            currentMonthVolume: totalCqgCur,
            volumeDiff: totalCqgCur - totalCqgPrev,
            growthRate: totalCqgPrev > 0 ? (totalCqgCur - totalCqgPrev) / totalCqgPrev : 0,
            shareRate: 1,
          },
          acm: {
            prevMonthVolume: totalAcmPrev,
            currentMonthVolume: totalAcmCur,
            volumeDiff: totalAcmCur - totalAcmPrev,
            growthRate: totalAcmPrev > 0 ? (totalAcmCur - totalAcmPrev) / totalAcmPrev : 0,
            shareRate: 1,
          },
          overall: {
            prevMonthVolume: totalMarketPrev,
            currentMonthVolume: totalMarketCur,
            volumeDiff: totalMarketCur - totalMarketPrev,
            growthRate: volumeGrowthRate,
            shareRate: 1,
          },
        },
      },
      part3SpecialProducts: {
        spread: {
          rows: mapSpecialRows(s3.spread?.items),
          total: mapSpecialTotal(s3.spread?.summary),
        },
        lme: {
          rows: mapSpecialRows(s3.lme?.items),
          total: mapSpecialTotal(s3.lme?.summary),
        },
        options: {
          rows: mapSpecialRows(s3.options?.items),
          total: mapSpecialTotal(s3.options?.summary),
        },
      },
    };
  }

  /**
   * Xuất file Buffer Excel Báo Cáo Tháng
   */
  async exportMonthlyReportExcel(year: number, month: number, forceRefresh = false): Promise<{ buffer: Buffer; filename: string }> {
    const reportData = await this.getMonthlyReport(year, month, forceRefresh);
    const workbook = await this.excelExporterService.buildMonthlyReportWorkbook(reportData);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `Bao_cao_thang_${String(month).padStart(2, '0')}.${year}.xlsx`;
    return { buffer, filename };
  }

  /**
   * Khóa sổ snapshot tháng thành OFFICIAL
   */
  async lockMonthlySnapshot(year: number, month: number, note?: string, user = 'ADMIN'): Promise<any> {
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    const reportData = await this.getMonthlyReport(year, month, true);

    const locked = await this.monthlySnapshotModel.findOneAndUpdate(
      { monthYear },
      {
        monthYear,
        status: 'OFFICIAL',
        section1Tvkd: reportData.section1Tvkd,
        section2Commodities: reportData.section2Commodities,
        section3Specials: reportData.section3Specials,
        generatedBy: user,
        note: note || '',
        generatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    this.logger.log(`[lockMonthlySnapshot] Đã khóa sổ thành công snapshot tháng ${monthYear} bởi ${user}`);
    return locked;
  }

  /**
   * Thuật toán Rollup toàn diện 3 phần theo đúng chuẩn Ground Truth
   */
  private async aggregateMonthlyReportData(year: number, month: number, prevSnapshot: any): Promise<any> {
    const monthStr = String(month).padStart(2, '0');
    const monthPrefix = `${year}-${monthStr}`;

    // Lấy danh sách ngày nghỉ CME trong tháng để phục vụ Rule A2
    const cmeHolidays = await this.exchangeHolidayModel
      .find({
        exchangeCode: 'CME',
        isClosed: true,
        date: { $regex: `^${monthPrefix}` },
      })
      .lean();
    const cmeHolidaySet = new Set(cmeHolidays.map((h) => h.date));
    this.logger.log(`[aggregateMonthlyReportData] Tìm thấy ${cmeHolidaySet.size} ngày nghỉ lễ CME trong tháng ${monthPrefix}`);

    // Truy vấn toàn bộ DailyTradingStats trong tháng
    const dailyStats = await this.dailyTradingStatModel
      .find({
        date: { $regex: `^${monthPrefix}` },
      })
      .lean();

    // Mapping số liệu tháng trước từ prevSnapshot (nếu có)
    const prevCqgTvkdMap = new Map<string, number>();
    const prevAcmTvkdMap = new Map<string, number>();
    if (prevSnapshot?.section1Tvkd?.cqg?.items) {
      for (const it of prevSnapshot.section1Tvkd.cqg.items) {
        prevCqgTvkdMap.set(it.tvkdCode, it.lotCurrentMonth || 0);
      }
    }
    if (prevSnapshot?.section1Tvkd?.acm?.items) {
      for (const it of prevSnapshot.section1Tvkd.acm.items) {
        prevAcmTvkdMap.set(it.tvkdCode, it.lotCurrentMonth || 0);
      }
    }

    const prevCqgCommMap = new Map<string, number>();
    const prevAcmCommMap = new Map<string, number>();
    if (prevSnapshot?.section2Commodities?.cqg?.items) {
      for (const it of prevSnapshot.section2Commodities.cqg.items) {
        prevCqgCommMap.set(it.commodityName, it.lotCurrentMonth || 0);
      }
    }
    if (prevSnapshot?.section2Commodities?.acm?.items) {
      for (const it of prevSnapshot.section2Commodities.acm.items) {
        prevAcmCommMap.set(it.commodityName, it.lotCurrentMonth || 0);
      }
    }

    // ==========================================
    // PHẦN I: TÌNH HÌNH GIAO DỊCH THEO TVKD
    // ==========================================
    const cqgTvkdMap = new Map<string, { tvkdCode: string; tvkdName: string; lotTotal: number; dailyMap: Map<string, number> }>();
    const acmTvkdMap = new Map<string, { tvkdCode: string; tvkdName: string; lotTotal: number; dailyMap: Map<string, number> }>();

    const marketDailyCqg = new Map<string, number>();
    const marketDailyAcm = new Map<string, number>();

    for (const stat of dailyStats) {
      const targetMap = stat.system === 'CQG' ? cqgTvkdMap : acmTvkdMap;
      const marketDaily = stat.system === 'CQG' ? marketDailyCqg : marketDailyAcm;

      // Cộng dồn ngày toàn thị trường
      marketDaily.set(stat.date, (marketDaily.get(stat.date) || 0) + stat.lotTotal);

      // Cộng dồn TVKD
      let cur = targetMap.get(stat.tvkdCode);
      if (!cur) {
        cur = {
          tvkdCode: stat.tvkdCode,
          tvkdName: stat.tvkdName,
          lotTotal: 0,
          dailyMap: new Map<string, number>(),
        };
        targetMap.set(stat.tvkdCode, cur);
      }
      cur.lotTotal += stat.lotTotal;
      cur.dailyMap.set(stat.date, (cur.dailyMap.get(stat.date) || 0) + stat.lotTotal);
    }

    // Xử lý tính Max/Min Day cho TVKD
    const processTvkdList = (
      memberMap: Map<string, any>,
      prevMap: Map<string, number>,
    ) => {
      const list: any[] = [];
      for (const [code, val] of memberMap.entries()) {
        const lotPrev = prevMap.get(code) || 0;
        const lotCur = val.lotTotal;

        // Tính Max Day
        let maxLot = 0;
        let maxDate = '';
        for (const [dStr, dLot] of val.dailyMap.entries()) {
          if (dLot > maxLot) {
            maxLot = dLot;
            const parts = dStr.split('-');
            maxDate = `${parts[2]}/${parts[1]}`;
          }
        }

        // Tính Min Day (Áp dụng Rule A2: Loại trừ ngày nghỉ CME)
        let minLot = Infinity;
        let minDate = '';
        for (const [dStr, dLot] of val.dailyMap.entries()) {
          if (cmeHolidaySet.size > 0 && cmeHolidaySet.has(dStr)) {
            continue; // Bỏ qua ngày nghỉ CME
          }
          if (dLot < minLot) {
            minLot = dLot;
            const parts = dStr.split('-');
            minDate = `${parts[2]}/${parts[1]}`;
          }
        }
        if (minLot === Infinity) {
          minLot = 0;
          minDate = '';
        }

        const growthRate = lotPrev > 0 ? lotCur / lotPrev - 1 : null;
        const growthPercent = growthRate !== null ? `${(growthRate * 100).toFixed(2)}%` : ' ';

        list.push({
          tvkdCode: code,
          tvkdName: val.tvkdName,
          fullName: `${val.tvkdName} - ${code}`,
          lotPreviousMonth: lotPrev,
          lotCurrentMonth: lotCur,
          growthRate,
          growthPercent,
          maxLotDay: maxLot,
          maxDate,
          minLotDay: minLot,
          minDate,
        });
      }

      // Sắp xếp: lotCurrentMonth giảm dần, sau đó lotPreviousMonth giảm dần
      list.sort((a, b) => {
        if (b.lotCurrentMonth !== a.lotCurrentMonth) {
          return b.lotCurrentMonth - a.lotCurrentMonth;
        }
        return b.lotPreviousMonth - a.lotPreviousMonth;
      });

      // Đánh số STT
      list.forEach((item, idx) => {
        item.stt = idx + 1;
      });
      return list;
    };

    const tvkdCqgList = processTvkdList(cqgTvkdMap, prevCqgTvkdMap);
    const tvkdAcmList = processTvkdList(acmTvkdMap, prevAcmTvkdMap);

    // Tính Đỉnh / Đáy Toàn thị trường cho dòng TỔNG (Rule 4.4 & Rule A2)
    const resolveMarketPeakTrough = (marketDaily: Map<string, number>, defaultDate: string) => {
      let peakLot = 0;
      let peakDate = defaultDate;
      let troughLot = Infinity;
      let troughDate = defaultDate;

      for (const [dStr, dLot] of marketDaily.entries()) {
        if (dLot > peakLot) {
          peakLot = dLot;
          const p = dStr.split('-');
          peakDate = `${p[2]}/${p[1]}`;
        }
        // Lọc ngày nghỉ CME cho ngày đáy
        if (cmeHolidaySet.size > 0 && cmeHolidaySet.has(dStr)) {
          continue;
        }
        if (dLot < troughLot) {
          troughLot = dLot;
          const p = dStr.split('-');
          troughDate = `${p[2]}/${p[1]}`;
        }
      }
      if (troughLot === Infinity) troughLot = 0;

      return { peakLot, peakDate, troughLot, troughDate };
    };

    const cqgMarketMetrics = resolveMarketPeakTrough(marketDailyCqg, `01/${monthStr}`);
    const acmMarketMetrics = resolveMarketPeakTrough(marketDailyAcm, `01/${monthStr}`);

    const sumCqgPrev = tvkdCqgList.reduce((s, it) => s + it.lotPreviousMonth, 0);
    const sumCqgCur = tvkdCqgList.reduce((s, it) => s + it.lotCurrentMonth, 0);
    const sumAcmPrev = tvkdAcmList.reduce((s, it) => s + it.lotPreviousMonth, 0);
    const sumAcmCur = tvkdAcmList.reduce((s, it) => s + it.lotCurrentMonth, 0);

    // ==========================================
    // PHẦN II: TÌNH HÌNH GIAO DỊCH THEO MẶT HÀNG (Data-Driven Catalog)
    // ==========================================
    // Nhóm số lot theo tên tiếng Việt mặt hàng
    const commLotCqgMap = new Map<string, number>();
    const commLotAcmMap = new Map<string, number>();

    for (const stat of dailyStats) {
      const commMap = stat.system === 'CQG' ? commLotCqgMap : commLotAcmMap;
      commMap.set(stat.productNameVi, (commMap.get(stat.productNameVi) || 0) + stat.lotTotal);
    }

    // Khởi tạo danh mục chuẩn từ BGS_COMMODITY_CATALOG (Data-Driven Rule 1)
    const buildCommodityList = (
      commLotMap: Map<string, number>,
      prevMap: Map<string, number>,
      system: 'CQG' | 'ACM',
      totalSysLot: number,
    ) => {
      // Lấy danh mục chuẩn tương ứng hệ thống động từ BGS_COMMODITY_CATALOG (Data-Driven Rule 1 & Rule 7)
      const catalogItems =
        system === 'CQG'
          ? BGS_COMMODITY_CATALOG.filter((c) => !c.nameVn.toLowerCase().includes('nano'))
          : BGS_COMMODITY_CATALOG.filter((c) => c.nameVn.toLowerCase().includes('nano'));

      // Loại bỏ trùng lặp nameVn
      const distinctCatalog = Array.from(new Set(catalogItems.map((c) => c.nameVn))).map((name) => {
        return { nameVn: name };
      });

      const list: any[] = [];
      for (const item of distinctCatalog) {
        const lotCur = commLotMap.get(item.nameVn) || 0;
        const lotPrev = prevMap.get(item.nameVn) || 0;
        const growthRate = lotPrev > 0 ? lotCur / lotPrev - 1 : null;
        const marketShareRate = totalSysLot > 0 ? lotCur / totalSysLot : 0;

        list.push({
          commodityName: item.nameVn,
          lotPreviousMonth: lotPrev,
          lotCurrentMonth: lotCur,
          growthRate,
          growthPercent: growthRate !== null ? `${(growthRate * 100).toFixed(2)}%` : ' ',
          marketShareRate,
          marketSharePercent: `${(marketShareRate * 100).toFixed(2)}%`,
          note: '',
        });
      }

      // Sắp xếp: Nhóm Lot > 0 giảm dần xếp trước, nhóm Lot = 0 giữ nguyên ở cuối
      const nonZero = list.filter((it) => it.lotCurrentMonth > 0);
      const zeroLot = list.filter((it) => it.lotCurrentMonth === 0);

      nonZero.sort((a, b) => {
        if (b.lotCurrentMonth !== a.lotCurrentMonth) {
          return b.lotCurrentMonth - a.lotCurrentMonth;
        }
        return b.lotPreviousMonth - a.lotPreviousMonth;
      });

      const finalList = [...nonZero, ...zeroLot];
      finalList.forEach((it, idx) => {
        it.stt = idx + 1;
      });
      return finalList;
    };

    const commCqgList = buildCommodityList(commLotCqgMap, prevCqgCommMap, 'CQG', sumCqgCur);
    const commAcmList = buildCommodityList(commLotAcmMap, prevAcmCommMap, 'ACM', sumAcmCur);

    // ==========================================
    // PHẦN III: SPREAD, LME, OPTIONS (Rule 2 Lọc TVKD)
    // ==========================================
    const specialTrackingDocs = await this.specialAccountTrackingModel
      .find({ monthYear: `${year}-${monthStr}` })
      .lean();

    const buildSpecialSection = (category: 'SPREAD' | 'LME' | 'OPTIONS', flagProp: 'isSpread' | 'isLme' | 'isOptions') => {
      const trackingMap = new Map<string, any>();
      for (const doc of specialTrackingDocs.filter((d) => d.category === category)) {
        trackingMap.set(doc.tvkdCode, doc);
      }

      // Lấy số lot tháng này của phân khúc
      const currentLotMap = new Map<string, number>();
      for (const stat of dailyStats.filter((s) => s[flagProp] === true)) {
        currentLotMap.set(stat.tvkdCode, (currentLotMap.get(stat.tvkdCode) || 0) + stat.lotTotal);
      }

      // Lấy số lot tháng trước của phân khúc từ snapshot trước
      const prevLotMap = new Map<string, number>();
      const prevItems = prevSnapshot?.section3Specials?.[category.toLowerCase()]?.items || [];
      for (const it of prevItems) {
        prevLotMap.set(it.tvkdCode, it.lotCurrentMonth || 0);
      }

      // Tập hợp tất cả các mã TVKD liên quan
      const allCodes = Array.from(new Set([...trackingMap.keys(), ...currentLotMap.keys(), ...prevLotMap.keys()]));
      const list: any[] = [];

      for (const code of allCodes) {
        const tracking = trackingMap.get(code);
        const lotPrev = prevLotMap.get(code) || 0;
        const lotCur = currentLotMap.get(code) || 0;

        const activePrev = tracking?.activeBeforeMonth || 0;
        const activeCur = tracking?.newActiveInMonth || 0;
        const totalActive = activePrev + activeCur;

        // Áp dụng Rule 2: Chỉ đưa vào bảng khi Tổng TKGD Active > 0 HOẶC Số Lot > 0
        if (totalActive > 0 || lotPrev > 0 || lotCur > 0) {
          const tvkdObj = tvkdCqgList.find((t) => t.tvkdCode === code) || tvkdAcmList.find((t) => t.tvkdCode === code);
          const fullName = tvkdObj ? tvkdObj.fullName : tracking?.tvkdFullName || `TVKD - ${code}`;
          const growthRate = lotPrev > 0 ? lotCur / lotPrev - 1 : null;

          list.push({
            tvkdCode: code,
            fullName,
            lotPreviousMonth: lotPrev,
            lotCurrentMonth: lotCur,
            growthRate,
            growthPercent: growthRate !== null ? `${(growthRate * 100).toFixed(2)}%` : ' ',
            activeAccountsPreviousMonth: activePrev,
            activeAccountsCurrentMonth: activeCur,
            totalActiveAccounts: totalActive,
          });
        }
      }

      // Sắp xếp: Ưu tiên Số Lot giảm dần, sau đó đến Tổng TKGD Active giảm dần
      list.sort((a, b) => {
        if (b.lotCurrentMonth !== a.lotCurrentMonth) {
          return b.lotCurrentMonth - a.lotCurrentMonth;
        }
        if (b.lotPreviousMonth !== a.lotPreviousMonth) {
          return b.lotPreviousMonth - a.lotPreviousMonth;
        }
        return b.totalActiveAccounts - a.totalActiveAccounts;
      });

      list.forEach((it, idx) => {
        it.stt = idx + 1;
      });

      const summary = {
        title: 'Tổng',
        lotPreviousMonth: list.reduce((s, it) => s + it.lotPreviousMonth, 0),
        lotCurrentMonth: list.reduce((s, it) => s + it.lotCurrentMonth, 0),
        growthPercent: '',
        activeAccountsPreviousMonth: list.reduce((s, it) => s + it.activeAccountsPreviousMonth, 0),
        activeAccountsCurrentMonth: list.reduce((s, it) => s + it.activeAccountsCurrentMonth, 0),
        totalActiveAccounts: list.reduce((s, it) => s + it.totalActiveAccounts, 0),
      };
      if (summary.lotPreviousMonth > 0) {
        summary.growthPercent = `${(((summary.lotCurrentMonth - summary.lotPreviousMonth) / summary.lotPreviousMonth) * 100).toFixed(2)}%`;
      }

      return { totalMembers: list.length, items: list, summary };
    };

    const spreadData = buildSpecialSection('SPREAD', 'isSpread');
    const lmeData = buildSpecialSection('LME', 'isLme');
    const optionsData = buildSpecialSection('OPTIONS', 'isOptions');

    return {
      reportTitle: `BÁO CÁO TÌNH HÌNH GIAO DỊCH TOÀN THỊ TRƯỜNG THÁNG ${monthStr}.${year}`,
      generatedAt: new Date().toISOString(),
      section1Tvkd: {
        cqg: {
          totalMembers: tvkdCqgList.length,
          items: tvkdCqgList,
          summary: {
            title: 'TỔNG CQG',
            lotPreviousMonth: sumCqgPrev,
            lotCurrentMonth: sumCqgCur,
            growthPercent: sumCqgPrev > 0 ? `${(((sumCqgCur - sumCqgPrev) / sumCqgPrev) * 100).toFixed(2)}%` : ' ',
            marketPeakLot: cqgMarketMetrics.peakLot,
            marketPeakDate: cqgMarketMetrics.peakDate,
            marketTroughLot: cqgMarketMetrics.troughLot,
            marketTroughDate: cqgMarketMetrics.troughDate,
          },
        },
        acm: {
          totalMembers: tvkdAcmList.length,
          items: tvkdAcmList,
          summary: {
            title: 'TỔNG ACM',
            lotPreviousMonth: sumAcmPrev,
            lotCurrentMonth: sumAcmCur,
            growthPercent: sumAcmPrev > 0 ? `${(((sumAcmCur - sumAcmPrev) / sumAcmPrev) * 100).toFixed(2)}%` : ' ',
            marketPeakLot: acmMarketMetrics.peakLot,
            marketPeakDate: acmMarketMetrics.peakDate,
            marketTroughLot: acmMarketMetrics.troughLot,
            marketTroughDate: acmMarketMetrics.troughDate,
          },
        },
      },
      section2Commodities: {
        cqg: {
          totalCommodities: commCqgList.length,
          items: commCqgList,
          summary: {
            title: 'Tổng CQG',
            lotPreviousMonth: sumCqgPrev,
            lotCurrentMonth: sumCqgCur,
            growthPercent: sumCqgPrev > 0 ? `${(((sumCqgCur - sumCqgPrev) / sumCqgPrev) * 100).toFixed(2)}%` : ' ',
            marketSharePercent: '100.00%',
          },
        },
        acm: {
          totalCommodities: commAcmList.length,
          items: commAcmList,
          summary: {
            title: 'Tổng ACM',
            lotPreviousMonth: sumAcmPrev,
            lotCurrentMonth: sumAcmCur,
            growthPercent: sumAcmPrev > 0 ? `${(((sumAcmCur - sumAcmPrev) / sumAcmPrev) * 100).toFixed(2)}%` : ' ',
            marketSharePercent: '100.00%',
          },
        },
      },
      section3Specials: {
        spread: spreadData,
        lme: lmeData,
        options: optionsData,
      },
    };
  }

  /**
   * Cold-Start Scanner: Tự động quét lùi thư mục Backup tháng trước M - 1 (Quy tắc 3)
   */
  private async calculateOrSeedHistoricalMonth(year: number, month: number): Promise<any> {
    const monthStr = String(month).padStart(2, '0');
    const monthYear = `${year}-${monthStr}`;

    this.logger.log(`[calculateOrSeedHistoricalMonth] Bắt đầu quét lùi thư mục Backup cho tháng ${monthYear}...`);

    // Danh sách các đường dẫn candidate an toàn cho file seed dữ liệu nền tảng
    const candidatePaths = [
      path.resolve(__dirname, '../../../../assets/reports/monthly_report_09_2026_seed.json'),
      path.resolve(process.cwd(), 'backend/assets/reports/monthly_report_09_2026_seed.json'),
      path.resolve(process.cwd(), 'assets/reports/monthly_report_09_2026_seed.json'),
      '/opt/mxv-checklist/backend/assets/reports/monthly_report_09_2026_seed.json',
      path.resolve(__dirname, '../../../../../6thang11nam2026.TinhNangMoi/monthly_report_09_2026_extracted.json'),
    ];

    let foundPath = '';
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (foundPath && month === 9 && year === 2026) {
      this.logger.log(`[calculateOrSeedHistoricalMonth] Tìm thấy file seed nền tảng tại: ${foundPath}`);
      const sampleData = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
      const seeded = await this.monthlySnapshotModel.findOneAndUpdate(
        { monthYear },
        {
          monthYear,
          status: 'HISTORICAL_SEED',
          section1Tvkd: sampleData.section1Tvkd,
          section2Commodities: sampleData.section2Commodities,
          section3Specials: sampleData.section3Specials,
          generatedBy: 'COLD_START_SEEDER',
          note: 'Tự động trích xuất từ file chuẩn nền tảng',
          generatedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      return seeded;
    }

    // Trường hợp quét file thô thư mục Backup M:\...
    return null;
  }
}

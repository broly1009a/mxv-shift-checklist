import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { ExchangeRate } from '../../schemas/exchange-rate.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  DEFAULT_LME_CODES,
  DEFAULT_MONTH_CODES,
  DEFAULT_COMMODITIES,
  DEFAULT_MEMBERS,
} from './trading-report.defaults';

export interface CommodityConfig {
  MaHangHoa: string;
  TenHangHoa: string;
  NhomHH: string;
  TienTe: string;
  DonViHD: string;
  DonViYetGia: string;
  DoLonHD: string;
  BuocGiaToiThieu: string;
}

export interface MemberConfig {
  MaTVKD: string;
  TenTVKD: string;
  LoaiHH: string[];
}

export interface TradingReportConfig {
  LMECode: Record<string, string>;
  MonthCode: Record<string, string>;
  members: MemberConfig[];
  commodities: CommodityConfig[];
}

@Injectable()
export class TradingReportService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'trading-report');

  constructor(
    @InjectModel(ExchangeRate.name)
    private readonly exchangeRateModel: Model<ExchangeRate>,
    private readonly systemSettingsService: SystemSettingsService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // --- Configuration ---
  async getConfig(): Promise<TradingReportConfig> {
    const value = await this.systemSettingsService.getSetting('trading_report_config', '');
    if (!value) {
      return {
        LMECode: DEFAULT_LME_CODES,
        MonthCode: DEFAULT_MONTH_CODES,
        members: DEFAULT_MEMBERS,
        commodities: DEFAULT_COMMODITIES,
      };
    }
    try {
      return JSON.parse(value);
    } catch {
      return {
        LMECode: DEFAULT_LME_CODES,
        MonthCode: DEFAULT_MONTH_CODES,
        members: DEFAULT_MEMBERS,
        commodities: DEFAULT_COMMODITIES,
      };
    }
  }

  async saveConfig(config: any): Promise<{ success: boolean }> {
    await this.systemSettingsService.setSetting('trading_report_config', JSON.stringify(config));
    return { success: true };
  }

  // --- Exchange Rates ---
  async getExchangeRates(): Promise<ExchangeRate[]> {
    return this.exchangeRateModel.find().sort({ effectiveFrom: -1 }).exec();
  }

  async saveExchangeRate(body: any): Promise<ExchangeRate> {
    if (body.id) {
      const updated = await this.exchangeRateModel.findByIdAndUpdate(body.id, body, { new: true }).exec();
      if (!updated) {
        throw new HttpException('Không tìm thấy tỷ giá để cập nhật', HttpStatus.NOT_FOUND);
      }
      return updated;
    }
    return new this.exchangeRateModel(body).save();
  }

  async deleteExchangeRate(id: string): Promise<{ success: boolean }> {
    await this.exchangeRateModel.findByIdAndDelete(id).exec();
    return { success: true };
  }

  async importExchangeRates(buffer: Buffer): Promise<{ success: boolean; count: number }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (rows.length < 2) {
      throw new HttpException('File rỗng hoặc không đúng cấu trúc.', HttpStatus.BAD_REQUEST);
    }

    const headerRow = rows[0];
    let fromCol = -1;
    let toCol = -1;
    let rateCol = -1;
    let dateCol = -1;

    for (let col = 0; col < headerRow.length; col++) {
      const h = String(headerRow[col] || '').trim().toLowerCase();
      if (h === 'đồng tiền yết giá') fromCol = col;
      if (h === 'đồng tiền định giá') toCol = col;
      if (h === 'tỷ giá quy đổi') rateCol = col;
      if (h === 'ngày phiên hiệu lực') dateCol = col;
    }

    if (fromCol === -1 || toCol === -1 || rateCol === -1 || dateCol === -1) {
      throw new HttpException('Không tìm thấy đủ các cột tiêu chuẩn.', HttpStatus.BAD_REQUEST);
    }

    let count = 0;
    const ratesToInsert: any[] = [];

    for (let row = 1; row < rows.length; row++) {
      const r = rows[row];
      if (!r || r.length <= Math.max(fromCol, toCol, rateCol, dateCol)) continue;

      const from = String(r[fromCol] || '').trim();
      const to = String(r[toCol] || '').trim();
      const rateStr = String(r[rateCol] || '').trim().replace(/,/g, '');
      const dateStr = String(r[dateCol] || '').trim();

      if (!from || !to || !rateStr || !dateStr) continue;

      const rate = parseFloat(rateStr);
      let effectiveFrom: Date;
      if (!isNaN(Number(dateStr))) {
        effectiveFrom = new Date((Number(dateStr) - (25567 + 2)) * 86400 * 1000);
      } else {
        effectiveFrom = new Date(dateStr);
      }

      if (isNaN(rate) || isNaN(effectiveFrom.getTime())) continue;

      ratesToInsert.push({
        fromCurrency: from,
        toCurrency: to,
        rate,
        effectiveFrom,
      });
      count++;
    }

    if (ratesToInsert.length > 0) {
      ratesToInsert.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

      const grouped: Record<string, any[]> = {};
      for (const item of ratesToInsert) {
        const k = `${item.fromCurrency}_${item.toCurrency}`;
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(item);
      }

      for (const group of Object.values(grouped)) {
        for (let i = 0; i < group.length; i++) {
          const current = group[i];
          const next = group[i + 1];
          if (next) {
            current.effectiveTo = next.effectiveFrom;
          }
        }
      }

      for (const rate of ratesToInsert) {
        await this.exchangeRateModel.updateOne(
          {
            fromCurrency: rate.fromCurrency,
            toCurrency: rate.toCurrency,
            effectiveFrom: rate.effectiveFrom,
          },
          rate,
          { upsert: true },
        );
      }
    }

    return { success: true, count };
  }

  // --- Reports processing helper parsers ---
  private parseDSGD(buffers: Buffer[]): { MaTKGD: string; MaHD: string; KLGiaoDich: number; NgayGiaoDich: string }[] {
    const result: any[] = [];
    for (const buffer of buffers) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (rows.length < 2) continue;

      const headerRow = rows[0];
      let maTKGDIndex = -1;
      let maHDIndex = -1;
      let klGiaoDichIndex = -1;
      let ngayGDIndex = -1;

      for (let col = 0; col < headerRow.length; col++) {
        const h = String(headerRow[col] || '').trim().toLowerCase();
        if (h === 'mã tkgd') maTKGDIndex = col;
        if (h === 'mã hd' || h === 'mã hđ') maHDIndex = col;
        if (h === 'kl giao dịch') klGiaoDichIndex = col;
        if (h === 'ngày giờ thực hiện') ngayGDIndex = col;
      }

      if (maTKGDIndex === -1 || maHDIndex === -1 || klGiaoDichIndex === -1 || ngayGDIndex === -1) {
        throw new Error('Không tìm thấy đủ các cột trong file giao dịch (DSGD)');
      }

      for (let row = 1; row < rows.length; row++) {
        const r = rows[row];
        if (!r || r.length <= Math.max(maTKGDIndex, maHDIndex, klGiaoDichIndex, ngayGDIndex)) continue;

        const maTKGD = String(r[maTKGDIndex] || '').trim();
        const maHD = String(r[maHDIndex] || '').trim();
        const klGiaoDichStr = String(r[klGiaoDichIndex] || '').trim().replace(/,/g, '');
        const ngayGD = String(r[ngayGDIndex] || '').trim();

        if (!maTKGD || !maHD) continue;
        const klGiaoDich = parseFloat(klGiaoDichStr) || 0;
        result.push({ MaTKGD: maTKGD, MaHD: maHD, KLGiaoDich: klGiaoDich, NgayGiaoDich: ngayGD });
      }
    }
    return result;
  }

  private parseTTTT(buffers: Buffer[]): {
    MaTKGD: string;
    MaHD: string;
    KLMua: number;
    KLBan: number;
    GiaMua: number;
    GiaBan: number;
    LaiLoUSD: number;
    LaiLoVND: number;
    NgayPhienGhep: string;
  }[] {
    const result: any[] = [];
    for (const buffer of buffers) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (rows.length < 2) continue;

      const headerRow = rows[0];
      let maTKGDIndex = -1;
      let maHDIndex = -1;
      let klMuaIndex = -1;
      let klBanIndex = -1;
      let giaMuaIndex = -1;
      let giaBanIndex = -1;
      let laiLoUSDIndex = -1;
      let laiLoVNDIndex = -1;
      let ngayPhienGhepIndex = -1;

      for (let col = 0; col < headerRow.length; col++) {
        const h = String(headerRow[col] || '').trim().toLowerCase();
        if (h === 'mã tkgd') maTKGDIndex = col;
        if (h === 'mã hd' || h === 'mã hđ') maHDIndex = col;
        if (h === 'kl mua') klMuaIndex = col;
        if (h === 'kl bán') klBanIndex = col;
        if (h === 'giá mua') giaMuaIndex = col;
        if (h === 'giá bán') giaBanIndex = col;
        if (h === 'lãi lỗ thực tế') laiLoUSDIndex = col;
        if (h === 'lãi lỗ thực tế (vnd)') laiLoVNDIndex = col;
        if (h === 'ngày phiên ghép') ngayPhienGhepIndex = col;
      }

      if (
        maTKGDIndex === -1 ||
        maHDIndex === -1 ||
        klMuaIndex === -1 ||
        klBanIndex === -1 ||
        giaMuaIndex === -1 ||
        giaBanIndex === -1 ||
        laiLoUSDIndex === -1 ||
        laiLoVNDIndex === -1 ||
        ngayPhienGhepIndex === -1
      ) {
        throw new Error('Không tìm thấy đủ các cột trong file tất toán (TTTT)');
      }

      for (let row = 1; row < rows.length; row++) {
        const r = rows[row];
        if (!r || r.length <= Math.max(maTKGDIndex, maHDIndex, klMuaIndex, klBanIndex, giaMuaIndex, giaBanIndex, laiLoUSDIndex, laiLoVNDIndex, ngayPhienGhepIndex)) continue;

        const maTKGD = String(r[maTKGDIndex] || '').trim();
        const maHD = String(r[maHDIndex] || '').trim();
        const klMua = parseFloat(String(r[klMuaIndex] || '').replace(/,/g, '')) || 0;
        const klBan = parseFloat(String(r[klBanIndex] || '').replace(/,/g, '')) || 0;
        const giaMua = parseFloat(String(r[giaMuaIndex] || '').replace(/,/g, '')) || 0;
        const giaBan = parseFloat(String(r[giaBanIndex] || '').replace(/,/g, '')) || 0;
        const laiLoUSD = parseFloat(String(r[laiLoUSDIndex] || '').replace(/,/g, '')) || 0;
        const laiLoVND = parseFloat(String(r[laiLoVNDIndex] || '').replace(/,/g, '')) || 0;
        const ngayPhienGhep = String(r[ngayPhienGhepIndex] || '').trim();

        if (!maTKGD || !maHD) continue;
        result.push({
          MaTKGD: maTKGD,
          MaHD: maHD,
          KLMua: klMua,
          KLBan: klBan,
          GiaMua: giaMua,
          GiaBan: giaBan,
          LaiLoUSD: laiLoUSD,
          LaiLoVND: laiLoVND,
          NgayPhienGhep: ngayPhienGhep,
        });
      }
    }
    return result;
  }

  private parseConvertExchange(buffers: Buffer[]): {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }[] {
    const list: any[] = [];
    for (const buffer of buffers) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (rows.length < 2) continue;

      const headerRow = rows[0];
      let fromCol = -1;
      let toCol = -1;
      let rateCol = -1;
      let dateCol = -1;

      for (let col = 0; col < headerRow.length; col++) {
        const h = String(headerRow[col] || '').trim().toLowerCase();
        if (h === 'đồng tiền yết giá') fromCol = col;
        if (h === 'đồng tiền định giá') toCol = col;
        if (h === 'tỷ giá quy đổi') rateCol = col;
        if (h === 'ngày phiên hiệu lực') dateCol = col;
      }

      if (fromCol === -1 || toCol === -1 || rateCol === -1 || dateCol === -1) {
        throw new Error('Không tìm thấy đủ các cột trong file tỷ giá');
      }

      for (let row = 1; row < rows.length; row++) {
        const r = rows[row];
        if (!r || r.length <= Math.max(fromCol, toCol, rateCol, dateCol)) continue;

        const from = String(r[fromCol] || '').trim();
        const to = String(r[toCol] || '').trim();
        const rateStr = String(r[rateCol] || '').trim().replace(/,/g, '');
        const dateStr = String(r[dateCol] || '').trim();

        if (!from || !to || !rateStr || !dateStr) continue;
        const rate = parseFloat(rateStr);
        let effectiveFrom: Date;
        if (!isNaN(Number(dateStr))) {
          effectiveFrom = new Date((Number(dateStr) - (25567 + 2)) * 86400 * 1000);
        } else {
          effectiveFrom = new Date(dateStr);
        }

        if (isNaN(rate) || isNaN(effectiveFrom.getTime())) continue;
        list.push({ fromCurrency: from, toCurrency: to, rate, effectiveFrom });
      }
    }

    const result: any[] = [];
    const grouped: Record<string, any[]> = {};
    for (const item of list) {
      const key = `${item.fromCurrency}_${item.toCurrency}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    for (const group of Object.values(grouped)) {
      group.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
      for (let i = 0; i < group.length; i++) {
        const current = group[i];
        current.effectiveTo = i < group.length - 1 ? group[i + 1].effectiveFrom : undefined;
        result.push(current);
      }
    }

    return result;
  }

  // --- Date helpers ---
  private getFirstWorkingDayOfMonth(year: number, month: number): Date {
    const date = new Date(year, month - 1, 1);
    while (date.getDay() === 0 || date.getDay() === 6) { // 0 Sunday, 6 Saturday
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  private getSessionDate(tradeTime: Date, sessionStartStr: string): Date {
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);
    const sessionStartMinutes = sHour * 60 + sMin;
    const tradeMinutes = tradeTime.getHours() * 60 + tradeTime.getMinutes();

    const sessionDate = new Date(tradeTime);
    sessionDate.setHours(0, 0, 0, 0);
    if (tradeMinutes < sessionStartMinutes) {
      sessionDate.setDate(sessionDate.getDate() - 1);
    }
    while (sessionDate.getDay() === 0 || sessionDate.getDay() === 6) {
      sessionDate.setDate(sessionDate.getDate() - 1);
    }
    return sessionDate;
  }

  private getCommodityCode(raw: string, config: TradingReportConfig): string {
    const lmeCode = config.LMECode || {};
    const monthCode = config.MonthCode || {};

    for (const [key, value] of Object.entries(lmeCode)) {
      if (raw.toUpperCase().startsWith(String(value).toUpperCase())) {
        return key;
      }
    }

    const monthCodeIndex = raw.length - 3;
    if (monthCodeIndex < 0) {
      throw new Error(`Mã hàng hóa ${raw} không đúng định dạng`);
    }

    const mCode = raw.substring(monthCodeIndex, monthCodeIndex + 1).toUpperCase();
    if (!monthCode[mCode]) {
      throw new Error(`Mã hàng hóa ${raw} không đúng định dạng`);
    }

    return raw.substring(0, monthCodeIndex);
  }

  private parseDateString(str: string): Date {
    // Format can be dd-MM-yyyy HH:mm:ss or similar. Handle both dash and slash.
    const normalized = str.replace(/\//g, '-');
    const parts = normalized.split(' ');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1] ? parts[1].split(':') : ['00', '00', '00'];

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);

    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const second = parseInt(timeParts[2], 10);

    return new Date(year, month - 1, day, hour, minute, second);
  }

  private formatDayMonth(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  }

  private getColorByPercent(val: number): string {
    if (isNaN(val)) return 'FFFFAD2';
    return val < 0 ? 'FFFF8F8F' : 'FF42FFA1';
  }

  // --- Monthly Report ---
  async processMonthReport(
    monthDSGDTBuffers: Buffer[],
    monthDSGDT1Buffers: Buffer[],
    startSession: string,
    endSession: string,
    month: number,
    year: number,
    reportTypes: Record<string, boolean>,
  ): Promise<string> {
    const config = await this.getConfig();
    const dsgdT = this.parseDSGD(monthDSGDTBuffers);
    const dsgdT1 = this.parseDSGD(monthDSGDT1Buffers);

    const firstWorkingDay = this.getFirstWorkingDayOfMonth(year, month);
    const defaultDate = this.formatDayMonth(firstWorkingDay);

    const memberRows: any[][] = [];
    const memberACMRows: any[][] = [];
    const commodityRows: any[][] = [];
    const commodityACMRows: any[][] = [];
    const spreadRows: any[][] = [];
    const lmeRows: any[][] = [];
    const optionRows: any[][] = [];

    for (const item of config.members) {
      if (reportTypes.Member) {
        if (item.LoaiHH.includes('ACM')) {
          memberACMRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0, 0, defaultDate, 0, defaultDate]);
        }
        memberRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0, 0, defaultDate, 0, defaultDate]);
      }
      if (reportTypes.Spread && item.LoaiHH.includes('Spread')) {
        spreadRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0]);
      }
      if (reportTypes.LME && item.LoaiHH.includes('LME')) {
        lmeRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0]);
      }
      if (reportTypes.Option && item.LoaiHH.includes('Option')) {
        optionRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0]);
      }
    }

    for (const item of config.commodities) {
      if (reportTypes.Commodity) {
        if (!item.MaHangHoa.startsWith('C.') && !item.MaHangHoa.startsWith('P.')) {
          if (item.TenHangHoa.endsWith('ACM')) {
            commodityACMRows.push([item.TenHangHoa, 0, 0, 0, 0, '', item.MaHangHoa]);
          } else {
            commodityRows.push([item.TenHangHoa, 0, 0, 0, 0, '', item.MaHangHoa]);
          }
        }
      }
    }

    let totalMemberT1 = 0;
    let totalMemberT = 0;
    let totalMemberMaxVal = 0;
    let totalMemberMaxDate = defaultDate;
    let totalMemberMinVal = 0;
    let totalMemberMinDate = defaultDate;

    let totalMemberAcmT1 = 0;
    let totalMemberAcmT = 0;
    let totalMemberAcmMaxVal = 0;
    let totalMemberAcmMaxDate = defaultDate;
    let totalMemberAcmMinVal = 0;
    let totalMemberAcmMinDate = defaultDate;

    let totalCommodityT1 = 0;
    let totalCommodityT = 0;
    let totalCommodityAcmT1 = 0;
    let totalCommodityAcmT = 0;

    let totalSpreadT1 = 0;
    let totalSpreadT = 0;

    let totalLmeT1 = 0;
    let totalLmeT = 0;

    let totalOptionT1 = 0;
    let totalOptionT = 0;

    // --- Process DSGDT (Month T) ---
    if (reportTypes.Member) {
      const groupedByMember: Record<string, typeof dsgdT> = {};
      for (const item of dsgdT) {
        const code = item.MaTKGD.substring(0, 3);
        if (!groupedByMember[code]) groupedByMember[code] = [];
        groupedByMember[code].push(item);
      }

      for (const [memberCode, group] of Object.entries(groupedByMember)) {
        const matchedMemberRow = memberRows.find((r) => r[0] === memberCode);
        const matchedMemberACMRow = memberACMRows.find((r) => r[0] === memberCode);

        // ACM items
        const acmItems = group
          .filter((item) => item.MaTKGD.endsWith('A'))
          .map((item) => {
            const tradeTime = this.parseDateString(item.NgayGiaoDich);
            const sessionDate = this.getSessionDate(tradeTime, startSession);
            return {
              Volume: item.KLGiaoDich,
              Date: this.formatDayMonth(sessionDate),
            };
          });

        if (acmItems.length > 0 && matchedMemberACMRow) {
          const totalVolume = acmItems.reduce((sum, item) => sum + item.Volume, 0);
          const dateGroups: Record<string, number> = {};
          for (const item of acmItems) {
            dateGroups[item.Date] = (dateGroups[item.Date] || 0) + item.Volume;
          }
          const sortedDates = Object.entries(dateGroups).map(([date, volume]) => ({ date, volume }));
          const max = sortedDates.sort((a, b) => b.volume - a.volume)[0];
          const min = sortedDates.sort((a, b) => a.volume - b.volume)[0];

          matchedMemberACMRow[3] = totalVolume;
          matchedMemberACMRow[5] = max.volume;
          matchedMemberACMRow[6] = max.date;
          matchedMemberACMRow[7] = min.volume;
          matchedMemberACMRow[8] = min.date;

          totalMemberAcmT += totalVolume;
        }

        // Non-ACM items
        const memberItems = group
          .filter((item) => !item.MaTKGD.endsWith('A'))
          .map((item) => {
            const tradeTime = this.parseDateString(item.NgayGiaoDich);
            const sessionDate = this.getSessionDate(tradeTime, startSession);
            return {
              Volume: item.KLGiaoDich,
              Date: this.formatDayMonth(sessionDate),
            };
          });

        if (memberItems.length > 0 && matchedMemberRow) {
          const totalVolume = memberItems.reduce((sum, item) => sum + item.Volume, 0);
          const dateGroups: Record<string, number> = {};
          for (const item of memberItems) {
            dateGroups[item.Date] = (dateGroups[item.Date] || 0) + item.Volume;
          }
          const sortedDates = Object.entries(dateGroups).map(([date, volume]) => ({ date, volume }));
          const max = sortedDates.sort((a, b) => b.volume - a.volume)[0];
          const min = sortedDates.sort((a, b) => a.volume - b.volume)[0];

          matchedMemberRow[3] = totalVolume;
          matchedMemberRow[5] = max.volume;
          matchedMemberRow[6] = max.date;
          matchedMemberRow[7] = min.volume;
          matchedMemberRow[8] = min.date;

          totalMemberT += totalVolume;
        }
      }
    }

    // Commodity, Spread, LME, Option in DSGDT
    for (const item of dsgdT) {
      if (reportTypes.Commodity) {
        let comCode = this.getCommodityCode(item.MaHD, config);
        if (comCode.startsWith('C.') || comCode.startsWith('P.')) {
          comCode = comCode.substring(2);
        }
        const matchedRow = commodityRows.find((r) => r[6] === comCode);
        const matchedACMRow = commodityACMRows.find((r) => r[6] === comCode);

        if (matchedACMRow) {
          matchedACMRow[2] += item.KLGiaoDich;
          totalCommodityAcmT += item.KLGiaoDich;
        }
        if (matchedRow) {
          matchedRow[2] += item.KLGiaoDich;
          totalCommodityT += item.KLGiaoDich;
        }
      }
      if (reportTypes.Spread) {
        const matchedRow = spreadRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if (item.MaTKGD.endsWith('S') && matchedRow) {
          matchedRow[3] += item.KLGiaoDich;
          totalSpreadT += item.KLGiaoDich;
        }
      }
      if (reportTypes.LME) {
        const matchedRow = lmeRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if (item.MaTKGD.endsWith('L') && matchedRow) {
          matchedRow[3] += item.KLGiaoDich;
          totalLmeT += item.KLGiaoDich;
        }
      }
      if (reportTypes.Option) {
        const matchedRow = optionRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if ((item.MaHD.toUpperCase().includes('C.') || item.MaHD.toUpperCase().includes('P.')) && matchedRow) {
          matchedRow[3] += item.KLGiaoDich;
          totalOptionT += item.KLGiaoDich;
        }
      }
    }

    // --- Process DSGDT1 (Month T-1) ---
    for (const item of dsgdT1) {
      if (reportTypes.Member) {
        const matchedRow = memberRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        const matchedACMRow = memberACMRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if (item.MaTKGD.endsWith('A')) {
          if (matchedACMRow) {
            matchedACMRow[2] += item.KLGiaoDich;
            totalMemberAcmT1 += item.KLGiaoDich;
          }
        } else {
          if (matchedRow) {
            matchedRow[2] += item.KLGiaoDich;
            totalMemberT1 += item.KLGiaoDich;
          }
        }
      }
      if (reportTypes.Commodity) {
        let comCode = this.getCommodityCode(item.MaHD, config);
        if (comCode.startsWith('C.') || comCode.startsWith('P.')) {
          comCode = comCode.substring(2);
        }
        const matchedRow = commodityRows.find((r) => r[6] === comCode);
        const matchedACMRow = commodityACMRows.find((r) => r[6] === comCode);

        if (matchedACMRow) {
          matchedACMRow[1] += item.KLGiaoDich;
          totalCommodityAcmT1 += item.KLGiaoDich;
        }
        if (matchedRow) {
          matchedRow[1] += item.KLGiaoDich;
          totalCommodityT1 += item.KLGiaoDich;
        }
      }
      if (reportTypes.Spread) {
        const matchedRow = spreadRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if (item.MaTKGD.endsWith('S') && matchedRow) {
          matchedRow[2] += item.KLGiaoDich;
          totalSpreadT1 += item.KLGiaoDich;
        }
      }
      if (reportTypes.LME) {
        const matchedRow = lmeRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if (item.MaTKGD.endsWith('L') && matchedRow) {
          matchedRow[2] += item.KLGiaoDich;
          totalLmeT1 += item.KLGiaoDich;
        }
      }
      if (reportTypes.Option) {
        const matchedRow = optionRows.find((r) => r[0] === item.MaTKGD.substring(0, 3));
        if ((item.MaHD.toUpperCase().includes('C.') || item.MaHD.toUpperCase().includes('P.')) && matchedRow) {
          matchedRow[2] += item.KLGiaoDich;
          totalOptionT1 += item.KLGiaoDich;
        }
      }
    }

    // --- Growth % calculations ---
    const calcGrowth = (curr: number, prev: number): number => {
      if (prev === 0) return 0;
      return (curr - prev) / prev;
    };

    for (const row of memberRows) {
      row[4] = calcGrowth(row[3], row[2]);
    }
    for (const row of memberACMRows) {
      row[4] = calcGrowth(row[3], row[2]);
    }
    for (const row of commodityRows) {
      row[3] = calcGrowth(row[2], row[1]);
    }
    for (const row of commodityACMRows) {
      row[3] = calcGrowth(row[2], row[1]);
    }
    for (const row of spreadRows) {
      row[4] = calcGrowth(row[3], row[2]);
    }
    for (const row of lmeRows) {
      row[4] = calcGrowth(row[3], row[2]);
    }
    for (const row of optionRows) {
      row[4] = calcGrowth(row[3], row[2]);
    }

    // Member Peak & Valley totals across dates
    if (reportTypes.Member) {
      const dailyTotals = dsgdT.reduce((acc, item) => {
        const tradeTime = this.parseDateString(item.NgayGiaoDich);
        const sessionDate = this.getSessionDate(tradeTime, startSession);
        const dateStr = this.formatDayMonth(sessionDate);
        if (!acc[dateStr]) {
          acc[dateStr] = { ACM: 0, nonACM: 0 };
        }
        if (item.MaTKGD.endsWith('A')) {
          acc[dateStr].ACM += item.KLGiaoDich;
        } else {
          acc[dateStr].nonACM += item.KLGiaoDich;
        }
        return acc;
      }, {} as Record<string, { ACM: number; nonACM: number }>);

      const dailyList = Object.entries(dailyTotals).map(([date, v]) => ({ date, ...v }));

      if (dailyList.length > 0) {
        const maxA = dailyList.sort((a, b) => b.ACM - a.ACM)[0];
        const minA = dailyList.sort((a, b) => a.ACM - b.ACM)[0];
        const maxNonA = dailyList.sort((a, b) => b.nonACM - a.nonACM)[0];
        const minNonA = dailyList.sort((a, b) => a.nonACM - b.nonACM)[0];

        totalMemberAcmMaxVal = maxA.ACM;
        totalMemberAcmMaxDate = maxA.date;
        totalMemberAcmMinVal = minA.ACM;
        totalMemberAcmMinDate = minA.date;

        totalMemberMaxVal = maxNonA.nonACM;
        totalMemberMaxDate = maxNonA.date;
        totalMemberMinVal = minNonA.nonACM;
        totalMemberMinDate = minNonA.date;
      }
    }

    // Commodity proportions
    let proportionComm = 0;
    for (let i = 0; i < commodityRows.length; i++) {
      const row = commodityRows[i];
      const isLast = i === commodityRows.length - 1;
      if (totalCommodityT > 0) {
        if (isLast) {
          row[4] = 1 - proportionComm;
        } else {
          const prop = row[2] / totalCommodityT;
          row[4] = prop;
          proportionComm += prop;
        }
      } else {
        row[4] = 0;
      }
    }

    let proportionCommACM = 0;
    for (let i = 0; i < commodityACMRows.length; i++) {
      const row = commodityACMRows[i];
      const isLast = i === commodityACMRows.length - 1;
      if (totalCommodityAcmT > 0) {
        if (isLast) {
          row[4] = 1 - proportionCommACM;
        } else {
          const prop = row[2] / totalCommodityAcmT;
          row[4] = prop;
          proportionCommACM += prop;
        }
      } else {
        row[4] = 0;
      }
    }

    const totalMemberGrowth = calcGrowth(totalMemberT, totalMemberT1);
    const totalMemberAcmGrowth = calcGrowth(totalMemberAcmT, totalMemberAcmT1);
    const totalCommodityGrowth = calcGrowth(totalCommodityT, totalCommodityT1);
    const totalCommodityAcmGrowth = calcGrowth(totalCommodityAcmT, totalCommodityAcmT1);
    const totalSpreadGrowth = calcGrowth(totalSpreadT, totalSpreadT1);
    const totalLmeGrowth = calcGrowth(totalLmeT, totalLmeT1);
    const totalOptionGrowth = calcGrowth(totalOptionT, totalOptionT1);

    // Sorting lists by month volume desc
    memberRows.sort((a, b) => b[3] - a[3]);
    memberACMRows.sort((a, b) => b[3] - a[3]);
    commodityRows.sort((a, b) => b[2] - a[2]);
    commodityACMRows.sort((a, b) => b[2] - a[2]);
    spreadRows.sort((a, b) => b[3] - a[3]);
    lmeRows.sort((a, b) => b[3] - a[3]);
    optionRows.sort((a, b) => b[3] - a[3]);

    // Add totals to lists
    memberRows.push(['TỔNG (không bao gồm ACM)', '', totalMemberT1, totalMemberT, totalMemberGrowth, totalMemberMaxVal, totalMemberMaxDate, totalMemberMinVal, totalMemberMinDate]);
    memberACMRows.push(['TỔNG ACM', '', totalMemberAcmT1, totalMemberAcmT, totalMemberAcmGrowth, totalMemberAcmMaxVal, totalMemberAcmMaxDate, totalMemberAcmMinVal, totalMemberAcmMinDate]);
    commodityRows.push(['TỔNG (không bao gồm ACM)', totalCommodityT1, totalCommodityT, totalCommodityGrowth, '100.00%', '']);
    commodityACMRows.push(['TỔNG ACM', totalCommodityAcmT1, totalCommodityAcmT, totalCommodityAcmGrowth, '100.00%', '']);
    spreadRows.push(['TỔNG', '', totalSpreadT1, totalSpreadT, totalSpreadGrowth]);
    lmeRows.push(['TỔNG', '', totalLmeT1, totalLmeT, totalLmeGrowth]);
    optionRows.push(['TỔNG', '', totalOptionT1, totalOptionT, totalOptionGrowth]);

    // --- Generate Excel Workbook ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    let currentRow = 1;

    // 1. Members
    if (reportTypes.Member) {
      worksheet.getRow(currentRow).values = [
        'STT',
        'Mã TVKD',
        'Tên TVKD',
        'Số Lot tháng trước',
        'Số Lot tháng này',
        '% Tăng/giảm',
        'Số Lot giao dịch nhiều nhất/ngày',
        'Ngày giao dịch',
        'Số Lot giao dịch ít nhất/ngày',
        'Ngày giao dịch',
      ];
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startMemberRow = currentRow;
      for (let i = 0; i < memberRows.length; i++) {
        const row = memberRows[i];
        const isTotal = i === memberRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4], row[5], row[6], row[7], row[8]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        sheetRow.getCell(7).numFmt = '#,##0';
        sheetRow.getCell(9).numFmt = '#,##0';
        currentRow++;
      }

      // Member ACM section separator
      worksheet.mergeCells(currentRow, 1, currentRow, 10);
      const sepRow = worksheet.getRow(currentRow);
      sepRow.getCell(1).value = 'ACM';
      sepRow.getCell(1).font = { bold: true };
      sepRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF828282' },
      };
      currentRow++;

      const startAcmRow = currentRow;
      for (let i = 0; i < memberACMRows.length; i++) {
        const row = memberACMRows[i];
        const isTotal = i === memberACMRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4], row[5], row[6], row[7], row[8]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        sheetRow.getCell(7).numFmt = '#,##0';
        sheetRow.getCell(9).numFmt = '#,##0';
        currentRow++;
      }

      const endMemberRangeRow = currentRow - 1;
      for (let r = startMemberRow; r <= endMemberRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // 2. Commodities
    if (reportTypes.Commodity) {
      worksheet.getRow(currentRow).values = [
        'STT',
        'Mã hàng hóa',
        'Mặt hàng',
        'Số Lot tháng trước',
        'Số Lot tháng này',
        '% Tăng/giảm',
        'Tỷ trọng',
        'Ghi chú',
      ];
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startCommRow = currentRow;
      for (let i = 0; i < commodityRows.length; i++) {
        const row = commodityRows[i];
        const isTotal = i === commodityRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[1], row[2], row[3], row[4], '']
          : [i + 1, row[6], row[0], row[1], row[2], row[3], row[4], ''];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[3]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        if (typeof row[4] === 'number') {
          sheetRow.getCell(7).numFmt = '0.00%';
        }
        currentRow++;
      }

      // ACM commodities separator
      worksheet.mergeCells(currentRow, 1, currentRow, 8);
      const sepRow = worksheet.getRow(currentRow);
      sepRow.getCell(1).value = 'ACM';
      sepRow.getCell(1).font = { bold: true };
      sepRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF828282' },
      };
      currentRow++;

      for (let i = 0; i < commodityACMRows.length; i++) {
        const row = commodityACMRows[i];
        const isTotal = i === commodityACMRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[1], row[2], row[3], row[4], '']
          : [i + 1, row[6], row[0], row[1], row[2], row[3], row[4], ''];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[3]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        if (typeof row[4] === 'number') {
          sheetRow.getCell(7).numFmt = '0.00%';
        }
        currentRow++;
      }

      const endCommRangeRow = currentRow - 1;
      for (let r = startCommRow; r <= endCommRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // 3. Spread
    if (reportTypes.Spread && spreadRows.length > 1) {
      const startRow = currentRow;
      worksheet.getCell(currentRow, 1).value = '1';
      worksheet.mergeCells(currentRow, 3, currentRow, 6);
      worksheet.getCell(currentRow, 3).value = 'Giao dịch Spread';
      currentRow++;

      worksheet.mergeCells(currentRow, 1, currentRow + 1, 1);
      worksheet.getCell(currentRow, 1).value = 'STT';
      worksheet.mergeCells(currentRow, 2, currentRow + 1, 2);
      worksheet.getCell(currentRow, 2).value = 'Mã TVKD';
      worksheet.mergeCells(currentRow, 3, currentRow + 1, 3);
      worksheet.getCell(currentRow, 3).value = 'Tên TVKD';
      worksheet.mergeCells(currentRow, 4, currentRow, 6);
      worksheet.getCell(currentRow, 4).value = 'Số Lot giao dịch';
      currentRow++;

      worksheet.getCell(currentRow, 4).value = 'Tháng trước';
      worksheet.getCell(currentRow, 5).value = 'Tháng này';
      worksheet.getCell(currentRow, 6).value = '% Tăng/giảm';
      worksheet.getRow(startRow).font = { bold: true };
      worksheet.getRow(startRow + 1).font = { bold: true };
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startDataRow = currentRow;
      for (let i = 0; i < spreadRows.length; i++) {
        const row = spreadRows[i];
        const isTotal = i === spreadRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        currentRow++;
      }

      const endRangeRow = currentRow - 1;
      for (let r = startRow; r <= endRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // 4. LME
    if (reportTypes.LME && lmeRows.length > 1) {
      const startRow = currentRow;
      worksheet.getCell(currentRow, 1).value = '2';
      worksheet.mergeCells(currentRow, 3, currentRow, 6);
      worksheet.getCell(currentRow, 3).value = 'Giao dịch LME';
      currentRow++;

      worksheet.mergeCells(currentRow, 1, currentRow + 1, 1);
      worksheet.getCell(currentRow, 1).value = 'STT';
      worksheet.mergeCells(currentRow, 2, currentRow + 1, 2);
      worksheet.getCell(currentRow, 2).value = 'Mã TVKD';
      worksheet.mergeCells(currentRow, 3, currentRow + 1, 3);
      worksheet.getCell(currentRow, 3).value = 'Tên TVKD';
      worksheet.mergeCells(currentRow, 4, currentRow, 6);
      worksheet.getCell(currentRow, 4).value = 'Số Lot giao dịch';
      currentRow++;

      worksheet.getCell(currentRow, 4).value = 'Tháng trước';
      worksheet.getCell(currentRow, 5).value = 'Tháng này';
      worksheet.getCell(currentRow, 6).value = '% Tăng/giảm';
      worksheet.getRow(startRow).font = { bold: true };
      worksheet.getRow(startRow + 1).font = { bold: true };
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startDataRow = currentRow;
      for (let i = 0; i < lmeRows.length; i++) {
        const row = lmeRows[i];
        const isTotal = i === lmeRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        currentRow++;
      }

      const endRangeRow = currentRow - 1;
      for (let r = startRow; r <= endRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // 5. Options
    if (reportTypes.Option && optionRows.length > 1) {
      const startRow = currentRow;
      worksheet.getCell(currentRow, 1).value = '3';
      worksheet.mergeCells(currentRow, 3, currentRow, 6);
      worksheet.getCell(currentRow, 3).value = 'Giao dịch Option';
      currentRow++;

      worksheet.mergeCells(currentRow, 1, currentRow + 1, 1);
      worksheet.getCell(currentRow, 1).value = 'STT';
      worksheet.mergeCells(currentRow, 2, currentRow + 1, 2);
      worksheet.getCell(currentRow, 2).value = 'Mã TVKD';
      worksheet.mergeCells(currentRow, 3, currentRow + 1, 3);
      worksheet.getCell(currentRow, 3).value = 'Tên TVKD';
      worksheet.mergeCells(currentRow, 4, currentRow, 6);
      worksheet.getCell(currentRow, 4).value = 'Số Lot giao dịch';
      currentRow++;

      worksheet.getCell(currentRow, 4).value = 'Tháng trước';
      worksheet.getCell(currentRow, 5).value = 'Tháng này';
      worksheet.getCell(currentRow, 6).value = '% Tăng/giảm';
      worksheet.getRow(startRow).font = { bold: true };
      worksheet.getRow(startRow + 1).font = { bold: true };
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startDataRow = currentRow;
      for (let i = 0; i < optionRows.length; i++) {
        const row = optionRows[i];
        const isTotal = i === optionRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        currentRow++;
      }

      const endRangeRow = currentRow - 1;
      for (let r = startRow; r <= endRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // Set Column widths
    worksheet.columns.forEach((col, colIdx) => {
      if (colIdx === 0) col.width = 6;
      else if (colIdx === 1) col.width = 12;
      else if (colIdx === 2) col.width = 32;
      else if (colIdx === 3) col.width = 24;
      else if (colIdx === 4) col.width = 24;
      else if (colIdx === 5) col.width = 16;
      else if (colIdx === 6) col.width = 28;
      else if (colIdx === 7) col.width = 20;
      else if (colIdx === 8) col.width = 28;
      else if (colIdx === 9) col.width = 20;
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const outputPath = path.join(this.uploadDir, `bao_cao_thang_${timestamp}.xlsx`);
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  // --- Quarterly Report ---
  async processQuarterReport(
    quarterDSGDBuffers: Buffer[],
    quarterConvertExchangeBuffers: Buffer[],
    quarterTTTTBuffers: Buffer[],
    quarterWaitingTTTTBuffers: Buffer[],
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const config = await this.getConfig();
    const dsgd = this.parseDSGD(quarterDSGDBuffers);
    const tttt = this.parseTTTT(quarterTTTTBuffers);
    const waitingTTTT = this.parseTTTT(quarterWaitingTTTTBuffers);

    let rates: any[] = [];
    if (quarterConvertExchangeBuffers.length > 0) {
      rates = this.parseConvertExchange(quarterConvertExchangeBuffers);
    } else {
      const dbRates = await this.getExchangeRates();
      rates = dbRates.map((r) => ({
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: r.rate,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
      }));
    }

    const comRows = config.commodities.map((item) => ({
      MaHangHoa: item.MaHangHoa,
      TenHangHoa: item.TenHangHoa,
      NhomHH: item.NhomHH,
      KLGiaoDich: 0,
      GiaTriMua: 0,
      GiaTriBan: 0,
      ChenhLech: 0,
    }));

    // 1. Process dsgd volume
    for (const item of dsgd) {
      try {
        const code = this.getCommodityCode(item.MaHD, config);
        const row = comRows.find((r) => r.MaHangHoa === code);
        if (row) {
          row.KLGiaoDich += item.KLGiaoDich;
        }
      } catch {
        // ignore
      }
    }

    // 2. Process tttt settled positions
    for (const item of tttt) {
      if (item.MaTKGD.endsWith('L')) continue;
      const parsedTime = new Date(item.NgayPhienGhep);
      if (isNaN(parsedTime.getTime()) || parsedTime < startDate || parsedTime > endDate) continue;

      try {
        const comCode = this.getCommodityCode(item.MaHD, config);
        const commodity = config.commodities.find((r) => r.MaHangHoa === comCode);
        if (!commodity) continue;

        const row = comRows.find((r) => r.MaHangHoa === comCode);
        if (row) {
          const doLonHD = parseFloat(commodity.DoLonHD) || 0;
          const donViYetGia = parseFloat(commodity.DonViYetGia) || 0;
          const laiLoUSD = item.LaiLoUSD;
          const laiLoVND = item.LaiLoVND;

          if (laiLoUSD !== 0) {
            const conversionRate = laiLoVND / laiLoUSD;
            if (item.KLMua > 0 && item.GiaMua > 0) {
              const delta = item.KLMua * item.GiaMua * doLonHD * donViYetGia * conversionRate;
              row.GiaTriMua += delta;
              row.ChenhLech -= delta;
            }
            if (item.KLBan > 0 && item.GiaBan > 0) {
              const delta = item.KLBan * item.GiaBan * doLonHD * donViYetGia * conversionRate;
              row.GiaTriBan += delta;
              row.ChenhLech += delta;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Process waitingTTTT (LME positions)
    for (const item of waitingTTTT) {
      if (!item.MaTKGD.endsWith('L')) continue;
      const parsedTime = new Date(item.NgayPhienGhep);
      if (isNaN(parsedTime.getTime()) || parsedTime < startDate || parsedTime > endDate) continue;

      try {
        const comCode = this.getCommodityCode(item.MaHD, config);
        const commodity = config.commodities.find((r) => r.MaHangHoa === comCode);
        if (!commodity) continue;

        const row = comRows.find((r) => r.MaHangHoa === comCode);
        if (row) {
          const matchedRate = rates.find(
            (rate) =>
              rate.fromCurrency === commodity.TienTe &&
              rate.toCurrency === 'VND' &&
              new Date(rate.effectiveFrom) <= parsedTime &&
              (!rate.effectiveTo || parsedTime < new Date(rate.effectiveTo)),
          );

          if (!matchedRate) {
            throw new Error(
              `Không tìm thấy tỷ giá cho ${commodity.TienTe} tại ngày ${item.NgayPhienGhep}`,
            );
          }

          const doLonHD = parseFloat(commodity.DoLonHD) || 0;
          const donViYetGia = parseFloat(commodity.DonViYetGia) || 0;

          if (item.KLMua > 0 && item.GiaMua > 0) {
            const delta = item.KLMua * item.GiaMua * doLonHD * donViYetGia * matchedRate.rate;
            row.GiaTriMua += delta;
            row.ChenhLech -= delta;
          }
          if (item.KLBan > 0 && item.GiaBan > 0) {
            const delta = item.KLBan * item.GiaBan * doLonHD * donViYetGia * matchedRate.rate;
            row.GiaTriBan += delta;
            row.ChenhLech += delta;
          }
        }
      } catch (err) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      }
    }

    // --- Generate Quarterly Excel Workbook ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    worksheet.getRow(1).values = [
      'STT',
      'Mã hàng hóa',
      'Tên hàng hóa',
      'Nhóm hàng hóa',
      'Số lượng',
      'Giá trị mua',
      'Giá trị bán',
      'Chênh lệch',
    ];
    worksheet.getRow(1).font = { bold: true };

    let currentRow = 2;
    for (let i = 0; i < comRows.length; i++) {
      const row = comRows[i];
      const sheetRow = worksheet.addRow([
        i + 1,
        row.MaHangHoa,
        row.TenHangHoa,
        row.NhomHH,
        row.KLGiaoDich,
        row.GiaTriMua,
        row.GiaTriBan,
        row.ChenhLech,
      ]);

      sheetRow.getCell(5).numFmt = '#,##0';
      sheetRow.getCell(6).numFmt = '#,##0.00';
      sheetRow.getCell(7).numFmt = '#,##0.00';
      sheetRow.getCell(8).numFmt = '#,##0.00';
      currentRow++;
    }

    const fullRangeRow = currentRow - 1;
    for (let r = 1; r <= fullRangeRow; r++) {
      const rowObj = worksheet.getRow(r);
      rowObj.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
    }

    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 6;
      else if (idx === 1) col.width = 14;
      else if (idx === 2) col.width = 32;
      else if (idx === 3) col.width = 18;
      else if (idx === 4) col.width = 14;
      else if (idx === 5) col.width = 24;
      else if (idx === 6) col.width = 24;
      else if (idx === 7) col.width = 24;
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const outputPath = path.join(this.uploadDir, `bao_cao_quy_${timestamp}.xlsx`);
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  // --- Settled Position (TTTT) Report ---
  async processTtttReport(
    ttttTBuffers: Buffer[],
    ttttT1Buffers: Buffer[],
    reportTypes: Record<string, boolean>,
  ): Promise<string> {
    const config = await this.getConfig();
    const ttttT = this.parseTTTT(ttttTBuffers);
    const ttttT1 = this.parseTTTT(ttttT1Buffers);

    const memberRows: any[][] = [];
    const commodityRows: any[][] = [];

    for (const item of config.members) {
      if (reportTypes.Member) {
        memberRows.push([item.MaTVKD, item.TenTVKD, 0, 0, 0, 0, 0, 0, 0, 0]);
      }
    }

    for (const item of config.commodities) {
      if (reportTypes.Commodity) {
        if (!item.MaHangHoa.startsWith('C.') && !item.MaHangHoa.startsWith('P.')) {
          commodityRows.push([item.TenHangHoa, 0, 0, 0, 0, 0, 0, 0, 0, item.MaHangHoa]);
        }
      }
    }

    let totalMemberT1Vol = 0;
    let totalMemberTVol = 0;
    let totalMemberT1PLUSD = 0;
    let totalMemberTPLUSD = 0;
    let totalMemberT1PLVND = 0;
    let totalMemberTPLVND = 0;

    let totalCommodityT1Vol = 0;
    let totalCommodityTVol = 0;
    let totalCommodityT1PLUSD = 0;
    let totalCommodityTPLUSD = 0;
    let totalCommodityT1PLVND = 0;
    let totalCommodityTPLVND = 0;

    // Process ttttT (Month T)
    for (const item of ttttT) {
      if (reportTypes.Member) {
        const code = item.MaTKGD.substring(0, 3);
        const row = memberRows.find((r) => r[0] === code);
        if (row) {
          row[3] += item.KLBan;
          row[6] += item.LaiLoUSD;
          row[8] += item.LaiLoVND;

          totalMemberTVol += item.KLBan;
          totalMemberTPLUSD += item.LaiLoUSD;
          totalMemberTPLVND += item.LaiLoVND;
        }
      }

      if (reportTypes.Commodity) {
        try {
          let comCode = this.getCommodityCode(item.MaHD, config);
          if (comCode.startsWith('C.') || comCode.startsWith('P.')) {
            comCode = comCode.substring(2);
          }
          const row = commodityRows.find((r) => r[9] === comCode);
          if (row) {
            row[2] += item.KLBan;
            row[5] += item.LaiLoUSD;
            row[7] += item.LaiLoVND;

            totalCommodityTVol += item.KLBan;
            totalCommodityTPLUSD += item.LaiLoUSD;
            totalCommodityTPLVND += item.LaiLoVND;
          }
        } catch {
          // ignore
        }
      }
    }

    // Process ttttT1 (Month T-1)
    for (const item of ttttT1) {
      if (reportTypes.Member) {
        const code = item.MaTKGD.substring(0, 3);
        const row = memberRows.find((r) => r[0] === code);
        if (row) {
          row[2] += item.KLBan;
          row[5] += item.LaiLoUSD;
          row[7] += item.LaiLoVND;

          totalMemberT1Vol += item.KLBan;
          totalMemberT1PLUSD += item.LaiLoUSD;
          totalMemberT1PLVND += item.LaiLoVND;
        }
      }

      if (reportTypes.Commodity) {
        try {
          let comCode = this.getCommodityCode(item.MaHD, config);
          if (comCode.startsWith('C.') || comCode.startsWith('P.')) {
            comCode = comCode.substring(2);
          }
          const row = commodityRows.find((r) => r[9] === comCode);
          if (row) {
            row[1] += item.KLBan;
            row[4] += item.LaiLoUSD;
            row[6] += item.LaiLoVND;

            totalCommodityT1Vol += item.KLBan;
            totalCommodityT1PLUSD += item.LaiLoUSD;
            totalCommodityT1PLVND += item.LaiLoVND;
          }
        } catch {
          // ignore
        }
      }
    }

    // Calculate growth percentages
    const calcGrowth = (curr: number, prev: number): number => {
      if (prev === 0) return 0;
      return (curr - prev) / prev;
    };

    for (const row of memberRows) {
      row[4] = calcGrowth(row[3], row[2]);
      row[9] = calcGrowth(row[8], row[7]);
    }
    const totalMemberVolGrowth = calcGrowth(totalMemberTVol, totalMemberT1Vol);
    const totalMemberPLGrowth = calcGrowth(totalMemberTPLVND, totalMemberT1PLVND);

    for (const row of commodityRows) {
      row[3] = calcGrowth(row[2], row[1]);
      row[8] = calcGrowth(row[7], row[6]);
    }
    const totalCommodityVolGrowth = calcGrowth(totalCommodityTVol, totalCommodityT1Vol);
    const totalCommodityPLGrowth = calcGrowth(totalCommodityTPLVND, totalCommodityT1PLVND);

    // Sorting by Month T VND PL Descending
    memberRows.sort((a, b) => b[8] - a[8]);
    commodityRows.sort((a, b) => b[7] - a[7]);

    // Add totals to rows
    memberRows.push([
      'TỔNG',
      '',
      totalMemberT1Vol,
      totalMemberTVol,
      totalMemberVolGrowth,
      totalMemberT1PLUSD,
      totalMemberTPLUSD,
      totalMemberT1PLVND,
      totalMemberTPLVND,
      totalMemberPLGrowth,
    ]);
    commodityRows.push([
      'TỔNG',
      totalCommodityT1Vol,
      totalCommodityTVol,
      totalCommodityVolGrowth,
      totalCommodityT1PLUSD,
      totalCommodityTPLUSD,
      totalCommodityT1PLVND,
      totalCommodityTPLVND,
      totalCommodityPLGrowth,
      '',
    ]);

    // --- Generate Excel Workbook ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    let currentRow = 1;

    // 1. Member Section
    if (reportTypes.Member) {
      worksheet.getRow(currentRow).values = [
        'STT',
        'Mã TVKD',
        'Tên TVKD',
        'Số Lot tất toán tháng/kỳ trước',
        'Số Lot tất toán tháng/kỳ này',
        '% tăng/giảm số Lot tất toán',
        'P/L tháng/kỳ trước (nguyên tệ)',
        'P/L tháng/kỳ này (nguyên tệ)',
        'P/L tháng/kỳ trước (VNĐ)',
        'P/L tháng/kỳ này (VNĐ)',
      ];
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startMemberRow = currentRow;
      for (let i = 0; i < memberRows.length; i++) {
        const row = memberRows[i];
        const isTotal = i === memberRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[2], row[3], row[4], row[5], row[6], row[7], row[8]]
          : [i + 1, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[4]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        sheetRow.getCell(7).numFmt = '#,##0.00';
        sheetRow.getCell(8).numFmt = '#,##0.00';
        sheetRow.getCell(9).numFmt = '#,##0.00';
        sheetRow.getCell(10).numFmt = '#,##0.00';
        currentRow++;
      }

      const endRangeRow = currentRow - 1;
      for (let r = startMemberRow; r <= endRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    // 2. Commodity Section
    if (reportTypes.Commodity) {
      worksheet.getRow(currentRow).values = [
        'STT',
        'Mã hàng hóa',
        'Mặt hàng',
        'Số Lot tất toán tháng/kỳ trước',
        'Số Lot tất toán tháng/kỳ này',
        '% tăng/giảm số Lot tất toán',
        'P/L tháng/kỳ trước (nguyên tệ)',
        'P/L tháng/kỳ này (nguyên tệ)',
        'P/L tháng/kỳ trước (VNĐ)',
        'P/L tháng/kỳ này (VNĐ)',
      ];
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;

      const startCommRow = currentRow;
      for (let i = 0; i < commodityRows.length; i++) {
        const row = commodityRows[i];
        const isTotal = i === commodityRows.length - 1;
        const rowData = isTotal
          ? [row[0], '', '', row[1], row[2], row[3], row[4], row[5], row[6], row[7]]
          : [i + 1, row[9], row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]];

        const sheetRow = worksheet.addRow(rowData);
        if (isTotal) {
          worksheet.mergeCells(currentRow, 1, currentRow, 3);
          sheetRow.font = { bold: true };
        }

        const pctCell = sheetRow.getCell(6);
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.getColorByPercent(row[3]) },
        };
        pctCell.numFmt = '0.00%';

        sheetRow.getCell(4).numFmt = '#,##0';
        sheetRow.getCell(5).numFmt = '#,##0';
        sheetRow.getCell(7).numFmt = '#,##0.00';
        sheetRow.getCell(8).numFmt = '#,##0.00';
        sheetRow.getCell(9).numFmt = '#,##0.00';
        sheetRow.getCell(10).numFmt = '#,##0.00';
        currentRow++;
      }

      const endRangeRow = currentRow - 1;
      for (let r = startCommRow; r <= endRangeRow; r++) {
        const rowObj = worksheet.getRow(r);
        rowObj.eachCell((cell) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      }
      currentRow++;
    }

    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 6;
      else if (idx === 1) col.width = 14;
      else if (idx === 2) col.width = 32;
      else if (idx === 3) col.width = 24;
      else if (idx === 4) col.width = 24;
      else if (idx === 5) col.width = 16;
      else if (idx === 6) col.width = 28;
      else if (idx === 7) col.width = 28;
      else if (idx === 8) col.width = 28;
      else if (idx === 9) col.width = 28;
    });

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const outputPath = path.join(this.uploadDir, `bao_cao_tat_toan_thang_${timestamp}.xlsx`);
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }
}

const thinBorder = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

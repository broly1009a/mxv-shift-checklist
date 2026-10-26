import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import {
  parseExcelBuffer,
  toNum,
  toStr,
  ParsedRow,
  extractCcpBaseProduct,
} from '../../helpers/clearing-excel.helper';

export interface CcpExchangeRates {
  usdLoss: number;
  usdGain: number;
  myrLoss: number;
  myrGain: number;
  jpyLoss: number;
  jpyGain: number;
  rmbLoss: number;
  rmbGain: number;
}

export interface ProductValueBreakdown {
  product: string;
  lots: number;
  valueVnd: number;
  currency: 'USD' | 'MYR' | 'JPY' | 'RMB' | 'VND';
  exchangeRate: number;
}

export interface TvkdValueBreakdown {
  tvkd: string;
  lots: number;
  valueVnd: number;
}

export interface CcpTransactionValueResult {
  sessionDate: string;
  totalLots: number;
  totalValueVnd: number;
  breakdownByProduct: ProductValueBreakdown[];
  breakdownByTvkd?: TvkdValueBreakdown[];
  rates: CcpExchangeRates;
  passed: boolean;
  calculatedAt: Date;
}

@Injectable()
export class ValueStatisticsService {
  private readonly logger = new Logger(ValueStatisticsService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Lấy tỷ giá quy đổi CCP hiện hành theo thứ tự ưu tiên:
   * 1. Ma trận ccp_exchange_rates_matrix
   * 2. Tỷ giá lẻ riêng CCP (ccp_usd_exchange_rate, ccp_myr_exchange_rate, ccp_jpy_exchange_rate, ccp_rmb_exchange_rate)
   * 3. Fallback M-System (usd_exchange_rate, myr_exchange_rate, ...)
   * 4. Mặc định an toàn (USD=25400, MYR=5400, JPY=165, RMB=3500)
   */
  async getCurrentExchangeRates(): Promise<CcpExchangeRates> {
    if (!this.settingsService) {
      return {
        usdLoss: 25400,
        usdGain: 25400,
        myrLoss: 5400,
        myrGain: 5400,
        jpyLoss: 165,
        jpyGain: 165,
        rmbLoss: 3500,
        rmbGain: 3500,
      };
    }

    // 1. Ưu tiên đọc ma trận đa nguyên tệ ccp_exchange_rates_matrix
    let matrix: Record<string, any> = {};
    try {
      const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '');
      if (matrixStr) matrix = JSON.parse(matrixStr);
    } catch {
      matrix = {};
    }

    // 2. Đọc các setting đơn lẻ riêng của CoreCCP (fallback về M-System nếu chưa cấu hình)
    const [
      ccpUsdStr, usdStr,
      ccpMyrStr, myrStr,
      ccpJpyStr, jpyStr,
      ccpRmbStr, rmbStr,
    ] = await Promise.all([
      this.settingsService.getSetting('ccp_usd_exchange_rate', ''),
      this.settingsService.getSetting('usd_exchange_rate', ''),
      this.settingsService.getSetting('ccp_myr_exchange_rate', ''),
      this.settingsService.getSetting('myr_exchange_rate', ''),
      this.settingsService.getSetting('ccp_jpy_exchange_rate', ''),
      this.settingsService.getSetting('jpy_exchange_rate', ''),
      this.settingsService.getSetting('ccp_rmb_exchange_rate', ''),
      this.settingsService.getSetting('rmb_exchange_rate', ''),
    ]);

    const getRate = (code: string, ccpFallback: string, msFallback: string, defaultRate: number) => {
      const item = matrix[code];
      const parsedCcp = parseFloat(ccpFallback);
      const parsedMs = parseFloat(msFallback);
      const parsedMatrixConv = item?.conversionRate ? Number(item.conversionRate) : NaN;

      // An toàn: Tỷ giá ngoại tệ hợp lệ bắt buộc phải > 10 (tránh trường hợp fallback về 1 hoặc 0 làm lệch quy mô giá trị)
      const validCcp = !isNaN(parsedCcp) && parsedCcp > 10 ? parsedCcp : 0;
      const validMs = !isNaN(parsedMs) && parsedMs > 10 ? parsedMs : 0;
      const validMatrix = !isNaN(parsedMatrixConv) && parsedMatrixConv > 10 ? parsedMatrixConv : 0;

      const conv = validMatrix || validCcp || validMs || defaultRate;
      const buy = (item?.buyRate && Number(item.buyRate) > 10) ? Number(item.buyRate) : conv;
      const sell = (item?.sellRate && Number(item.sellRate) > 10) ? Number(item.sellRate) : conv;
      return { buy, sell, conv };
    };

    const usd = getRate('USD', ccpUsdStr, usdStr, 25400);
    const myr = getRate('MYR', ccpMyrStr, myrStr, 5400);
    const jpy = getRate('JPY', ccpJpyStr, jpyStr, 165);
    const rmb = getRate('RMB', ccpRmbStr, rmbStr, 3500);

    return {
      usdLoss: usd.buy,
      usdGain: usd.sell,
      myrLoss: myr.buy,
      myrGain: myr.sell,
      jpyLoss: jpy.buy,
      jpyGain: jpy.sell,
      rmbLoss: rmb.buy,
      rmbGain: rmb.sell,
    };
  }

  /**
   * Tính toán giá trị giao dịch từ danh sách dòng DSGD và tỷ giá
   * - Hàng hóa JPY (ví dụ TRU): Chia 100 theo quy ước niêm yết 100 Yên
   * - Hàng hóa MYR (ví dụ MPO): Tính theo tỷ giá MYR
   * - Hàng hóa RMB: Tính theo tỷ giá RMB
   * - Các hàng hóa khác: Tính theo USD
   */
  calculateTransactionValues(
    rows: ParsedRow[],
    rates: CcpExchangeRates,
    sessionDate?: string,
  ): CcpTransactionValueResult {
    const productMap = new Map<string, { lots: number; valueVnd: number; currency: 'USD' | 'MYR' | 'JPY' | 'RMB' | 'VND'; exchangeRate: number }>();
    const tvkdMap = new Map<string, { lots: number; valueVnd: number }>();
    let totalLots = 0;
    let totalValueVnd = 0;

    // Bảng tra độ lớn hợp đồng đặc thù đã kiểm chứng từ CoreCCP
    const CCP_MULTIPLIERS: Record<string, { doCao: number; defaultCurrency: 'USD' | 'VND' }> = {
      SI5CO: { doCao: 100, defaultCurrency: 'USD' },
      CP2CO: { doCao: 1000, defaultCurrency: 'USD' },
      PL1NY: { doCao: 5, defaultCurrency: 'USD' },
      GLD1:  { doCao: 10, defaultCurrency: 'USD' },
      SIV:   { doCao: 1, defaultCurrency: 'VND' },
      SIVE:  { doCao: 1, defaultCurrency: 'VND' },
      SVR3L: { doCao: 1, defaultCurrency: 'VND' },
    };

    for (const row of rows) {
      const lot = toNum(row['KL giao dịch'] ?? row['KL'] ?? row['Khối lượng'] ?? row['KL khớp'] ?? row['col13'] ?? row['col17']);
      const price = toNum(row['Giá khớp'] ?? row['Giá'] ?? row['Giá khớp trung bình'] ?? row['col14'] ?? row['col18']);
      const rawProduct = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['Mã SP'] ?? row['Hàng hóa'] ?? row['col6'] ?? 'UNKNOWN').toUpperCase();

      if (lot <= 0) continue;

      // Nhận diện mã hàng hóa gốc bằng bộ tách chuẩn CoreCCP
      const product = extractCcpBaseProduct(rawProduct);

      // Nhận diện mã TVKD
      const memberCode = toStr(row['Mã thành viên'] ?? row['TVKD'] ?? row['Mã TVKD'] ?? '');
      let tvkd = memberCode;
      if (!tvkd) {
        const maTKGD = toStr(row['Mã TKGD'] ?? row['Account'] ?? '');
        tvkd = maTKGD.length >= 3 ? maTKGD.substring(0, 3).toUpperCase() : 'OTHER';
      }
      if (/^\d{1,2}$/.test(tvkd)) {
        tvkd = tvkd.padStart(3, '0');
      }

      let currency: 'USD' | 'MYR' | 'JPY' | 'RMB' | 'VND' = 'USD';
      let rate = rates.usdGain && rates.usdGain > 10 ? rates.usdGain : 25400;
      let divisor = 1;

      // Tra cứu độ lớn doCao từ bảng chuẩn CoreCCP nếu có
      const ccpSpec = CCP_MULTIPLIERS[product];
      const doCao = ccpSpec?.doCao || 1;

      if (ccpSpec?.defaultCurrency === 'VND') {
        currency = 'VND';
        rate = 1;
      } else if (product === 'TRU' || product.startsWith('JP') || rawProduct.includes('TOCOM') || rawProduct.includes('OSE')) {
        currency = 'JPY';
        rate = rates.jpyGain && rates.jpyGain > 10 ? rates.jpyGain : 165;
        divisor = 100; // JPY niêm yết theo 100 Yên
      } else if (product === 'MPO' || rawProduct.includes('BMD')) {
        currency = 'MYR';
        rate = rates.myrGain && rates.myrGain > 10 ? rates.myrGain : 5400;
      } else if (product.startsWith('DCE') || product.startsWith('SHFE') || product.startsWith('ZCE')) {
        currency = 'RMB';
        rate = rates.rmbGain && rates.rmbGain > 10 ? rates.rmbGain : 3500;
      }

      // Giá trị tính = Lot * Price * doCao * Rate / Divisor
      const effectivePrice = price > 0 ? price : 1;
      const valueVnd = Math.round((lot * effectivePrice * doCao * rate) / divisor);

      totalLots += lot;
      totalValueVnd += valueVnd;

      // Gom nhóm theo Hàng hóa
      const currentProd = productMap.get(product) || { lots: 0, valueVnd: 0, currency, exchangeRate: rate };
      currentProd.lots += lot;
      currentProd.valueVnd += valueVnd;
      productMap.set(product, currentProd);

      // Gom nhóm theo TVKD
      const currentTvkd = tvkdMap.get(tvkd) || { lots: 0, valueVnd: 0 };
      currentTvkd.lots += lot;
      currentTvkd.valueVnd += valueVnd;
      tvkdMap.set(tvkd, currentTvkd);
    }

    const breakdownByProduct: ProductValueBreakdown[] = Array.from(productMap.entries()).map(
      ([product, data]) => ({
        product,
        lots: data.lots,
        valueVnd: data.valueVnd,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
      }),
    );

    const breakdownByTvkd: TvkdValueBreakdown[] = Array.from(tvkdMap.entries()).map(
      ([tvkd, data]) => ({
        tvkd,
        lots: data.lots,
        valueVnd: data.valueVnd,
      }),
    ).sort((a, b) => b.valueVnd - a.valueVnd);

    return {
      sessionDate: sessionDate || new Date().toISOString().split('T')[0],
      totalLots,
      totalValueVnd,
      breakdownByProduct,
      breakdownByTvkd,
      rates,
      passed: totalLots > 0 && totalValueVnd > 0,
      calculatedAt: new Date(),
    };
  }

  /**
   * Tự động quét file DSGD và tính toán thống kê Giá trị giao dịch CCP
   */
  async runAutoValueStatistics(
    targetDate?: string,
    folderPath?: string,
  ): Promise<CcpTransactionValueResult> {
    const dir = folderPath || path.join(process.cwd(), 'data', 'backup');
    const findFile = (pattern: RegExp) => {
      if (!fs.existsSync(dir)) return null;
      const files = fs.readdirSync(dir);
      const match = files.find((f) => pattern.test(f));
      return match ? path.join(dir, match) : null;
    };

    const dsgdPath = findFile(/DSGD.*\.xlsx$/i);
    const rows = dsgdPath ? parseExcelBuffer(fs.readFileSync(dsgdPath)) : [];

    const rates = await this.getCurrentExchangeRates();
    return this.calculateTransactionValues(rows, rates, targetDate);
  }
}

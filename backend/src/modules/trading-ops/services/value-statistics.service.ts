import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseExcelBuffer,
  toNum,
  toStr,
  ParsedRow,
} from '../helpers/clearing-excel.helper';

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
  currency: 'USD' | 'MYR' | 'JPY' | 'RMB';
  exchangeRate: number;
}

export interface CcpTransactionValueResult {
  sessionDate: string;
  totalLots: number;
  totalValueVnd: number;
  breakdownByProduct: ProductValueBreakdown[];
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
      const conv = item?.conversionRate
        ? Number(item.conversionRate)
        : parseFloat(ccpFallback) || parseFloat(msFallback) || defaultRate;
      const buy = item?.buyRate ? Number(item.buyRate) : conv;
      const sell = item?.sellRate ? Number(item.sellRate) : conv;
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
    const productMap = new Map<string, { lots: number; valueVnd: number; currency: 'USD' | 'MYR' | 'JPY' | 'RMB'; exchangeRate: number }>();
    let totalLots = 0;
    let totalValueVnd = 0;

    for (const row of rows) {
      const lot = toNum(row['KL giao dịch'] ?? row['KL'] ?? row['Khối lượng'] ?? row['col13'] ?? row['col17']);
      const price = toNum(row['Giá khớp'] ?? row['Giá'] ?? row['col14'] ?? row['col18']);
      const rawProduct = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['Hàng hóa'] ?? row['col6'] ?? 'UNKNOWN').toUpperCase();

      if (lot <= 0) continue;

      // Nhận diện mã hàng hóa gốc (3 ký tự đầu hoặc trước số)
      const numMatch = rawProduct.match(/\d/);
      const product = numMatch && numMatch.index ? rawProduct.substring(0, numMatch.index) : rawProduct.substring(0, 3);

      let currency: 'USD' | 'MYR' | 'JPY' | 'RMB' = 'USD';
      let rate = rates.usdGain || 25400;
      let divisor = 1;

      if (product === 'TRU' || product.startsWith('JP') || rawProduct.includes('TOCOM') || rawProduct.includes('OSE')) {
        currency = 'JPY';
        rate = rates.jpyGain || 165;
        divisor = 100; // JPY niêm yết theo 100 Yên
      } else if (product === 'MPO' || rawProduct.includes('BMD')) {
        currency = 'MYR';
        rate = rates.myrGain || 5400;
      } else if (product.startsWith('DCE') || product.startsWith('SHFE') || product.startsWith('ZCE')) {
        currency = 'RMB';
        rate = rates.rmbGain || 3500;
      }

      // Giá trị tính = Lot * Price * Rate / Divisor (nếu không có price thì nhân ước lượng lot * rate)
      const effectivePrice = price > 0 ? price : 1;
      const valueVnd = Math.round((lot * effectivePrice * rate) / divisor);

      totalLots += lot;
      totalValueVnd += valueVnd;

      const current = productMap.get(product) || { lots: 0, valueVnd: 0, currency, exchangeRate: rate };
      current.lots += lot;
      current.valueVnd += valueVnd;
      productMap.set(product, current);
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

    return {
      sessionDate: sessionDate || new Date().toISOString().split('T')[0],
      totalLots,
      totalValueVnd,
      breakdownByProduct,
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

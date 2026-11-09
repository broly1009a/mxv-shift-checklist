import { SystemSettingsService } from '../../system-settings/system-settings.service';

/**
 * Nguồn tỷ giá M-System DUY NHẤT cho toàn bộ module trading-ops.
 * Tương ứng C# Tool (config.json): ConvertExchangeRate (quy đổi) và PaymentExchangeRate1/2 (thanh toán Mua/Bán).
 *  - Tỷ giá quy đổi:  system_settings[`<ccy>_exchange_rate`]  (usd/jpy/myr/rmb)
 *  - Tỷ giá thanh toán: system_settings['ms_payment_rates'] = {"USD/VND": {buy, sell}, ...}
 * Thiếu cấu hình => throw (fail-fast), không fallback về hằng số.
 */
export type MsPaymentRates = Record<string, { buy: number; sell: number }>;

export async function getMsConversionRate(
  settingsService: SystemSettingsService,
  currency: string = 'USD',
): Promise<number> {
  const key = `${currency.toLowerCase()}_exchange_rate`;
  const raw = await settingsService.getSetting(key, '');
  const rate = parseFloat(raw);
  if (!rate || rate <= 0) {
    throw new Error(
      `Chưa cấu hình tỷ giá quy đổi M-System (${key}). Vào Cấu hình hệ thống và bấm "Đồng bộ từ M-System".`,
    );
  }
  return rate;
}

export async function getMsPaymentRates(settingsService: SystemSettingsService): Promise<MsPaymentRates> {
  const raw = await settingsService.getSetting('ms_payment_rates', '');
  if (!raw) {
    throw new Error(
      'Chưa cấu hình tỷ giá thanh toán M-System (ms_payment_rates). Vào Cấu hình hệ thống và bấm "Đồng bộ từ M-System".',
    );
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ms_payment_rates trong CSDL không phải JSON hợp lệ.');
  }
  const result: MsPaymentRates = {};
  for (const [pair, v] of Object.entries<any>(parsed || {})) {
    const buy = Number(v?.buy);
    const sell = Number(v?.sell);
    if (buy > 0 && sell > 0) result[pair] = { buy, sell };
  }
  if (!result['USD/VND']) {
    throw new Error('ms_payment_rates thiếu tỷ giá Mua/Bán hợp lệ cho nguyên tệ cơ sở USD/VND.');
  }
  return result;
}


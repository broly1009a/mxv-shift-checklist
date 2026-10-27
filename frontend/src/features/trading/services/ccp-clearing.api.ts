import { requestJson } from './api-client';
import {
  CcpClearingLogItem,
  ExchangeRatesData,
  TriggerRunResponse,
} from '../types/trading.types';

export const ccpClearingApi = {
  /**
   * Truy vấn danh sách Nhật ký Bù trừ CCP theo ngày từ Modular V2
   */
  async getCcpClearingLogs(
    tradingDate: string,
    token?: string | null,
  ): Promise<{ success: boolean; count: number; data: CcpClearingLogItem[] }> {
    return requestJson<{ success: boolean; count: number; data: CcpClearingLogItem[] }>(
      `/api/v1/ccp-clearing/logs/by-date/${encodeURIComponent(tradingDate)}`,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy chi tiết một bản ghi Nhật ký Bù trừ CCP theo ID từ Modular V2
   */
  async getCcpClearingLogById(
    id: string,
    token?: string | null,
  ): Promise<{ success: boolean; data: CcpClearingLogItem }> {
    return requestJson<{ success: boolean; data: CcpClearingLogItem }>(
      `/api/v1/ccp-clearing/logs/${encodeURIComponent(id)}`,
      { method: 'GET' },
      token,
    );
  },

  /**
   * Lấy danh sách tỷ giá đa tiền tệ hiện hành
   */
  async getExchangeRates(token?: string | null): Promise<ExchangeRatesData> {
    return requestJson<ExchangeRatesData>(
      '/api/v1/ccp-clearing/exchange-rates',
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt đồng bộ tỷ giá đa tiền tệ tự động từ M-System
   */
  async syncExchangeRates(token?: string | null): Promise<ExchangeRatesData> {
    return requestJson<ExchangeRatesData>(
      '/api/v1/ccp-clearing/sync-exchange-rates',
      { method: 'POST' },
      token,
    );
  },

  /**
   * Lấy tỷ giá USD/VND hiện hành
   */
  async getUsdRate(token?: string | null): Promise<{ success: boolean; rate: number }> {
    return requestJson<{ success: boolean; rate: number }>(
      '/api/v1/ccp-clearing/usd-rate',
      { method: 'GET' },
      token,
    );
  },

  /**
   * Kích hoạt đồng bộ tỷ giá USD/VND từ M-System
   */
  async syncUsdRate(token?: string | null): Promise<{ success: boolean; rate: number }> {
    return requestJson<{ success: boolean; rate: number }>(
      '/api/v1/ccp-clearing/sync-usd-rate',
      { method: 'POST' },
      token,
    );
  },

  /**
   * Tải riêng 3 file CoreCCP (DSGD, TTM, TTTT) và bóc tách trực tiếp số liệu
   */
  async downloadCcpMetrics(
    date?: string,
    token?: string | null,
  ): Promise<{ success: boolean; message?: string; result?: any }> {
    return requestJson<{ success: boolean; message?: string; result?: any }>(
      '/api/v1/ccp-clearing/download-ccp-metrics',
      {
        method: 'POST',
        body: JSON.stringify({ date }),
      },
      token,
    );
  },

  /**
   * Kích hoạt Macro Thống kê Khối lượng (Lot Macro)
   */
  async triggerLotMacro(token?: string | null): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/trading-ops/trigger-lot-macro',
      { method: 'POST' },
      token,
    );
  },

  /**
   * Kích hoạt Macro Thống kê Giá trị (Value Macro)
   */
  async triggerValueMacro(token?: string | null): Promise<TriggerRunResponse> {
    return requestJson<TriggerRunResponse>(
      '/api/v1/trading-ops/trigger-value-macro',
      { method: 'POST' },
      token,
    );
  },
};

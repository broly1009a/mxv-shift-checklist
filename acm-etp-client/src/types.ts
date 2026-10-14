/**
 * types.ts
 * Type definitions & Registry danh mục báo cáo hệ thống ACM ETP Exchange Management
 */

export interface IAcmCredentials {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export interface IAcmSession {
  token: string;
  username: string;
  cookies: string;
  updatedAt: string;
  expiresAt?: string;
}

export type CaptchaSolverHook = (
  imageBuffer: Buffer,
  imagePath: string
) => Promise<string>;

export interface IAcmReportDef {
  key: string;
  name: string;
  fileName: string;
  group: string;
  exportEndpoint: string;
  pageEndpoint?: string;
  method: 'GET' | 'POST';
  ext: 'xlsx' | 'xls' | 'csv';
  defaultQueryParams?: Record<string, string>;
  description?: string;
}

export interface IAcmDownloadResult {
  key: string;
  name: string;
  fileName: string;
  filePath?: string;
  sizeBytes?: number;
  durationMs?: number;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface IAcmPageQuery {
  page?: number;
  limit?: number;
  order?: string;
  orderField?: string;
  brokerid?: string;
  investorid?: string;
  direction?: string;
  instrumentid?: string;
  tradingfirmid?: string;
  orderstatus?: string;
  orderref?: string;
  ordersysid?: string;
  startTradedate?: string;
  endTradedate?: string;
  minPrice?: string;
  maxPrice?: string;
  [key: string]: any;
}

/**
 * REGISTRY DANH MỤC BÁO CÁO ACM ETP (GROUND TRUTH AUDITED)
 */
export const ACM_ETP_REPORTS_REGISTRY: Record<string, IAcmReportDef> = {
  // ─── 1. SỔ LỆNH ETP (ETP ORDERS) ───────────────────────────────────────────
  'ACM_ETP_ORDERS': {
    key: 'ACM_ETP_ORDERS',
    name: 'Sổ lệnh ACM ETP',
    fileName: 'ACM_ETP_ORDERS.xlsx',
    group: 'Quản lý Giao dịch ETP',
    exportEndpoint: '/exchange/business/tetporder/export',
    pageEndpoint: '/exchange/business/tetporder/page',
    method: 'GET',
    ext: 'xlsx',
    defaultQueryParams: {
      brokerid: '',
      investorid: '',
      direction: '',
      comboffsetflag: '',
      instrumentid: '',
      orderstatus: '',
      tradingfirmid: '',
      orderref: '',
      ordersysid: '',
    },
    description: 'Xuất toàn bộ sổ lệnh ETP (Trạng thái lệnh, khối lượng, giá đặt, tài khoản)',
  },

  // ─── 2. SỔ KHỚP LỆNH ETP (ETP TRADES) ─────────────────────────────────────
  'ACM_ETP_TRADES': {
    key: 'ACM_ETP_TRADES',
    name: 'Khớp lệnh ACM ETP (Giao dịch)',
    fileName: 'ACM_ETP_TRADES.xlsx',
    group: 'Quản lý Giao dịch ETP',
    exportEndpoint: '/exchange/business/tetptrade/export',
    pageEndpoint: '/exchange/business/tetptrade/page',
    method: 'GET',
    ext: 'xlsx',
    defaultQueryParams: {
      brokerid: '',
      investorid: '',
      direction: '',
      offsetflag: '',
      instrumentid: '',
      startTradedate: '',
      endTradedate: '',
      minPrice: '',
      maxPrice: '',
    },
    description: 'Xuất toàn bộ kết quả khớp lệnh ETP trong phiên (Số hiệu trade, giá khớp, số lượng)',
  },
};

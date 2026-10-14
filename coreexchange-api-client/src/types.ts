/**
 * types.ts
 * Types & Registry Danh mục Báo cáo Core Exchange (CE)
 * Căn cứ theo tài liệu khảo sát & đặc tả hệ thống Core Exchange (UAT / PROD)
 */

export enum CoreExchangeExportMechanism {
  /** REST API Direct Query / JSON Search */
  DIRECT_JSON_SEARCH = 'DIRECT_JSON_SEARCH',
  /** REST API Direct Binary Export (.xlsx / .csv) */
  DIRECT_BINARY_EXPORT = 'DIRECT_BINARY_EXPORT',
  /** Playwright Headless Navigation & Export (Material React Table) */
  MODAL_DOM_EXTRACTION = 'MODAL_DOM_EXTRACTION',
}

export interface ICoreExchangeCredentials {
  baseUrl?: string;
  username?: string;
  password?: string;
  clientId?: string;
  redirectUri?: string;
}

export interface ICoreExchangeAuthSession {
  baseUrl: string;
  username: string;
  sessionCookie: string;
  oauthCode?: string;
  clientId: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface ICoreExchangeReportDef {
  key: string;
  name: string;
  fileName: string;
  group: string;
  route: string;
  subTab?: string;
  fallbackRoute?: string;
  mechanism: CoreExchangeExportMechanism;
  searchCode?: string;
  defaultQueryParams?: Record<string, string>;
  description?: string;
}

export interface ICoreExchangeDownloadResult {
  key: string;
  name: string;
  fileName: string;
  filePath?: string;
  sizeBytes?: number;
  durationMs?: number;
  mechanism: CoreExchangeExportMechanism;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface ICoreExchangePageQuery {
  page?: number;
  limit?: number;
  symbol?: string;
  orderId?: string;
  tradeId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  [key: string]: any;
}

/**
 * DANH MỤC CÁC BÁO CÁO CỐT LÕI CỦA CORE EXCHANGE (GROUND TRUTH AUDITED)
 */
export const CORE_EXCHANGE_REPORTS_REGISTRY: Record<string, ICoreExchangeReportDef> = {
  // ─── 1. SỔ LỆNH TỔNG HỢP (DSL) ──────────────────────────────────────────
  'DSL': {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    fileName: 'DSL ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
    route: '/ORDERS/ORDERBOOK_ALL_ACM',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Lịch sử toàn bộ sổ lệnh liên thông ACM trên sàn Core Exchange',
  },

  // ─── 2. DANH SÁCH GIAO DỊCH KHỚP (DSGD) ─────────────────────────────────
  'DSGD': {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    fileName: 'DSGD ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Chi tiết toàn bộ các giao dịch khớp lệnh liên thông ACM trong phiên',
  },

  // ─── 3. LỆNH CHỜ KHỚP (DSLCK) ───────────────────────────────────────────
  'DSLCK': {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    fileName: 'DSLCK ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh chờ khớp',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'ORDERBOOK_ACM_WORKING',
    description: 'Danh sách các lệnh đang ở trạng thái chờ khớp (Working/Pending)',
  },

  // ─── 4. LỆNH ĐÃ KHỚP (DSLDK) ───────────────────────────────────────────
  'DSLDK': {
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE',
    fileName: 'DSLDK ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh đã khớp',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'ORDERBOOK_ACM_FILLED',
    description: 'Danh sách các lệnh đã được khớp (Partially Filled / Filled)',
  },

  // ─── 5. LỆNH HỦY (DSLH) ────────────────────────────────────────────────
  'DSLH': {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    fileName: 'DSLH ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh đã hủy',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'ORDERBOOK_ACM_CANCELLED',
    description: 'Danh sách các lệnh đã bị hủy (Cancelled / Rejected)',
  },

  // ─── 6. GIÁ THANH TOÁN (GTT) ───────────────────────────────────────────
  'GTT': {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    fileName: 'GTT ACM.xlsx',
    group: 'Quản lý sản phẩm',
    route: '/PRODUCT/SETTLEMENT',
    subTab: 'Giá thanh toán liên thông',
    fallbackRoute: '/PRODUCT/SETTLEMENT_HIST',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'SETTLEMENT_ACM',
    description: 'Bảng giá thanh toán (Settlement Price) phục vụ EOD tính PnL',
  },

  // ─── 7. DANH MỤC HÀNG HÓA (HH) ─────────────────────────────────────────
  'HH': {
    key: 'HH',
    name: 'Hàng hóa ACM',
    fileName: 'HH ACM.xlsx',
    group: 'Quản lý sản phẩm',
    route: '/PRODUCT/COMMODITY',
    fallbackRoute: '/PRODUCT/COMMODITY_ACM',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'COMMODITY_ACM',
    description: 'Danh mục hàng hóa và thông số hợp đồng giao dịch liên thông',
  },

  // ─── 8. THÔNG TIN PHIÊN TRONG NGÀY (SESSION) ───────────────────────────
  'SESSION_INFO': {
    key: 'SESSION_INFO',
    name: 'Thông tin phiên trong ngày',
    fileName: 'SESSION_INFO.xlsx',
    group: 'Quản lý phiên giao dịch',
    route: '/SESSIONMNG/SESSION_INFO',
    mechanism: CoreExchangeExportMechanism.DIRECT_JSON_SEARCH,
    searchCode: 'SESSION_INFO',
    description: 'Trạng thái phiên giao dịch trong ngày của từng mặt hàng',
  },
};

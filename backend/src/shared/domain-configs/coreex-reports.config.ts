/**
 * ============================================================================
 * CORE EXCHANGE (COREEX) REPORTS CONFIGURATION & REGISTRY
 * ============================================================================
 * 
 * Tách biệt cấu hình danh mục báo cáo CoreEX ra khỏi CoreExApiAdapter.
 * Dùng chung cho: Ingress Adapter, Scraper, Worker, Frontend, Test script.
 * 100% Ground Truth & Data-Driven: Không hardcode mã hàng hóa trong code,
 * tự động quét danh sách hàng hóa thực tế từ database sàn để tải hợp đồng.
 * Đồng bộ chuẩn kiến trúc Domain Config với VNCLEAR CoreCCP.
 */

export interface ICoreExchangeReportMapping {
  key: string;
  name?: string;
  fileName: string;
  route: string;
  searchCode: string;
  exportSearchCode?: string;
  description: string;
  parentSearchCode?: string;
  filterPayload?: Record<string, any>;
  subTab?: string;
  isDerived?: boolean;
  derivedFrom?: string;
  isHistorical?: boolean;
  group?: 'ORDERS' | 'MM' | 'POSITION' | 'PRODUCT' | 'ACCOUNT' | 'SESSION';
  phase?: 'BEFORE_1620' | 'EOD' | 'BOTH';
}

export type ICeReportMapping = ICoreExchangeReportMapping;

/**
 * DANH MỤC ENDPOINT GỐC CHUẨN CỦA CORE EXCHANGE API (LIVE HTTP 200)
 */
export const CANONICAL_COREEX_API_KEYS = [
  'DSTKGD_ACM',     // ACCOUNTS_INFO -> DSTKGD ACM.xlsx (Đồng bộ từ CCP hoặc tải trực tiếp)
  'DSGD',           // ORDERMATCH_DETAIL_ACM -> DSGD ACM CE.xlsx (Kiểu 2 Server Export)
  'DSL',            // ORDERBOOK_ACM -> DSL ACM CE.xlsx (Sổ lệnh tổng)
  'DSLCK',          // ORDERBOOK_ACM (STATUS: SS) -> DSLCK ACM CE.xlsx (Lệnh chờ khớp)
  'DSLDK',          // ORDERBOOK_ACM (STATUS: TS) -> DSLDK ACM CE.xlsx (Lệnh đã khớp)
  'DSLH',           // ORDERBOOK_ACM (STATUS: DD) -> DSLH ACM CE.xlsx (Lệnh đã hủy)
  'GTT',            // SETTLEMENT_ACM -> GTT ACM.xlsx (Giá thanh toán)
  'TTM',            // OPEN_POSITION -> TTM CE.xlsx (Vị thế chi tiết từng lệnh)
  'HH',             // COMMODITY_ACM -> HH ACM.xlsx (Hàng hóa & trích xuất hợp đồng HĐ *.xlsx)
] as const;

export type CanonicalCoreExKey = typeof CANONICAL_COREEX_API_KEYS[number];

export interface ICeDerivedRule {
  targetFileName: string;
  isDated?: boolean;
  freezeHour?: number;
  freezeMinute?: number;
  noOverwriteIfExists?: boolean;
}

/**
 * QUY TẮC NHÂN BẢN FILE PHÁI SINH (DERIVED REQUISITES) CHO CORE EXCHANGE
 */
export const COREEX_DERIVED_RULES: Record<string, ICeDerivedRule[]> = {
  DSGD: [
    { targetFileName: 'DSGD_{date}.xlsx', isDated: true },
  ],
  LSGD: [
    { targetFileName: 'LSGD_{date}.xlsx', isDated: true },
  ],
  DSL: [
    { targetFileName: 'DSL_{date}.xlsx', isDated: true },
  ],
  GTT: [
    { targetFileName: 'GTT_{date}.xlsx', isDated: true },
  ],
};

/**
 * DANH MỤC ĐẦY ĐỦ BÁO CÁO VÀ ALIAS CORE EXCHANGE
 */
export const CORE_EXCHANGE_REPORTS_REGISTRY: Record<string, ICoreExchangeReportMapping> = {
  // ── 1. TÀI KHOẢN GIAO DỊCH LIÊN THÔNG ACM ──────────────────────────────────
  DSTKGD_ACM: {
    key: 'DSTKGD_ACM',
    name: 'Danh sách tài khoản giao dịch ACM',
    fileName: 'DSTKGD ACM.xlsx',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    searchCode: 'ACCOUNTS_INFO',
    description: 'Danh sách tài khoản giao dịch liên thông ACM đồng bộ từ CCP sang CE',
    group: 'ACCOUNT',
    phase: 'EOD',
  },

  // ── 2. SỔ LỆNH & KHỚP LỆNH CE ─────────────────────────────────────────────
  DSGD: {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    fileName: 'DSGD ACM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Chi tiết toàn bộ các giao dịch khớp lệnh liên thông ACM trong phiên',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSL: {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    fileName: 'DSL ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM',
    description: 'Lịch sử toàn bộ sổ lệnh liên thông ACM trên sàn Core Exchange',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLCK: {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    fileName: 'DSLCK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM',
    filterPayload: { search: { STATUS: 'SS' } },
    subTab: 'Lệnh chờ khớp',
    description: 'Danh sách các lệnh đang ở trạng thái chờ khớp (STATUS=SS)',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLDK: {
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE',
    fileName: 'DSLDK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM',
    filterPayload: { search: { STATUS: 'TS' } },
    subTab: 'Lệnh đã khớp',
    description: 'Danh sách các lệnh đã được khớp (STATUS=TS)',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLH: {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    fileName: 'DSLH ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ACM',
    filterPayload: { search: { STATUS: 'DD' } },
    subTab: 'Lệnh đã hủy',
    description: 'Danh sách các lệnh đã bị hủy (STATUS=DD)',
    group: 'ORDERS',
    phase: 'EOD',
  },
  LSGD: {
    key: 'LSGD',
    name: 'Lịch sử khớp lệnh liên thông',
    fileName: 'LSGD ACM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_ALL_ACM',
    searchCode: 'ORDERMATCH_ALL_ACM',
    description: 'Lịch sử khớp lệnh liên thông ACM (Lịch sử T-1)',
    isHistorical: true,
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSL_SESSION: {
    key: 'DSL_SESSION',
    name: 'Danh sách lệnh trong phiên',
    fileName: 'DSL Trong Phien CE.xlsx',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK_ACM',
    description: 'Danh sách lệnh trong phiên',
    isDerived: true,
    derivedFrom: 'DSL',
    group: 'ORDERS',
    phase: 'BEFORE_1620',
  },
  DSGD_MM: {
    key: 'DSGD_MM',
    name: 'Khớp lệnh MM chi tiết',
    fileName: 'DSGD MM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_DETAIL_MM',
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Lịch sử khớp lệnh Market Maker chi tiết (Lịch sử T-1)',
    isDerived: true,
    derivedFrom: 'DSGD',
    isHistorical: true,
    group: 'MM',
    phase: 'EOD',
  },
  DSL_MM: {
    key: 'DSL_MM',
    name: 'Sổ lệnh MM tổng hợp',
    fileName: 'DSL MM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ALL_MM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Lịch sử toàn bộ sổ lệnh Market Maker (Lịch sử T-1)',
    isDerived: true,
    derivedFrom: 'DSL',
    isHistorical: true,
    group: 'MM',
    phase: 'EOD',
  },

  // ── 3. GIÁ, HÀNG HÓA & PHIÊN GIAO DỊCH ─────────────────────────────────────
  GTT: {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    fileName: 'GTT ACM.xlsx',
    route: '/PRODUCT/SETTLEMENT',
    searchCode: 'SETTLEMENT_ACM',
    parentSearchCode: 'SETTLEMENT',
    description: 'Bảng giá thanh toán liên thông ACM (Settlement Price) phục vụ EOD tính PnL',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  HH: {
    key: 'HH',
    name: 'Hàng hóa & Bước giá CE',
    fileName: 'HH ACM.xlsx',
    route: '/PRODUCT/COMMODITY_ACM',
    searchCode: 'COMMODITY_ACM',
    description: 'Danh mục hàng hóa Nano liên thông ACM',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  HD: {
    key: 'HD',
    name: 'Hợp đồng chi tiết CE',
    fileName: 'HĐ *.xlsx',
    route: '/PRODUCT/COMMODITY_ACM',
    searchCode: 'INSTRUMENTS_ACM',
    parentSearchCode: 'COMMODITY_ACM',
    description: 'Hợp đồng chi tiết các mặt hàng liên thông trên sàn Core Exchange',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  SESSION_INFO: {
    key: 'SESSION_INFO',
    name: 'Thông tin phiên trong ngày',
    fileName: 'SESSION_INFO.xlsx',
    route: '/SESSIONMNG/SESSION_INFO',
    searchCode: 'SESSION_INFO',
    description: 'Trạng thái phiên giao dịch trong ngày của từng mặt hàng',
    group: 'SESSION',
    phase: 'BOTH',
  },
  SESSION_CONFIG: {
    key: 'SESSION_CONFIG',
    name: 'Danh sách cấu hình phiên',
    fileName: 'SESSION_CONFIG.xlsx',
    route: '/SESSIONMNG/SESSION_CONFIG_ALL',
    searchCode: 'SESSION_CONFIG_ALL',
    description: 'Danh sách cấu hình các phiên giao dịch (Lịch sử T-1)',
    isHistorical: true,
    group: 'SESSION',
    phase: 'EOD',
  },

  // ── 4. VỊ THẾ & VẬN HÀNH & ĐỐI CHIẾU ─────────────────────────────────────────
  TTM: {
    key: 'TTM',
    name: 'Trạng thái mở CE',
    fileName: 'TTM CE.xlsx',
    route: '/ORDERS/OPEN_POSITION',
    searchCode: 'OPEN_POSITION',
    exportSearchCode: 'OPEN_POSITION_EXPORT',
    description: 'Vị thế mở chi tiết từng giao dịch liên thông sàn CoreEX',
    group: 'POSITION',
    phase: 'EOD',
  },
  ACM_RECON: {
    key: 'ACM_RECON',
    name: 'Đối chiếu lệnh liên thông',
    fileName: 'Doi chieu lenh ACM.xlsx',
    route: '/EOD/ACM_RECON_ORDERS',
    searchCode: 'ACM_RECON_ORDERS',
    description: 'Đối chiếu lệnh liên thông sở ACM',
    group: 'ORDERS',
    phase: 'EOD',
  },
};

/**
 * Tên alias thống nhất theo chuẩn CoreCCP (CORECCP_API_REPORTS -> COREEX_API_REPORTS)
 */
export const COREEX_API_REPORTS = CORE_EXCHANGE_REPORTS_REGISTRY;

/**
 * Tra cứu cấu hình báo cáo Core Exchange thông minh theo key, searchCode hoặc tên file (Single Source of Truth)
 */
export function resolveCoreExchangeReport(target: string): ICoreExchangeReportMapping | undefined {
  if (!target) return undefined;
  if (CORE_EXCHANGE_REPORTS_REGISTRY[target]) return CORE_EXCHANGE_REPORTS_REGISTRY[target];

  const upper = target.toUpperCase().trim();
  const cleanTarget = upper.replace(/[\s_.-]/g, '');

  return Object.values(CORE_EXCHANGE_REPORTS_REGISTRY).find((r) => {
    const cleanKey = r.key.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanSearch = r.searchCode.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanParent = r.parentSearchCode ? r.parentSearchCode.toUpperCase().replace(/[\s_.-]/g, '') : '';
    const cleanFile = r.fileName.toUpperCase().replace(/[\s_.-]/g, '');
    return (
      cleanKey === cleanTarget ||
      cleanSearch === cleanTarget ||
      cleanParent === cleanTarget ||
      cleanFile.includes(cleanTarget)
    );
  });
}

export const resolveCoreExReport = resolveCoreExchangeReport;


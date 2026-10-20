/**
 * ============================================================================
 * CORE EXCHANGE (COREEX) REPORTS CONFIGURATION & REGISTRY
 * ============================================================================
 * 
 * Tách biệt cấu hình danh mục báo cáo CoreEX ra khỏi CoreExApiAdapter.
 * Dùng chung cho: Ingress Adapter, Scraper, Worker, Frontend, Test script.
 * 100% Ground Truth & Data-Driven: Không hardcode mã hàng hóa trong code,
 * tự động quét danh sách hàng hóa thực tế từ database sàn để tải hợp đồng.
 */

export interface ICoreExchangeReportMapping {
  key: string;
  name: string;
  fileName: string;
  route: string;
  searchCode: string;
  description: string;
  parentSearchCode?: string;
  filterPayload?: Record<string, any>;
  subTab?: string;
  isDerived?: boolean;
  derivedFrom?: string;
  isHistorical?: boolean;
}

export const CANONICAL_COREEX_API_KEYS = [
  'DSGD',           // ORDERMATCH_DETAIL_ACM -> DSGD ACM CE.xlsx
  'DSL',            // ORDERBOOK_ALL_ACM -> DSL ACM CE.xlsx (Lịch sử T-1)
  'GTT',            // SETTLEMENT -> GTT ACM.xlsx
  'HH',             // COMMODITY_ACM -> HH ACM.xlsx (Hàng hóa & tự động trích xuất HĐ theo từng mã hàng hóa động)
  'SESSION_INFO',   // SESSION_INFO -> SESSION_INFO.xlsx
  'SESSION_CONFIG', // SESSION_CONFIG_ALL -> SESSION_CONFIG.xlsx (Lịch sử T-1)
  'TTM',            // OPEN_POSITION -> TTM CE.xlsx
  'ACM_RECON',      // ACM_RECON_ORDERS -> Doi chieu lenh ACM.xlsx
] as const;

export const COREEX_DERIVED_RULES: Record<string, Array<{ targetFileName: string }>> = {
  DSL: [
    { targetFileName: 'DSLDK ACM CE.xlsx' },
    { targetFileName: 'DSLCK ACM CE.xlsx' },
    { targetFileName: 'DSLH ACM CE.xlsx' },
    { targetFileName: 'DSL Trong Phien CE.xlsx' },
    { targetFileName: 'DSL MM CE.xlsx' },
  ],
  DSGD: [
    { targetFileName: 'DSGD ALL ACM CE.xlsx' },
    { targetFileName: 'DSGD MM CE.xlsx' },
  ],
};

export const CORE_EXCHANGE_REPORTS_REGISTRY: Record<string, ICoreExchangeReportMapping> = {
  // 1. Sổ lệnh & Khớp lệnh CE
  DSGD: {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    fileName: 'DSGD ACM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Chi tiết toàn bộ các giao dịch khớp lệnh liên thông ACM trong phiên',
  },
  DSL: {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    fileName: 'DSL ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ALL_ACM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Lịch sử toàn bộ sổ lệnh liên thông ACM trên sàn Core Exchange (Mặc định ngày T-1)',
    isHistorical: true,
  },
  DSLCK: {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    fileName: 'DSLCK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Danh sách các lệnh đang ở trạng thái chờ khớp',
    isDerived: true,
    derivedFrom: 'DSL',
  },
  DSLDK: {
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE',
    fileName: 'DSLDK ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Danh sách các lệnh đã được khớp',
    isDerived: true,
    derivedFrom: 'DSL',
  },
  DSLH: {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    fileName: 'DSLH ACM CE.xlsx',
    route: '/ORDERS/ORDERBOOK_ACM',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Danh sách các lệnh đã bị hủy',
    isDerived: true,
    derivedFrom: 'DSL',
  },
  DSGD_ALL: {
    key: 'DSGD_ALL',
    name: 'Danh sách khớp lệnh liên thông',
    fileName: 'DSGD ALL ACM CE.xlsx',
    route: '/ORDERS/ORDERMATCH_ALL_ACM',
    searchCode: 'ORDERMATCH_DETAIL_ACM',
    description: 'Danh sách khớp lệnh liên thông ACM (Lịch sử T-1)',
    isDerived: true,
    derivedFrom: 'DSGD',
    isHistorical: true,
  },
  DSL_SESSION: {
    key: 'DSL_SESSION',
    name: 'Danh sách lệnh trong phiên',
    fileName: 'DSL Trong Phien CE.xlsx',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK_ALL_ACM',
    description: 'Danh sách lệnh trong phiên',
    isDerived: true,
    derivedFrom: 'DSL',
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
  },

  // 2. Giá, Hàng hóa & Phiên giao dịch
  GTT: {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    fileName: 'GTT ACM.xlsx',
    route: '/PRODUCT/SETTLEMENT',
    searchCode: 'SETTLEMENT',
    description: 'Bảng giá thanh toán (Settlement Price) phục vụ EOD tính PnL',
  },
  HH: {
    key: 'HH',
    name: 'Hàng hóa & Bước giá CE',
    fileName: 'HH ACM.xlsx',
    route: '/PRODUCT/COMMODITY_ACM',
    searchCode: 'COMMODITY_ACM',
    description: 'Danh mục hàng hóa Nano liên thông ACM',
  },
  HD: {
    key: 'HD',
    name: 'Hợp đồng chi tiết CE',
    fileName: 'HĐ *.xlsx',
    route: '/PRODUCT/COMMODITY_ACM',
    searchCode: 'INSTRUMENTS_ACM',
    parentSearchCode: 'COMMODITY_ACM',
    description: 'Hợp đồng chi tiết các mặt hàng liên thông trên sàn Core Exchange',
  },
  SESSION_INFO: {
    key: 'SESSION_INFO',
    name: 'Thông tin phiên trong ngày',
    fileName: 'SESSION_INFO.xlsx',
    route: '/SESSIONMNG/SESSION_INFO',
    searchCode: 'SESSION_INFO',
    description: 'Trạng thái phiên giao dịch trong ngày của từng mặt hàng',
  },
  SESSION_CONFIG: {
    key: 'SESSION_CONFIG',
    name: 'Danh sách cấu hình phiên',
    fileName: 'SESSION_CONFIG.xlsx',
    route: '/SESSIONMNG/SESSION_CONFIG_ALL',
    searchCode: 'SESSION_CONFIG_ALL',
    description: 'Danh sách cấu hình các phiên giao dịch (Lịch sử T-1)',
    isHistorical: true,
  },

  // 3. Vị thế & Vận hành & Đối chiếu
  TTM: {
    key: 'TTM',
    name: 'Trạng thái mở CE',
    fileName: 'TTM CE.xlsx',
    route: '/ORDERS/OPEN_POSITION',
    searchCode: 'OPEN_POSITION',
    description: 'Vị thế mở liên thông sàn CoreEX',
  },
  ACM_RECON: {
    key: 'ACM_RECON',
    name: 'Đối chiếu lệnh liên thông',
    fileName: 'Doi chieu lenh ACM.xlsx',
    route: '/EOD/ACM_RECON_ORDERS',
    searchCode: 'ACM_RECON_ORDERS',
    description: 'Đối chiếu lệnh liên thông sở ACM',
  },
};

export function resolveCoreExchangeReport(target: string): ICoreExchangeReportMapping | undefined {
  if (!target) return undefined;
  if (CORE_EXCHANGE_REPORTS_REGISTRY[target]) return CORE_EXCHANGE_REPORTS_REGISTRY[target];

  const upper = target.toUpperCase().trim();
  const cleanTarget = upper.replace(/[\s_.-]/g, '');

  return Object.values(CORE_EXCHANGE_REPORTS_REGISTRY).find((r) => {
    const cleanKey = r.key.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanSearch = r.searchCode.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanFile = r.fileName.toUpperCase().replace(/[\s_.-]/g, '');
    return cleanKey === cleanTarget || cleanSearch === cleanTarget || cleanFile.includes(cleanTarget);
  });
}

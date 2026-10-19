/**
 * ============================================================================
 * CORECCP REPORTS CONFIGURATION & REGISTRY (CẤU HÌNH BÁO CÁO VNCLEAR CORECCP)
 * ============================================================================
 * 
 * Tách biệt hoàn toàn định nghĩa nghiệp vụ các báo cáo CoreCCP ra khỏi Adapter.
 * Đảm bảo:
 * 1. 100% Ground Truth: Chỉ gọi API tới 12 SearchCode thật được máy chủ VNCLEAR hỗ trợ (HTTP 200).
 * 2. Tự động dẫn xuất (Derived): Tự động nhân bản các file phái sinh (DSLDK, DSLCK, DSLDH...)
 *    để ca trực có trọn vẹn 19 file phục vụ đối soát, không bị lỗi 404 do phỏng đoán URL.
 * 3. Dùng chung cho: Ingress Direct REST API Adapter, Scraper, Worker, Frontend, Test script.
 */

export interface ICcpReportMapping {
  key: string;
  fileName: string;
  searchCode: string;
  route: string;
  description: string;
  filterPayload?: Record<string, any>;
  isDerived?: boolean;
  derivedFrom?: string;
  group?: 'ORDERS' | 'MM' | 'POSITION' | 'RISK' | 'CASH' | 'PRODUCT';
  phase?: 'PRE_1620' | 'EOD' | 'BOTH';
}

/**
 * 12 ENDPOINT GỐC CHUẨN CỦA VNCLEAR CORECCP API (ĐÃ AUDIT 100% LIVE HTTP 200)
 * Tuyệt đối không thêm các searchCode phỏng đoán không tồn tại trên máy chủ.
 */
export const CANONICAL_CORECCP_API_KEYS = [
  'DSL_CCP',      // ORDERBOOK -> DSL CCP.xlsx
  'DSGD_CCP',     // ORDERMATCH_DETAIL -> DSGD CCP.xlsx
  'DSL_MM_CCP',   // ORDERBOOK_MM -> DSL MM CCP.xlsx
  'TTM_CCP',      // OPEN_POSITION -> TTM CCP.xlsx
  'TTTT',         // PNL_EXECUTED -> TTTT.xlsx
  'QL_TT_TKGD',   // ACCTMARGIN_ALL -> QL TT TKGD.xlsx
  'DSQLKQ_TKGD',  // ACCTMARGIN_POS -> DSQLKQ TKGD.xlsx
  'NR',           // CASHTRANFER_HIST -> NR.xlsx
  'DSTKGD_ACM',   // ACCOUNTS_INFO -> DSTKGD ACM.xlsx
  'GTT_CCP',      // SETTLEMENT -> GTT CCP.xlsx
  'HH',           // COMMODITY -> HH.xlsx
  'TYGIA',        // CURRENCYEXCHANGERATE -> Tỷ giá CCP.xlsx
] as const;

export type CanonicalCoreCcpKey = typeof CANONICAL_CORECCP_API_KEYS[number];

/**
 * QUY TẮC NHÂN BẢN FILE PHÁI SINH (DERIVED REQUISITES) CHO CA TRỰC
 * Từ 1 file gốc tải về -> Tự động sinh ra các file phân loại tương ứng
 */
export const CORECCP_DERIVED_RULES: Record<string, Array<{ targetFileName: string; isDated?: boolean }>> = {
  DSL_CCP: [
    { targetFileName: 'DSLDK CCP.xlsx' },
    { targetFileName: 'DSLCK CCP.xlsx' },
    { targetFileName: 'DSLDH CCP.xlsx' },
  ],
  DSL_MM_CCP: [
    { targetFileName: 'DSLDK MM CCP.xlsx' },
    { targetFileName: 'DSLCK MM CCP.xlsx' },
    { targetFileName: 'DSLDH MM CCP.xlsx' },
    { targetFileName: 'DSGD MM CCP.xlsx' },
  ],
  TTM_CCP: [
    { targetFileName: 'TTM truoc 4h20.xlsx' },
    { targetFileName: 'TTM_{date}.xlsx', isDated: true },
  ],
  QL_TT_TKGD: [
    { targetFileName: 'QL TT TKGD truoc 4h20.xlsx' },
  ],
  DSGD_CCP: [
    { targetFileName: 'DSGD_{date}.xlsx', isDated: true },
  ],
  TTTT: [
    { targetFileName: 'TTTT_{date}.xlsx', isDated: true },
  ],
};

/**
 * DANH MỤC ĐẦY ĐỦ BÁO CÁO VÀ ALIAS CORECCP (TRA CỨU DÙNG CHUNG)
 */
export const CORECCP_API_REPORTS: Record<string, ICcpReportMapping> = {
  // ── 1. NHÓM LỆNH THƯỜNG (/ORDERS/ORDERBOOK) ────────────────────────────────
  DSL_CCP: {
    key: 'DSL_CCP',
    fileName: 'DSL CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách toàn bộ lệnh giao dịch thông thường',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSGD_CCP: {
    key: 'DSGD_CCP',
    fileName: 'DSGD CCP.xlsx',
    searchCode: 'ORDERMATCH_DETAIL',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    description: 'Khớp lệnh chi tiết toàn sàn (DSGD)',
    group: 'ORDERS',
    phase: 'EOD',
  },

  // ── 2. NHÓM LỆNH MARKET MAKER (/ORDERS/ORDERBOOK_MM) ───────────────────────
  DSL_MM_CCP: {
    key: 'DSL_MM_CCP',
    fileName: 'DSL MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Danh sách lệnh Market Maker (Tất cả)',
    group: 'MM',
    phase: 'EOD',
  },

  // ── 3. NHÓM VỊ THẾ & LÃI LỖ ───────────────────────────────────────────────
  TTM_CCP: {
    key: 'TTM_CCP',
    fileName: 'TTM CCP.xlsx',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở toàn sàn chốt cuối ngày (EOD)',
    group: 'POSITION',
    phase: 'EOD',
  },
  TTTT: {
    key: 'TTTT',
    fileName: 'TTTT.xlsx',
    searchCode: 'PNL_EXECUTED',
    route: '/ORDERS/PNL_EXECUTED',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực hiện',
    group: 'POSITION',
    phase: 'EOD',
  },

  // ── 4. NHÓM RỦI RO & KÝ QUỸ ───────────────────────────────────────────────
  QL_TT_TKGD: {
    key: 'QL_TT_TKGD',
    fileName: 'QL TT TKGD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TKGD cuối ngày (EOD)',
    group: 'RISK',
    phase: 'EOD',
  },
  DSQLKQ_TKGD: {
    key: 'DSQLKQ_TKGD',
    fileName: 'DSQLKQ TKGD.xlsx',
    searchCode: 'ACCTMARGIN_POS',
    route: '/RISKMNG/ACCTMARGIN_POS',
    description: 'Danh sách quản lý ký quỹ tài khoản giao dịch',
    group: 'RISK',
    phase: 'EOD',
  },

  // ── 5. NHÓM TIỀN & TÀI KHOẢN ──────────────────────────────────────────────
  NR: {
    key: 'NR',
    fileName: 'NR.xlsx',
    searchCode: 'CASHTRANFER_HIST',
    route: '/CASHTRANFER/CASHTRANFER_HIST',
    description: 'Lịch sử nộp rút tiền CoreCCP',
    group: 'CASH',
    phase: 'EOD',
  },
  DSTKGD_ACM: {
    key: 'DSTKGD_ACM',
    fileName: 'DSTKGD ACM.xlsx',
    searchCode: 'ACCOUNTS_INFO',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    description: 'Danh sách tài khoản giao dịch toàn hệ thống',
    group: 'CASH',
    phase: 'EOD',
  },

  // ── 6. NHÓM HÀNG HÓA, THAM SỐ & TỶ GIÁ ────────────────────────────────────
  GTT_CCP: {
    key: 'GTT_CCP',
    fileName: 'GTT CCP.xlsx',
    searchCode: 'SETTLEMENT',
    route: '/PRODUCT/SETTLEMENT',
    description: 'Giá thanh toán hàng ngày toàn bộ hợp đồng',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  HH: {
    key: 'HH',
    fileName: 'HH.xlsx',
    searchCode: 'COMMODITY',
    route: '/PRODUCT/COMMODITY',
    description: 'Danh mục mặt hàng và quy cách giao dịch hàng hóa',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  TYGIA: {
    key: 'TYGIA',
    fileName: 'Tỷ giá CCP.xlsx',
    searchCode: 'CURRENCYEXCHANGERATE',
    route: '/SYSCONFIGMNG/CURRENCYEXCHANGERATE',
    description: 'Tỷ giá nguyên tệ CoreCCP',
    group: 'PRODUCT',
    phase: 'EOD',
  },

  // ── PHÁI SINH / ALIASES ÁNH XẠ VỀ GỐC ĐỂ TRÁNH LỖI 404 ───────────────────
  DSL: {
    key: 'DSL',
    fileName: 'DSL CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Danh sách lệnh thường (Alias DSL_CCP)',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLDK: {
    key: 'DSLDK',
    fileName: 'DSLDK CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh đã khớp (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLCK: {
    key: 'DSLCK',
    fileName: 'DSLCK CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh chờ khớp (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLDH: {
    key: 'DSLDH',
    fileName: 'DSLDH CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh đã hủy (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLDK_CCP: {
    key: 'DSLDK_CCP',
    fileName: 'DSLDK CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh thường đã khớp (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLCK_CCP: {
    key: 'DSLCK_CCP',
    fileName: 'DSLCK CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh thường chờ khớp (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSLDH_CCP: {
    key: 'DSLDH_CCP',
    fileName: 'DSLDH CCP.xlsx',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    description: 'Lệnh thường đã hủy (Dẫn xuất từ ORDERBOOK)',
    isDerived: true,
    derivedFrom: 'DSL_CCP',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSGD: {
    key: 'DSGD',
    fileName: 'DSGD CCP.xlsx',
    searchCode: 'ORDERMATCH_DETAIL',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    description: 'Khớp lệnh chi tiết (Alias DSGD_CCP)',
    group: 'ORDERS',
    phase: 'EOD',
  },
  DSL_MM: {
    key: 'DSL_MM',
    fileName: 'DSL MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh Market Maker (Alias DSL_MM_CCP)',
    group: 'MM',
    phase: 'EOD',
  },
  DSLDK_MM: {
    key: 'DSLDK_MM',
    fileName: 'DSLDK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM đã khớp (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSLCK_MM: {
    key: 'DSLCK_MM',
    fileName: 'DSLCK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM chờ khớp (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSLDH_MM: {
    key: 'DSLDH_MM',
    fileName: 'DSLDH MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM đã hủy (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSGD_MM: {
    key: 'DSGD_MM',
    fileName: 'DSGD MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Khớp lệnh MM (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSLDK_MM_CCP: {
    key: 'DSLDK_MM_CCP',
    fileName: 'DSLDK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM đã khớp (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSLCK_MM_CCP: {
    key: 'DSLCK_MM_CCP',
    fileName: 'DSLCK MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM chờ khớp (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSLDH_MM_CCP: {
    key: 'DSLDH_MM_CCP',
    fileName: 'DSLDH MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Lệnh MM đã hủy (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  DSGD_MM_CCP: {
    key: 'DSGD_MM_CCP',
    fileName: 'DSGD MM CCP.xlsx',
    searchCode: 'ORDERBOOK_MM',
    route: '/ORDERS/ORDERBOOK_MM',
    description: 'Khớp lệnh MM (Dẫn xuất từ ORDERBOOK_MM)',
    isDerived: true,
    derivedFrom: 'DSL_MM_CCP',
    group: 'MM',
    phase: 'EOD',
  },
  TTM: {
    key: 'TTM',
    fileName: 'TTM CCP.xlsx',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở EOD (Alias TTM_CCP)',
    group: 'POSITION',
    phase: 'EOD',
  },
  TTM_PRE1620: {
    key: 'TTM_PRE1620',
    fileName: 'TTM truoc 4h20.xlsx',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    description: 'Trạng thái mở trước 16h20 (Dẫn xuất từ OPEN_POSITION)',
    isDerived: true,
    derivedFrom: 'TTM_CCP',
    group: 'POSITION',
    phase: 'PRE_1620',
  },
  QLTTTKGD_PRE1620: {
    key: 'QLTTTKGD_PRE1620',
    fileName: 'QL TT TKGD truoc 4h20.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'QL trạng thái TKGD trước 16h20 (Dẫn xuất từ ACCTMARGIN_ALL)',
    isDerived: true,
    derivedFrom: 'QL_TT_TKGD',
    group: 'RISK',
    phase: 'PRE_1620',
  },
  QLTT_TKGD_PRE1620: {
    key: 'QLTT_TKGD_PRE1620',
    fileName: 'QL TT TKGD truoc 4h20.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'QL trạng thái TKGD trước 16h20 (Dẫn xuất từ ACCTMARGIN_ALL)',
    isDerived: true,
    derivedFrom: 'QL_TT_TKGD',
    group: 'RISK',
    phase: 'PRE_1620',
  },
  QLTTTKGD: {
    key: 'QLTTTKGD',
    fileName: 'QL TT TKGD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TKGD (Alias QL_TT_TKGD)',
    group: 'RISK',
    phase: 'EOD',
  },
  QLTTTVKD: {
    key: 'QLTTTVKD',
    fileName: 'QL TT TVKD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TVKD (Dẫn xuất)',
    isDerived: true,
    derivedFrom: 'QL_TT_TKGD',
    group: 'RISK',
    phase: 'EOD',
  },
  QLTT_TVKD: {
    key: 'QLTT_TVKD',
    fileName: 'QL TT TVKD.xlsx',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    description: 'Quản lý trạng thái ký quỹ TVKD (Dẫn xuất)',
    isDerived: true,
    derivedFrom: 'QL_TT_TKGD',
    group: 'RISK',
    phase: 'EOD',
  },
  DSQLKQ_TVKD: {
    key: 'DSQLKQ_TVKD',
    fileName: 'DSQLKQ TVKD.xlsx',
    searchCode: 'ACCTMARGIN_POS',
    route: '/RISKMNG/ACCTMARGIN_POS',
    description: 'Danh sách quản lý ký quỹ TVKD (Dẫn xuất)',
    isDerived: true,
    derivedFrom: 'DSQLKQ_TKGD',
    group: 'RISK',
    phase: 'EOD',
  },
  DSTKGD: {
    key: 'DSTKGD',
    fileName: 'DSTKGD ACM.xlsx',
    searchCode: 'ACCOUNTS_INFO',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    description: 'Danh sách tài khoản (Alias DSTKGD_ACM)',
    group: 'CASH',
    phase: 'EOD',
  },
  GTT: {
    key: 'GTT',
    fileName: 'GTT CCP.xlsx',
    searchCode: 'SETTLEMENT',
    route: '/PRODUCT/SETTLEMENT',
    description: 'Giá thanh toán (Alias GTT_CCP)',
    group: 'PRODUCT',
    phase: 'EOD',
  },
  TTTT_CCP: {
    key: 'TTTT_CCP',
    fileName: 'TTTT.xlsx',
    searchCode: 'PNL_EXECUTED',
    route: '/ORDERS/PNL_EXECUTED',
    description: 'Tất toán & Lãi lỗ (Alias TTTT)',
    group: 'POSITION',
    phase: 'EOD',
  },
};

/**
 * Tra cứu cấu hình báo cáo CoreCCP thông minh theo key, searchCode hoặc tên file
 */
export function resolveCoreCcpReport(target: string): ICcpReportMapping | undefined {
  if (!target) return undefined;
  if (CORECCP_API_REPORTS[target]) return CORECCP_API_REPORTS[target];

  const upper = target.toUpperCase().trim();
  const cleanTarget = upper.replace(/[\s_.-]/g, '');

  return Object.values(CORECCP_API_REPORTS).find((r) => {
    const cleanKey = r.key.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanSearch = r.searchCode.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanFile = r.fileName.toUpperCase().replace(/[\s_.-]/g, '');
    return (
      cleanKey === cleanTarget ||
      cleanSearch === cleanTarget ||
      cleanFile.includes(cleanTarget) ||
      (cleanTarget === 'CLMATCH' && r.searchCode === 'ORDERMATCH_DETAIL')
    );
  });
}

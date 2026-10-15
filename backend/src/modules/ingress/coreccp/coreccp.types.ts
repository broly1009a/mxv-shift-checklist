/**
 * ============================================================================
 * CORECCP.TYPES.TS
 * ============================================================================
 * Định nghĩa Type, Interface, Enum và Registry danh mục 25 Báo cáo Maker CoreCCP.
 * Thiết kế cho kiến trúc Modular Ingress Client độc lập.
 * ============================================================================
 */

export enum CcpExportMechanism {
  /** Kiểu 1: Search API với pageSize 200,000 -> Nhận full JSON -> Render Excel */
  DIRECT_JSON_SEARCH = 'DIRECT_JSON_SEARCH',
  /** Kiểu 2: Server-side Export (POST /ccp/export/create -> Socket.IO -> Download ID) */
  SERVER_SIDE_EXPORT = 'SERVER_SIDE_EXPORT',
  /** Kiểu 3: Modal UI / DOM extraction (Cần Playwright hoặc API con) */
  MODAL_DOM_EXTRACTION = 'MODAL_DOM_EXTRACTION',
}

export interface ICcpCredentials {
  url?: string;
  username: string;
  password?: string;
}

export interface ICcpAuthSession {
  accessToken: string;
  sessionCookie: string;
  userId: number;
  username: string;
  expiresAt: number; // Unix timestamp
  rawJwtPayload?: any;
}

export interface ICcpReportDef {
  id: number;
  key: string;
  fileName: string;
  group: string;
  route: string;
  searchCode?: string;
  mechanism: CcpExportMechanism;
  tab?: string;
  contractCode?: string;
  filterPayload?: Record<string, any>;
  phase?: 'pre1620' | 'eod' | 'all';
  description?: string;
}

export interface ICcpExportCreatePayload {
  searchcode: string;
  search: Record<string, any>;
  filter: Record<string, any>;
  orderBy: Record<string, any>;
  page: { pageIndex: number; pageSize: number };
  exptype: 'XLSX' | 'CSV';
  fekey: string;
}

export interface ICcpExportNotification {
  reportId: number | string;
  fekey: string;
  fileName?: string;
  status: 'SUCCESS' | 'COMPLETED' | 'FAILED' | 'ERROR';
  rawMessage?: any;
}

export interface ICcpDownloadResult {
  success: boolean;
  fileName: string;
  filePath?: string;
  buffer?: Buffer;
  fileSizeBytes: number;
  mechanism: CcpExportMechanism;
  durationMs: number;
  error?: string;
}

export interface ICcpBatchDownloadProgress {
  total: number;
  completed: number;
  failed: number;
  currentReport?: string;
  results: ICcpDownloadResult[];
}

/**
 * DANH MỤC 25 FILE BÁO CÁO THỰC TẾ CỦA MAKER CORECCP
 * Được thẩm định và chuẩn hóa 100% dựa trên hệ thống thực tế (Ground Truth)
 */
export const CORECCP_25_MAKER_REPORTS: ICcpReportDef[] = [
  // ─── NHÓM 1: SỔ LỆNH & KHỚP LỆNH THƯỜNG (5 File) ─────────────────────────
  {
    id: 1,
    key: 'DSL_CCP',
    fileName: 'DSL CCP.xlsx',
    group: 'Lệnh & Khớp lệnh',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Tất cả',
    description: 'Danh sách toàn bộ lệnh giao dịch thông thường',
  },
  {
    id: 2,
    key: 'DSLDK_CCP',
    fileName: 'DSLDK CCP.xlsx',
    group: 'Lệnh & Khớp lệnh',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh đã khớp',
    filterPayload: { orderStatus: 'FILLED' },
    description: 'Danh sách lệnh thông thường đã khớp',
  },
  {
    id: 3,
    key: 'DSLCK_CCP',
    fileName: 'DSLCK CCP.xlsx',
    group: 'Lệnh & Khớp lệnh',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh chờ khớp',
    filterPayload: { orderStatus: 'PENDING' },
    description: 'Danh sách lệnh thông thường đang chờ khớp',
  },
  {
    id: 4,
    key: 'DSLDH_CCP',
    fileName: 'DSLDH CCP.xlsx',
    group: 'Lệnh & Khớp lệnh',
    route: '/ORDERS/ORDERBOOK',
    searchCode: 'ORDERBOOK',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh đã hủy',
    filterPayload: { orderStatus: 'CANCELLED' },
    description: 'Danh sách lệnh thông thường đã bị hủy',
  },
  {
    id: 5,
    key: 'DSGD_CCP',
    fileName: 'DSGD CCP.xlsx',
    group: 'Lệnh & Khớp lệnh',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    searchCode: 'ORDERMATCH_DETAIL',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    description: 'Khớp lệnh chi tiết toàn sàn (DSGD)',
  },

  // ─── NHÓM 2: SỔ LỆNH & KHỚP LỆNH MM (5 File) ──────────────────────────────
  {
    id: 6,
    key: 'DSL_MM_CCP',
    fileName: 'DSL MM CCP.xlsx',
    group: 'Lệnh & Khớp lệnh MM',
    route: '/ORDERS/ORDERBOOK_MM',
    searchCode: 'ORDERBOOK_MM',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Tất cả',
    description: 'Danh sách toàn bộ lệnh tạo lập thị trường (MM)',
  },
  {
    id: 7,
    key: 'DSLDK_MM_CCP',
    fileName: 'DSLDK MM CCP.xlsx',
    group: 'Lệnh & Khớp lệnh MM',
    route: '/ORDERS/ORDERBOOK_MM',
    searchCode: 'ORDERBOOK_MM',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh đã khớp',
    filterPayload: { orderStatus: 'FILLED' },
    description: 'Danh sách lệnh MM đã khớp',
  },
  {
    id: 8,
    key: 'DSLCK_MM_CCP',
    fileName: 'DSLCK MM CCP.xlsx',
    group: 'Lệnh & Khớp lệnh MM',
    route: '/ORDERS/ORDERBOOK_MM',
    searchCode: 'ORDERBOOK_MM',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh chờ khớp',
    filterPayload: { orderStatus: 'PENDING' },
    description: 'Danh sách lệnh MM đang chờ khớp',
  },
  {
    id: 9,
    key: 'DSLDH_MM_CCP',
    fileName: 'DSLDH MM CCP.xlsx',
    group: 'Lệnh & Khớp lệnh MM',
    route: '/ORDERS/ORDERBOOK_MM',
    searchCode: 'ORDERBOOK_MM',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    tab: 'Lệnh đã hủy',
    filterPayload: { orderStatus: 'CANCELLED' },
    description: 'Danh sách lệnh MM đã hủy',
  },
  {
    id: 10,
    key: 'DSGD_MM_CCP',
    fileName: 'DSGD MM CCP.xlsx',
    group: 'Lệnh & Khớp lệnh MM',
    route: '/ORDERS/ORDERBOOK_ALL_MM',
    searchCode: 'ORDERBOOK_ALL_MM',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    description: 'Giao dịch khớp lệnh tạo lập thị trường (MM)',
  },

  // ─── NHÓM 3: VỊ THẾ & LÃI LỖ (3 File) ────────────────────────────────────
  {
    id: 11,
    key: 'TTM_TRUOC_4H20',
    fileName: 'TTM truoc 4h20.xlsx',
    group: 'Vị thế & Lãi lỗ',
    route: '/ORDERS/OPEN_POSITION',
    searchCode: 'OPEN_POSITION',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    phase: 'pre1620',
    description: 'Trạng thái mở chụp trước mốc 16:20',
  },
  {
    id: 12,
    key: 'TTM_CCP',
    fileName: 'TTM CCP.xlsx',
    group: 'Vị thế & Lãi lỗ',
    route: '/ORDERS/OPEN_POSITION',
    searchCode: 'OPEN_POSITION',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    phase: 'eod',
    description: 'Trạng thái mở toàn sàn chốt cuối ngày (EOD)',
  },
  {
    id: 13,
    key: 'TTTT',
    fileName: 'TTTT.xlsx',
    group: 'Vị thế & Lãi lỗ',
    route: '/ORDERS/PNL_EXECUTED',
    searchCode: 'PNL_EXECUTED',
    mechanism: CcpExportMechanism.MODAL_DOM_EXTRACTION,
    tab: 'Lịch sử tất toán',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực hiện',
  },

  // ─── NHÓM 4: RỦI RO & QUẢN LÝ KÝ QUỸ (5 File) ────────────────────────────
  {
    id: 14,
    key: 'QL_TT_TKGD_TRUOC_4H20',
    fileName: 'QL TT TKGD truoc 4h20.xlsx',
    group: 'Rủi ro & Ký quỹ',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    searchCode: 'ACCTMARGIN_ALL',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    phase: 'pre1620',
    tab: 'Danh sách trạng thái TKGD',
    description: 'Quản lý trạng thái ký quỹ TKGD trước 16:20',
  },
  {
    id: 15,
    key: 'QL_TT_TKGD',
    fileName: 'QL TT TKGD.xlsx',
    group: 'Rủi ro & Ký quỹ',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    searchCode: 'ACCTMARGIN_ALL',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    phase: 'eod',
    tab: 'Danh sách trạng thái TKGD',
    description: 'Quản lý trạng thái ký quỹ TKGD cuối ngày (EOD)',
  },
  {
    id: 16,
    key: 'QL_TT_TVKD',
    fileName: 'QL TT TVKD.xlsx',
    group: 'Rủi ro & Ký quỹ',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    searchCode: 'ACCTMARGIN_ALL',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    tab: 'Danh sách trạng thái TKTVKD',
    description: 'Quản lý trạng thái ký quỹ Thành viên kinh doanh (TVKD)',
  },
  {
    id: 17,
    key: 'DSQLKQ_TKGD',
    fileName: 'DSQLKQ TKGD.xlsx',
    group: 'Rủi ro & Ký quỹ',
    route: '/RISKMNG/ACCTMARGIN_POS',
    searchCode: 'ACCTMARGIN_POS',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    tab: 'Danh sách ký quỹ TKGD',
    description: 'Danh sách quản lý ký quỹ tài khoản giao dịch',
  },
  {
    id: 18,
    key: 'DSQLKQ_TVKD',
    fileName: 'DSQLKQ TVKD.xlsx',
    group: 'Rủi ro & Ký quỹ',
    route: '/RISKMNG/ACCTMARGIN_POS',
    searchCode: 'MEMBERMARGIN_POS',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    tab: 'Danh sách ký quỹ TKTVKD',
    description: 'Danh sách quản lý ký quỹ Thành viên kinh doanh',
  },

  // ─── NHÓM 5: NỘP RÚT TIỀN & TÀI KHOẢN (2 File) ───────────────────────────
  {
    id: 19,
    key: 'NR',
    fileName: 'NR.xlsx',
    group: 'Nộp rút & Tài khoản',
    route: '/CASHTRANFER/CASHTRANFER_HIST',
    searchCode: 'CASHTRANFER_HIST',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    description: 'Lịch sử nộp rút và chuyển khoản tiền ký quỹ',
  },
  {
    id: 20,
    key: 'DSTKGD_ACM',
    fileName: 'DSTKGD ACM.xlsx',
    group: 'Nộp rút & Tài khoản',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    searchCode: 'ACCOUNTS_INFO',
    mechanism: CcpExportMechanism.SERVER_SIDE_EXPORT,
    description: 'Danh sách tài khoản giao dịch toàn hệ thống',
  },

  // ─── NHÓM 6: HÀNG HÓA, HỢP ĐỒNG & GIÁ THANH TOÁN (5 File) ────────────────
  {
    id: 21,
    key: 'GTT_CCP',
    fileName: 'GTT CCP.xlsx',
    group: 'Hàng hóa & Giá',
    route: '/PRODUCT/SETTLEMENT',
    searchCode: 'SETTLEMENT',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    description: 'Giá thanh toán hàng ngày toàn bộ hợp đồng',
  },
  {
    id: 22,
    key: 'HH',
    fileName: 'HH.xlsx',
    group: 'Hàng hóa & Giá',
    route: '/PRODUCT/COMMODITY',
    searchCode: 'COMMODITY',
    mechanism: CcpExportMechanism.DIRECT_JSON_SEARCH,
    description: 'Danh mục mặt hàng và quy cách giao dịch hàng hóa',
  },
  {
    id: 23,
    key: 'HD_CP2CO',
    fileName: 'HĐ CP2CO.xlsx',
    group: 'Hàng hóa & Giá',
    route: '/PRODUCT/COMMODITY',
    mechanism: CcpExportMechanism.MODAL_DOM_EXTRACTION,
    contractCode: 'CP2CO',
    description: 'Danh mục hợp đồng chi tiết mã CP2CO (Dầu cọ Nano)',
  },
  {
    id: 24,
    key: 'HD_PL1NY',
    fileName: 'HĐ PL1NY.xlsx',
    group: 'Hàng hóa & Giá',
    route: '/PRODUCT/COMMODITY',
    mechanism: CcpExportMechanism.MODAL_DOM_EXTRACTION,
    contractCode: 'PL1NY',
    description: 'Danh mục hợp đồng chi tiết mã PL1NY (Bạch kim Nano)',
  },
  {
    id: 25,
    key: 'HD_SI5CO',
    fileName: 'HĐ SI5CO.xlsx',
    group: 'Hàng hóa & Giá',
    route: '/PRODUCT/COMMODITY',
    mechanism: CcpExportMechanism.MODAL_DOM_EXTRACTION,
    contractCode: 'SI5CO',
    description: 'Danh mục hợp đồng chi tiết mã SI5CO (Bạc Nano)',
  },
];

/**
 * ============================================================================
 * M-SYSTEM (MS) REPORTS CONFIGURATION & REGISTRY (CẤU HÌNH BÁO CÁO M-SYSTEM)
 * ============================================================================
 * 
 * Tách biệt cấu hình danh mục báo cáo M-System ra khỏi MsApiAdapter.
 * Dùng chung cho: Ingress Direct REST API Adapter, Scraper, Worker, Frontend.
 */

export interface IMsReportDef {
  key: string;
  name: string;
  fileName: string;
  group: string;
  endpoint: string;
  method: 'GET' | 'POST';
  ext: 'xlsx' | 'csv';
  queryParams?: Record<string, string>;
  description?: string;
  isDerived?: boolean;
}

/**
 * DANH MỤC 19 BÁO CÁO M-SYSTEM CHUẨN XÁC 100% (GROUND TRUTH AUDITED)
 */
export const CANONICAL_MS_KEYS = [
  'NKTTHT',
  'DSTKGD-Futures',
  'DSTKGD-Spread',
  'DSTKGD-LME',
  'DSTKGD-ACM',
  'TLKQHSKQ',
  'NR',
  'DSTrader',
  'DSLDK',
  'DSLCK',
  'DSLH',
  'DSLK',
  'DSGD',
  'TTM',
  'TTTT',
  'TTCDH',
  'DSQLKQ',
  'QLTKGD',
  'QLTKGDAmKQ',
  'Markettruoc6h',
] as const;

export type CanonicalMsKey = typeof CANONICAL_MS_KEYS[number];

export const MS_REPORTS_REGISTRY: Record<string, IMsReportDef> = {
  // 1. NHẬT KÝ THAO TÁC HỆ THỐNG
  'NKTTHT': {
    key: 'NKTTHT',
    name: 'Nhật ký thao tác hệ thống',
    fileName: 'NKTTHT.xlsx',
    group: 'QL Hệ thống',
    endpoint: '/approval/admin/activities/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(datetime)' },
    description: 'Nhật ký thao tác của người dùng trên toàn hệ thống M-System',
  },

  // 2. DANH SÁCH TÀI KHOẢN GIAO DỊCH
  'DSTKGD-Futures': {
    key: 'DSTKGD-Futures',
    name: 'Danh sách TKGD Futures',
    fileName: 'DSTKGD-Futures.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'NULL' },
    description: 'Danh sách tài khoản giao dịch Futures thông thường',
  },
  'DSTKGD-Spread': {
    key: 'DSTKGD-Spread',
    name: 'Danh sách TKGD Spread',
    fileName: 'DSTKGD-Spread.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'S' },
    description: 'Danh sách tài khoản giao dịch Spreads',
  },
  'DSTKGD-LME': {
    key: 'DSTKGD-LME',
    name: 'Danh sách TKGD LME',
    fileName: 'DSTKGD-LME.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'LME' },
    description: 'Danh sách tài khoản giao dịch LME',
  },
  'DSTKGD-ACM': {
    key: 'DSTKGD-ACM',
    name: 'Danh sách TKGD ACM',
    fileName: 'DSTKGD-ACM.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'subInvestorType[eq]': 'ACM' },
    description: 'Danh sách tài khoản giao dịch ACM',
  },

  // 3. THIẾT LẬP KÝ QUỸ & NỘP RÚT TIỀN
  'TLKQHSKQ': {
    key: 'TLKQHSKQ',
    name: 'Thiết lập quan hệ số ký quỹ',
    fileName: 'TLKQHSKQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/margin-ratio-multiplier/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(createdDate)' },
    description: 'Bảng thiết lập hệ số ký quỹ và tỷ lệ ký quỹ theo tài khoản',
  },
  'TLQHSKQ': {
    key: 'TLQHSKQ',
    name: 'Thiết lập quan hệ số ký quỹ (Alias)',
    fileName: 'TLKQHSKQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/margin-ratio-multiplier/investors/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(createdDate)' },
    description: 'Bảng thiết lập hệ số ký quỹ và tỷ lệ ký quỹ theo tài khoản (Alias)',
  },
  'NR': {
    key: 'NR',
    name: 'Danh sách nộp rút tiền',
    fileName: 'NR.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/investors/marginTransactionHistory/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Lịch sử giao dịch tiền, nộp rút tiền ký quỹ tài khoản',
  },
  'DSTrader': {
    key: 'DSTrader',
    name: 'Danh sách Trader',
    fileName: 'DSTrader.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/am/admin/traders/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { sort_by: 'desc(createdDate)' },
    description: 'Danh sách quản lý Trader trên hệ thống',
  },

  // 4. SỔ LỆNH & KHỚP LỆNH
  'DSLDK': {
    key: 'DSLDK',
    name: 'Danh sách lệnh đã khớp',
    fileName: 'DSLDK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'PARTIALLY_FILLED,FILLED' },
    description: 'Danh sách lệnh giao dịch đã khớp một phần hoặc toàn bộ',
  },
  'DSLCK': {
    key: 'DSLCK',
    name: 'Danh sách lệnh chờ khớp',
    fileName: 'DSLCK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'WORKING' },
    description: 'Danh sách lệnh giao dịch đang chờ khớp trên sàn',
  },
  'DSLH': {
    key: 'DSLH',
    name: 'Danh sách lệnh hủy',
    fileName: 'DSLH.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { 'status[in]': 'CANCELLED' },
    description: 'Danh sách lệnh giao dịch đã bị hủy',
  },
  'DSLK': {
    key: 'DSLK',
    name: 'Danh sách lệnh khác',
    fileName: 'DSLK.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/order/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách lệnh giao dịch khác',
  },
  'DSGD': {
    key: 'DSGD',
    name: 'Danh sách giao dịch',
    fileName: 'DSGD.xlsx',
    group: 'QL Giao dịch',
    endpoint: '/transaction/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Khớp lệnh chi tiết toàn sàn trong phiên',
  },

  // 5. TRẠNG THÁI VỊ THẾ & TẤT TOÁN
  'TTM': {
    key: 'TTM',
    name: 'Trạng thái mở',
    fileName: 'TTM.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/open/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái vị thế mở của toàn bộ tài khoản nhà đầu tư',
  },
  'TTTT': {
    key: 'TTTT',
    name: 'Trạng thái tất toán',
    fileName: 'TTTT.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settle/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán vị thế và lãi lỗ thực tế trong phiên',
  },
  'TTCDH': {
    key: 'TTCDH',
    name: 'Trạng thái tất toán chờ đáo hạn LME',
    fileName: 'TTCDH.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/position/admin/settleLME/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Trạng thái tất toán chờ đáo hạn các hợp đồng LME',
  },

  // 6. QUẢN LÝ KÝ QUỸ & TÀI KHOẢN ÂM
  'DSQLKQ': {
    key: 'DSQLKQ',
    name: 'Danh sách quản lý ký quỹ',
    fileName: 'DSQLKQ.xlsx',
    group: 'QL Trạng thái',
    endpoint: '/margin/admin/list/excel',
    method: 'GET',
    ext: 'xlsx',
    queryParams: { limit: '20', offset: '0' },
    description: 'Danh sách quản lý ký quỹ tài khoản',
  },
  'QLTKGD': {
    key: 'QLTKGD',
    name: 'Quản lý tài khoản giao dịch',
    fileName: 'QLTKGD.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/margin/admin/status/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Quản lý trạng thái ký quỹ tài khoản giao dịch',
  },
  'QLTKGDAmKQ': {
    key: 'QLTKGDAmKQ',
    name: 'Quản lý TKGD âm ký quỹ',
    fileName: 'QLTKGDAmKQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/margin/admin/status/negative/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách tài khoản giao dịch rơi vào tình trạng âm ký quỹ',
  },
  'QLTKGD âm KQ': {
    key: 'QLTKGD âm KQ',
    name: 'Quản lý TKGD âm ký quỹ (Alias)',
    fileName: 'QLTKGDAmKQ.xlsx',
    group: 'QL Khách hàng',
    endpoint: '/margin/admin/status/negative/excel',
    method: 'GET',
    ext: 'xlsx',
    description: 'Danh sách tài khoản giao dịch rơi vào tình trạng âm ký quỹ (Alias)',
  },

  // 7. BẢNG GIÁ MARKET TRƯỚC 6H
  'Markettruoc6h': {
    key: 'Markettruoc6h',
    name: 'Báo cáo Market trước 6h (Bảng giá)',
    fileName: 'market truoc 6h.csv',
    group: 'QL Giao dịch',
    endpoint: '/market/priceList',
    method: 'GET',
    ext: 'csv',
    description: 'Bảng giá thị trường toàn sàn bao gồm Giá khớp và Giá thanh toán',
  },
  'market': {
    key: 'Markettruoc6h',
    name: 'Báo cáo Market trước 6h (Alias)',
    fileName: 'market truoc 6h.csv',
    group: 'QL Giao dịch',
    endpoint: '/market/priceList',
    method: 'GET',
    ext: 'csv',
    description: 'Bảng giá thị trường toàn sàn (Alias)',
  },
  'market.csv': {
    key: 'Markettruoc6h',
    name: 'Báo cáo Market trước 6h (Alias)',
    fileName: 'market truoc 6h.csv',
    group: 'QL Giao dịch',
    endpoint: '/market/priceList',
    method: 'GET',
    ext: 'csv',
    description: 'Bảng giá thị trường toàn sàn (Alias)',
  },
  'market truoc 6h': {
    key: 'Markettruoc6h',
    name: 'Báo cáo Market trước 6h (Alias)',
    fileName: 'market truoc 6h.csv',
    group: 'QL Giao dịch',
    endpoint: '/market/priceList',
    method: 'GET',
    ext: 'csv',
    description: 'Bảng giá thị trường toàn sàn (Alias)',
  },
};

/**
 * Tra cứu cấu hình báo cáo M-System thông minh theo key hoặc tên file
 */
export function resolveMsReport(target: string): IMsReportDef | undefined {
  if (!target) return undefined;
  if (MS_REPORTS_REGISTRY[target]) return MS_REPORTS_REGISTRY[target];

  const upper = target.toUpperCase().trim();
  const cleanTarget = upper.replace(/[\s_.-]/g, '');

  return Object.values(MS_REPORTS_REGISTRY).find((r) => {
    const cleanKey = r.key.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanFile = r.fileName.toUpperCase().replace(/[\s_.-]/g, '');
    return cleanKey === cleanTarget || cleanFile.includes(cleanTarget);
  });
}

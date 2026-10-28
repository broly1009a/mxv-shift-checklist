/**
 * required-files.constant.ts
 *
 * Danh mục tệp chuẩn bắt buộc và mẫu nhận diện (Regex Patterns)
 * dùng cho công tác kiểm tra, thẩm định tính đầy đủ của thư mục sao lưu (File Audit).
 *
 * Đặt tại src/shared/constants để tuân thủ Single Responsibility Principle (SRP)
 * và cho phép các phân hệ khác (Ingress, TradingOps, ChecklistHub, Dashboard) dùng chung.
 */

export interface RequiredMsFileDefinition {
  key: string;
  filename: string;
  patterns?: RegExp[];
}

export interface RequiredCcpCeFileDefinition {
  key: string;
  name: string;
  filename: string;
  patterns: RegExp[];
  optional?: boolean;
}

// ── 1. M-SYSTEM (20 BÁO CÁO CỐT LÕI) ──────────────────────────────────────────
export const REQUIRED_MS_FILES: RequiredMsFileDefinition[] = [
  { key: 'DSGD', filename: 'DSGD.xlsx' },
  { key: 'DSLCK', filename: 'DSLCK.xlsx' },
  { key: 'DSLDK', filename: 'DSLDK.xlsx' },
  { key: 'DSLH', filename: 'DSLH.xlsx' },
  { key: 'DSLK', filename: 'DSLK.xlsx' },
  { key: 'DSQLKQ', filename: 'DSQLKQ.xlsx' },
  { key: 'DSTKGD-ACM', filename: 'DSTKGD-ACM.xlsx' },
  { key: 'DSTKGD-Futures', filename: 'DSTKGD-Futures.xlsx' },
  { key: 'DSTKGD-LME', filename: 'DSTKGD-LME.xlsx' },
  { key: 'DSTKGD-Spread', filename: 'DSTKGD-Spread.xlsx' },
  { key: 'DSTrader', filename: 'DSTrader.xlsx' },
  { key: 'Markettruoc6h', filename: 'market truoc 6h.csv', patterns: [/market.*truoc.*6.*h/i] },
  { key: 'NKTTHT', filename: 'NKTTHT.xlsx', patterns: [/^nktt?ht\./i] },
  { key: 'NR', filename: 'NR.xlsx' },
  { key: 'QLTKGD', filename: 'QLTKGD.xlsx' },
  { key: 'QLTKGDAmKQ', filename: 'QLTKGDAmKQ.xlsx', patterns: [/qltkgd.*am.*kq/i, /qltkgdamkq/i] },
  { key: 'TLKQHSKQ', filename: 'TLKQHSKQ.xlsx', patterns: [/tlk?qhskq/i] },
  { key: 'TTCDH', filename: 'TTCDH.xlsx' },
  { key: 'TTM', filename: 'TTM.xlsx' },
  { key: 'TTTT', filename: 'TTTT.xlsx' },
];

// ── 2. CORECCP (25 BÁO CÁO TOÀN THỊ TRƯỜNG VNCLEAR) ──────────────────────────
export const REQUIRED_CCP_FILES: RequiredCcpCeFileDefinition[] = [
  // ── Nhóm Lệnh thường ──────────────────────────────────────────────────────
  {
    key: 'DSL',
    name: 'Danh sách lệnh (Tất cả)',
    filename: 'DSL CCP.xlsx',
    patterns: [/^dsl\s+ccp/i, /^dsl\b/i, /orderbook/i],
  },
  {
    key: 'DSLDK',
    name: 'Danh sách lệnh đã khớp',
    filename: 'DSLDK CCP.xlsx',
    patterns: [/^dsldk\s+ccp/i, /dsldk/i, /lenh.*da.*khop/i],
  },
  {
    key: 'DSLCK',
    name: 'Danh sách lệnh chờ khớp',
    filename: 'DSLCK CCP.xlsx',
    patterns: [/^dslck\s+ccp/i, /dslck/i, /lenh.*cho.*khop/i],
  },
  {
    key: 'DSLDH',
    name: 'Danh sách lệnh đã hủy',
    filename: 'DSLDH CCP.xlsx',
    patterns: [/^dsldh\s+ccp/i, /dsldh/i, /lenh.*da.*huy/i],
  },
  {
    key: 'DSGD',
    name: 'Danh sách giao dịch',
    filename: 'DSGD CCP.xlsx',
    patterns: [/^dsgd\s+ccp/i, /^dsgd\b/i, /ordermatch/i],
  },

  // ── Nhóm Lệnh Market Maker ───────────────────────────────────────────────
  {
    key: 'DSL_MM',
    name: 'Danh sách lệnh MM',
    filename: 'DSL MM CCP.xlsx',
    patterns: [/dsl.*mm/i, /orderbook_mm/i],
  },
  {
    key: 'DSLDK_MM',
    name: 'Lệnh đã khớp MM',
    filename: 'DSLDK MM CCP.xlsx',
    patterns: [/dsldk.*mm/i],
  },
  {
    key: 'DSLCK_MM',
    name: 'Lệnh chờ khớp MM',
    filename: 'DSLCK MM CCP.xlsx',
    patterns: [/dslck.*mm/i],
  },
  {
    key: 'DSLDH_MM',
    name: 'Lệnh đã hủy MM',
    filename: 'DSLDH MM CCP.xlsx',
    patterns: [/dsldh.*mm/i],
  },
  {
    key: 'DSGD_MM',
    name: 'Danh sách giao dịch MM',
    filename: 'DSGD MM CCP.xlsx',
    patterns: [/dsgd.*mm/i],
  },

  // ── Nhóm Vị thế & Lãi lỗ ─────────────────────────────────────────────────
  {
    key: 'TTM',
    name: 'Trạng thái mở cuối ngày',
    filename: 'TTM CCP.xlsx',
    patterns: [/ttm\s+ccp/i, /^ttm\b/i, /open_pos/i],
  },
  {
    key: 'TTM_PRE1620',
    name: 'Trạng thái mở trước 16h20',
    filename: 'TTM truoc 4h20.xlsx',
    patterns: [/ttm.*4h20/i, /ttm.*16h/i, /ttm.*1620/i, /^ttm_pre/i],
    optional: true,
  },
  {
    key: 'TTTT',
    name: 'Trạng thái tất toán',
    filename: 'TTTT.xlsx',
    patterns: [/tttt/i, /pnl/i, /tat.*toan/i],
  },

  // ── Nhóm Rủi ro & Ký quỹ ─────────────────────────────────────────────────
  {
    key: 'QLTTTKGD',
    name: 'Quản lý trạng thái TKGD',
    filename: 'QL TT TKGD.xlsx',
    patterns: [/ql.*tt.*tkgd\.xlsx$/i, /qltkgd/i, /acctmargin_all/i],
  },
  {
    key: 'QLTTTKGD_PRE1620',
    name: 'Quản lý trạng thái TKGD trước 16h20',
    filename: 'QL TT TKGD truoc 4h20.xlsx',
    patterns: [/ql.*tt.*tkgd.*4h20/i, /ql.*tt.*tkgd.*1620/i, /^qltttkgd_pre/i],
    optional: true,
  },
  {
    key: 'QLTTTVKD',
    name: 'Quản lý trạng thái TVKD',
    filename: 'QL TT TVKD.xlsx',
    patterns: [/ql.*tt.*tvkd/i],
  },
  {
    key: 'DSQLKQ_TKGD',
    name: 'Quản lý ký quỹ TKGD',
    filename: 'DSQLKQ TKGD.xlsx',
    patterns: [/dsqlkq.*tkgd/i],
  },
  {
    key: 'DSQLKQ_TVKD',
    name: 'Quản lý ký quỹ TVKD',
    filename: 'DSQLKQ TVKD.xlsx',
    patterns: [/dsqlkq.*tvkd/i],
  },

  // ── Nhóm Tiền & Tài khoản ────────────────────────────────────────────────
  {
    key: 'NR',
    name: 'Lịch sử nộp rút tiền',
    filename: 'NR.xlsx',
    patterns: [/^nr\b/i, /cashtranfer/i, /nop.*rut/i],
  },
  {
    key: 'DSTKGD',
    name: 'Danh sách tài khoản giao dịch',
    filename: 'DSTKGD ACM.xlsx',
    patterns: [/dstkgd/i, /accounts_info/i],
  },

  // ── Nhóm Hàng hóa & Hợp đồng & Giá ───────────────────────────────────────
  {
    key: 'GTT',
    name: 'Giá thanh toán',
    filename: 'GTT CCP.xlsx',
    patterns: [/^gtt\s+ccp/i, /^gtt\b/i, /settlement/i],
  },
  {
    key: 'HH',
    name: 'Danh mục hàng hóa',
    filename: 'HH.xlsx',
    patterns: [/^(hh|commodity)\.(xlsx|csv)$/i, /^hh\b/i, /commodity/i],
  },
  {
    key: 'HD',
    name: 'Hợp đồng hàng hóa',
    filename: 'HĐ *.xlsx',
    patterns: [/^hđ\s+/i, /^hd_/i, /^hd\b/i, /contracts?/i],
    optional: true,
  },
];

// ── 3. COREEX (10 BÁO CÁO ACM NANO / KIM LOẠI VNCLEAR) ────────────────────────
export const REQUIRED_CE_FILES: RequiredCcpCeFileDefinition[] = [
  {
    key: 'DSTKGD',
    name: 'Danh sách tài khoản giao dịch ACM',
    filename: 'DSTKGD ACM.xlsx',
    patterns: [/dstkgd.*acm/i, /^dstkgd\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    filename: 'DSGD ACM CE.xlsx',
    patterns: [/dsgd.*acm.*ce/i, /dsgd.*ce/i, /^dsgd\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'DSL',
    name: 'Sổ lệnh CE',
    filename: 'DSL ACM CE.xlsx',
    patterns: [/dsl.*acm.*ce/i, /dsl.*ce/i, /^dsl\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    filename: 'DSLCK ACM CE.xlsx',
    patterns: [/dslck.*acm.*ce/i, /dslck.*ce/i, /^dslck\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'DSLDK',
    name: 'Lệnh điều kiện CE',
    filename: 'DSLDK ACM CE.xlsx',
    patterns: [/dsldk.*acm.*ce/i, /dsldk.*ce/i, /^dsldk\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    filename: 'DSLH ACM CE.xlsx',
    patterns: [/dslh.*acm.*ce/i, /dslh.*ce/i, /^dslh\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    filename: 'GTT ACM.xlsx',
    patterns: [/gtt.*acm/i, /^gtt\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'TTM',
    name: 'Trạng thái mở CE',
    filename: 'TTM CE.xlsx',
    patterns: [/ttm.*ce/i, /^ttm\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'HH',
    name: 'Hàng hóa ACM',
    filename: 'HH ACM.xlsx',
    patterns: [/hh.*acm/i, /^hh\.(xlsx|xls|csv)$/i],
  },
  {
    key: 'HD',
    name: 'Hợp đồng chi tiết CE',
    filename: 'HĐ *.xlsx',
    patterns: [/^hđ\s+/i, /^hd_/i, /^hd\b/i, /contracts?/i],
  },
];

// ── 4. ACM ETP & SFTP (BÁO CÁO ACM STRAITS / ETP) ───────────────────────────
export interface AcmReportConfig {
  key: string;
  name: string;
  group: 'WEB' | 'SFTP';
  aliases: string[];
}

export const ACM_REPORT_CONFIGS: Record<string, AcmReportConfig> = {
  ORDER: {
    key: 'ORDER',
    name: 'Sổ lệnh ACM (Order.xlsx)',
    group: 'WEB',
    aliases: ['ORDER', 'WEB', 'ETP'],
  },
  FILL: {
    key: 'FILL',
    name: 'Khớp lệnh ACM (Fill.xlsx)',
    group: 'WEB',
    aliases: ['FILL', 'TRADE', 'WEB', 'ETP'],
  },
  SFTP_CSV: {
    key: 'SFTP_CSV',
    name: 'File khớp lệnh Straits SFTP CSV',
    group: 'SFTP',
    aliases: ['SFTP_CSV', 'SFTP', 'STRAITS'],
  },
  SFTP_XLS: {
    key: 'SFTP_XLS',
    name: 'File khớp lệnh Straits SFTP XLS',
    group: 'SFTP',
    aliases: ['SFTP_XLS', 'SFTP'],
  },
};

export function isAcmReportRequested(key: string, requested?: string[]): boolean {
  if (!requested || requested.length === 0) return true;
  if (requested.some((r) => ['ALL', 'FULL', 'BACKUP'].includes(r))) return true;
  const cfg = ACM_REPORT_CONFIGS[key];
  return cfg ? requested.some((r) => cfg.aliases.includes(r)) : false;
}

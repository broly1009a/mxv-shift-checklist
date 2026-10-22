import { TRADING_FILE_PATTERNS } from '../../trading-ops/constants/trading-file-patterns.constant';
import { TradingOpsTaskPreflightDefinition } from '../../trading-ops/constants/preflight.types';

export interface BotTaskDefinition {
  jobType: string;      // Loại job trong bot_jobs (VD: 'CHECK_KLGD')
  botCheckType: string; // Loại bot gắn trên template ca trực (VD: 'CHECK_KLGD')
  displayName: string;  // Tên hiển thị loại bot
  description: string;  // Mô tả chức năng nghiệp vụ
  category?: 'STATISTICS' | 'RECONCILIATION' | 'SESSION_OPEN' | 'POST_EOD' | 'INGRESS';
  /**
   * Cấu hình Pre-flight tùy chọn.
   * Chỉ các tác vụ I/O nặng (đọc file thô từ đĩa, ghi đè sổ lũy kế Excel) mới cấu hình preflightSpec.
   * Các tác vụ nhẹ (API, lookup DB, đồng bộ tỷ giá...) TUYỆT ĐỐI không gắn Pre-flight tràn lan.
   */
  preflightSpec?: TradingOpsTaskPreflightDefinition;
}

/**
 * MASTER TASK & CAPABILITIES REGISTRY (DUY NHẤT 1 MASTER REGISTRY CHO TOÀN BỘ HỆ THỐNG)
 *
 * Gộp tập trung:
 * - Thông tin định tuyến ca trực (jobType, botCheckType, displayName, description).
 * - Cấu hình kiểm tra Pre-flight trước khi chạy (preflightSpec) dùng chung TRADING_FILE_PATTERNS.
 *
 * Tuyệt đối KHÔNG chứa bất kỳ Task ID, Alias hay Pattern ID cụ thể nào (Tuân thủ AGENTS.md Mục 7).
 */
export const BOT_TASK_REGISTRY: Record<string, BotTaskDefinition> = {
  // ── 1. THỐNG KÊ CORECCP (TOÀN THỊ TRƯỜNG - HEAVY I/O) ──────────────────────
  RUN_MACRO: {
    jobType: 'RUN_MACRO',
    botCheckType: 'RUN_MACRO',
    displayName: 'Thống Kê Khối Lượng CCP (Macro)',
    description: 'Chạy macro thống kê số lô & giá trị giao dịch CCP và ghi vào 11 sổ lũy kế Excel',
    category: 'STATISTICS',
    preflightSpec: {
      taskKey: 'CCP_STATISTICS',
      jobType: 'RUN_MACRO',
      botCheckType: 'RUN_MACRO',
      displayName: 'Thống Kê Số Lot & GTGD CoreCCP (Toàn Thị Trường)',
      description: 'Tổng hợp số lot và giá trị giao dịch toàn thị trường từ CoreCCP và ghi vào 11 sổ lũy kế Excel',
      category: 'STATISTICS',
      enabled: true,
      toggleSettingKey: 'enable_preflight_ccp_statistics',
      inputFiles: [
        {
          id: 'dsgd',
          name: 'Tệp Khớp Lệnh (DSGD)',
          role: 'Nguồn khớp lệnh chính để phân loại và tính số lot, giá trị giao dịch',
          patterns: TRADING_FILE_PATTERNS.CCP_DSGD,
          required: true,
          sourceCategory: 'CCP',
          enabled: true,
        },
        {
          id: 'ttm',
          name: 'Tệp Vị Thế Mở (TTM)',
          role: 'Tính vị thế mở Mua/Bán và Lãi lỗ dự kiến của toàn thị trường',
          patterns: TRADING_FILE_PATTERNS.CCP_TTM,
          required: false,
          sourceCategory: 'CCP',
          enabled: true,
        },
        {
          id: 'tttt',
          name: 'Tệp Tất Toán Thực Tế (TTTT)',
          role: 'Tính khối lượng tất toán và Lãi lỗ thực tế',
          patterns: TRADING_FILE_PATTERNS.CCP_TTTT,
          required: false,
          sourceCategory: 'CCP',
          enabled: true,
        },
      ],
      accumulators: [
        // Sổ Lot theo 4 loại + Options
        {
          key: 'pathNormalLot',
          label: 'Sổ Số Lot Giao Dịch Thường',
          settingKey: 'pathNormalLot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        {
          key: 'pathAcmLot',
          label: 'Sổ Số Lot Giao Dịch ACM (CCP)',
          settingKey: 'pathAcmLot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich ACM ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        {
          key: 'pathSpreadLot',
          label: 'Sổ Số Lot Giao Dịch Spread',
          settingKey: 'pathSpreadLot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich Spread ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        {
          key: 'pathLmeLot',
          label: 'Sổ Số Lot Giao Dịch LME',
          settingKey: 'pathLmeLot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich LME ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        {
          key: 'pathOptionsLot',
          label: 'Sổ Số Lot Giao Dịch Options',
          settingKey: 'pathOptionsLot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich Options ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        // Sổ GTGD theo 4 loại + Options
        {
          key: 'pathGtgdNormal',
          label: 'Sổ Giá Trị Giao Dịch Thường',
          settingKey: 'pathGtgdNormal',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
        {
          key: 'pathAcmGtgd',
          label: 'Sổ Giá Trị Giao Dịch ACM (CCP)',
          settingKey: 'pathAcmGtgd',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich ACM ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
        {
          key: 'pathGtgdSpread',
          label: 'Sổ Giá Trị Giao Dịch Spread',
          settingKey: 'pathGtgdSpread',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich Spread ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
        {
          key: 'pathGtgdLme',
          label: 'Sổ Giá Trị Giao Dịch LME',
          settingKey: 'pathGtgdLme',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich LME ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
        {
          key: 'pathGtgdOptions',
          label: 'Sổ Giá Trị Giao Dịch Options',
          settingKey: 'pathGtgdOptions',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich Options ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
        // Raw DSGD tích lũy tháng
        {
          key: 'pathDsgdCumulative',
          label: 'File DSGD Gộp Tích Lũy Tháng',
          settingKey: 'pathDsgdCumulative',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\DSGD_${MM}_${YYYY}.xlsx',
          checkOverwriteRule: 'MONTHLY_FILE',
          group: 'ALL',
          enabled: true,
        },
      ],
      extraChecks: ['USD_EXCHANGE_RATE'],
    },
  },

  // ── 2. THỐNG KÊ COREEX (ACM NANO & KIM LOẠI - HEAVY I/O) ───────────────────
  CE_STATISTICS: {
    jobType: 'RUN_MACRO_CE',
    botCheckType: 'RUN_MACRO_CE',
    displayName: 'Thống Kê Số Lot & GTGD CoreEX (ACM Nano)',
    description: 'Tổng hợp số lot và giá trị giao dịch ACM Nano từ Straits CSV và ghi sổ lũy kế',
    category: 'STATISTICS',
    preflightSpec: {
      taskKey: 'CE_STATISTICS',
      jobType: 'RUN_MACRO_CE',
      botCheckType: 'RUN_MACRO_CE',
      displayName: 'Thống Kê Số Lot & GTGD CoreEX (ACM Nano)',
      description: 'Tổng hợp số lot và giá trị giao dịch ACM Nano từ Straits CSV và ghi sổ lũy kế',
      category: 'STATISTICS',
      enabled: true,
      toggleSettingKey: 'enable_preflight_ce_statistics',
      inputFiles: [
        {
          id: 'dsgd',
          name: 'Tệp Khớp Lệnh (DSGD ACM / Straits)',
          role: 'Nguồn khớp lệnh chính để tính Số Lot và Giá Trị Giao Dịch',
          patterns: TRADING_FILE_PATTERNS.CE_DSGD,
          required: true,
          sourceCategory: 'CE',
          enabled: true,
        },
        {
          id: 'ttm',
          name: 'Tệp Vị Thế Mở (TTM CE)',
          role: 'Tính vị thế mở Mua/Bán và Lãi lỗ dự kiến',
          patterns: TRADING_FILE_PATTERNS.CE_TTM,
          required: false,
          sourceCategory: 'CE',
          enabled: true,
        },
        {
          id: 'gtt',
          name: 'Tệp Giá Thanh Toán (GTT ACM)',
          role: 'Đối chiếu giá khớp so với giá thanh toán',
          patterns: TRADING_FILE_PATTERNS.CE_GTT,
          required: false,
          sourceCategory: 'CE',
          enabled: true,
        },
        {
          id: 'hh',
          name: 'Tệp Danh Mục Hàng Hóa (HH ACM)',
          role: 'Tra cứu quy cách hàng hóa và hệ số nhân',
          patterns: TRADING_FILE_PATTERNS.CE_HH,
          required: false,
          sourceCategory: 'CE',
          enabled: true,
        },
      ],
      accumulators: [
        {
          key: 'ce_path_acm_lot',
          label: 'Sổ Lũy Kế Số Lot Giao Dịch ACM',
          settingKey: 'ce_path_acm_lot',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Thong ke so lot giao dich ACM ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'LOT',
          enabled: true,
        },
        {
          key: 'ce_path_acm_gtgd',
          label: 'Sổ Lũy Kế Giá Trị Giao Dịch ACM',
          settingKey: 'ce_path_acm_gtgd',
          defaultPattern: 'M:\\Trading\\Trading\\2026\\Bao cao so lieu GD 2026\\Gia tri giao dich ACM ${YYYY}.xlsx',
          checkOverwriteRule: 'DATE_IN_SHEET',
          group: 'VALUE',
          enabled: true,
        },
      ],
      extraChecks: ['USD_EXCHANGE_RATE'],
    },
  },

  // ── 3. ĐỐI CHIẾU KHỚP LỆNH TRONG PHIÊN (MS VS CQG - HEAVY I/O) ────────────
  CHECK_KLGD: {
    jobType: 'CHECK_KLGD',
    botCheckType: 'CHECK_KLGD',
    displayName: 'Đối Chiếu Khớp Lệnh Trong Phiên',
    description: 'Đối chiếu khớp lệnh trong phiên (M-System vs CQG vs ACM)',
    category: 'RECONCILIATION',
    preflightSpec: {
      taskKey: 'CHECK_KLGD',
      jobType: 'CHECK_KLGD',
      botCheckType: 'CHECK_KLGD',
      displayName: 'Đối Chiếu Khớp Lệnh Trong Phiên (MS vs CQG)',
      description: 'Đối chiếu khớp lệnh chi tiết trong phiên giữa M-System (TKGD) và CQG (FR)',
      category: 'RECONCILIATION',
      enabled: true,
      toggleSettingKey: 'enable_preflight_check_klgd',
      inputFiles: [
        {
          id: 'ms_tkgd',
          name: 'Báo Cáo Khớp Lệnh MS (TKGD)',
          role: 'Dữ liệu khớp lệnh M-System trong phiên',
          patterns: TRADING_FILE_PATTERNS.MS_TKGD,
          required: true,
          sourceCategory: 'MS',
          enabled: true,
        },
        {
          id: 'cqg_fr',
          name: 'Báo Cáo Khớp Lệnh CQG (FR)',
          role: 'Dữ liệu giao dịch khớp lệnh CQG (FR gộp hoặc FR1/FR2)',
          patterns: TRADING_FILE_PATTERNS.CQG_FR,
          required: true,
          sourceCategory: 'CQG',
          enabled: true,
        },
        {
          id: 'acm_straits',
          name: 'Báo Cáo Khớp Lệnh ACM (Straits CSV)',
          role: 'Dữ liệu khớp lệnh ACM Straits CSV (AGENTS.md Rule 2.1)',
          patterns: TRADING_FILE_PATTERNS.STRAITS_CSV,
          required: false,
          sourceCategory: 'COMMON',
          enabled: true,
        },
      ],
      extraChecks: ['RAW_CQG_PAIR_MERGE'],
    },
  },

  // ── 4. ĐỐI CHIẾU DSGD TRƯỚC EOD 3 BÊN (HEAVY I/O) ─────────────────────────
  CHECK_DSGD_BEFORE_EOD: {
    jobType: 'CHECK_DSGD_BEFORE_EOD',
    botCheckType: 'CHECK_DSGD_BEFORE_EOD',
    displayName: 'Đối Chiếu Dsgd-Before-EOD',
    description: 'Đối chiếu 3 bên trước EOD',
    category: 'RECONCILIATION',
    preflightSpec: {
      taskKey: 'CHECK_DSGD_BEFORE_EOD',
      jobType: 'CHECK_DSGD_BEFORE_EOD',
      botCheckType: 'CHECK_DSGD_BEFORE_EOD',
      displayName: 'Đối Chiếu DSGD 3 Bên Trước EOD',
      description: 'Chốt đối chiếu 3 bên cuối ngày: M-System (DSGD) vs CoreCCP (DSGD) vs CQG (FR)',
      category: 'RECONCILIATION',
      enabled: true,
      toggleSettingKey: 'enable_preflight_check_dsgd_before_eod',
      inputFiles: [
        {
          id: 'ms_dsgd',
          name: 'Báo Cáo DSGD M-System',
          role: 'Dữ liệu giao dịch ngày M-System',
          patterns: TRADING_FILE_PATTERNS.MS_DSGD,
          required: true,
          sourceCategory: 'MS',
          enabled: true,
        },
        {
          id: 'ccp_dsgd',
          name: 'Báo Cáo DSGD CoreCCP',
          role: 'Dữ liệu giao dịch ngày CoreCCP',
          patterns: TRADING_FILE_PATTERNS.CCP_DSGD,
          required: true,
          sourceCategory: 'CCP',
          enabled: true,
        },
        {
          id: 'cqg_fr',
          name: 'Báo Cáo Khớp Lệnh CQG (FR)',
          role: 'Dữ liệu giao dịch khớp lệnh CQG',
          patterns: TRADING_FILE_PATTERNS.CQG_FR,
          required: true,
          sourceCategory: 'CQG',
          enabled: true,
        },
        {
          id: 'acm_straits',
          name: 'Báo Cáo Khớp Lệnh ACM (Straits CSV)',
          role: 'Dữ liệu khớp lệnh ACM Straits CSV (AGENTS.md Rule 2.1)',
          patterns: TRADING_FILE_PATTERNS.STRAITS_CSV,
          required: false,
          sourceCategory: 'COMMON',
          enabled: true,
        },
      ],
    },
  },

  // ── 5. QUÉT TÀI KHOẢN ÂM KÝ QUỸ (POST-EOD - HEAVY I/O) ────────────────────
  SCAN_NEGATIVE_MARGIN: {
    jobType: 'SCAN_NEGATIVE_MARGIN',
    botCheckType: 'SCAN_NEGATIVE_MARGIN',
    displayName: 'Quét Tài Khoản Âm Ký Quỹ',
    description: 'Quét và phân tích tài khoản âm ký quỹ',
    category: 'POST_EOD',
    preflightSpec: {
      taskKey: 'SCAN_NEGATIVE_MARGIN',
      jobType: 'SCAN_NEGATIVE_MARGIN',
      botCheckType: 'SCAN_NEGATIVE_MARGIN',
      displayName: 'Quét Tài Khoản Âm Ký Quỹ (Post-EOD)',
      description: 'Quét và cảnh báo tài khoản vi phạm ký quỹ âm sau phiên EOD CoreCCP',
      category: 'POST_EOD',
      enabled: true,
      toggleSettingKey: 'enable_preflight_scan_negative_margin',
      inputFiles: [
        {
          id: 'margin_detail',
          name: 'Báo Cáo Margin Requirement Detail',
          role: 'Chi tiết yêu cầu ký quỹ tài khoản thành viên',
          patterns: TRADING_FILE_PATTERNS.MARGIN_DETAIL,
          required: true,
          sourceCategory: 'CCP',
          enabled: true,
        },
        {
          id: 'net_position',
          name: 'Báo Cáo Vị Thế Ròng (Net Position)',
          role: 'Đối chiếu trạng thái vị thế mở để tính ký quỹ',
          patterns: TRADING_FILE_PATTERNS.NET_POSITION,
          required: false,
          sourceCategory: 'CCP',
          enabled: true,
        },
      ],
    },
  },

  // ── 6. CÁC TÁC VỤ KHÔNG CẦN PRE-FLIGHT (LIGHTWEIGHT / API / CRAWLER) ─────────
  AUTO_CHECK_SOD: {
    jobType: 'AUTO_CHECK_SOD',
    botCheckType: 'AUTO_CHECK_SOD',
    displayName: 'Đối Chiếu Đầu Ngày SOD',
    description: 'Đối chiếu số dư đầu ngày SOD (M-System vs CQG)',
    category: 'SESSION_OPEN',
  },
  CHECK_EOD_MS: {
    jobType: 'CHECK_EOD_MS',
    botCheckType: 'CHECK_EOD_MS',
    displayName: 'Đối Chiếu Kết Quả EOD (M-System)',
    description: 'Đối chiếu kết quả chạy EOD & Ký quỹ âm M-System',
    category: 'POST_EOD',
  },
  CHECK_CQG_SYNC: {
    jobType: 'CHECK_CQG_SYNC',
    botCheckType: 'CHECK_CQG_SYNC',
    displayName: 'Đồng Bộ Số Dư CQG',
    description: 'Đối chiếu và đồng bộ số dư tài khoản CQG vs M-System',
    category: 'RECONCILIATION',
  },
  CHECK_MARGIN_DECISION: {
    jobType: 'CHECK_MARGIN_DECISION',
    botCheckType: 'CHECK_MARGIN_DECISION',
    displayName: 'Quét Quyết Định Ký Quỹ',
    description: 'Quét thư mục Quyết định thay đổi ký quỹ',
    category: 'POST_EOD',
  },
  DOWNLOAD_CCP_REPORT: {
    jobType: 'DOWNLOAD_CCP_REPORT',
    botCheckType: 'DOWNLOAD_CCP_REPORT',
    displayName: 'Tải Báo Cáo CoreCCP (VNCLEAR)',
    description: 'Tự động tải các báo cáo từ hệ thống VNCLEAR CoreCCP (NR, TTTT, DSL, DSGD...)',
    category: 'INGRESS',
  },
  DOWNLOAD_CE_REPORT: {
    jobType: 'DOWNLOAD_CE_REPORT',
    botCheckType: 'DOWNLOAD_CE_REPORT',
    displayName: 'Tải Báo Cáo CoreEX (VNCLEAR)',
    description: 'Tự động tải các báo cáo từ hệ thống VNCLEAR CoreEX (NR, TTTT, DSL, DSGD...)',
    category: 'INGRESS',
  },
  CHECK_EOD_CCP: {
    jobType: 'CHECK_EOD_CCP',
    botCheckType: 'CHECK_EOD_CCP',
    displayName: 'Đối Chiếu EOD CoreCCP',
    description: 'Đối chiếu số dư cuối ngày EOD CoreCCP (VNCLEAR)',
    category: 'POST_EOD',
  },
};

/**
 * Tìm kiếm Task Con (chạy bot) và Task Cha (chứa task con) trong ca trực hoàn toàn ĐỘNG
 * dựa vào dữ liệu thực tế trong Database (details của ca trực).
 * Tuyệt đối không phụ thuộc vào chuỗi Task ID cụ thể.
 */
export function findBotTasksInShift(
  details: any[] = [],
  botKeyOrJobType: string,
): { subTask: any; parentTask: any } {
  if (!Array.isArray(details) || details.length === 0) {
    return { subTask: null, parentTask: null };
  }

  const normalizedKey = String(botKeyOrJobType || '').trim().toUpperCase();
  const config =
    BOT_TASK_REGISTRY[normalizedKey] ||
    Object.values(BOT_TASK_REGISTRY).find(
      (def) =>
        def.jobType.toUpperCase() === normalizedKey ||
        def.botCheckType.toUpperCase() === normalizedKey ||
        def.preflightSpec?.taskKey.toUpperCase() === normalizedKey,
    );

  const targetBotType = config?.botCheckType || normalizedKey;

  // 1. Tìm Task Con chạy bot dựa 100% vào thuộc tính botCheckType do Admin gán trong Template/Ca
  let subTask = details.find(
    (t) =>
      (t.botCheckTypeSnapshot && t.botCheckTypeSnapshot.toUpperCase() === targetBotType) ||
      (t.botCheckType && t.botCheckType.toUpperCase() === targetBotType),
  );

  // 2. Tìm Task Cha dựa 100% vào quan hệ parentTaskIdSnapshot lưu trong Database
  let parentTask: any = null;
  if (subTask?.parentTaskIdSnapshot) {
    parentTask = details.find((t) => t.taskId === subTask.parentTaskIdSnapshot) || null;
  }

  // 3. Fallback: Nếu không tìm thấy theo botCheckType (do ca trực custom), tìm theo taskId khớp trực tiếp
  if (!subTask) {
    subTask = details.find(
      (t) => t.taskId && t.taskId.toUpperCase() === normalizedKey,
    );
    if (subTask?.parentTaskIdSnapshot) {
      parentTask = details.find((t) => t.taskId === subTask.parentTaskIdSnapshot) || null;
    }
  }

  return { subTask, parentTask };
}

/**
 * Trả về danh sách tất cả các ID liên quan (cha + con + anh em) của một taskId bất kỳ
 * dựa HOÀN TOÀN ĐỘNG vào cấu trúc cây trong ca trực (details).
 * Tuyệt đối không dùng bất kỳ chuỗi hardcode nào (Tuân thủ AGENTS.md Mục 7).
 */
export function getRelatedTaskIds(taskId: string, details?: any[]): string[] {
  if (!taskId) return [];

  const result = new Set<string>([taskId]);

  if (Array.isArray(details) && details.length > 0) {
    // 1. Nếu taskId là Task Cha -> Lấy tất cả Task Con có parentTaskIdSnapshot === taskId
    details.forEach((t) => {
      if (t.parentTaskIdSnapshot === taskId) {
        result.add(t.taskId);
      }
    });

    // 2. Nếu taskId là Task Con -> Lấy Task Cha và toàn bộ Task anh em cùng cha
    const current = details.find((t) => t.taskId === taskId);
    if (current?.parentTaskIdSnapshot) {
      result.add(current.parentTaskIdSnapshot);
      details.forEach((t) => {
        if (t.parentTaskIdSnapshot === current.parentTaskIdSnapshot) {
          result.add(t.taskId);
        }
      });
    }

    // 3. Nếu task có botCheckTypeSnapshot, liên kết với các task khác cùng chung loại bot trong ca
    if (current?.botCheckTypeSnapshot) {
      details.forEach((t) => {
        if (
          t.botCheckTypeSnapshot &&
          t.botCheckTypeSnapshot.toUpperCase() === current.botCheckTypeSnapshot.toUpperCase()
        ) {
          result.add(t.taskId);
          if (t.parentTaskIdSnapshot) {
            result.add(t.parentTaskIdSnapshot);
          }
        }
      });
    }
  }

  return Array.from(result);
}

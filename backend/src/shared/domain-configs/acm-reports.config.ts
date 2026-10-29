/**
 * ============================================================================
 * ACM (STRAITS FINANCIAL & ETP WEB) REPORTS CONFIGURATION & REGISTRY
 * ============================================================================
 * 
 * Tách biệt cấu hình danh mục báo cáo ACM (Web Portal & SFTP).
 * Dùng chung cho: Ingress SFTP Adapter, Web ETP Adapter, Scraper, Worker, Frontend.
 */

export interface IAcmReportDef {
  key: string;
  name: string;
  fileName: string;
  source: 'SFTP' | 'WEB';
  description: string;
  pattern?: string;
  alias?: string;
}

export const CANONICAL_ACM_KEYS = [
  'FILL',      // Khớp lệnh ETP Web -> Fill.xls
  'ORDER',     // Sổ lệnh ETP Web -> Order.xls
  'SFTP_CSV',  // File CSV Straits EOD -> EOD FO trades_PT Straits...csv / Straits_<date>.csv
  'SFTP_XLS',  // Báo cáo TK 10017890000 -> <date>_10017890000.xls
] as const;

export type CanonicalAcmKey = typeof CANONICAL_ACM_KEYS[number];

export const ACM_REPORTS_REGISTRY: Record<string, IAcmReportDef> = {
  FILL: {
    key: 'FILL',
    name: 'Khớp lệnh ACM (Fill)',
    fileName: 'Fill.xls',
    source: 'WEB',
    description: 'Danh sách khớp lệnh liên thông ACM tải từ ETP Web Portal',
  },
  ORDER: {
    key: 'ORDER',
    name: 'Sổ lệnh ACM (Order)',
    fileName: 'Order.xls',
    source: 'WEB',
    description: 'Sổ lệnh giao dịch ACM tải từ ETP Web Portal',
  },
  SFTP_CSV: {
    key: 'SFTP_CSV',
    name: 'Straits EOD CSV (SFTP)',
    fileName: 'Straits.csv',
    source: 'SFTP',
    pattern: 'EOD FO trades_PT Straits*.csv',
    alias: 'Straits_{ddmmyyyy}.csv',
    description: 'Báo cáo giao dịch Straits Financial dạng CSV từ máy chủ SFTP',
  },
  SFTP_XLS: {
    key: 'SFTP_XLS',
    name: 'Báo cáo TK 10017890000 (SFTP)',
    fileName: '10017890000.xls',
    source: 'SFTP',
    pattern: '*_10017890000.xls',
    description: 'Báo cáo sao kê tài khoản 10017890000 từ máy chủ SFTP',
  },
  // Aliases
  STRAITS: {
    key: 'STRAITS',
    name: 'Straits EOD CSV (Alias)',
    fileName: 'Straits.csv',
    source: 'SFTP',
    description: 'Alias cho báo cáo Straits CSV từ SFTP',
  },
};

export function resolveAcmReport(target: string): IAcmReportDef | undefined {
  if (!target) return undefined;
  if (ACM_REPORTS_REGISTRY[target]) return ACM_REPORTS_REGISTRY[target];

  const upper = target.toUpperCase().trim();
  const cleanTarget = upper.replace(/[\s_.-]/g, '');

  return Object.values(ACM_REPORTS_REGISTRY).find((r) => {
    const cleanKey = r.key.toUpperCase().replace(/[\s_.-]/g, '');
    const cleanFile = r.fileName.toUpperCase().replace(/[\s_.-]/g, '');
    return cleanKey === cleanTarget || cleanFile.includes(cleanTarget);
  });
}

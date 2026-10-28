import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CANONICAL_CORECCP_API_KEYS } from '../../../shared/domain-configs/coreccp-reports.config';
import { CANONICAL_COREEX_API_KEYS } from '../../../shared/domain-configs/coreex-reports.config';

export type BackupSystemKey = 'MS' | 'CQG' | 'CCP' | 'CE' | 'ACM';

export const RECOMMENDED_DEFAULT_TARGETS: Record<BackupSystemKey, readonly string[]> = {
  MS: [
    'DSGD',
    'DSLDK',
    'DSLCK',
    'DSLH',
    'DSLK',
    'TTM',
    'TTTT',
    'NR',
    'QLTKGD',
    'DSQLKQ',
    'DSTKGD-Futures',
    'DSTKGD-Spread',
    'DSTKGD-LME',
    'DSTKGD-ACM',
    'DSTrader',
    'market truoc 6h',
    'NKTTHT',
  ],
  CQG: ['FR1', 'FR2', 'PS1', 'PS2', 'OP1', 'OP2', 'OD1', 'OD2'],
  CCP: CANONICAL_CORECCP_API_KEYS,
  CE: CANONICAL_COREEX_API_KEYS,
  ACM: ['FILL', 'ORDER', 'SFTP_CSV'],
};

/**
 * Lấy danh mục báo cáo cần tải thực tế cho từng phân hệ sao lưu:
 * 1. Nếu có explicitReports truyền vào và không phải cờ ALL/FULL -> dùng explicitReports
 * 2. Đọc từ CSDL MongoDB system_settings (key: bot_backup_selected_reports_<system>)
 * 3. Nếu chưa cấu hình -> Fallback về danh mục khuyến nghị cốt lõi (RECOMMENDED_DEFAULT_TARGETS)
 */
export async function getEffectiveReportTargets(
  settingsService?: SystemSettingsService,
  systemKey?: BackupSystemKey,
  explicitReports?: string[],
): Promise<string[]> {
  if (!systemKey) return explicitReports || [];

  const isFullFlag = explicitReports?.some((c) =>
    ['FULL', 'ALL', 'BACKUP', `${systemKey}_FULL`].includes(c.toUpperCase()),
  );

  // Nếu truyền danh mục cụ thể (không chứa cờ ALL/FULL) -> Ưu tiên dùng danh mục truyền vào
  if (explicitReports && explicitReports.length > 0 && !isFullFlag) {
    return explicitReports;
  }

  // Nếu có settingsService, đọc từ CSDL MongoDB system_settings
  if (settingsService) {
    const settingKey = `bot_backup_selected_reports_${systemKey.toLowerCase()}`;
    try {
      const savedConfig = await settingsService.getSetting(settingKey, '');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Bỏ qua lỗi parse JSON và fallback về cấu hình mặc định
    }
  }

  // Fallback về danh mục chuẩn cốt lõi
  return [...(RECOMMENDED_DEFAULT_TARGETS[systemKey] || [])];
}

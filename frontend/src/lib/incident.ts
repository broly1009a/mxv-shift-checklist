/**
 * Utility functions for formatting and localizing incident codes and SLAs
 */

export const getFriendlyCode = (code: string): string => {
  if (!code) return '';
  if (code.startsWith('SLA_BREACH_')) {
    const timeStr = code.replace('SLA_BREACH_', '');
    if (timeStr.length === 4) {
      const hh = timeStr.substring(0, 2);
      const mm = timeStr.substring(2, 4);
      return `Trễ hạn lúc ${hh}:${mm}`;
    }
    return `Trễ hạn (${timeStr})`;
  }

  switch (code) {
    case 'SYSTEM_OR_NETWORK_ERROR':
      return 'Sự cố Hệ thống/Đường truyền';
    case 'PROCESS_DELAY':
      return 'Quá trình bị Trễ';
    case 'DATA_MISMATCH':
      return 'Sai lệch Dữ liệu';
    case 'MISSED_SLA':
      return 'Trễ hạn Cam kết';
    default:
      return code.replace(/_/g, ' ');
  }
};

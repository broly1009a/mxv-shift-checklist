/**
 * Activity Log Mapper & Business Parser Utility
 * Ánh xạ và chuyển đổi nhật ký kỹ thuật thành thông tin nghiệp vụ trực quan, dễ hiểu.
 */

export interface ActivityLogModuleInfo {
  code: string;
  name: string;
  color: string;
  bgLight: string;
  border: string;
}

export interface BusinessParameter {
  key: string;
  label: string;
  value: string;
  isHighlight?: boolean;
  badgeColor?: string;
}

export interface ClientInfo {
  browser: string;
  os: string;
  ip: string;
  rawUserAgent: string;
}

export interface ResponseSummary {
  status: 'success' | 'warning' | 'info';
  message: string;
  recordId?: string;
}

export interface ParsedActivityLog {
  module: ActivityLogModuleInfo;
  actionTitle: string;
  actionDescription: string;
  method: string;
  path: string;
  cleanEndpoint: string;
  technicalTag?: string;
  businessParameters: BusinessParameter[];
  clientInfo: ClientInfo;
  responseSummary?: ResponseSummary;
  rawPayload: any;
  hasPayload: boolean;
}

// Danh mục phân hệ nghiệp vụ hệ thống
export const LOG_MODULES: Record<string, ActivityLogModuleInfo> = {
  INGRESS: {
    code: 'INGRESS',
    name: 'Thu thập RPA (Ingress)',
    color: '#0ea5e9',
    bgLight: 'rgba(14, 165, 233, 0.12)',
    border: 'rgba(14, 165, 233, 0.3)',
  },
  STORAGE_AUDIT: {
    code: 'STORAGE_AUDIT',
    name: 'Giám sát Tệp tin & RPA',
    color: '#8b5cf6',
    bgLight: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  TRADING_OPS: {
    code: 'TRADING_OPS',
    name: 'Trading Ops & Đối chiếu',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  CCP_CLEARING: {
    code: 'CCP_CLEARING',
    name: 'Bù trừ & Thống kê CCP',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  SHIFTS: {
    code: 'SHIFTS',
    name: 'Ca trực & Checklist',
    color: '#14b8a6',
    bgLight: 'rgba(20, 184, 166, 0.12)',
    border: 'rgba(20, 184, 166, 0.3)',
  },
  ADMIN_USERS: {
    code: 'ADMIN_USERS',
    name: 'Tài khoản & Phân quyền',
    color: '#ec4899',
    bgLight: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  ADMIN_SYSTEM: {
    code: 'ADMIN_SYSTEM',
    name: 'Quản trị Hệ thống',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.15)',
    border: 'rgba(100, 116, 139, 0.3)',
  },
  INCIDENTS: {
    code: 'INCIDENTS',
    name: 'Quản lý Sự cố',
    color: '#ef4444',
    bgLight: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  NOTIFICATIONS: {
    code: 'NOTIFICATIONS',
    name: 'Kênh thông báo',
    color: '#0284c7',
    bgLight: 'rgba(2, 132, 199, 0.12)',
    border: 'rgba(2, 132, 199, 0.3)',
  },
  CALENDAR: {
    code: 'CALENDAR',
    name: 'Lịch làm việc',
    color: '#7c3aed',
    bgLight: 'rgba(124, 58, 237, 0.12)',
    border: 'rgba(124, 58, 237, 0.3)',
  },
  AUTH: {
    code: 'AUTH',
    name: 'Xác thực & Cá nhân',
    color: '#84cc16',
    bgLight: 'rgba(132, 204, 22, 0.12)',
    border: 'rgba(132, 204, 22, 0.3)',
  },
  MARGIN: {
    code: 'MARGIN',
    name: 'Quản trị Ký quỹ',
    color: '#d97706',
    bgLight: 'rgba(217, 119, 6, 0.12)',
    border: 'rgba(217, 119, 6, 0.3)',
  },
  REPORT: {
    code: 'REPORT',
    name: 'Báo cáo định kỳ',
    color: '#059669',
    bgLight: 'rgba(5, 150, 105, 0.12)',
    border: 'rgba(5, 150, 105, 0.3)',
  },
  DEFAULT: {
    code: 'GENERAL',
    name: 'Hệ thống chung',
    color: '#94a3b8',
    bgLight: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.3)',
  },
};

/**
 * Phân giải chuỗi User Agent thành thông tin Trình duyệt & Hệ điều hành thân thiện
 */
export function parseUserAgent(ua: string): { browser: string; os: string } {
  if (!ua) return { browser: 'Không xác định', os: 'Không xác định' };

  let browser = 'Trình duyệt Web';
  let os = 'Hệ điều hành';

  // Detect OS
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10 / 11';
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (ua.includes('Ubuntu')) os = 'Ubuntu Linux';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect Browser
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/([0-9.]+)/);
    browser = `Microsoft Edge ${match ? match[1].split('.')[0] : ''}`;
  } else if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/([0-9.]+)/);
    browser = `Google Chrome ${match ? match[1].split('.')[0] : ''}`;
  } else if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/([0-9.]+)/);
    browser = `Mozilla Firefox ${match ? match[1] : ''}`;
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Apple Safari';
  } else if (ua.includes('PostmanRuntime/')) {
    browser = 'Postman Client';
  } else if (ua.includes('curl/')) {
    browser = 'cURL Tool';
  } else if (ua.includes('python-requests')) {
    browser = 'Python Automation Script';
  }

  return { browser: browser.trim(), os };
}

/**
 * Định dạng địa chỉ IP thân thiện
 */
export function formatIpAddress(ip: string): string {
  if (!ip) return '---';
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1 (Localhost / Reverse Proxy)';
  }
  return ip.replace(/^::ffff:/, '');
}

/**
 * Ánh xạ tên mã tác vụ console sang tiếng Việt
 */
export const TRADING_JOB_TYPE_TITLES: Record<string, { title: string; desc: string }> = {
  SCAN_NEGATIVE_MARGIN: {
    title: 'Kích hoạt quét tài khoản ký quỹ âm (Post-EOD)',
    desc: 'Yêu cầu hệ thống đối chiếu thực hiện quét kiểm tra tự động các tài khoản có trạng thái ký quỹ âm sau phiên.',
  },
  CHECK_KLGD: {
    title: 'Kích hoạt đối chiếu KLGD (MS vs CQG trong phiên)',
    desc: 'Kích hoạt so khớp khối lượng khớp lệnh giữa hệ thống M-System và tài khoản CQG trong phiên.',
  },
  CHECK_DSGD_BEFORE_EOD: {
    title: 'Kích hoạt đối chiếu DSGD trước EOD',
    desc: 'Chốt đối chiếu số liệu DSGD gốc vs snapshot và Straits ACM trước giờ EOD chuẩn bị bàn giao ca.',
  },
  CHECK_EOD_CCP: {
    title: 'Kích hoạt đối chiếu chốt sổ EOD CoreCCP',
    desc: 'Thực hiện chốt sổ và đối chiếu dữ liệu thanh toán bù trừ với hệ thống CoreCCP cuối ngày.',
  },
  CHECK_CQG_SYNC: {
    title: 'Kích hoạt đồng bộ số dư & trạng thái CQG',
    desc: 'Đồng bộ hóa dữ liệu số dư, vị thế mở từ 2 tài khoản giao dịch CQG.',
  },
  CHECK_GTT: {
    title: 'Kích hoạt kiểm tra đối chiếu giá thanh toán (GTT)',
    desc: 'So khớp giá thanh toán thực tế giữa hệ thống CoreEX và CoreCCP.',
  },
  CHECK_IMR: {
    title: 'Kích hoạt kiểm tra mức ký quỹ yêu cầu ban đầu (IMR)',
    desc: 'Rà soát mức ký quỹ yêu cầu ban đầu cho các tài khoản mở mới và đang nắm giữ vị thế.',
  },
  CCP_LOT_STATISTICS: {
    title: 'Kích hoạt thống kê Lot hợp đồng CCP',
    desc: 'Chạy Macro tính toán và trích xuất bảng tổng hợp khối lượng hợp đồng giao dịch CCP.',
  },
  CCP_VALUE_STATISTICS: {
    title: 'Kích hoạt thống kê Giá trị giao dịch CCP',
    desc: 'Chạy Macro tính toán và trích xuất tổng giá trị thanh toán giao dịch CCP.',
  },
};

/**
 * Trích xuất các tham số nghiệp vụ từ payload JSON
 */
function extractBusinessParameters(body: any, params: any, path: string): BusinessParameter[] {
  const items: BusinessParameter[] = [];

  // Trích xuất jobType / type (Trading Ops & Recon)
  const jobType = body?.jobType || body?.type;
  if (jobType && typeof jobType === 'string') {
    const mapped = TRADING_JOB_TYPE_TITLES[jobType];
    items.push({
      key: 'jobType',
      label: 'Tác vụ thực hiện',
      value: mapped ? mapped.title : jobType,
      isHighlight: true,
      badgeColor: '#10b981',
    });
  }

  // Trích xuất ngày phiên giao dịch (sessionDate / date)
  const sessionDate = body?.sessionDate || body?.date || params?.date;
  if (sessionDate && typeof sessionDate === 'string') {
    items.push({
      key: 'sessionDate',
      label: 'Ngày phiên giao dịch',
      value: sessionDate,
      isHighlight: true,
      badgeColor: '#3b82f6',
    });
  }

  // Cơ chế chạy tức thì (bypassCooldown)
  if (body?.bypassCooldown !== undefined) {
    items.push({
      key: 'bypassCooldown',
      label: 'Cơ chế kích hoạt',
      value: body.bypassCooldown ? 'Chạy tức thì (Bỏ qua thời gian chờ - Bypass Cooldown)' : 'Theo lịch trình tiêu chuẩn',
      badgeColor: body.bypassCooldown ? '#f59e0b' : '#64748b',
    });
  }

  // Nguồn dữ liệu (source)
  if (body?.source) {
    items.push({
      key: 'source',
      label: 'Nguồn hệ thống',
      value: body.source === 'MS' ? 'Hệ thống M-System' : body.source === 'CQG' ? 'Hệ thống sàn CQG' : body.source,
      badgeColor: '#8b5cf6',
    });
  }

  // Danh sách báo cáo tùy chọn (reports)
  if (Array.isArray(body?.reports) && body.reports.length > 0) {
    items.push({
      key: 'reports',
      label: 'Danh sách báo cáo tải',
      value: body.reports.join(', '),
    });
  }

  // Tùy chọn kiểm tra mở rộng (options)
  if (body?.options && typeof body.options === 'object') {
    const opts = body.options;
    const activeOpts: string[] = [];
    if (opts.checkKlgd) activeOpts.push('Khớp lệnh (KLGD)');
    if (opts.checkTtm) activeOpts.push('Thanh toán bù trừ (TTM)');
    if (opts.checkTttt) activeOpts.push('Thông tin thanh toán (TTTT)');
    if (activeOpts.length > 0) {
      items.push({
        key: 'options',
        label: 'Phạm vi đối chiếu',
        value: activeOpts.join(' + '),
      });
    }
  }

  // Quản lý người dùng (Users)
  if (body?.fullName || body?.username) {
    if (body.fullName) items.push({ key: 'fullName', label: 'Họ và tên', value: body.fullName });
    if (body.username) items.push({ key: 'username', label: 'Tên đăng nhập', value: `@${body.username}` });
    if (body.role) items.push({ key: 'role', label: 'Vai trò tài khoản', value: body.role, badgeColor: '#ec4899' });
    if (body.departmentId) items.push({ key: 'departmentId', label: 'Mã phòng ban', value: body.departmentId });
  }

  // Quản lý phòng ban (Departments)
  if (body?.name && path.includes('/departments')) {
    items.push({ key: 'name', label: 'Tên phòng ban', value: body.name });
    if (body.code) items.push({ key: 'code', label: 'Mã phòng ban', value: body.code });
  }

  // Phân quyền vai trò (Roles)
  if (Array.isArray(body?.permissions)) {
    items.push({
      key: 'permissions',
      label: 'Số lượng quyền hạn gán',
      value: `${body.permissions.length} quyền`,
      badgeColor: '#ec4899',
    });
  }

  // Quản trị hệ thống (System Settings)
  if (body?.key) {
    let keyFriendly = body.key;
    if (body.key.startsWith('bot_credentials_msystem')) keyFriendly = 'Thông tin kết nối & Tài khoản Bot M-System';
    else if (body.key.startsWith('bot_credentials_cqg')) keyFriendly = 'Thông tin kết nối & Tài khoản Bot CQG';
    else if (body.key.startsWith('bot_credentials_acm')) keyFriendly = 'Thông tin kết nối & Tài khoản Bot ACM';
    else if (body.key.startsWith('bot_credentials_ccp')) keyFriendly = 'Thông tin kết nối & Tài khoản Bot CoreCCP';
    else if (body.key.startsWith('bot_credentials_ce')) keyFriendly = 'Thông tin kết nối & Tài khoản Bot CoreEX';
    else if (body.key === 'backup_directory') keyFriendly = 'Thư mục gốc lưu trữ tệp tin sao lưu';

    items.push({ key: 'settingKey', label: 'Mục cấu hình cập nhật', value: keyFriendly, isHighlight: true });
  }

  // Quản lý Sự cố (Incidents)
  if (body?.title && path.includes('/incidents')) {
    items.push({ key: 'title', label: 'Tiêu đề sự cố', value: body.title, isHighlight: true });
    if (body.severity) items.push({ key: 'severity', label: 'Mức độ nghiêm trọng', value: body.severity, badgeColor: '#ef4444' });
    if (body.solution) items.push({ key: 'solution', label: 'Biện pháp khắc phục', value: body.solution });
  }

  // Khung giờ ca trực & Checklist
  if (body?.name && (path.includes('/shift-slots') || path.includes('/templates'))) {
    items.push({ key: 'templateName', label: 'Tên cấu hình / Mẫu checklist', value: body.name });
  }

  // Tham số URL / Query
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v && typeof v === 'string' && k !== 'password') {
        items.push({ key: k, label: `Tham số ${k}`, value: v });
      }
    });
  }

  return items;
}

/**
 * Hàm phân tích và ánh xạ toàn diện một bản ghi Log
 */
export function parseActivityLog(actionStr: string, detailsStr: string, ipStr: string, uaStr: string): ParsedActivityLog {
  const parts = (actionStr || '').split(' ');
  const method = parts[0] || 'POST';
  const path = parts.slice(1).join(' ') || '';

  // Parse JSON Details
  let rawJson: any = null;
  let hasPayload = false;
  let body: any = null;
  let params: any = null;
  let responseBody: any = null;

  if (detailsStr) {
    try {
      rawJson = JSON.parse(detailsStr);
      hasPayload = true;
      body = rawJson.body || null;
      params = rawJson.params || null;
      responseBody = rawJson.response || null;
    } catch {
      hasPayload = false;
    }
  }

  // Client info
  const clientInfo = {
    ...parseUserAgent(uaStr),
    ip: formatIpAddress(ipStr),
    rawUserAgent: uaStr || '---',
  };

  // Response summary
  let responseSummary: ResponseSummary | undefined;
  if (responseBody) {
    const recordId = responseBody._id || responseBody.id;
    responseSummary = {
      status: 'success',
      message: recordId ? `Bản ghi đã được xử lý thành công (Mã ID: ${recordId})` : 'Yêu cầu được thực thi thành công (HTTP 200 OK)',
      recordId,
    };
  }

  // Phân tích nghiệp vụ dựa trên Method, Path và Body
  let module = LOG_MODULES.DEFAULT;
  let actionTitle = 'Thao tác ghi dữ liệu hệ thống';
  let actionDescription = 'Gửi yêu cầu thay đổi trạng thái hoặc ghi dữ liệu lên máy chủ.';
  let technicalTag: string | undefined;

  // 1. INGRESS & BOT ENGINE
  if (path.includes('/ingress/trigger-ce-download') || path.includes('/bot-engine/trigger-ce-download')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kích hoạt tải báo cáo CoreEX (CE) (RPA)';
    actionDescription = 'Gửi lệnh tới Bot RPA tự động tải bộ báo cáo thị trường từ hệ thống sàn CoreEX (CE).';
    technicalTag = 'TRIGGER_CE_DOWNLOAD';
  } else if (path.includes('/ingress/trigger-ccp-download') || path.includes('/bot-engine/trigger-ccp-download')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kích hoạt tải 25 báo cáo CoreCCP (RPA)';
    actionDescription = 'Kích hoạt quy trình Bot Playwright tự động đăng nhập và tải bộ 25 báo cáo thanh toán bù trừ CoreCCP.';
    technicalTag = 'TRIGGER_CCP_DOWNLOAD';
  } else if (path.includes('/ingress/trigger-download') || path.includes('/bot-engine/trigger-download')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kích hoạt tải báo cáo M-System (RPA)';
    actionDescription = 'Kích hoạt Bot Playwright tự động đăng nhập và tải báo cáo từ hệ thống M-System.';
    technicalTag = 'TRIGGER_MS_DOWNLOAD';
  } else if (path.includes('/ingress/trigger-cqg-download') || path.includes('/bot-engine/trigger-cqg-download')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kích hoạt tải báo cáo CQG (2 tài khoản)';
    actionDescription = 'Kích hoạt Bot Playwright tự động tải bộ báo cáo giao dịch song song từ 2 tài khoản CQG (FR, PS, OP, OD).';
    technicalTag = 'TRIGGER_CQG_DOWNLOAD';
  } else if (path.includes('/ingress/trigger-acm-download') || path.includes('/bot-engine/trigger-acm-download')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kích hoạt tải báo cáo ACM (Straits CSV)';
    actionDescription = 'Kích hoạt tác vụ kết nối SFTP/Web ACM để tải tệp đối chiếu Straits CSV.';
    technicalTag = 'TRIGGER_ACM_DOWNLOAD';
  } else if (path.includes('/ingress/audit-ccp-backup') || path.includes('/bot-engine/audit-ccp-backup')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Kiểm tra & Audit tệp sao lưu CoreCCP';
    actionDescription = 'Quét và kiểm tra sự hiện diện, tính toàn vẹn của 25 tệp báo cáo sao lưu CoreCCP trong ngày.';
    technicalTag = 'AUDIT_CCP_BACKUP';
  } else if (path.includes('/ingress/audit-ce-backup') || path.includes('/bot-engine/audit-ce-backup')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Kiểm tra & Audit tệp sao lưu CoreEX';
    actionDescription = 'Quét và kiểm tra tính đầy đủ của các tệp báo cáo sao lưu CoreEX (CE) trong ngày.';
    technicalTag = 'AUDIT_CE_BACKUP';
  } else if (path.includes('/ingress/audit-ms-backup') || path.includes('/bot-engine/audit-ms-backup')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Kiểm tra & Audit tệp sao lưu M-System';
    actionDescription = 'Quét và kiểm tra tính đầy đủ của các tệp sao lưu giao dịch M-System.';
    technicalTag = 'AUDIT_MS_BACKUP';
  } else if (path.includes('/ingress/audit-cqg-backup') || path.includes('/bot-engine/audit-cqg-backup')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Kiểm tra & Audit tệp sao lưu CQG';
    actionDescription = 'Kiểm tra sự hiện diện của các tệp FR, PS, OP, OD từ 2 tài khoản CQG.';
    technicalTag = 'AUDIT_CQG_BACKUP';
  } else if (path.includes('/ingress/audit-acm-backup') || path.includes('/bot-engine/audit-acm-backup')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Kiểm tra & Audit tệp sao lưu ACM';
    actionDescription = 'Kiểm tra sự hiện diện của tệp Straits CSV trong thư mục sao lưu ACM.';
    technicalTag = 'AUDIT_ACM_BACKUP';
  } else if (path.includes('/ingress/test-connection') || path.includes('/bot-engine/test-connection')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Kiểm tra kết nối Bot / Sàn giao dịch';
    actionDescription = 'Thực hiện kiểm tra tính khả dụng của thông tin đăng nhập và đường truyền kết nối Bot.';
    technicalTag = 'TEST_CONNECTION';
  } else if (path.includes('/files/upload-daily')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Tải lên tệp sao lưu thủ công hàng ngày';
    actionDescription = 'Người dùng tải tệp sao lưu bổ sung trực tiếp vào thư mục ngày của hệ thống.';
    technicalTag = 'UPLOAD_DAILY_FILES';
  } else if ((path.includes('/bot-engine/jobs') || path.includes('/checklist-hub/jobs')) && path.includes('/cancel')) {
    module = LOG_MODULES.STORAGE_AUDIT;
    actionTitle = 'Hủy tác vụ Bot đang chạy';
    actionDescription = 'Dừng khẩn cấp một tác vụ Bot hoặc Worker đang xử lý trong hàng đợi.';
    technicalTag = 'CANCEL_JOB';
  } else if ((path.includes('/bot-engine/jobs') || path.includes('/checklist-hub/jobs')) && path.includes('/submit-captcha')) {
    module = LOG_MODULES.INGRESS;
    actionTitle = 'Gửi mã xác thực Captcha cho Bot';
    actionDescription = 'Cung cấp mã Captcha để Bot giải quyết phiên đăng nhập hệ thống đối tác.';
    technicalTag = 'SUBMIT_CAPTCHA';
  } else if (path.includes('/bot-engine/config') || path.includes('/ingress/config')) {
    module = LOG_MODULES.ADMIN_SYSTEM;
    actionTitle = 'Lưu cấu hình hệ thống Bot/RPA';
    actionDescription = 'Cập nhật tài khoản, mật khẩu hoặc URL kết nối cho các Bot cào dữ liệu.';
    technicalTag = 'BOT_CONFIG_SAVE';
  }

  // 2. TRADING OPS & RECONCILIATION
  else if (path.includes('/trading-ops/trigger-console-run') || path.includes('/reconciliation/trigger-console-run')) {
    module = LOG_MODULES.TRADING_OPS;
    const jType = body?.jobType || body?.type;
    if (jType && TRADING_JOB_TYPE_TITLES[jType]) {
      actionTitle = TRADING_JOB_TYPE_TITLES[jType].title;
      actionDescription = TRADING_JOB_TYPE_TITLES[jType].desc;
      technicalTag = jType;
    } else {
      actionTitle = 'Kích hoạt tác vụ Console Trading Ops';
      actionDescription = 'Gửi lệnh kích hoạt tác vụ đối soát hoặc kiểm tra tức thì trong phân hệ Trading Ops.';
      technicalTag = jType || 'TRIGGER_CONSOLE_RUN';
    }
  } else if (path.includes('/trading-ops/check-eod-run')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Kích hoạt đối chiếu chốt sổ EOD CoreCCP';
    actionDescription = 'Đối soát chốt sổ dữ liệu thanh toán bù trừ cuối ngày với CoreCCP.';
    technicalTag = 'CHECK_EOD_CCP';
  } else if (path.includes('/trading-ops/run-check-dsgd-before-eod')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Kích hoạt đối soát Dsgd-Before-EOD CoreCCP ↔ CoreEX';
    actionDescription = 'Kiểm tra so khớp dữ liệu cuối ngày trước khi đóng phiên giữa CoreCCP và CoreEX.';
    technicalTag = 'CHECK_DSGD_BEFORE_EOD';
  } else if (path.includes('/trading-ops/upload-klgd') || path.includes('/reconciliation/upload-klgd')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Tải lên tệp đối chiếu KLGD thủ công';
    actionDescription = 'Tải tệp Excel giao dịch khớp lệnh M-System hoặc CQG để thực hiện đối chiếu thủ công.';
    technicalTag = 'UPLOAD_KLGD';
  } else if (path.includes('/trading-ops/upload-dsgd-before-eod')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Tải lên tệp đối chiếu Dsgd-Before-EOD thủ công';
    actionDescription = 'Tải tệp dữ liệu vị thế ròng và tất toán để thực hiện chốt đối soát Dsgd-Before-EOD.';
    technicalTag = 'UPLOAD_DSGD_BEFORE_EOD';
  } else if (path.includes('/trading-ops/upload-eod')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Tải lên tệp đối chiếu EOD thủ công';
    actionDescription = 'Tải tệp sao lưu cuối ngày để chốt phiên giao dịch.';
    technicalTag = 'UPLOAD_EOD';
  } else if (path.includes('/trading-ops/upload-backup')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Tải lên tệp sao lưu dữ liệu giao dịch';
    actionDescription = 'Bổ sung tệp sao lưu dữ liệu vào hệ thống lưu trữ giao dịch.';
    technicalTag = 'UPLOAD_BACKUP';
  } else if (path.includes('/trading-ops/trigger-selective-backup')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Kích hoạt tải báo cáo tùy chọn (MS / CQG)';
    actionDescription = 'Yêu cầu Bot tải chọn lọc các loại báo cáo được chỉ định từ M-System hoặc CQG.';
    technicalTag = 'SELECTIVE_BACKUP';
  } else if (path.includes('/trading-ops/sync-usd-rate')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Đồng bộ tỷ giá USD sang VND';
    actionDescription = 'Cập nhật và đồng bộ tỷ giá hối đoái USD phục vụ quy đổi giá trị ký quỹ.';
    technicalTag = 'SYNC_USD_RATE';
  } else if (path.includes('/trading-ops/sync-exchange-rates')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Đồng bộ bảng tỷ giá ngoại tệ M-System';
    actionDescription = 'Lấy bảng tỷ giá chốt ngày từ hệ thống M-System để cập nhật vào hệ thống đối soát.';
    technicalTag = 'SYNC_EXCHANGE_RATES';
  } else if (path.includes('/trading-ops/run-gtt-check')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Kích hoạt kiểm tra đối chiếu giá thanh toán GTT';
    actionDescription = 'So khớp giá thanh toán thực tế giữa CoreEX và CoreCCP để phát hiện sai lệch.';
    technicalTag = 'CHECK_GTT';
  } else if (path.includes('/trading-ops/gtt-report/push-to-ms')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Đẩy chênh lệch GTT sang hệ thống M-System';
    actionDescription = 'Gửi dữ liệu hiệu chỉnh giá thanh toán sang hệ thống M-System sau khi đối chiếu.';
    technicalTag = 'GTT_PUSH_TO_MS';
  } else if (path.includes('/trading-ops') || path.includes('/reconciliation')) {
    module = LOG_MODULES.TRADING_OPS;
    actionTitle = 'Thao tác đối chiếu ca trực';
    actionDescription = 'Thực hiện thao tác tính toán hoặc cập nhật trạng thái trong phân hệ đối chiếu giao dịch.';
  }

  // 3. CCP CLEARING & STATISTICS
  else if (path.includes('/ccp-clearing/run-ce-ccp-gtt-check')) {
    module = LOG_MODULES.CCP_CLEARING;
    actionTitle = 'Kiểm tra đối chiếu GTT CoreEX ↔ CoreCCP';
    actionDescription = 'Đối soát giá thanh toán hợp đồng giữa sàn CoreEX và trung tâm bù trừ CoreCCP.';
    technicalTag = 'CE_CCP_GTT_CHECK';
  } else if (path.includes('/ccp-clearing/lot-statistics/sync-exchange-rate')) {
    module = LOG_MODULES.CCP_CLEARING;
    actionTitle = 'Đồng bộ tỷ giá thống kê Lot CCP';
    actionDescription = 'Cập nhật tỷ giá quy đổi phục vụ báo cáo thống kê khối lượng hợp đồng CCP.';
    technicalTag = 'SYNC_LOT_EXCHANGE_RATE';
  } else if (path.includes('/ccp-clearing/lot-statistics/upload-tygia')) {
    module = LOG_MODULES.CCP_CLEARING;
    actionTitle = 'Tải lên bảng tỷ giá thống kê Lot';
    actionDescription = 'Tải lên bảng tỷ giá quy định để tính toán thống kê khối lượng giao dịch CCP.';
    technicalTag = 'UPLOAD_TYGIA_LOT';
  } else if (path.includes('/ccp-statistics') || path.includes('/lot-statistics') || path.includes('/value-statistics')) {
    module = LOG_MODULES.CCP_CLEARING;
    if (path.includes('run-lot') || path.includes('trigger-lot-macro')) {
      actionTitle = 'Chạy thống kê khối lượng (Lot) CCP';
      actionDescription = 'Chạy tiến trình tính toán và cập nhật số liệu khối lượng hợp đồng giao dịch CCP.';
      technicalTag = 'RUN_LOT_STATS';
    } else if (path.includes('run-value') || path.includes('trigger-value-macro')) {
      actionTitle = 'Chạy thống kê giá trị giao dịch CCP';
      actionDescription = 'Chạy tiến trình tính toán và cập nhật số liệu tổng giá trị thanh toán CCP.';
      technicalTag = 'RUN_VALUE_STATS';
    } else {
      actionTitle = 'Cấu hình & Xử lý số liệu CCP';
      actionDescription = 'Cập nhật cấu hình hoặc chạy xử lý dữ liệu thống kê bù trừ CoreCCP.';
    }
  }

  // 4. QUẢN TRỊ HỆ THỐNG
  else if (path.includes('/system-settings/verify-storage-path')) {
    module = LOG_MODULES.ADMIN_SYSTEM;
    actionTitle = 'Kiểm tra hợp lệ đường dẫn lưu trữ';
    actionDescription = 'Kiểm tra quyền truy cập đọc/ghi trên thư mục lưu trữ sao lưu được cấu hình.';
    technicalTag = 'VERIFY_STORAGE_PATH';
  } else if (path.includes('/system-settings')) {
    module = LOG_MODULES.ADMIN_SYSTEM;
    actionTitle = 'Lưu cấu hình hệ thống chung';
    actionDescription = 'Cập nhật tham số cấu hình chung, thông tin đường dẫn lưu trữ hoặc tài khoản hệ thống.';
    technicalTag = 'SYSTEM_SETTINGS_UPDATE';
  }

  // 5. CA TRỰC & CHECKLIST
  else if (path.includes('/shifts/initialize')) {
    module = LOG_MODULES.SHIFTS;
    actionTitle = 'Khởi tạo phiên ca trực mới';
    actionDescription = 'Bắt đầu phiên ca trực mới theo mẫu cấu hình khung giờ đã định sẵn.';
    technicalTag = 'INIT_SHIFT';
  } else if (path.includes('/shifts/close')) {
    module = LOG_MODULES.SHIFTS;
    actionTitle = 'Chốt bàn giao và kết thúc ca trực';
    actionDescription = 'Xác nhận hoàn thành toàn bộ công việc và đóng phiên ca trực hiện tại.';
    technicalTag = 'CLOSE_SHIFT';
  } else if (path.includes('/shifts/items/status')) {
    module = LOG_MODULES.SHIFTS;
    actionTitle = 'Cập nhật tiến độ đầu việc ca trực';
    actionDescription = 'Thay đổi trạng thái hoàn thành hoặc ghi chú trên một đầu việc của ca trực.';
    technicalTag = 'UPDATE_TASK_STATUS';
  } else if (path.includes('/shifts/') && path.includes('/add-task')) {
    module = LOG_MODULES.SHIFTS;
    actionTitle = 'Thêm đầu việc phát sinh vào ca trực';
    actionDescription = 'Bổ sung một tác vụ phát sinh ngoài mẫu checklist vào ca trực hiện tại.';
    technicalTag = 'ADD_SHIFT_TASK';
  } else if (path.includes('/shift-jobs/generate')) {
    module = LOG_MODULES.SHIFTS;
    actionTitle = 'Tự động sinh tác vụ ca trực từ mẫu';
    actionDescription = 'Kích hoạt quy trình sinh tự động danh sách tác vụ cho ca trực.';
    technicalTag = 'GENERATE_SHIFT_JOBS';
  } else if (path.includes('/shift-slots')) {
    module = LOG_MODULES.SHIFTS;
    if (method === 'POST') actionTitle = 'Tạo mới khung giờ ca trực';
    else if (method === 'PUT') actionTitle = 'Cập nhật khung giờ ca trực';
    else if (method === 'DELETE') actionTitle = 'Xóa khung giờ ca trực';
    else actionTitle = 'Quản lý khung giờ ca trực';
    actionDescription = 'Thiết lập danh mục khung giờ làm việc và thời gian chuyển giao ca trực.';
    technicalTag = 'SHIFT_SLOTS_CONFIG';
  } else if (path.includes('/templates')) {
    module = LOG_MODULES.SHIFTS;
    if (method === 'POST') actionTitle = 'Tạo mới mẫu checklist ca trực';
    else if (method === 'PUT') actionTitle = 'Cập nhật mẫu checklist ca trực';
    else if (method === 'DELETE') actionTitle = 'Xóa mẫu checklist ca trực';
    else actionTitle = 'Quản lý mẫu checklist ca trực';
    actionDescription = 'Cấu hình danh mục các đầu việc chuẩn hóa cần thực hiện trong từng ca trực.';
    technicalTag = 'CHECKLIST_TEMPLATE_CONFIG';
  }

  // 6. TÀI KHOẢN & PHÂN QUYỀN
  else if (path.includes('/users')) {
    module = LOG_MODULES.ADMIN_USERS;
    if (method === 'POST') actionTitle = 'Tạo tài khoản người dùng mới';
    else if (method === 'PUT') actionTitle = 'Cập nhật thông tin tài khoản';
    else if (method === 'DELETE') actionTitle = 'Xóa / Khóa tài khoản người dùng';
    else actionTitle = 'Quản lý tài khoản người dùng';
    actionDescription = 'Thực hiện thay đổi hồ sơ nhân sự, phân quyền hoặc trạng thái hoạt động của tài khoản.';
    technicalTag = 'USER_MANAGEMENT';
  } else if (path.includes('/departments')) {
    module = LOG_MODULES.ADMIN_USERS;
    if (method === 'POST') actionTitle = 'Tạo mới phòng ban';
    else if (method === 'PUT') actionTitle = 'Cập nhật thông tin phòng ban';
    else if (method === 'DELETE') actionTitle = 'Xóa phòng ban';
    else actionTitle = 'Quản lý sơ đồ phòng ban';
    actionDescription = 'Thiết lập cơ cấu tổ chức và phòng ban làm việc trong hệ thống.';
    technicalTag = 'DEPARTMENT_MANAGEMENT';
  } else if (path.includes('/roles')) {
    module = LOG_MODULES.ADMIN_USERS;
    if (path.includes('/permissions')) {
      const match = path.match(/\/roles\/(.*)\/permissions/);
      const roleCode = match ? match[1] : '';
      actionTitle = `Cập nhật phân quyền vai trò ${roleCode ? `[${roleCode}]` : 'hệ thống'}`;
      actionDescription = 'Điều chỉnh ma trận phân quyền các chức năng chi tiết cho vai trò người dùng.';
      technicalTag = 'ROLE_PERMISSIONS_UPDATE';
    } else {
      actionTitle = method === 'POST' ? 'Tạo mới vai trò người dùng' : 'Cập nhật thông tin vai trò';
      actionDescription = 'Quản lý danh mục vai trò người dùng trong hệ thống.';
      technicalTag = 'ROLE_MANAGEMENT';
    }
  }

  // 7. QUẢN LÝ SỰ CỐ
  else if (path.includes('/incidents')) {
    module = LOG_MODULES.INCIDENTS;
    if (path.includes('/resolve')) {
      actionTitle = 'Xác nhận xử lý hoàn tất sự cố';
      actionDescription = 'Đánh dấu sự cố vận hành đã được khắc phục và ghi nhận giải pháp.';
      technicalTag = 'INCIDENT_RESOLVED';
    } else if (method === 'POST') {
      actionTitle = 'Khai báo sự cố vận hành mới';
      actionDescription = 'Ghi nhận sự cố phát sinh trong ca trực kèm mức độ nghiêm trọng.';
      technicalTag = 'INCIDENT_CREATED';
    } else if (method === 'PUT') {
      actionTitle = 'Cập nhật tiến độ xử lý sự cố';
      actionDescription = 'Ghi nhận nhật ký xử lý hoặc cập nhật trạng thái sự cố vận hành.';
      technicalTag = 'INCIDENT_UPDATED';
    } else {
      actionTitle = 'Quản lý báo cáo sự cố ca trực';
      actionDescription = 'Thao tác liên quan đến phân hệ theo dõi và quản lý sự cố.';
    }
  }

  // 8. KÊNH THÔNG BÁO & CẢNH BÁO
  else if (path.includes('/notifications')) {
    module = LOG_MODULES.NOTIFICATIONS;
    if (path.includes('/test')) {
      actionTitle = 'Gửi thử nghiệm thông báo kiểm tra (Test Alert)';
      actionDescription = 'Gửi tin nhắn mẫu kiểm tra kết nối tới kênh nhận tin Teams hoặc Telegram.';
      technicalTag = 'NOTIFICATION_TEST';
    } else if (path.includes('/channels')) {
      actionTitle = method === 'POST' ? 'Tạo mới kênh thông báo' : 'Cập nhật cấu hình kênh thông báo';
      actionDescription = 'Thiết lập Webhook hoặc tài khoản Bot gửi cảnh báo tự động.';
      technicalTag = 'NOTIFICATION_CHANNELS';
    } else if (path.includes('/rules')) {
      actionTitle = 'Cập nhật quy tắc gửi cảnh báo tự động';
      actionDescription = 'Thiết lập điều kiện kích hoạt và nhóm nhận thông báo khi có sự cố.';
      technicalTag = 'NOTIFICATION_RULES';
    } else {
      actionTitle = 'Cập nhật cài đặt kênh thông báo';
      actionDescription = 'Quản trị hệ thống cảnh báo và phân phối tin tức vận hành.';
    }
  }

  // 9. LỊCH LÀM VIỆC
  else if (path.includes('/working-calendar')) {
    module = LOG_MODULES.CALENDAR;
    actionTitle = 'Cập nhật lịch làm việc / ca trực';
    actionDescription = 'Thiết lập phân công ca trực, lịch trực cuối tuần hoặc ngày nghỉ lễ.';
    technicalTag = 'WORKING_CALENDAR_UPDATE';
  }

  // 10. XÁC THỰC & CÁ NHÂN
  else if (path.includes('/auth/profile')) {
    module = LOG_MODULES.AUTH;
    actionTitle = 'Cập nhật hồ sơ cá nhân / Đổi mật khẩu';
    actionDescription = 'Người dùng thay đổi thông tin liên lạc cá nhân hoặc cập nhật mật khẩu đăng nhập.';
    technicalTag = 'PROFILE_UPDATE';
  } else if (path.includes('/auth/login')) {
    module = LOG_MODULES.AUTH;
    actionTitle = 'Đăng nhập vào hệ thống';
    actionDescription = 'Tài khoản người dùng đăng nhập thành công vào phiên làm việc.';
    technicalTag = 'USER_LOGIN';
  }

  // 11. QUẢN TRỊ KÝ QUỸ
  else if (path.includes('/margin-change-requests') || path.includes('/margin-checker')) {
    module = LOG_MODULES.MARGIN;
    if (path.includes('/approve')) {
      actionTitle = 'Phê duyệt yêu cầu thay đổi ký quỹ';
      actionDescription = 'Chấp thuận yêu cầu điều chỉnh hạn mức hoặc tỷ lệ ký quỹ tài khoản.';
      technicalTag = 'MARGIN_APPROVE';
    } else if (path.includes('/reject')) {
      actionTitle = 'Từ chối yêu cầu thay đổi ký quỹ';
      actionDescription = 'Bác bỏ yêu cầu điều chỉnh mức ký quỹ tài khoản.';
      technicalTag = 'MARGIN_REJECT';
    } else {
      actionTitle = 'Quản lý yêu cầu điều chỉnh ký quỹ';
      actionDescription = 'Thao tác liên quan đến rà soát tỷ lệ và yêu cầu thay đổi ký quỹ.';
      technicalTag = 'MARGIN_REQUEST';
    }
  }

  // 12. BÁO CÁO ĐỊNH KỲ
  else if (path.includes('/trading-report')) {
    module = LOG_MODULES.REPORT;
    if (path.includes('process-month')) {
      actionTitle = 'Tổng hợp báo cáo giao dịch tháng';
      actionDescription = 'Chạy tiến trình tính toán và xuất báo cáo khối lượng giao dịch tháng.';
      technicalTag = 'REPORT_MONTH';
    } else if (path.includes('process-quarter')) {
      actionTitle = 'Tổng hợp báo cáo giao dịch quý';
      actionDescription = 'Chạy tiến trình tính toán và xuất báo cáo khối lượng giao dịch quý.';
      technicalTag = 'REPORT_QUARTER';
    } else {
      actionTitle = 'Xử lý báo cáo định kỳ';
      actionDescription = 'Cập nhật dữ liệu hoặc chạy tính toán báo cáo định kỳ.';
    }
  }

  // Extract business parameters
  const businessParameters = extractBusinessParameters(body, params, path);

  return {
    module,
    actionTitle,
    actionDescription,
    method,
    path,
    cleanEndpoint: path,
    technicalTag,
    businessParameters,
    clientInfo,
    responseSummary,
    rawPayload: rawJson,
    hasPayload,
  };
}

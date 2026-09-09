export interface TkgdNotificationItem {
  id: string;
  type: 'pipeline' | 'mail' | 'msystem' | 'reconcile' | 'auto_247' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  meta?: {
    totalRecords?: number;
    khopCount?: number;
    lechCount?: number;
    mailCount?: number;
    investorCode?: string;
  };
}

const STORAGE_KEY = 'tkgd_notifications_history_v1';
const EVENT_NAME = 'tkgd-notification-updated';

/**
 * Danh sách thông báo mẫu khởi tạo độc lập cho hệ thống TKGD
 */
const DEFAULT_NOTIFICATIONS: TkgdNotificationItem[] = [
  {
    id: 'tkgd-init-1',
    type: 'info',
    title: 'Hệ Thống Đối Soát TKGD Sẵn Sàng',
    message: 'Phân hệ bóc tách email và đối soát mở tài khoản giao dịch (TTBT) đã sẵn sàng hoạt động.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isRead: false,
  },
  {
    id: 'tkgd-init-2',
    type: 'auto_247',
    title: 'Giám Sát Tự Động 24/7',
    message: 'Bot tự động hóa quét mail Outlook và cào M-System theo chu kỳ mỗi 5 phút.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    isRead: true,
  },
];

/**
 * Lấy danh sách thông báo TKGD từ LocalStorage
 */
export function getTkgdNotifications(): TkgdNotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_NOTIFICATIONS;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

/**
 * Lưu danh sách thông báo TKGD vào LocalStorage và phát event cập nhật
 */
export function saveTkgdNotifications(items: TkgdNotificationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50))); // Giữ tối đa 50 thông báo gần nhất
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {}
}

/**
 * Thêm một thông báo mới cho phân hệ TKGD
 */
export function addTkgdNotification(
  item: Omit<TkgdNotificationItem, 'id' | 'timestamp' | 'isRead'> & {
    id?: string;
    timestamp?: string;
    isRead?: boolean;
  }
): void {
  if (typeof window === 'undefined') return;
  const current = getTkgdNotifications();
  const newItem: TkgdNotificationItem = {
    id: item.id || `tkgd-notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: item.type,
    title: item.title,
    message: item.message,
    timestamp: item.timestamp || new Date().toISOString(),
    isRead: item.isRead ?? false,
    meta: item.meta,
  };

  const updated = [newItem, ...current];
  saveTkgdNotifications(updated);
}

/**
 * Đánh dấu toàn bộ thông báo TKGD là đã đọc
 */
export function markAllTkgdNotificationsAsRead(): void {
  const current = getTkgdNotifications();
  const updated = current.map((item) => ({ ...item, isRead: true }));
  saveTkgdNotifications(updated);
}

/**
 * Xóa sạch lịch sử thông báo TKGD
 */
export function clearAllTkgdNotifications(): void {
  saveTkgdNotifications([]);
}

/**
 * Hook lắng nghe sự kiện thay đổi thông báo TKGD
 */
export function subscribeTkgdNotifications(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) callback();
  });
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

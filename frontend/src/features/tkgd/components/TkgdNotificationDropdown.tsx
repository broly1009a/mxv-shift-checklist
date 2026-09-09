'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Server,
  Cpu,
  Info,
  Check,
  Trash2,
  Layers,
} from 'lucide-react';
import {
  TkgdNotificationItem,
  getTkgdNotifications,
  markAllTkgdNotificationsAsRead,
  clearAllTkgdNotifications,
  subscribeTkgdNotifications,
} from '../utils/tkgdNotifications';

/**
 * Tính toán thời gian tương đối thân thiện (VD: "vừa xong", "3 phút trước", "10:20 Hôm nay")
 */
function formatTimeAgo(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (3600 * 1000));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24 && d.getDate() === now.getDate()) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m} Hôm nay`;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m} ${day}/${month}`;
  } catch {
    return '-';
  }
}

interface TkgdNotificationDropdownProps {
  onOpenLogs?: () => void;
}

export const TkgdNotificationDropdown: React.FC<TkgdNotificationDropdownProps> = ({ onOpenLogs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TkgdNotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tải danh sách và lắng nghe thay đổi
  useEffect(() => {
    setNotifications(getTkgdNotifications());
    const unsubscribe = subscribeTkgdNotifications(() => {
      setNotifications(getTkgdNotifications());
    });
    return unsubscribe;
  }, []);

  // Đóng khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = () => {
    markAllTkgdNotificationsAsRead();
    setNotifications(getTkgdNotifications());
  };

  const handleClearAll = () => {
    clearAllTkgdNotifications();
    setNotifications([]);
  };

  // Icon theo từng loại thông báo TKGD
  const renderIcon = (type: TkgdNotificationItem['type']) => {
    switch (type) {
      case 'mail':
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
            }}
          >
            <Mail size={16} />
          </div>
        );
      case 'msystem':
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
            }}
          >
            <Server size={16} />
          </div>
        );
      case 'pipeline':
      case 'reconcile':
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
            }}
          >
            <Layers size={16} />
          </div>
        );
      case 'auto_247':
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(168, 85, 247, 0.12)',
              color: '#a855f7',
            }}
          >
            <Cpu size={16} />
          </div>
        );
      case 'warning':
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
            }}
          >
            <AlertTriangle size={16} />
          </div>
        );
      default:
        return (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(100, 116, 139, 0.12)',
              color: '#64748b',
            }}
          >
            <Info size={16} />
          </div>
        );
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Nút Chuông Thông Báo */}
      <button
        onClick={handleToggle}
        title="Thông báo đối soát TKGD"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: isOpen ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
          border: isOpen ? '1px solid #3b82f6' : '1px solid var(--border-color)',
          color: isOpen ? '#3b82f6' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '17px',
              height: '17px',
              borderRadius: '9px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
              border: '2px solid var(--bg-card)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Menu Dropdown Thông Báo Độc Lập */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxWidth: '90vw',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-app)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Thông báo TKGD
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  fontWeight: 700,
                }}
              >
                TTBT
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.74rem' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <Check size={13} />
                  <span>Đã đọc</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                  title="Xóa tất cả thông báo"
                >
                  <Trash2 size={13} />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>
          </div>

          {/* Danh sách thông báo */}
          <div
            style={{
              maxHeight: '360px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                }}
              >
                <Bell size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>Chưa có thông báo nào về đối soát TKGD.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: item.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.04)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>{renderIcon(item.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '3px',
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          fontWeight: item.isRead ? 600 : 700,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.title}
                      </h4>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.message}
                    </p>

                    {/* Meta tags nếu có */}
                    {item.meta && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {typeof item.meta.khopCount === 'number' && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              fontWeight: 600,
                            }}
                          >
                            Khớp: {item.meta.khopCount}
                          </span>
                        )}
                        {typeof item.meta.lechCount === 'number' && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                item.meta.lechCount > 0
                                  ? 'rgba(239, 68, 68, 0.1)'
                                  : 'rgba(100, 116, 139, 0.1)',
                              color: item.meta.lechCount > 0 ? '#ef4444' : 'var(--text-muted)',
                              fontWeight: 600,
                            }}
                          >
                            Lệch: {item.meta.lechCount}
                          </span>
                        )}
                        {typeof item.meta.mailCount === 'number' && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              fontWeight: 600,
                            }}
                          >
                            {item.meta.mailCount} email
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--bg-app)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Module Đối Soát TKGD (TTBT)</span>
            {onOpenLogs && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenLogs();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Xem Nhật Ký Tác Vụ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

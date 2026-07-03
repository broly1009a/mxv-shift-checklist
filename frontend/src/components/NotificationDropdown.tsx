'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { io } from 'socket.io-client';

export default function NotificationDropdown() {
  const { token } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifyRef = useRef<HTMLDivElement>(null);

  // Dynamic system activities for notifications
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [lastClearedTime, setLastClearedTime] = useState<string | null>(null);
  const [lastReadTime, setLastReadTime] = useState<string | null>(null);
  const [lastAcknowledgedTime, setLastAcknowledgedTime] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cleared = localStorage.getItem('lastClearedNotificationsTime');
      const read = localStorage.getItem('lastReadNotificationsTime');
      setLastClearedTime(cleared);
      setLastReadTime(read);
      setLastAcknowledgedTime(read);
    }
  }, []);

  const handleClearAll = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem('lastClearedNotificationsTime', nowStr);
    setLastClearedTime(nowStr);
    setUnreadCount(0);
  };

  const handleMarkAsRead = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem('lastReadNotificationsTime', nowStr);
    setLastReadTime(nowStr);
    setLastAcknowledgedTime(nowStr);
    setUnreadCount(0);
  };

  const showNotificationsRef = useRef(showNotifications);
  useEffect(() => {
    showNotificationsRef.current = showNotifications;
  }, [showNotifications]);

  const isLoadingRef = useRef(false);

  const fetchActivities = useCallback(async () => {
    if (!token || isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoadingActivities(true);
    try {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const todayStr = vietnamTime.toISOString().split('T')[0];

      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/activity?date=${todayStr}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.warn('Error fetching header activities:', err);
    } finally {
      isLoadingRef.current = false;
      setLoadingActivities(false);
    }
  }, [token]);

  const fetchRef = useRef(fetchActivities);
  useEffect(() => {
    fetchRef.current = fetchActivities;
  }, [fetchActivities]);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const todayStr = vietnamTime.toISOString().split('T')[0];

      const readTime = localStorage.getItem('lastReadNotificationsTime') || '';
      const clearedTime = localStorage.getItem('lastClearedNotificationsTime') || '';

      const res = await fetch(
        `${API_BASE_URL}/api/v1/dashboard/unread-activities-count?date=${todayStr}&lastReadTime=${readTime}&lastClearedTime=${clearedTime}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.warn('Error fetching unread count:', err);
    }
  }, [token]);

  const fetchCountRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchCountRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (showNotifications) {
      fetchRef.current();
    }
  }, [showNotifications]);

  // Initial load when token is available
  useEffect(() => {
    if (token) {
      // Only fetch the unread count initially to show the badge.
      // The activity list will only be fetched when the user opens the dropdown tray.
      fetchCountRef.current();
    }
  }, [token]);

  // WebSockets Real-time Synchronization for Notifications
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to socket gateway from NotificationDropdown (Notifications)');
    });

    const handleUpdateEvent = (payload: any) => {
      console.log('Notification update event received via WS:', payload);
      // Always update the badge count
      fetchCountRef.current();
      // Only update the list of activities if the notification tray is currently open
      if (showNotificationsRef.current) {
        fetchRef.current();
      }
    };

    socket.on('dashboard-updated', handleUpdateEvent);
    socket.on('task-updated', handleUpdateEvent);
    socket.on('shift-job-generated', handleUpdateEvent);
    socket.on('shift-job-closed', handleUpdateEvent);

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const formatTimeElapsed = (dateStr: string) => {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  // Filter out cleared notifications
  const displayedActivities = activities.filter(act => {
    if (!lastClearedTime) return true;
    return new Date(act.createdAt).getTime() > new Date(lastClearedTime).getTime();
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={notifyRef} style={{ position: 'relative' }}>
      <button 
        onClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) {
            setUnreadCount(0);
            setLastAcknowledgedTime(new Date().toISOString());
          }
        }}
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          color: 'var(--text-primary)', 
          cursor: 'pointer', 
          padding: '8px', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        className="hover:border-slate-300 dark:hover:border-slate-700"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-sidebar)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="glass-panel" style={{
          position: 'absolute',
          right: 0,
          top: '46px',
          width: '320px',
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: 'var(--glass-shadow)',
          padding: '16px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Thông báo mới</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span 
                onClick={handleMarkAsRead} 
                style={{ fontSize: '0.75rem', color: 'var(--color-accent)', cursor: 'pointer' }}
              >
                Đánh dấu đã đọc
              </span>
              <span 
                onClick={handleClearAll} 
                style={{ fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer' }}
              >
                Xóa tất cả
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            {loadingActivities ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-pulse" style={{ height: '42px', borderRadius: '8px' }} />
                ))}
              </div>
            ) : displayedActivities.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Không có hoạt động nào hôm nay.
              </div>
            ) : (
              displayedActivities.map((act, idx) => {
                let title = 'Cập nhật hệ thống';
                if (act.type === 'TASK_UPDATED') {
                  title = 'Cập nhật tác vụ';
                } else if (act.type === 'JOB_GENERATED') {
                  title = 'Khởi tạo ca trực';
                }

                const isLast = idx === displayedActivities.length - 1;
                const isUnread = !lastReadTime || new Date(act.createdAt).getTime() > new Date(lastReadTime).getTime();

                return (
                  <div 
                    key={act.id || idx} 
                    style={{ 
                      fontSize: '0.8rem', 
                      paddingBottom: isLast ? '0' : '8px', 
                      borderBottom: isLast ? 'none' : '1px dashed var(--border-color)',
                      opacity: isUnread ? 1 : 0.75,
                      transition: 'opacity 0.25s ease'
                    }}
                  >
                    <p style={{ 
                      fontWeight: isUnread ? 700 : 600, 
                      margin: '0 0 2px 0', 
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {isUnread && (
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--color-accent, #3b82f6)',
                          flexShrink: 0
                        }} />
                      )}
                      {title}
                    </p>
                    <p style={{ color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: '1.3' }}>
                      {act.message}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {act.actorName || 'Hệ thống'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatTimeElapsed(act.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

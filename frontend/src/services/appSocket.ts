'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/context/AuthContext';

let sharedSocket: Socket | null = null;

/**
 * Lấy Socket instance dùng chung (Singleton) cho toàn bộ ứng dụng.
 * Tránh việc mở hàng chục WebSocket độc lập gây bão kết nối (connection storm),
 * đồng thời ngăn ngừa triệt để lỗi "WebSocket is closed before the connection is established"
 * khi người dùng chuyển đổi qua lại giữa các tab.
 */
export function getAppSocket(): Socket {
  if (!sharedSocket && typeof window !== 'undefined') {
    const socketUrl = API_BASE_URL || window.location.origin;

    sharedSocket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Tự động fallback polling nếu reverse proxy/SSL chưa nâng cấp WSS kịp
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    if (process.env.NODE_ENV !== 'production') {
      sharedSocket.on('connect', () => {
        console.log('[AppSocket] Connected to WebSocket Gateway:', sharedSocket?.id);
      });
      sharedSocket.on('disconnect', (reason) => {
        console.log('[AppSocket] Disconnected from WebSocket Gateway:', reason);
      });
      sharedSocket.on('connect_error', (err) => {
        console.warn('[AppSocket] Connection error:', err.message);
      });
    }
  }

  return sharedSocket!;
}

/**
 * Hook đăng ký lắng nghe sự kiện WebSocket an toàn trong vòng đời của React Component.
 * - Chỉ đăng ký/hủy bỏ event listener (`socket.on` / `socket.off`).
 * - TUYỆT ĐỐI KHÔNG ngắt kết nối (`socket.disconnect()`) khi component unmount hoặc khi đổi tab.
 * - Dùng `useRef` cho handlers để luôn gọi phiên bản mới nhất của hàm xử lý mà không cần re-subscribe.
 */
export function useAppSocket(
  handlers: Record<string, (...args: any[]) => void>,
  enabled: boolean = true,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const socket = getAppSocket();
    if (!socket) return;

    const registeredEvents: Array<{ event: string; fn: (...args: any[]) => void }> = [];

    Object.keys(handlersRef.current).forEach((event) => {
      const listener = (...args: any[]) => {
        if (handlersRef.current[event]) {
          handlersRef.current[event](...args);
        }
      };
      socket.on(event, listener);
      registeredEvents.push({ event, fn: listener });
    });

    return () => {
      // Khi component unmount hoặc đổi tab, CHỈ hủy đăng ký listener của component đó
      // Giữ nguyên kết nối WebSocket nền cho các tab và component khác
      registeredEvents.forEach(({ event, fn }) => {
        socket.off(event, fn);
      });
    };
  }, [enabled]);
}

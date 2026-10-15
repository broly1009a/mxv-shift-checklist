/**
 * ============================================================================
 * CORECCP-SOCKET.CLIENT.TS
 * ============================================================================
 * Client kết nối WebSocket NotiSocket (Engine.IO / Socket.IO v4) của CoreCCP.
 * Lắng nghe thông báo hoàn thành export và bắt reportId động theo fekey.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ICcpAuthSession, ICcpExportNotification } from './coreccp.types';

@Injectable()
export class CoreCcpSocketClient {
  private readonly logger = new Logger(CoreCcpSocketClient.name);
  private ws: any = null;
  private isConnected = false;
  private pingTimer: any = null;
  private pendingListeners = new Map<
    string,
    {
      resolve: (value: ICcpExportNotification) => void;
      reject: (reason?: any) => void;
      timeoutId: any;
    }
  >();

  /**
   * Khởi tạo kết nối WebSocket NotiSocket
   */
  async connect(session: ICcpAuthSession, baseUrl?: string, ticket?: string): Promise<void> {
    if (this.isConnected && this.ws) {
      return;
    }

    const hostUrl = (baseUrl || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const wsHost = hostUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    const wsTicket = ticket || 'ticket_default';
    const wsUrl = `${wsHost}/notisocket/socket.io/?ticket=${wsTicket}&userId=${session.userId}&EIO=4&transport=websocket`;

    this.logger.log(`[Socket] Đang kết nối NotiSocket: ${wsUrl} (User ID: ${session.userId})...`);

    return new Promise((resolve, reject) => {
      try {
        // Sử dụng native WebSocket có sẵn trong Node.js (Node 22+)
        const WebSocketClass = (globalThis as any).WebSocket || (global as any).WebSocket;
        if (!WebSocketClass) {
          throw new Error('Môi trường Node.js không hỗ trợ native WebSocket.');
        }

        this.ws = new WebSocketClass(wsUrl, {
          headers: {
            'Origin': hostUrl,
            'Cookie': `SESSION=${session.sessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Bot-Ingress/1.0',
          },
        });

        this.ws.onopen = () => {
          this.logger.debug('[Socket] WebSocket transport open, đang chờ Engine.IO handshake...');
        };

        this.ws.onmessage = (event: any) => {
          this.handleIncomingMessage(event.data, resolve);
        };

        this.ws.onerror = (err: any) => {
          this.logger.error(`[Socket] Lỗi kết nối WebSocket: ${err.message || err}`);
          if (!this.isConnected) reject(err);
        };

        this.ws.onclose = () => {
          this.logger.warn('[Socket] NotiSocket đã đóng kết nối');
          this.isConnected = false;
          clearInterval(this.pingTimer);
        };

        // Fallback resolve sau 3s nếu server Engine.IO kết nối thành công
        setTimeout(() => {
          if (this.isConnected) resolve();
        }, 3000);
      } catch (err: any) {
        this.logger.error(`[Socket] Không thể khởi tạo WebSocket: ${err.message}`);
        reject(err);
      }
    });
  }

  /**
   * Đăng ký chờ thông báo Export xong cho một `fekey` cụ thể
   */
  waitForExportCompletion(fekey: string, timeoutMs = 30000): Promise<ICcpExportNotification> {
    return new Promise((resolve, reject) => {
      this.logger.log(`[Socket] ⏳ Đang chờ NotiSocket phản hồi cho fekey: "${fekey}" (Timeout: ${timeoutMs}ms)...`);

      const timeoutId = setTimeout(() => {
        this.pendingListeners.delete(fekey);
        this.logger.warn(`[Socket] ⚠️ Quá thời gian chờ NotiSocket cho fekey: "${fekey}"`);
        reject(new Error(`Timeout ${timeoutMs}ms chờ xuất file CoreCCP (fekey: ${fekey})`));
      }, timeoutMs);

      this.pendingListeners.set(fekey, { resolve, reject, timeoutId });
    });
  }

  /**
   * Ngắt kết nối WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    clearInterval(this.pingTimer);
    this.pendingListeners.clear();
  }

  /**
   * Xử lý gói tin Engine.IO / Socket.IO v4
   */
  private handleIncomingMessage(rawMessage: string, onConnected?: () => void): void {
    if (typeof rawMessage !== 'string') return;

    // 1. Engine.IO Handshake: '0{"sid":"...","pingInterval":25000,...}'
    if (rawMessage.startsWith('0')) {
      this.isConnected = true;
      this.logger.debug('[Socket] Engine.IO Handshake thành công. Gửi connect namespace 40...');
      this.sendMessage('40');
      return;
    }

    // 2. Namespace Connected: '40'
    if (rawMessage.startsWith('40')) {
      this.logger.debug('[Socket] Namespace connected. Gửi SUBSCRIBE room REPORT...');
      const subPayload = JSON.stringify([
        'SUBSCRIBE',
        { action: 'SUBSCRIBE', userID: 213, room: ['NOTI', 'REPORT', 'SOCKET'] }
      ]);
      this.sendMessage(`42${subPayload}`);
      if (onConnected) onConnected();
      return;
    }

    // 3. Engine.IO Heartbeat Ping: '2' -> Phản hồi Pong '3'
    if (rawMessage === '2') {
      this.sendMessage('3');
      return;
    }

    // 4. Socket.IO Event: '42["eventName", payload]' hoặc '42/namespace,["eventName", payload]'
    if (rawMessage.startsWith('42')) {
      this.parseSocketIoEvent(rawMessage);
    }
  }

  /**
   * Parse thông tin Socket.IO Event
   */
  private parseSocketIoEvent(rawMessage: string): void {
    try {
      const jsonStart = rawMessage.indexOf('[');
      if (jsonStart === -1) return;

      const payloadStr = rawMessage.substring(jsonStart);
      const [eventName, eventData] = JSON.parse(payloadStr);

      this.logger.debug(`[Socket] Nhận Event: "${eventName}" | Data: ${JSON.stringify(eventData).substring(0, 150)}`);

      const content = eventData?.content || eventData;
      const fekey = content?.fekey || content?.feKey || eventData?.fekey;
      const reportId = content?.autoid || content?.reportId || content?.id || eventData?.reportId;

      if (fekey && this.pendingListeners.has(fekey)) {
        const listener = this.pendingListeners.get(fekey)!;
        clearTimeout(listener.timeoutId);
        this.pendingListeners.delete(fekey);

        this.logger.log(`[Socket] 🎯 BẮT ĐƯỢC REPORT ID THÀNH CÔNG: ${reportId} (Khớp fekey: ${fekey})`);

        listener.resolve({
          reportId,
          fekey,
          fileName: content?.fileName || eventData?.fileName,
          status: content?.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          rawMessage: eventData,
        });
      }
    } catch (err: any) {
      this.logger.warn(`[Socket] Lỗi parse Socket.IO event: ${err.message}`);
    }
  }

  private sendMessage(data: string): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(data);
    }
  }
}

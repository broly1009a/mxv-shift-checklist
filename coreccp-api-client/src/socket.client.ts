/**
 * ============================================================================
 * SOCKET CLIENT - CORECCP NOTISOCKET LISTENER & REPORT ID RESOLVER
 * ============================================================================
 * Kết nối wss://.../notisocket/socket.io/?userId=...&EIO=4&transport=websocket
 * Bắt chính xác Report ID khi server CoreCCP hoàn tất xuất file Excel.
 * ============================================================================
 */

import { ICcpAuthSession } from './types';

export interface IExportNotification {
  reportId: string | number;
  fekey: string;
  fileName?: string;
  status: 'SUCCESS' | 'FAILED';
  rawMessage?: any;
}

export class CoreCcpSocketClient {
  private ws: any = null;
  private isConnected = false;
  private pendingListeners = new Map<
    string,
    {
      resolve: (value: IExportNotification) => void;
      reject: (reason?: any) => void;
      timeoutId: any;
    }
  >();

  private userId: number = 71;

  async connect(session: ICcpAuthSession, baseUrl?: string, ticket?: string): Promise<void> {
    if (this.isConnected && this.ws) return;

    this.userId = session.userId;
    const hostUrl = (baseUrl || 'https://uat-coreccp.mxv.com.vn').replace(/\/+$/, '');
    const wsHost = hostUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    const wsTicket = ticket || 'ticket_default';
    const wsUrl = `${wsHost}/notisocket/socket.io/?ticket=${wsTicket}&userId=${session.userId}&EIO=4&transport=websocket`;

    return new Promise((resolve, reject) => {
      try {
        const WebSocketClass = (globalThis as any).WebSocket || (global as any).WebSocket;
        if (!WebSocketClass) {
          throw new Error('Môi trường Node.js không hỗ trợ native WebSocket (Yêu cầu Node 22+).');
        }

        this.ws = new WebSocketClass(wsUrl, {
          headers: {
            'Origin': hostUrl,
            'Cookie': `SESSION=${session.sessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-API-Client/1.0',
          },
        });

        this.ws.onopen = () => {};

        this.ws.onmessage = (event: any) => {
          this.handleIncomingMessage(event.data, resolve);
        };

        this.ws.onerror = (err: any) => {
          if (!this.isConnected) reject(err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
        };

        // Fallback resolve sau 3s nếu socket đã kết nối
        setTimeout(() => {
          if (this.isConnected) resolve();
        }, 3000);
      } catch (err: any) {
        reject(err);
      }
    });
  }

  waitForExportCompletion(fekey: string, timeoutMs = 30000): Promise<IExportNotification> {
    return new Promise((resolve, reject) => {
      // Đảm bảo đã subscribe room REPORT
      this.sendMessage(JSON.stringify([
        'SUBSCRIBE',
        { action: 'SUBSCRIBE', userID: this.userId, room: ['NOTI', 'REPORT', 'SOCKET'] }
      ]).replace(/^/, '42'));

      const timeoutId = setTimeout(() => {
        this.pendingListeners.delete(fekey);
        reject(new Error(`Timeout ${timeoutMs}ms chờ xuất file CoreCCP (fekey: ${fekey})`));
      }, timeoutMs);

      this.pendingListeners.set(fekey, { resolve, reject, timeoutId });
    });
  }

  disconnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.pendingListeners.clear();
  }

  private handleIncomingMessage(rawMessage: string, onConnected?: () => void): void {
    if (typeof rawMessage !== 'string') return;

    // 1. Engine.IO Handshake
    if (rawMessage.startsWith('0')) {
      this.isConnected = true;
      this.sendMessage('40'); // Connect default namespace
      return;
    }

    // 2. Namespace Connected: '40'
    if (rawMessage.startsWith('40')) {
      // Gửi SUBSCRIBE các kênh thông báo
      const subPayload = JSON.stringify([
        'SUBSCRIBE',
        { action: 'SUBSCRIBE', userID: this.userId, room: ['NOTI', 'REPORT', 'SOCKET'] }
      ]);
      this.sendMessage(`42${subPayload}`);
      if (onConnected) onConnected();
      return;
    }

    // 3. Heartbeat Ping
    if (rawMessage === '2') {
      this.sendMessage('3'); // Pong
      return;
    }

    // 4. Socket.IO Event
    if (rawMessage.startsWith('42')) {
      this.parseSocketIoEvent(rawMessage);
    }
  }

  private parseSocketIoEvent(rawMessage: string): void {
    try {
      const jsonStart = rawMessage.indexOf('[');
      if (jsonStart === -1) return;

      const payloadStr = rawMessage.substring(jsonStart);
      const [, eventData] = JSON.parse(payloadStr);

      const content = eventData?.content || eventData;
      const fekey = content?.fekey || content?.feKey || eventData?.fekey;
      const reportId = content?.autoid || content?.reportId || content?.id || eventData?.reportId;

      if (fekey && this.pendingListeners.has(fekey)) {
        const listener = this.pendingListeners.get(fekey)!;
        clearTimeout(listener.timeoutId);
        this.pendingListeners.delete(fekey);

        listener.resolve({
          reportId,
          fekey,
          fileName: content?.fileName || eventData?.fileName,
          status: content?.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          rawMessage: eventData,
        });
      }
    } catch {}
  }

  private sendMessage(data: string): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(data);
    }
  }
}

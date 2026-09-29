#!/usr/bin/env node
/**
 * DEV SSH TUNNEL RUNNER CHO TKGD BACKEND (RESILIENT AUTO-RECONNECT)
 * ============================================================================
 * Mở đường hầm bảo mật SSH Tunnel kết nối máy Local với MongoDB máy chủ Ubuntu:
 * Local: 127.0.0.1:27018  --->  Ubuntu: 10.0.0.26:27017 (mxv_shift_checklist)
 * Tích hợp:
 *  - SSH Keep-Alive (10s) chống idle timeout
 *  - Bắt lỗi Socket ECONNRESET không làm crash tiến trình
 *  - Tự động kết nối lại (Auto-Reconnect) khi mạng bị đứt
 * ============================================================================
 */

const net = require('net');
const { Client } = require('ssh2');

const SSH_CONFIG = {
  host: process.env.UBUNTU_HOST || '10.0.0.26',
  port: parseInt(process.env.UBUNTU_PORT || '22', 10),
  username: process.env.UBUNTU_USER || 'mxvadmin',
  password: process.env.UBUNTU_PASSWORD || 'MxV!,#2o26',
  keepaliveInterval: 10000, // Gửi ping keepalive mỗi 10 giây chống ngắt phiên
  keepaliveCountMax: 5,
  readyTimeout: 20000,
};

const LOCAL_PORT = parseInt(process.env.LOCAL_MONGO_PORT || '27018', 10);
const REMOTE_PORT = 27017;

// Ngăn ngừa crash do các lỗi socket reset đột ngột từ connection pool
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.message?.includes('ECONNRESET')) {
    // Nuốt lỗi socket reset bình thường trong connection pool, không thoát process
    return;
  }
  console.error('[TUNNEL-FATAL]', err);
});

console.log('='.repeat(75));
console.log('   KHỞI ĐỘNG SSH TUNNEL: LOCAL <---> MONGODB UBUNTU (10.0.0.26)');
console.log('='.repeat(75));

let localServer = null;
let isReconnecting = false;

function createLocalServer(conn) {
  if (localServer) {
    try { localServer.close(); } catch {}
  }

  localServer = net.createServer((sock) => {
    sock.on('error', () => {
      sock.destroy();
    });

    conn.forwardOut('127.0.0.1', sock.remotePort, '127.0.0.1', REMOTE_PORT, (err, stream) => {
      if (err) {
        sock.destroy();
        return;
      }

      stream.on('error', () => {
        sock.destroy();
      });

      sock.pipe(stream).pipe(sock);
    });
  });

  localServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n⚠️ Cổng ${LOCAL_PORT} đã có tiến trình sử dụng (đang hoạt động sẵn).`);
    } else {
      console.error('Lỗi Tunnel Server:', err.message);
    }
  });

  localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`\n  ĐƯỜNG HẦM ĐÃ SẴN SÀNG! (Tự động giữ kết nối 24/7)`);
    console.log(`  Local MongoDB URI: mongodb://127.0.0.1:${LOCAL_PORT}/mxv_shift_checklist\n`);
  });
}

function startTunnel() {
  console.log(`[TUNNEL] Đang kết nối SSH tới ${SSH_CONFIG.host}:${SSH_CONFIG.port}...`);
  const conn = new Client();

  conn
    .on('ready', () => {
      isReconnecting = false;
      console.log('  -> Xác thực SSH thành công!');
      createLocalServer(conn);
    })
    .on('error', (err) => {
      console.error('❌ Lỗi kết nối SSH:', err.message);
    })
    .on('close', () => {
      if (!isReconnecting) {
        isReconnecting = true;
        console.log('⚠️ Kết nối SSH bị đóng. Đang tự động kết nối lại sau 3 giây...');
        setTimeout(() => {
          startTunnel();
        }, 3000);
      }
    })
    .connect(SSH_CONFIG);
}

startTunnel();

/**
 * ============================================================================
 * TEST_CORECCP_MODULAR_CLIENT.JS
 * ============================================================================
 * Script kiểm thử trực tiếp phân hệ CoreCCP Client độc lập:
 * - Test 1: Kiểm thử KIỂU 1 (Direct JSON Search với pageSize: 200,000 -> Excel)
 * - Test 2: Kiểm thử KIỂU 2 (Server Export -> Socket.IO bắt reportId -> Download XLSX)
 * 
 * Lệnh chạy (USER tự chạy trên Terminal):
 *   node backend/src/scripts/test_coreccp_modular_client.js
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CCP_URL = 'https://uat-coreccp.mxv.com.vn';
const USERNAME = 'hieptruong';
const PASSWORD = 'Taovipko0!';
const OUTPUT_DIR = path.resolve(__dirname, 'output', 'test_modular_downloads');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── 1. HÀM ĐĂNG NHẬP CORECCP LẤY BEARER VÀ SESSION COOKIE ───────────────────
function login(username, password) {
  return new Promise((resolve, reject) => {
    console.log(`[1] Đang xác thực với CoreCCP (${CCP_URL})...`);
    const parsed = new URL(CCP_URL);
    const postData = JSON.stringify({ username, password });

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json, text/plain, */*',
        'connectkey': 'fsscssiam2021',
        'x-devicetype': 'WEB',
        'x-lang': 'vi',
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let sessionCookie = '';
        const setCookies = res.headers['set-cookie'] || [];
        for (const c of setCookies) {
          const m = c.match(/SESSION=([^;]+)/i);
          if (m) { sessionCookie = m[1]; break; }
        }

        try {
          const json = JSON.parse(body);
          const token = json.token || json.accessToken || json.data?.token || json.data?.accessToken;
          
          let userId = 71;
          if (token) {
            const parts = token.split('.');
            if (parts.length > 1) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
              userId = payload.user_id || 71;
            }
          }

          console.log(`  ✓ Đăng nhập thành công! User ID: ${userId}, Session: ${sessionCookie ? sessionCookie.substring(0, 15) + '...' : 'N/A'}`);
          resolve({ token, sessionCookie, userId });
        } catch (err) {
          reject(new Error(`Login error: ${body.substring(0, 150)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── 2. TEST KIỂU 1: DIRECT JSON SEARCH (PAGESIZE 200,000) ───────────────────
function testKieu1Search(token, sessionCookie, searchCode) {
  return new Promise((resolve, reject) => {
    console.log(`\n[2] KIỂM THỬ KIỂU 1: Gọi REST Search API ${searchCode} (pageSize: 200,000)...`);
    const startTime = Date.now();
    const parsed = new URL(CCP_URL);
    const postData = JSON.stringify({
      searchcode: searchCode,
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 }
    });

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: `/ccp/inquiry/maintain/${searchCode}/search/${searchCode}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`,
        'connectkey': 'fsscssiam2021',
        'Cookie': `SESSION=${sessionCookie}`,
        'x-devicetype': 'WEB',
        'x-lang': 'vi',
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const dur = Date.now() - startTime;
        try {
          const json = JSON.parse(body);
          const rows = json.data || [];
          console.log(`  🎯 KẾT QUẢ KIỂU 1: Thành công!`);
          console.log(`     - Số dòng dữ liệu: ${rows.length}`);
          console.log(`     - Tổng bản ghi (totalCount): ${json.page?.totalCount || rows.length}`);
          console.log(`     - Thời gian phản hồi: ${dur}ms (Siêu tốc!)`);
          resolve({ rows, totalCount: json.page?.totalCount });
        } catch (err) {
          reject(new Error(`Kiểu 1 thất bại: ${body.substring(0, 150)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── 3. TEST KIỂU 2: ASYNCHRONOUS EXPORT & SOCKET.IO BẮT REPORT ID ─────────────
function testKieu2ExportWithSocket(token, sessionCookie, userId, searchCode, fileName) {
  return new Promise(async (resolve, reject) => {
    console.log(`\n[3] KIỂM THỬ KIỂU 2: Asynchronous Export cho [${searchCode}] -> ${fileName}...`);
    const fekey = `${searchCode}_${Date.now()}`;
    const parsed = new URL(CCP_URL);

    // 1. Mở WebSocket native (Node.js 22+)
    const wsUrl = `wss://${parsed.hostname}/notisocket/socket.io/?ticket=ticket_test&userId=${userId}&EIO=4&transport=websocket`;
    console.log(`  3.1. Kết nối NotiSocket: ${wsUrl}`);

    const WebSocketClass = global.WebSocket;
    if (!WebSocketClass) {
      return reject(new Error('Môi trường không có native WebSocket'));
    }

    const ws = new WebSocketClass(wsUrl, {
      headers: {
        'Cookie': `SESSION=${sessionCookie}`,
        'Origin': CCP_URL,
      }
    });

    let timeoutId;

    ws.onmessage = (event) => {
      const msg = event.data;
      // Engine.IO handshake
      if (typeof msg === 'string' && msg.startsWith('0')) {
        console.log('    ✓ Engine.IO Handshake OK -> Gửi connect 40');
        ws.send('40');
        return;
      }
      // Heartbeat
      if (msg === '2') {
        ws.send('3');
        return;
      }
      // Socket event
      if (typeof msg === 'string' && msg.startsWith('42')) {
        try {
          const jsonIdx = msg.indexOf('[');
          const [evName, evData] = JSON.parse(msg.substring(jsonIdx));
          console.log(`    📩 [Socket Event] ${evName}:`, JSON.stringify(evData).substring(0, 100));

          const rId = evData?.reportId || evData?.id;
          const rFekey = evData?.fekey || evData?.feKey;

          if (rFekey === fekey || (rId && !rFekey)) {
            console.log(`    🎯🎯🎯 BẮT ĐƯỢC REPORT ID THÀNH CÔNG: ${rId} (fekey: ${fekey})`);
            clearTimeout(timeoutId);
            ws.close();

            // 3.3. Tải file nhị phân qua /ccp/report/download/{id}
            console.log(`  3.3. Đang tải file nhị phân: /ccp/report/download/${rId}...`);
            downloadReportBinary(token, sessionCookie, rId, path.join(OUTPUT_DIR, fileName))
              .then(filePath => resolve({ reportId: rId, filePath }))
              .catch(reject);
          }
        } catch (e) {}
      }
    };

    ws.onopen = async () => {
      console.log('  3.2. Đã mở WebSocket. Đang gửi POST /ccp/export/create với fekey:', fekey);

      // 2. Gửi POST /ccp/export/create
      const postData = JSON.stringify({
        searchcode: searchCode,
        search: {},
        filter: {},
        orderBy: {},
        page: { pageIndex: 1, pageSize: 20 },
        exptype: 'XLSX',
        fekey: fekey
      });

      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: '/ccp/export/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${token}`,
          'connectkey': 'fsscssiam2021',
          'Cookie': `SESSION=${sessionCookie}`,
          'Origin': CCP_URL,
          'Referer': `${CCP_URL}/ORDERS/${searchCode}`,
          'x-devicetype': 'WEB',
          'x-lang': 'vi',
        },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`    ✓ Response /export/create:`, body.substring(0, 120));
        });
      });

      req.on('error', (e) => console.error('Lỗi create export:', e));
      req.write(postData);
      req.end();

      // Set timeout 25 giây
      timeoutId = setTimeout(() => {
        try { ws.close(); } catch(e){}
        reject(new Error(`Timeout 25s không nhận được Socket notification cho fekey: ${fekey}`));
      }, 25000);
    };

    ws.onerror = (err) => {
      console.error('    ✗ WebSocket error:', err.message || err);
    };
  });
}

// ─── 4. TẢI FILE NHỊ PHÂN VỀ ĐĨA ─────────────────────────────────────────────
function downloadReportBinary(token, sessionCookie, reportId, targetPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(CCP_URL);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: `/ccp/report/download/${reportId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'connectkey': 'fsscssiam2021',
        'Cookie': `SESSION=${sessionCookie}`,
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Tải file thất bại HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(targetPath, buf);
        console.log(`    ✓ Tải file thành công! Kích thước: ${(buf.length / 1024).toFixed(1)} KB -> ${targetPath}`);
        resolve(targetPath);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ─── CHẠY TOÀN BỘ KIỂM THỬ ───────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================================');
  console.log('   KIỂM THỬ THỰC TẾ: BẮT REPORT ID & TẢI FILE CORECCP TỰ ĐỘNG');
  console.log('========================================================================\n');

  try {
    // 1. Đăng nhập
    const auth = await login(USERNAME, PASSWORD);

    // 2. Thử Kiểu 1 (Direct JSON Search) với SETTLEMENT (Giá thanh toán)
    await testKieu1Search(auth.token, auth.sessionCookie, 'SETTLEMENT');

    // 3. Thử Kiểu 2 (Server Export + Socket.IO) với ACCOUNTS_INFO (Danh sách tài khoản)
    await testKieu2ExportWithSocket(auth.token, auth.sessionCookie, auth.userId, 'ACCOUNTS_INFO', 'DSTKGD_ACM_test.xlsx');

    console.log('\n========================================================================');
    console.log('   🎉 TẤT CẢ CÁC BƯỚC ĐÃ THÀNH CÔNG VƯỢT TRỘI!');
    console.log(`   File đã lưu tại: ${OUTPUT_DIR}`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ Lỗi trong quá trình chạy kiểm thử:', err.message);
  }
}

run();

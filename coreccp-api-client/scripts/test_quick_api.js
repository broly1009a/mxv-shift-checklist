/**
 * ============================================================================
 * QUICK TEST SCRIPT - KIỂM THỬ SIÊU TỐC CORECCP API
 * ============================================================================
 * Chạy trực tiếp bằng Node.js (Zero Build):
 *   node scripts/test_quick_api.js
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CCP_URL = 'https://coreccp.mxv.com.vn';
const USERNAME = 'hieptruong';
const PASSWORD = 'Taovipko0!';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let playwright;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
}
const { chromium } = playwright;

// 1. Đăng nhập tự động lấy Bearer Token, Session Cookie và WebSocket Ticket
async function login() {
  console.log(`[1] Đang xác thực với CoreCCP (${CCP_URL})...`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let token = '';
  let wsTicket = '';

  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && !token) {
      token = auth.replace('Bearer ', '');
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('issue-ws-ticket')) {
      try {
        const json = await res.json();
        wsTicket = json.ticket || json.data?.ticket || '';
      } catch {}
    }
  });

  await page.goto(`${CCP_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill("input[name='username'], input[type='text']", USERNAME);
  await page.fill("input[name='password'], input[type='password']", PASSWORD);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(2500);

  // Lấy WebSocket ticket chính thức từ SSO Gateway
  try {
    const ticketRes = await page.request.post(`${CCP_URL}/sso/api/v1/oauth/issue-ws-ticket`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    const ticketJson = await ticketRes.json();
    wsTicket = ticketJson.payload?.[0] || '';
  } catch (e) {
    console.warn('Lỗi lấy ws ticket:', e.message);
  }

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'SESSION')?.value || '';

  await browser.close();

  let userId = 71;
  if (token) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      userId = payload.user_id || 71;
    } catch {}
  }

  console.log(`  ✓ Xác thực thành công!`);
  console.log(`     - User ID: ${userId}`);
  console.log(`     - WS Ticket: ${wsTicket || '(mặc định)'}`);
  console.log(`     - Session Cookie: ${sessionCookie.substring(0, 15)}...`);
  return { token, sessionCookie, userId, wsTicket };
}

// 2. Test Kiểu 1: Search API pageSize 200,000
function testKieu1(token, sessionCookie, searchCode) {
  return new Promise((resolve, reject) => {
    console.log(`\n[2] KIỂM THỬ KIỂU 1: Gọi REST Search API [${searchCode}] (pageSize: 200,000)...`);
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
          console.log(`  🎯 KẾT QUẢ KIỂU 1 THÀNH CÔNG:`);
          console.log(`     - Số dòng dữ liệu nhận được: ${rows.length}`);
          console.log(`     - Thời gian phản hồi: ${dur}ms (Siêu tốc!)`);
          resolve(rows);
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

// 3. Test Kiểu 2: Socket.IO bắt reportId & tải file
function testKieu2(token, sessionCookie, userId, ticket, searchCode, fileName) {
  return new Promise((resolve, reject) => {
    console.log(`\n[3] KIỂM THỬ KIỂU 2: Asynchronous Export [${searchCode}] -> Bắt reportId qua Socket.IO...`);
    const startTimeKieu2 = Date.now();
    const fekey = `${searchCode}_${Date.now()}`;
    const parsed = new URL(CCP_URL);

    const wsUrl = `wss://${parsed.hostname}/notisocket/socket.io/?ticket=${ticket || 'ticket_test'}&userId=${userId}&EIO=4&transport=websocket`;
    console.log(`  3.1. Mở NotiSocket: ${wsUrl}`);

    const WebSocketClass = global.WebSocket || globalThis.WebSocket;
    if (!WebSocketClass) return reject(new Error('Yêu cầu Node 22+ hỗ trợ native WebSocket'));

    const ws = new WebSocketClass(wsUrl, {
      headers: { 'Cookie': `SESSION=${sessionCookie}`, 'Origin': CCP_URL }
    });

    let timeoutId;

    ws.onmessage = (event) => {
      const msg = event.data;
      if (typeof msg === 'string' && msg.startsWith('0')) { ws.send('40'); return; }
      if (typeof msg === 'string' && msg.startsWith('40')) {
        // Gửi SUBSCRIBE room REPORT
        ws.send(JSON.stringify(['SUBSCRIBE', { action: 'SUBSCRIBE', userID: userId, room: ['NOTI', 'REPORT', 'SOCKET'] }]).replace(/^/, '42'));
        return;
      }
      if (msg === '2') { ws.send('3'); return; }
      if (typeof msg === 'string' && msg.startsWith('42')) {
        try {
          const jsonIdx = msg.indexOf('[');
          const [evName, evData] = JSON.parse(msg.substring(jsonIdx));
          console.log(`    📩 [Socket Notification] ${evName}:`, JSON.stringify(evData).substring(0, 120));

          const content = evData?.content || evData;
          const rId = content?.autoid || content?.reportId || content?.id || evData?.reportId;
          const rFekey = content?.fekey || content?.feKey || evData?.fekey;

          if (rFekey === fekey || (rId && !rFekey)) {
            console.log(`    🎯🎯🎯 BẮT ĐƯỢC REPORT ID THÀNH CÔNG: ${rId} (fekey: ${fekey})`);
            clearTimeout(timeoutId);
            ws.close();

            console.log(`  3.3. Tải file nhị phân qua: /ccp/report/download/${rId}...`);
            const targetPath = path.join(OUTPUT_DIR, fileName);
            downloadFile(token, sessionCookie, rId, targetPath).then((p) => {
              const durKieu2 = Date.now() - startTimeKieu2;
              console.log(`  🎯 KẾT QUẢ KIỂU 2 THÀNH CÔNG!`);
              console.log(`     - Report ID: ${rId}`);
              console.log(`     - Tổng thời gian (Gửi Export -> Socket báo -> Tải xong file): ${durKieu2}ms (${(durKieu2 / 1000).toFixed(2)}s)`);
              resolve(p);
            }).catch(reject);
          }
        } catch (e) {}
      }
    };

    ws.onopen = () => {
      console.log('  3.2. Socket đã mở. Đang kích hoạt POST /ccp/export/create...');
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
        },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log('    ✓ Phản hồi /export/create:', body.substring(0, 120)));
      });

      req.on('error', reject);
      req.write(postData);
      req.end();

      timeoutId = setTimeout(() => {
        try { ws.close(); } catch(e) {}
        reject(new Error(`Timeout 25s không nhận được Socket notification cho fekey: ${fekey}`));
      }, 25000);
    };

    ws.onerror = (err) => console.error('    ✗ WebSocket error:', err.message || err);
  });
}

function downloadFile(token, sessionCookie, reportId, targetPath) {
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
      if (res.statusCode !== 200) return reject(new Error(`Tải file thất bại HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(targetPath, buf);
        console.log(`    ✓ Tải file thành công! ${(buf.length / 1024).toFixed(1)} KB -> ${targetPath}`);
        resolve(targetPath);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ CORECCP API CLIENT ĐỘC LẬP');
  console.log('========================================================================\n');
  try {
    const auth = await login();
    await testKieu1(auth.token, auth.sessionCookie, 'SETTLEMENT');
    await testKieu2(auth.token, auth.sessionCookie, auth.userId, auth.wsTicket, 'ACCOUNTS_INFO', 'DSTKGD_ACM_test.xlsx');
    console.log('\n🎉 HOÀN THÀNH TẤT CẢ KIỂM THỬ THÀNH CÔNG!');
  } catch (err) {
    console.error('\n❌ Thất bại:', err.message);
  }
}

run();

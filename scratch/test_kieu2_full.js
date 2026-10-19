const { chromium } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'playwright-core'));
const https = require('https');
const path = require('path');
const fs = require('fs');

async function testFull() {
  const CCP_URL = 'https://coreccp.vnclear.vn';
  const USERNAME = 'hieptruong';
  const PASSWORD = 'Taovipko0!';
  const OUTPUT_DIR = path.resolve(__dirname, 'output');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('1. Đăng nhập qua Headless Browser để bẫy Bearer Token & WS Ticket (Tier 2 Sniffer)...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        wsTicket = json.ticket || json.data?.ticket || json.payload?.[0] || '';
      } catch {}
    }
  });

  await page.goto(`${CCP_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill("input[name='username'], input[type='text']", USERNAME);
  await page.fill("input[name='password'], input[type='password']", PASSWORD);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");

  try {
    await page.waitForURL(
      (url) => !url.href.includes('validate_code') && !url.pathname.toLowerCase().includes('/login'),
      { timeout: 25000 }
    );
  } catch (e) {
    console.log('  waitForURL timeout, current URL:', page.url());
  }

  console.log('  Page URL after login:', page.url());
  for (let i = 0; i < 20; i++) {
    if (token) break;
    await page.waitForTimeout(500);
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

  console.log(`  ✓ Xác thực thành công:`);
  console.log(`    - Token: ${token.substring(0, 25)}...`);
  console.log(`    - User ID: ${userId}`);
  console.log(`    - Session: ${sessionCookie.substring(0, 15)}...`);

  // 2. Kích hoạt Kiểu 2: Socket.IO + /ccp/export/create + /ccp/report/download/{id}
  console.log('\n2. Kích hoạt Kiểu 2: WebSocket NotiSocket + POST /ccp/export/create...');
  const fekey = `ORDERMATCH_DETAIL_${Date.now()}`;
  const parsed = new URL(CCP_URL);
  const wsUrl = `wss://${parsed.hostname}/notisocket/socket.io/?ticket=${wsTicket || 'ticket_test'}&userId=${userId}&EIO=4&transport=websocket`;

  const WebSocketClass = globalThis.WebSocket || global.WebSocket;
  const ws = new WebSocketClass(wsUrl, {
    headers: { 'Cookie': `SESSION=${sessionCookie}`, 'Origin': CCP_URL }
  });

  let reportId = null;

  const waitReportId = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout 30s chờ reportId từ WebSocket'));
    }, 30000);

    ws.onmessage = (event) => {
      const msg = event.data;
      if (typeof msg === 'string' && msg.startsWith('0')) { ws.send('40'); return; }
      if (typeof msg === 'string' && msg.startsWith('40')) {
        ws.send(`42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":${userId},"room":["NOTI","REPORT","SOCKET"]}]`);
        return;
      }
      if (msg === '2') { ws.send('3'); return; }
      if (typeof msg === 'string' && msg.startsWith('42')) {
        try {
          const jsonIdx = msg.indexOf('[');
          const [evName, evData] = JSON.parse(msg.substring(jsonIdx));
          console.log(`    📩 [WebSocket] ${evName}:`, JSON.stringify(evData).substring(0, 120));

          const content = evData?.content || evData;
          const rId = content?.autoid || content?.reportId || content?.id || evData?.reportId;
          const rFekey = content?.fekey || content?.feKey || evData?.fekey;

          if (rFekey === fekey || (rId && !rFekey)) {
            console.log(`    🎯🎯🎯 BẮT ĐƯỢC REPORT ID: ${rId}`);
            clearTimeout(timer);
            ws.close();
            resolve(rId);
          }
        } catch (e) {}
      }
    };

    ws.onopen = () => {
      console.log('  2.1. WebSocket đã kết nối. Gửi request POST /ccp/export/create...');
      const postData = JSON.stringify({
        searchcode: 'ORDERMATCH_DETAIL',
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
          'Referer': `${CCP_URL}/ORDERS/ORDERMATCH_DETAIL`
        },
        timeout: 15000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log('  2.2. POST /ccp/export/create status:', res.statusCode, 'body:', body.substring(0, 120));
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    };

    ws.onerror = reject;
  });

  reportId = await waitReportId;

  // 3. Tải file nhị phân qua /ccp/report/download/{reportId}
  console.log(`\n3. Tải file Excel nhị phân qua /ccp/report/download/${reportId}...`);
  const targetFilePath = path.join(OUTPUT_DIR, 'DSGD_test_kieu2.xlsx');
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: `/ccp/report/download/${reportId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'connectkey': 'fsscssiam2021',
        'Cookie': `SESSION=${sessionCookie}`,
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        'Referer': `${CCP_URL}/ORDERS/ORDERMATCH_DETAIL`
      },
      timeout: 30000
    }, (res) => {
      console.log('  Download HTTP status:', res.statusCode);
      if (res.statusCode !== 200) return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      const fileStream = fs.createWriteStream(targetFilePath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const stat = fs.statSync(targetFilePath);
        console.log(`  🎉 TẢI THÀNH CÔNG! File: ${targetFilePath} (${stat.size} bytes)`);
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
}

testFull().catch(console.error);

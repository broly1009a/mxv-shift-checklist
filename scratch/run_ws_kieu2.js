const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const scriptContent = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

class CookieJar {
  constructor() { this.cookies = new Map(); }
  setFromHeaders(headers) {
    let raw = [];
    if (typeof headers.getSetCookie === 'function') raw = headers.getSetCookie();
    else { const s = headers.get('set-cookie'); if (s) raw = [s]; }
    raw.forEach(str => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
    });
  }
  getCookieHeader() { return Array.from(this.cookies.entries()).map(([k, v]) => k + '=' + v).join('; '); }
  getSessionCookie() { return this.cookies.get('SESSION') ? 'SESSION=' + this.cookies.get('SESSION') : this.getCookieHeader(); }
}

async function testWebSocketKieu2() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  const creds = JSON.parse(decrypt(s.value));
  await mongoose.disconnect();

  const baseUrl = 'https://coreccp.vnclear.vn';
  const username = creds.username;
  const password = creds.password;
  const redirectUri = baseUrl + '/validate_code';
  const basicAuth = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';

  const jar = new CookieJar();
  const authUrl = baseUrl + '/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=openid%20profile';

  const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(initRes.headers);
  let loginUrl = initRes.headers.get('location');
  if (loginUrl && !loginUrl.startsWith('http')) loginUrl = baseUrl + loginUrl;
  const loginRes = await fetch(loginUrl || authUrl, { headers: { Cookie: jar.getCookieHeader(), 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(loginRes.headers);
  const html = await loginRes.text();
  const csrf = (html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["']\\s+name=["']_csrf["']/i))[1];

  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', username);
  bodyParams.append('password', password);
  bodyParams.append('page', 'login_ccp');

  const postLoginRes = await fetch(baseUrl + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader(), Origin: baseUrl, Referer: baseUrl + '/login' },
    body: bodyParams.toString(),
    redirect: 'manual'
  });
  jar.setFromHeaders(postLoginRes.headers);
  const loc = postLoginRes.headers.get('location');

  let code = null;
  let nextUrl = loc;
  let hops = 0;
  while (nextUrl && hops < 10) {
    hops++;
    const fullUrl = nextUrl.startsWith('http') ? nextUrl : baseUrl + nextUrl;
    const urlObj = new URL(fullUrl);
    if (urlObj.searchParams.has('code')) { code = urlObj.searchParams.get('code'); break; }
    const hopRes = await fetch(fullUrl, { method: 'GET', headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
    jar.setFromHeaders(hopRes.headers);
    nextUrl = hopRes.headers.get('location');
  }

  const tokenParams = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const tokenRes = await fetch(baseUrl + '/oauth2/token', {
    method: 'POST',
    headers: { Authorization: basicAuth, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader(), Origin: baseUrl },
    body: tokenParams.toString()
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  const jwtParts = token.split('.');
  const jwtPayload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString('utf8'));
  const userId = jwtPayload.user_id || 6;
  console.log('Login OAuth2 OK, userId:', userId);

  // Thử lấy ws-ticket nếu có
  let wsTicket = 'ticket_default';
  try {
    const tRes = await fetch(baseUrl + '/sso/api/v1/oauth/issue-ws-ticket', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Cookie: jar.getSessionCookie() }
    });
    const tJson = await tRes.json();
    if (tJson.payload?.[0]) wsTicket = tJson.payload[0];
    console.log('Got ws-ticket:', wsTicket);
  } catch (e) {
    console.log('No ws-ticket endpoint, using default');
  }

  // Kết nối WebSocket
  const wsUrl = 'wss://coreccp.vnclear.vn/notisocket/socket.io/?ticket=' + wsTicket + '&userId=' + userId + '&EIO=4&transport=websocket';
  console.log('Connecting WS:', wsUrl);

  let WebSocketClass = globalThis.WebSocket;
  if (!WebSocketClass) {
    try { WebSocketClass = require('/opt/mxv-checklist/backend/node_modules/ws'); } catch {
      try { WebSocketClass = require('/opt/mxv-checklist/backend/node_modules/socket.io/node_modules/engine.io/node_modules/ws'); } catch {}
    }
  }
  console.log('Using WebSocket class:', typeof WebSocketClass);
  const ws = new WebSocketClass(wsUrl, {
    headers: { Cookie: jar.getSessionCookie(), Origin: baseUrl }
  });

  const fekey = 'ORDERMATCH_DETAIL_' + Date.now();

  ws.onopen = async () => {
    console.log('WS connected successfully!');
  };

  ws.onmessage = async (event) => {
    const msg = event.data;
    console.log('WS msg received:', typeof msg === 'string' ? msg.substring(0, 100) : msg);
    if (typeof msg === 'string' && msg.startsWith('0')) {
      ws.send('40');
      return;
    }
    if (typeof msg === 'string' && msg.startsWith('40')) {
      console.log('Sending SUBSCRIBE room REPORT...');
      ws.send('42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":' + userId + ',"room":["NOTI","REPORT","SOCKET"]}]');

      // Gửi yêu cầu export sau khi đã subscribe
      console.log('Gửi POST /ccp/export/create với fekey:', fekey);
      const expRes = await fetch(baseUrl + '/ccp/export/create', {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': 'Bearer ' + token,
          'connectkey': 'fsscssiam2021',
          'Content-Type': 'application/json',
          'Cookie': jar.getSessionCookie(),
          'Origin': baseUrl,
          'Referer': baseUrl + '/ORDERS/ORDERMATCH_DETAIL'
        },
        body: JSON.stringify({
          searchcode: 'ORDERMATCH_DETAIL',
          search: {},
          filter: {},
          orderBy: {},
          page: { pageIndex: 1, pageSize: 20 },
          exptype: 'XLSX',
          fekey
        })
      });
      const expData = await expRes.json();
      console.log('POST /ccp/export/create result:', expData);
      return;
    }
    if (msg === '2') {
      ws.send('3');
      return;
    }
    if (typeof msg === 'string' && msg.startsWith('42')) {
      console.log('🎉 BẮT ĐƯỢC NOTIFICATION 42:', msg);
      try {
        const jsonIdx = msg.indexOf('[');
        const [evName, evData] = JSON.parse(msg.substring(jsonIdx));
        const content = evData?.content || evData;
        const rId = content?.autoid || content?.reportId || content?.id;
        console.log('FOUND REPORT ID:', rId);
        if (rId) {
          // Tải file nhị phân
          console.log('Tải file /ccp/report/download/' + rId);
          const dlRes = await fetch(baseUrl + '/ccp/report/download/' + rId, {
            headers: {
              'Authorization': 'Bearer ' + token,
              'connectkey': 'fsscssiam2021',
              'Cookie': jar.getSessionCookie(),
              'Referer': baseUrl + '/ORDERS/ORDERMATCH_DETAIL'
            }
          });
          const buf = await dlRes.arrayBuffer();
          console.log('🎉🎉🎉 DOWNLOADED FILE SIZE BYTES:', buf.byteLength);
          ws.close();
          process.exit(0);
        }
      } catch (e) {
        console.error('Error parsing 42:', e);
      }
    }
  };

  ws.onerror = (err) => console.error('WS Error:', err);

  setTimeout(() => {
    console.log('Test timeout after 25s');
    ws.close();
    process.exit(0);
  }, 25000);
}

testWebSocketKieu2().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const stream = sftp.createWriteStream('/tmp/test_ws_kieu2.js');
    stream.write(scriptContent);
    stream.end(() => {
      conn.exec('node /tmp/test_ws_kieu2.js', (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

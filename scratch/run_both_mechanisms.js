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

async function testBothMechanisms() {
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
  console.log('Login OAuth2 OK, token length:', token.length);

  // Decode userId from JWT
  const jwtParts = token.split('.');
  const jwtPayload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString('utf8'));
  const userId = jwtPayload.user_id || 71;
  console.log('User ID from JWT:', userId);

  // TEST 1: Kiểu 1 - Search full JSON (pageSize: 200000)
  console.log('\\n--- TEST KIỂU 1: Search Full JSON (pageSize: 200000) ---');
  const t0 = Date.now();
  const sRes = await fetch(baseUrl + '/ccp/inquiry/maintain/ORDERMATCH_DETAIL/search/ORDERMATCH_DETAIL', {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': 'Bearer ' + token,
      'connectkey': 'fsscssiam2021',
      'Content-Type': 'application/json',
      'Cookie': jar.getSessionCookie(),
      'Origin': baseUrl,
      'x-devicetype': 'WEB',
      'x-lang': 'vi'
    },
    body: JSON.stringify({
      searchcode: 'ORDERMATCH_DETAIL',
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 }
    })
  });
  const sJson = await sRes.json();
  const duration1 = Date.now() - t0;
  console.log('Kiểu 1 status:', sRes.status, 'Time:', duration1 + 'ms');
  console.log('Kiểu 1 rows returned:', (sJson.data || []).length);
  if ((sJson.data || []).length > 0) {
    console.log('Sample row columns:', Object.keys(sJson.data[0]));
    let totalKhop = 0;
    sJson.data.forEach(r => {
      totalKhop += Number(r.MATCH_QTTY || r.MATCH_VOL || r.MATCH_QTY || r.VOLUME || r.QUANTITY || r.QTY || 0);
    });
    console.log('Total khop from Kiểu 1:', totalKhop);
  }

  // TEST 2: Kiểu 2 - Server Export via /ccp/export/create
  console.log('\\n--- TEST KIỂU 2: POST /ccp/export/create ---');
  const fekey = 'ORDERMATCH_DETAIL_' + Date.now();
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
  const expJson = await expRes.json();
  console.log('Kiểu 2 create export status:', expRes.status, 'response:', expJson);
}

testBothMechanisms().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const stream = sftp.createWriteStream('/tmp/test_both_mechanisms.js');
    stream.write(scriptContent);
    stream.end(() => {
      conn.exec('node /tmp/test_both_mechanisms.js', (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

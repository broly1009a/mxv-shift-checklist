const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const fs = require('fs');

const scriptContent = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  setFromHeaders(headers) {
    let raw = [];
    if (typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else {
      const single = headers.get('set-cookie');
      if (single) raw = [single];
    }
    raw.forEach((str) => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        const k = nameVal.substring(0, eqIdx).trim();
        const v = nameVal.substring(eqIdx + 1).trim();
        this.cookies.set(k, v);
      }
    });
  }
  getCookieHeader() {
    return Array.from(this.cookies.entries()).map(([k, v]) => k + '=' + v).join('; ');
  }
  getSessionCookie() {
    const session = this.cookies.get('SESSION');
    return session ? 'SESSION=' + session : this.getCookieHeader();
  }
}

async function testOAuth2Real() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const s = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  const creds = JSON.parse(decrypt(s.value));
  await mongoose.disconnect();

  const baseUrl = 'https://coreccp.vnclear.vn';
  const username = creds.username;
  const password = creds.password;
  const redirectUri = baseUrl + '/validate_code';
  const basicAuth = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';

  console.log('Testing OAuth2 with real DB user:', username);

  const jar = new CookieJar();
  const authUrl = baseUrl + '/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=' + encodeURIComponent(redirectUri) + '&scope=openid%20profile';

  console.log('1. Khởi tạo truy cập và bẫy _csrf...');
  const initRes = await fetch(authUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    redirect: 'manual'
  });
  jar.setFromHeaders(initRes.headers);

  let loginUrl = initRes.headers.get('location');
  let html = '';
  if (loginUrl) {
    if (!loginUrl.startsWith('http')) loginUrl = baseUrl + loginUrl;
    const loginRes = await fetch(loginUrl, {
      headers: { Cookie: jar.getCookieHeader(), 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual'
    });
    jar.setFromHeaders(loginRes.headers);
    html = await loginRes.text();
  } else {
    html = await initRes.text();
  }

  const csrfMatch = html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["']\\s+name=["']_csrf["']/i);
  if (!csrfMatch) throw new Error('Không bẫy được _csrf token!');
  const csrf = csrfMatch[1];
  console.log('   Bẫy được _csrf:', csrf.slice(0, 15) + '...');

  console.log('2. Submit POST /login form với tài khoản ' + username + '...');
  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', username);
  bodyParams.append('password', password);
  bodyParams.append('page', 'login_ccp');

  const postLoginRes = await fetch(baseUrl + '/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
      Origin: baseUrl,
      Referer: baseUrl + '/login'
    },
    body: bodyParams.toString(),
    redirect: 'manual'
  });
  jar.setFromHeaders(postLoginRes.headers);
  const loc = postLoginRes.headers.get('location');
  console.log('   POST /login status:', postLoginRes.status, 'Location:', loc);

  if (loc && loc.includes('error')) {
    throw new Error('Login CoreCCP bị từ chối: redirect về ' + loc);
  }

  let code = null;
  let nextUrl = loc;
  let hops = 0;
  while (nextUrl && hops < 10) {
    hops++;
    const fullUrl = nextUrl.startsWith('http') ? nextUrl : baseUrl + nextUrl;
    const urlObj = new URL(fullUrl);
    if (urlObj.searchParams.has('code')) {
      code = urlObj.searchParams.get('code');
      break;
    }
    const hopRes = await fetch(fullUrl, {
      method: 'GET',
      headers: { Cookie: jar.getCookieHeader() },
      redirect: 'manual'
    });
    jar.setFromHeaders(hopRes.headers);
    nextUrl = hopRes.headers.get('location');
  }

  if (!code) throw new Error('Không lấy được OAuth2 Code!');
  console.log('3. Lấy được OAuth2 Code:', code);

  console.log('4. POST /oauth2/token để lấy Access Token...');
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri
  });
  const tokenRes = await fetch(baseUrl + '/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
      Origin: baseUrl
    },
    body: tokenParams.toString()
  });
  const tokenData = await tokenRes.json();
  console.log('   Token status:', tokenRes.status);
  console.log('   Access Token nhận được:', tokenData.access_token ? tokenData.access_token.slice(0, 30) + '... (expires_in: ' + tokenData.expires_in + 's)' : tokenData);

  if (tokenData.access_token) {
    console.log('\\n5. KIỂM TRA GỌI API VỚI ACCESS TOKEN MỚI...');
    const searchRes = await fetch(baseUrl + '/ccp/inquiry/maintain/ORDERMATCH_DETAIL/search/ORDERMATCH_DETAIL', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': 'Bearer ' + tokenData.access_token,
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
        page: { pageIndex: 1, pageSize: 5 }
      })
    });
    console.log('   API search status:', searchRes.status);
    const searchData = await searchRes.json();
    console.log('   API search response totalCount:', searchData.page?.totalCount || searchData.payload?.page?.totalCount);
    console.log('   API search response rows:', (searchData.data || searchData.payload?.data || []).length);
  }
}

testOAuth2Real().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const stream = sftp.createWriteStream('/tmp/test_oauth2_remote.js');
    stream.write(scriptContent);
    stream.end(() => {
      console.log('Uploaded /tmp/test_oauth2_remote.js');
      conn.exec('node /tmp/test_oauth2_remote.js', (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

const { Client } = require('ssh2');

const conn = new Client();
console.log('Connecting to Ubuntu (10.0.0.26)...');

conn.on('ready', () => {
  console.log('SSH Connected. Testing CoreCCP direct search APIs on Ubuntu...');

  const remoteScript = `
    const crypto = require('crypto');
    const mongoose = require('mongoose');

    class CookieJar {
      constructor() { this.cookies = new Map(); }
      setFromHeaders(headers) {
        if (!headers) return;
        const setCookieHeaders = typeof headers.getSetCookie === 'function'
          ? headers.getSetCookie()
          : (headers['set-cookie'] || []);
        const rawCookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        rawCookies.forEach(str => {
          if (!str) return;
          const parts = str.split(';');
          const nameVal = parts[0];
          const eqIdx = nameVal.indexOf('=');
          if (eqIdx !== -1) {
            this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
          }
        });
      }
      getCookieHeader() {
        return Array.from(this.cookies.entries()).map(([k, v]) => \`\${k}=\${v}\`).join('; ');
      }
      getSessionCookie() {
        const session = this.cookies.get('SESSION');
        return session ? \`SESSION=\${session}\` : this.getCookieHeader();
      }
    }

    const CCP_PROD_BASIC_AUTH = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';
    const CCP_UAT_BASIC_AUTH  = 'Basic d2ViLWNjcC1teHY6VWtXVDU2eHZCa1pPcmt6M21UWTZ0empmdWhuMkdU';

    function decrypt(encryptedText, encKey) {
      if (!encryptedText) return '';
      const parts = encryptedText.split(':');
      if (parts.length !== 2) return '';
      const rawKey = encKey || 'mxv_default_secret_key_32_chars_long!';
      const secretKey = crypto.createHash('sha256').update(rawKey).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, Buffer.from(parts[0], 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(parts[1], 'hex')), decipher.final()]).toString('utf8');
    }

    async function loginCoreCcp(baseUrl, username, password) {
      const jar = new CookieJar();
      const redirectUri = \`\${baseUrl}/validate_code\`;
      const basicAuth = baseUrl.includes('vnclear.vn') ? CCP_PROD_BASIC_AUTH : CCP_UAT_BASIC_AUTH;
      const authUrl = \`\${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=openid%20profile\`;

      const initRes = await fetch(authUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Ingress/1.0' },
        redirect: 'manual',
      });
      jar.setFromHeaders(initRes.headers);

      let loginUrl = initRes.headers.get('location');
      let html = '';
      if (loginUrl) {
        if (!loginUrl.startsWith('http')) loginUrl = \`\${baseUrl}\${loginUrl}\`;
        const loginRes = await fetch(loginUrl, {
          headers: { Cookie: jar.getCookieHeader(), 'User-Agent': 'Mozilla/5.0' },
          redirect: 'manual',
        });
        jar.setFromHeaders(loginRes.headers);
        html = await loginRes.text();
      } else {
        html = await initRes.text();
      }

      const csrfMatch = html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i) ||
                        html.match(/value=["']([^"']+)["']\\s+name=["']_csrf["']/i);
      if (!csrfMatch) throw new Error('Không bẫy được _csrf token từ form CoreCCP!');
      const csrf = csrfMatch[1];

      const bodyParams = new URLSearchParams();
      bodyParams.append('_csrf', csrf);
      bodyParams.append('username', username);
      bodyParams.append('password', password);
      bodyParams.append('page', 'login_ccp');

      const postLoginRes = await fetch(\`\${baseUrl}/login\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: jar.getCookieHeader(),
          Origin: baseUrl,
          Referer: \`\${baseUrl}/login\`,
        },
        body: bodyParams.toString(),
        redirect: 'manual',
      });
      jar.setFromHeaders(postLoginRes.headers);
      const loc = postLoginRes.headers.get('location');
      if (postLoginRes.status !== 302 || !loc || loc.includes('error')) {
        throw new Error(\`Đăng nhập CoreCCP thất bại: status=\${postLoginRes.status}, loc=\${loc}\`);
      }

      let code = null;
      let nextUrl = loc;
      let hops = 0;
      while (nextUrl && hops < 10) {
        hops++;
        const fullUrl = nextUrl.startsWith('http') ? nextUrl : \`\${baseUrl}\${nextUrl}\`;
        const urlObj = new URL(fullUrl);
        if (urlObj.searchParams.has('code')) {
          code = urlObj.searchParams.get('code');
          break;
        }
        const hopRes = await fetch(fullUrl, {
          method: 'GET',
          headers: { Cookie: jar.getCookieHeader() },
          redirect: 'manual',
        });
        jar.setFromHeaders(hopRes.headers);
        nextUrl = hopRes.headers.get('location');
      }

      if (!code) throw new Error('Không bắt được OAuth2 Code từ CoreCCP!');

      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(\`\${baseUrl}/oauth2/token\`, {
        method: 'POST',
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: jar.getCookieHeader(),
          Origin: baseUrl,
        },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(\`Đổi Access Token CoreCCP thất bại: \${JSON.stringify(tokenData)}\`);
      }

      return {
        sessionCookie: jar.getSessionCookie(),
        accessToken: tokenData.access_token,
      };
    }

    async function searchApi(baseUrl, sessionCookie, accessToken, searchCode, refererRoute) {
      const endpoint = \`/ccp/inquiry/maintain/\${searchCode}/search/\${searchCode}\`;
      const url = \`\${baseUrl}\${endpoint}\`;
      const payload = {
        searchcode: searchCode,
        search: {},
        filter: {},
        orderBy: {},
        page: { pageIndex: 1, pageSize: 200000 }
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'connectkey': 'fsscssiam2021',
          'x-devicetype': 'WEB',
          'Origin': baseUrl,
          'Referer': \`\${baseUrl}\${refererRoute}\`,
          'Cookie': sessionCookie,
          'Authorization': \`Bearer \${accessToken}\`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      return { status: res.status, json };
    }

    async function run() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist', { serverSelectionTimeoutMS: 5000 });
      const db = mongoose.connection.db;
      const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const urlDoc = await db.collection('system_settings').findOne({ key: 'coreccp_base_url' });

      const encKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
      const decrypted = JSON.parse(decrypt(credDoc.value, encKey));
      let rawBaseUrl = (urlDoc?.value || decrypted.url || 'https://coreccp.vnclear.vn').replace(/\\/+$/, '');
      const baseUrl = new URL(rawBaseUrl).origin;
      const username = decrypted.username;
      const password = decrypted.password;

      console.log('Logging in CoreCCP:', username, '@', baseUrl);
      const auth = await loginCoreCcp(baseUrl, username, password);
      console.log('CoreCCP Auth OK!');

      // 1. Search OPEN_POSITION
      console.log('\\n1. Testing searchCode: OPEN_POSITION...');
      const ttmRes = await searchApi(baseUrl, auth.sessionCookie, auth.accessToken, 'OPEN_POSITION', '/ORDERS/OPEN_POSITION');
      const ttmRows = ttmRes.json?.data || ttmRes.json?.payload?.data || [];
      console.log('OPEN_POSITION status:', ttmRes.status, 'Total rows:', ttmRows.length);
      if (ttmRows.length > 0) {
        console.log('Sample row OPEN_POSITION (keys):', Object.keys(ttmRows[0]));
        console.log('Sample row OPEN_POSITION (detail):', JSON.stringify(ttmRows[0], null, 2));
      } else {
        console.log('OPEN_POSITION response:', JSON.stringify(ttmRes.json).slice(0, 300));
      }

      // 2. Search PNL_EXECUTED
      console.log('\\n2. Testing searchCode: PNL_EXECUTED...');
      const ttttRes = await searchApi(baseUrl, auth.sessionCookie, auth.accessToken, 'PNL_EXECUTED', '/ORDERS/PNL_EXECUTED');
      const ttttRows = ttttRes.json?.data || ttttRes.json?.payload?.data || [];
      console.log('PNL_EXECUTED status:', ttttRes.status, 'Total rows:', ttttRows.length);
      if (ttttRows.length > 0) {
        console.log('Sample row PNL_EXECUTED (keys):', Object.keys(ttttRows[0]));
        console.log('Sample row PNL_EXECUTED (detail):', JSON.stringify(ttttRows[0], null, 2));
      } else {
        console.log('PNL_EXECUTED response:', JSON.stringify(ttttRes.json).slice(0, 300));
      }

      await mongoose.disconnect();
    }

    run().catch(e => {
      console.error('Error:', e);
      process.exit(1);
    });
  `;

  const remoteCmd = `
    cat << 'EOF' > /tmp/test_live_ccp.js
${remoteScript}
EOF
    NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_live_ccp.js
    rm -f /tmp/test_live_ccp.js
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error('SSH exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => {
      conn.end();
    });
  });
});

conn.connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

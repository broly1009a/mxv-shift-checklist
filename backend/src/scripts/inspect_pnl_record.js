const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const remoteScript = `
    const crypto = require('crypto');
    const mongoose = require('mongoose');

    class CookieJar {
      constructor() { this.cookies = new Map(); }
      setFromHeaders(headers) {
        if (!headers) return;
        const setCookieHeaders = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : (headers['set-cookie'] || []);
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
      getCookieHeader() { return Array.from(this.cookies.entries()).map(([k, v]) => \`\${k}=\${v}\`).join('; '); }
      getSessionCookie() { const s = this.cookies.get('SESSION'); return s ? \`SESSION=\${s}\` : this.getCookieHeader(); }
    }

    function decrypt(encryptedText, encKey) {
      if (!encryptedText) return '';
      const parts = encryptedText.split(':');
      if (parts.length !== 2) return '';
      const rawKey = encKey || 'mxv_default_secret_key_32_chars_long!';
      const secretKey = crypto.createHash('sha256').update(rawKey).digest();
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    }

    async function run() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist', { serverSelectionTimeoutMS: 5000 });
      const db = mongoose.connection.db;
      const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const encKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
      const decrypted = JSON.parse(decrypt(credDoc.value, encKey));
      const baseUrl = 'https://coreccp.vnclear.vn';
      const username = decrypted.username;
      const password = decrypted.password;

      // OAuth2 Login
      const jar = new CookieJar();
      const redirectUri = \`\${baseUrl}/validate_code\`;
      const basicAuth = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';
      const authUrl = \`\${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=openid%20profile\`;

      const initRes = await fetch(authUrl, { redirect: 'manual' });
      jar.setFromHeaders(initRes.headers);
      let loginUrl = initRes.headers.get('location');
      if (loginUrl && !loginUrl.startsWith('http')) loginUrl = \`\${baseUrl}\${loginUrl}\`;

      const loginRes = await fetch(loginUrl || authUrl, {
        headers: { Cookie: jar.getCookieHeader() },
        redirect: 'manual',
      });
      jar.setFromHeaders(loginRes.headers);
      const html = await loginRes.text();
      const csrf = (html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i) || [])[1];

      const postLoginRes = await fetch(\`\${baseUrl}/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader(), Origin: baseUrl, Referer: \`\${baseUrl}/login\` },
        body: new URLSearchParams({ _csrf: csrf, username, password, page: 'login_ccp' }).toString(),
        redirect: 'manual',
      });
      jar.setFromHeaders(postLoginRes.headers);
      const loc = postLoginRes.headers.get('location');

      let nextUrl = loc;
      let code = null;
      while (nextUrl && !code) {
        const full = nextUrl.startsWith('http') ? nextUrl : \`\${baseUrl}\${nextUrl}\`;
        const u = new URL(full);
        if (u.searchParams.has('code')) { code = u.searchParams.get('code'); break; }
        const r = await fetch(full, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
        jar.setFromHeaders(r.headers);
        nextUrl = r.headers.get('location');
      }

      const tokenRes = await fetch(\`\${baseUrl}/oauth2/token\`, {
        method: 'POST',
        headers: { Authorization: basicAuth, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader(), Origin: baseUrl },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const sessionCookie = jar.getSessionCookie();

      console.log('✅ Đăng nhập CoreCCP thành công.');
      console.log('Đang gọi API OMS_PNL_DETAIL...');

      const res = await fetch(\`\${baseUrl}/ccp/inquiry/OMS_ACM\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'connectkey': 'fsscssiam2021',
          'Cookie': sessionCookie,
          'Authorization': \`Bearer \${accessToken}\`,
          'Origin': baseUrl,
          'Referer': \`\${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM\`,
        },
        body: JSON.stringify({
          searchcode: 'OMS_PNL_DETAIL',
          search: { accountId: '' },
          page: 1,
          pageSize: 5,
        }),
      });

      const json = await res.json();
      const raw = json.payload?.data || json.data || [];
      console.log('\\n=== CẤU TRÚC CHI TIẾT 1 BẢN GHI TỪ API OMS_PNL_DETAIL ===');
      for (const entry of raw) {
        for (const [sym, arr] of Object.entries(entry)) {
          if (Array.isArray(arr) && arr.length > 0) {
            console.log('Hợp đồng (Symbol): ' + sym);
            console.log('JSON đầy đủ:', JSON.stringify(arr[0], null, 2));
            break;
          }
        }
        break;
      }

      await mongoose.disconnect();
    }

    run().catch(e => console.error('Lỗi run:', e));
  `;

  const remoteCmd = `
    cat << 'EOF' > /tmp/inspect_pnl_detail.js
${remoteScript}
EOF
    NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_pnl_detail.js
    rm -f /tmp/inspect_pnl_detail.js
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

const { Client } = require('ssh2');

const conn = new Client();

console.log('Đang kết nối SSH tới Ubuntu Server (10.0.0.26)...');

conn.on('ready', () => {
  console.log('✅ Kết nối SSH thành công. Đang truy vấn CSDL và kiểm thử API OMS trên Ubuntu...\n');

  // Script Node.js chạy trực tiếp trên Ubuntu bằng Node 20 native fetch
  const remoteScript = `
    const crypto = require('crypto');
    const mongoose = require('mongoose');

    class CookieJar {
      constructor() {
        this.cookies = new Map();
      }
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
            const k = nameVal.substring(0, eqIdx).trim();
            const v = nameVal.substring(eqIdx + 1).trim();
            this.cookies.set(k, v);
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
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    }

    async function performOAuth2Login(baseUrl, username, password) {
      const jar = new CookieJar();
      const redirectUri = \`\${baseUrl}/validate_code\`;
      const basicAuth = baseUrl.includes('vnclear.vn') ? CCP_PROD_BASIC_AUTH : CCP_UAT_BASIC_AUTH;
      const authUrl = \`\${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=openid%20profile\`;

      // Bước 1: Khởi tạo bẫy _csrf
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

      // Bước 2: Submit POST /login
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

      // Bước 3: Theo dõi chuỗi redirect bắt code
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

      // Bước 4: Đổi lấy Access Token
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
        accessToken: tokenData.access_token,
        sessionCookie: jar.getSessionCookie(),
      };
    }

    async function callOmsApi(baseUrl, sessionCookie, accessToken, searchcode, searchObj = {}) {
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
          searchcode,
          search: searchObj,
          page: 1,
          pageSize: 200000,
        }),
      });

      const json = await res.json();
      return { status: res.status, json };
    }

    async function run() {
      // 1. Kết nối MongoDB Ubuntu
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist', { serverSelectionTimeoutMS: 5000 });
      const db = mongoose.connection.db;
      
      const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const urlDoc = await db.collection('system_settings').findOne({ key: 'coreccp_base_url' });
      
      if (!credDoc || !credDoc.value) {
        console.error('❌ Không tìm thấy bot_credentials_ccp trong system_settings!');
        process.exit(1);
      }

      const encKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
      const decrypted = JSON.parse(decrypt(credDoc.value, encKey));
      let rawBaseUrl = (urlDoc?.value || decrypted.url || 'https://coreccp.vnclear.vn').replace(/\\/+$/, '');
      const urlParsed = new URL(rawBaseUrl);
      const baseUrl = urlParsed.origin;
      const username = decrypted.username;
      const password = decrypted.password;

      console.log('📌 Thông tin CoreCCP nạp từ MongoDB Ubuntu:');
      console.log('   - Base URL : ' + baseUrl);
      console.log('   - Username : ' + username);
      console.log('   - Password : ' + (password ? '****** (Đã giải mã thành công)' : 'RỖNG'));
      console.log('');

      // 2. OAuth2 Login
      console.log('[1/4] Đang thực hiện đăng nhập OAuth2 CoreCCP...');
      const t0 = Date.now();
      const { accessToken, sessionCookie } = await performOAuth2Login(baseUrl, username, password);
      console.log(\`   -> Đăng nhập thành công! (\${Date.now() - t0}ms)\`);
      console.log('   -> Session Cookie: ' + sessionCookie.slice(0, 25) + '...');
      console.log('   -> Access Token  : ' + accessToken.slice(0, 25) + '...');
      console.log('');

      // 3. Test API 1: OMS_ACCOUNT
      console.log('[2/4] Kiểm tra API OMS_ACCOUNT (Check Ký Quỹ TKGD)...');
      const r1 = await callOmsApi(baseUrl, sessionCookie, accessToken, 'OMS_ACCOUNT', {});
      const accounts = r1.json?.payload?.data || r1.json?.data || [];
      console.log(\`   -> Kết quả: Status=\${r1.status} | Tổng tài khoản=\${accounts.length}\`);
      if (accounts.length > 0) {
        console.log('   -> Mẫu 3 tài khoản:');
        accounts.slice(0, 3).forEach((a, idx) => {
          console.log(\`      \${idx + 1}. TK: \${a.accountId || a.dmaAccount} | TVKD: \${a.memberCode} | RMA: \${a.rma} | RMO: \${a.rmo} | Tiền KQ: \${a.imCash}\`);
        });
      } else {
        console.log('   -> Phản hồi:', JSON.stringify(r1.json).slice(0, 250));
      }
      console.log('');

      // 4. Test API 2: OMS_OPEN_POSITION
      console.log('[3/4] Kiểm tra API OMS_OPEN_POSITION (Check TTM)...');
      const r2 = await callOmsApi(baseUrl, sessionCookie, accessToken, 'OMS_OPEN_POSITION', { accountId: '' });
      const rawPos = r2.json?.payload?.data || r2.json?.data || [];
      let posCount = 0;
      const samplePos = [];
      if (Array.isArray(rawPos)) {
        for (const entry of rawPos) {
          if (entry && typeof entry === 'object') {
            for (const [sym, arr] of Object.entries(entry)) {
              if (Array.isArray(arr)) {
                posCount += arr.length;
                if (samplePos.length < 3 && arr.length > 0) {
                  samplePos.push(...arr.slice(0, 3 - samplePos.length).map(x => ({ ...x, symbol: x.symbol || sym })));
                }
              }
            }
          }
        }
      }
      console.log(\`   -> Kết quả: Status=\${r2.status} | Tổng vị thế mở=\${posCount}\`);
      if (samplePos.length > 0) {
        console.log('   -> Mẫu vị thế mở:');
        samplePos.forEach((p, idx) => {
          console.log(\`      \${idx + 1}. TK: \${p.accountId} | HĐ: \${p.symbol} | Mua: \${p.longQtty} | Bán: \${p.shortQtty} | Giá: \${p.matchPrice}\`);
        });
      } else {
        console.log('   -> Phản hồi:', JSON.stringify(r2.json).slice(0, 250));
      }
      console.log('');

      // 5. Test API 3: OMS_PNL_DETAIL
      console.log('[4/4] Kiểm tra API OMS_PNL_DETAIL (Check TTTT)...');
      const r3 = await callOmsApi(baseUrl, sessionCookie, accessToken, 'OMS_PNL_DETAIL', { accountId: '' });
      const rawPnl = r3.json?.payload?.data || r3.json?.data || [];
      let pnlCount = 0;
      const samplePnl = [];
      if (Array.isArray(rawPnl)) {
        for (const entry of rawPnl) {
          if (entry && typeof entry === 'object') {
            for (const [sym, arr] of Object.entries(entry)) {
              if (Array.isArray(arr)) {
                pnlCount += arr.length;
                if (samplePnl.length < 3 && arr.length > 0) {
                  samplePnl.push(...arr.slice(0, 3 - samplePnl.length).map(x => ({ ...x, symbol: x.symbol || sym })));
                }
              }
            }
          }
        }
      }
      console.log(\`   -> Kết quả: Status=\${r3.status} | Tổng bản ghi tất toán=\${pnlCount}\`);
      if (samplePnl.length > 0) {
        console.log('   -> Mẫu bản ghi tất toán:');
        samplePnl.forEach((p, idx) => {
          console.log(\`      \${idx + 1}. TK: \${p.accountId} | HĐ: \${p.symbol} | Chiều: \${p.closeSide} | KL: \${p.closeQtty} | PnL: $\${p.vrplAmt}\`);
        });
      } else {
        console.log('   -> Phản hồi:', JSON.stringify(r3.json).slice(0, 250));
      }
      console.log('');

      await mongoose.disconnect();
    }

    run().catch(err => {
      console.error('❌ Lỗi chạy script trên Ubuntu:', err.message || err);
      process.exit(1);
    });
  `;

  // Ghi script tạm vào /tmp/test_oms.js trên Ubuntu và chạy bằng node
  const remoteCmd = `
    cat << 'EOF' > /tmp/test_oms.js
${remoteScript}
EOF
    NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_oms.js
    rm -f /tmp/test_oms.js
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error('Lỗi thực thi lệnh qua SSH:', err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => {
      conn.end();
      console.log('\n========================================================================');
      console.log('  KẾT THÚC KIỂM THỬ VỚI TÀI KHOẢN CSDL TRÊN UBUNTU');
      console.log('========================================================================');
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

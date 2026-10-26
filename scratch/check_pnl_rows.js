const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('mongoose');
    const crypto = require('crypto');

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
          if (eqIdx !== -1) this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
        });
      }
      getCookieHeader() { return Array.from(this.cookies.entries()).map(([k, v]) => \`\${k}=\${v}\`).join('; '); }
      getSessionCookie() { return this.cookies.get('SESSION') ? \`SESSION=\${this.cookies.get('SESSION')}\` : this.getCookieHeader(); }
    }

    function decrypt(encryptedText) {
      const parts = encryptedText.split(':');
      const secretKey = crypto.createHash('sha256').update('mxv_default_secret_key_32_chars_long!').digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, Buffer.from(parts[0], 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(parts[1], 'hex')), decipher.final()]).toString('utf8');
    }

    async function run() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;
      const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const decrypted = JSON.parse(decrypt(credDoc.value));
      const baseUrl = 'https://coreccp.vnclear.vn';

      // Login
      const jar = new CookieJar();
      const authUrl = \`\${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=\${encodeURIComponent(baseUrl + '/validate_code')}&scope=openid%20profile\`;
      const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
      jar.setFromHeaders(initRes.headers);
      let loc = initRes.headers.get('location');
      const loginRes = await fetch(loc.startsWith('http') ? loc : \`\${baseUrl}\${loc}\`, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
      jar.setFromHeaders(loginRes.headers);
      const html = await loginRes.text();
      const csrf = (html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i) || [])[1];

      const body = new URLSearchParams({ _csrf: csrf, username: decrypted.username, password: decrypted.password, page: 'login_ccp' });
      const postLogin = await fetch(\`\${baseUrl}/login\`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader() }, body: body.toString(), redirect: 'manual' });
      jar.setFromHeaders(postLogin.headers);
      let nextUrl = postLogin.headers.get('location');
      let code = null;
      while (nextUrl) {
        const u = new URL(nextUrl.startsWith('http') ? nextUrl : \`\${baseUrl}\${nextUrl}\`);
        if (u.searchParams.has('code')) { code = u.searchParams.get('code'); break; }
        const r = await fetch(u.toString(), { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
        jar.setFromHeaders(r.headers);
        nextUrl = r.headers.get('location');
      }

      const tokRes = await fetch(\`\${baseUrl}/oauth2/token\`, {
        method: 'POST',
        headers: { Authorization: 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy', 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader() },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: \`\${baseUrl}/validate_code\` }).toString()
      });
      const tok = await tokRes.json();

      // PNL_EXECUTED
      const pnlRes = await fetch(\`\${baseUrl}/ccp/inquiry/maintain/PNL_EXECUTED/search/PNL_EXECUTED\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'connectkey': 'fsscssiam2021',
          'Cookie': jar.getSessionCookie(),
          'Authorization': \`Bearer \${tok.access_token}\`
        },
        body: JSON.stringify({ searchcode: 'PNL_EXECUTED', search: {}, filter: {}, orderBy: {}, page: { pageIndex: 1, pageSize: 200000 } })
      });
      const pnlJson = await pnlRes.json();
      const rows = pnlJson.data || [];
      console.log('PNL_EXECUTED total rows:', rows.length);
      let bothCount = 0, buyCount = 0, sellCount = 0;
      rows.forEach(r => {
        const b = Number(r.LONGQTTY) || 0;
        const s = Number(r.SHORTQTTY) || 0;
        if (b > 0 && s > 0) bothCount++;
        else if (b > 0) buyCount++;
        else if (s > 0) sellCount++;
      });
      console.log(\`Breakdown: BOTH=\${bothCount}, BUY_ONLY=\${buyCount}, SELL_ONLY=\${sellCount}\`);
      console.log('First 3 rows summary:');
      rows.slice(0, 3).forEach(r => {
        console.log(\`TK: \${r.ACCTNO} | HĐ: \${r.SYMBOL} | LONGQTTY: \${r.LONGQTTY} | SHORTQTTY: \${r.SHORTQTTY} | VRPL_USD: \${r.PNLEXCUTED_USD} | VRPL_VND: \${r.PNLEXCUTED_VND} | CLOSE_SIDE: \${r.CLOSE_SIDE}\`);
      });

      await mongoose.disconnect();
    }
    run().catch(e => console.error(e));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_pnl.js\n${remoteScript}\nEOF\nNODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_pnl.js\nrm -f /tmp/test_pnl.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

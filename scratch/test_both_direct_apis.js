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

    function normalizeAccount(acc) {
      if (!acc) return '';
      return String(acc).trim().toUpperCase().replace(/-[A-Z0-9]$/, '');
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
      const accessToken = tok.access_token;
      const sessionCookie = jar.getSessionCookie();

      console.log('=== TEST 1: CHECK TTM (VỊ THẾ MỞ) GỌI API TRỰC TIẾP ===');
      // A. OMS_OPEN_POSITION
      const omsPosRes = await fetch(\`\${baseUrl}/ccp/inquiry/OMS_ACM\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'connectkey': 'fsscssiam2021', 'Cookie': sessionCookie, 'Authorization': \`Bearer \${accessToken}\` },
        body: JSON.stringify({ searchcode: 'OMS_OPEN_POSITION', search: { accountId: '' }, page: 1, pageSize: 9999 })
      });
      const omsPosJson = await omsPosRes.json();
      const rawOmsPos = omsPosJson.payload?.data || omsPosJson.data || [];
      const omsPos = [];
      if (Array.isArray(rawOmsPos)) {
        for (const entry of rawOmsPos) {
          if (entry && typeof entry === 'object') {
            for (const [sym, arr] of Object.entries(entry)) {
              if (Array.isArray(arr)) {
                for (const item of arr) omsPos.push({ ...item, symbol: item.symbol || sym });
              }
            }
          }
        }
      }

      // B. CCP OPEN_POSITION
      const ccpPosRes = await fetch(\`\${baseUrl}/ccp/inquiry/maintain/OPEN_POSITION/search/OPEN_POSITION\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'connectkey': 'fsscssiam2021', 'Cookie': sessionCookie, 'Authorization': \`Bearer \${accessToken}\` },
        body: JSON.stringify({ searchcode: 'OPEN_POSITION', search: {}, filter: {}, orderBy: {}, page: { pageIndex: 1, pageSize: 200000 } })
      });
      const ccpPosJson = await ccpPosRes.json();
      const ccpPos = ccpPosJson.data || ccpPosJson.payload?.data || [];

      console.log(\`OMS Pos records: \${omsPos.length} | CoreCCP Pos records: \${ccpPos.length}\`);

      // Group OMS
      const omsTtmMap = new Map();
      for (const p of omsPos) {
        const acc = normalizeAccount(p.accountId);
        const sym = String(p.symbol || '').trim().toUpperCase();
        if (!acc || !sym) continue;
        const k = \`\${acc}___\${sym}\`;
        if (!omsTtmMap.has(k)) omsTtmMap.set(k, { buy: 0, sell: 0 });
        const g = omsTtmMap.get(k);
        g.buy += Number(p.longQtty) || 0;
        g.sell += Number(p.shortQtty) || 0;
      }

      // Group CCP
      const ccpTtmMap = new Map();
      for (const p of ccpPos) {
        const acc = normalizeAccount(p.ACCTNO || p.CUSTODYCD);
        const sym = String(p.SYMBOL || '').trim().toUpperCase();
        if (!acc || !sym) continue;
        const k = \`\${acc}___\${sym}\`;
        if (!ccpTtmMap.has(k)) ccpTtmMap.set(k, { buy: 0, sell: 0 });
        const g = ccpTtmMap.get(k);
        g.buy += Number(p.LONGQTTY) || 0;
        g.sell += Number(p.SHORTQTTY) || 0;
      }

      const allTtmKeys = new Set([...omsTtmMap.keys(), ...ccpTtmMap.keys()]);
      let ttmMatch = 0, ttmDiff = 0, ttmMissingCcp = 0, ttmMissingOms = 0;
      for (const k of allTtmKeys) {
        const o = omsTtmMap.get(k);
        const c = ccpTtmMap.get(k);
        if (!o) ttmMissingOms++;
        else if (!c) ttmMissingCcp++;
        else if (o.buy === c.buy && o.sell === c.sell) ttmMatch++;
        else ttmDiff++;
      }
      console.log(\`TTM SO KHỚP TRỰC TIẾP 2 NGUỒN TƯƠI API:\`);
      console.log(\`-> Tổng cặp: \${allTtmKeys.size} | Khớp: \${ttmMatch} | Lệch số: \${ttmDiff} | Thiếu CCP: \${ttmMissingCcp} | Thiếu OMS: \${ttmMissingOms}\`);

      console.log('\\n=== TEST 2: CHECK TTTT (LÃI LỖ & TẤT TOÁN) GỌI API TRỰC TIẾP ===');
      // A. OMS_PNL_DETAIL
      const omsPnlRes = await fetch(\`\${baseUrl}/ccp/inquiry/OMS_ACM\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'connectkey': 'fsscssiam2021', 'Cookie': sessionCookie, 'Authorization': \`Bearer \${accessToken}\` },
        body: JSON.stringify({ searchcode: 'OMS_PNL_DETAIL', search: { accountId: '' }, page: 1, pageSize: 9999 })
      });
      const omsPnlJson = await omsPnlRes.json();
      const rawOmsPnl = omsPnlJson.payload?.data || omsPnlJson.data || [];
      const omsPnl = [];
      if (Array.isArray(rawOmsPnl)) {
        for (const entry of rawOmsPnl) {
          if (entry && typeof entry === 'object') {
            for (const [sym, arr] of Object.entries(entry)) {
              if (Array.isArray(arr)) {
                for (const item of arr) omsPnl.push({ ...item, symbol: item.symbol || sym });
              }
            }
          }
        }
      }

      // B. CCP PNL_EXECUTED
      const ccpPnlRes = await fetch(\`\${baseUrl}/ccp/inquiry/maintain/PNL_EXECUTED/search/PNL_EXECUTED\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'connectkey': 'fsscssiam2021', 'Cookie': sessionCookie, 'Authorization': \`Bearer \${accessToken}\` },
        body: JSON.stringify({ searchcode: 'PNL_EXECUTED', search: {}, filter: {}, orderBy: {}, page: { pageIndex: 1, pageSize: 200000 } })
      });
      const ccpPnlJson = await ccpPnlRes.json();
      const ccpPnl = ccpPnlJson.data || ccpPnlJson.payload?.data || [];

      console.log(\`OMS PnL records: \${omsPnl.length} | CoreCCP PnL records: \${ccpPnl.length}\`);

      // Group OMS PnL
      const omsGroupPnl = new Map();
      for (const p of omsPnl) {
        const acc = normalizeAccount(p.accountId);
        const sym = String(p.symbol || '').trim().toUpperCase();
        if (!acc || !sym) continue;
        const k = \`\${acc}___\${sym}\`;
        if (!omsGroupPnl.has(k)) omsGroupPnl.set(k, { buyQty: 0, sellQty: 0, vrplAmt: 0, vrplAmtVnd: 0 });
        const g = omsGroupPnl.get(k);
        const isBuy = String(p.closeSide || '').toUpperCase().startsWith('BUY') || String(p.closeSide || '').toUpperCase().startsWith('MUA');
        const qtty = Number(p.closeQtty) || 0;
        if (isBuy) g.buyQty += qtty; else g.sellQty += qtty;
        g.vrplAmt += Number(p.vrplAmt) || 0;
        g.vrplAmtVnd += Number(p.vrplAmt_Vnd) || 0;
      }

      // Group CCP PnL
      const ccpGroupPnl = new Map();
      for (const p of ccpPnl) {
        const acc = normalizeAccount(p.ACCTNO || p.CUSTODYCD);
        const sym = String(p.SYMBOL || '').trim().toUpperCase();
        if (!acc || !sym) continue;
        const k = \`\${acc}___\${sym}\`;
        if (!ccpGroupPnl.has(k)) ccpGroupPnl.set(k, { buyQty: 0, sellQty: 0, vrplAmt: 0, vrplAmtVnd: 0 });
        const g = ccpGroupPnl.get(k);
        const longQ = Number(p.LONGQTTY) || 0;
        const shortQ = Number(p.SHORTQTTY) || 0;
        const omsItem = omsGroupPnl.get(k);
        if (longQ > 0 && shortQ > 0) {
          if (omsItem && omsItem.buyQty === longQ && omsItem.sellQty === 0) g.buyQty += longQ;
          else if (omsItem && omsItem.sellQty === shortQ && omsItem.buyQty === 0) g.sellQty += shortQ;
          else if (omsItem && omsItem.buyQty + omsItem.sellQty === longQ) { g.buyQty += omsItem.buyQty; g.sellQty += omsItem.sellQty; }
          else { g.buyQty += longQ; }
        } else if (longQ > 0) {
          g.buyQty += longQ;
        } else {
          g.sellQty += shortQ;
        }
        g.vrplAmt += Number(p.PNLEXCUTED_USD ?? p.PNLEXCUTED) || 0;
        g.vrplAmtVnd += Number(p.PNLEXCUTED_VND) || 0;
      }

      const allPnlKeys = new Set([...omsGroupPnl.keys(), ...ccpGroupPnl.keys()]);
      let pnlMatch = 0, pnlDiffVol = 0, pnlDiffAmt = 0, pnlDiffBoth = 0, pnlMissingCcp = 0, pnlMissingOms = 0;
      for (const k of allPnlKeys) {
        const o = omsGroupPnl.get(k);
        const c = ccpGroupPnl.get(k);
        if (!o) pnlMissingOms++;
        else if (!c) pnlMissingCcp++;
        else {
          const matchVol = o.buyQty === c.buyQty && o.sellQty === c.sellQty;
          const matchAmt = Math.abs(o.vrplAmtVnd - c.vrplAmtVnd) <= 1;
          if (matchVol && matchAmt) pnlMatch++;
          else if (!matchVol && matchAmt) pnlDiffVol++;
          else if (matchVol && !matchAmt) pnlDiffAmt++;
          else pnlDiffBoth++;
        }
      }
      console.log(\`TTTT SO KHỚP TRỰC TIẾP 2 NGUỒN TƯƠI API:\`);
      console.log(\`-> Tổng cặp: \${allPnlKeys.size} | Khớp hoàn toàn: \${pnlMatch} | Lệch Vol: \${pnlDiffVol} | Lệch PnL: \${pnlDiffAmt} | Lệch Cả 2: \${pnlDiffBoth} | Thiếu CCP: \${pnlMissingCcp} | Thiếu OMS: \${pnlMissingOms}\`);

      await mongoose.disconnect();
    }
    run().catch(e => console.error(e));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_both_apis.js\n${remoteScript}\nEOF\nNODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_both_apis.js\nrm -f /tmp/test_both_apis.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

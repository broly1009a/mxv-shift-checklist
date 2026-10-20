import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = r"""
const mongoose = require('mongoose');
const { decrypt } = require('./dist/shared');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const setting = await mongoose.connection.collection('system_settings').findOne({ key: 'bot_credentials_ce' });
  const dec = decrypt(setting.value);
  const creds = JSON.parse(dec);

  let baseUrl = creds.url || 'https://coreexchange.mxv.com.vn';
  try {
    baseUrl = new URL(baseUrl).origin;
  } catch {}

  const clientId = creds.clientId || 'web-exchange-mxv';
  const clientSecret = creds.clientSecret || (baseUrl.includes('uat') ? 'jY3lgfDQQdJceOILsjKIxKLa0MQ7IU' : '865lhHVYOWQ93CicOirSZv4NR5JBe8');
  const redirectUri = `${baseUrl}/validate_code`;
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile`;

  console.log('\nStep 1: GET', authUrl);
  const r1 = await fetch(authUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0' },
    redirect: 'manual'
  });
  console.log('  Status:', r1.status);
  const cookies = new Map();
  function addCookies(headers) {
    let raw = [];
    if (headers.getSetCookie) raw = headers.getSetCookie();
    else if (headers.get('set-cookie')) raw = [headers.get('set-cookie')];
    raw.forEach(str => {
      const pair = str.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq > 0) cookies.set(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
    });
  }
  function getCookieHeader() {
    return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  addCookies(r1.headers);
  const loc1 = r1.headers.get('location') || `${baseUrl}/login`;
  const loginUrl = loc1.startsWith('http') ? loc1 : `${baseUrl}${loc1}`;

  console.log('\nStep 2: GET', loginUrl);
  const r2 = await fetch(loginUrl, {
    headers: { Cookie: getCookieHeader(), 'User-Agent': 'Mozilla/5.0' },
    redirect: 'manual'
  });
  console.log('  Status:', r2.status);
  addCookies(r2.headers);
  const html = await r2.text();
  const csrfMatch = html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);
  const csrf = csrfMatch ? csrfMatch[1] : null;
  console.log('  CSRF token:', csrf ? csrf.substring(0, 10) + '...' : null);

  console.log('\nStep 3: POST /login with user:', creds.username);
  const body = new URLSearchParams();
  body.append('_csrf', csrf);
  body.append('username', creds.username);
  body.append('password', creds.password);
  body.append('page', 'login');

  const r3 = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: getCookieHeader(),
      Origin: baseUrl,
      Referer: loginUrl
    },
    body: body.toString(),
    redirect: 'manual'
  });
  console.log('  Status:', r3.status);
  addCookies(r3.headers);
  const loc3 = r3.headers.get('location');
  console.log('  Location:', loc3);

  console.log('\nStep 4: Follow redirect ->', loc3);
  const r4 = await fetch(loc3, {
    headers: { Cookie: getCookieHeader(), 'User-Agent': 'Mozilla/5.0' },
    redirect: 'manual'
  });
  console.log('  Status:', r4.status);
  addCookies(r4.headers);
  const loc4 = r4.headers.get('location');
  console.log('  Location:', loc4);

  let oauthCode = null;
  if (loc4 && loc4.includes('code=')) {
    const u = new URL(loc4.startsWith('http') ? loc4 : `${baseUrl}${loc4}`);
    oauthCode = u.searchParams.get('code');
  }
  console.log('  OAuth2 Code:', oauthCode);

  console.log('\nStep 5: POST /oauth2/token');
  const tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('code', oauthCode);
  tokenParams.append('redirect_uri', redirectUri);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const r5 = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: getCookieHeader()
    },
    body: tokenParams.toString()
  });
  console.log('  Status:', r5.status);
  const tokenJson = await r5.json();
  console.log('  Token response keys:', Object.keys(tokenJson));
  console.log('  Access token (first 30 chars):', tokenJson.access_token ? tokenJson.access_token.substring(0, 30) + '...' : 'NONE');
  console.log('  Expires in:', tokenJson.expires_in);

  console.log('\nStep 6: Search COMMODITY_ACM with Access Token');
  const r6 = await fetch(`${baseUrl}/exchange/inquiry/maintain/COMMODITY_ACM/search/COMMODITY_ACM`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      connectkey: 'fsscssiam2021',
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),
      Origin: baseUrl,
      Referer: `${baseUrl}/DASHBOARD`,
      'x-devicetype': 'WEB',
      'x-lang': 'vi'
    },
    body: JSON.stringify({
      searchcode: 'COMMODITY_ACM',
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 5 }
    })
  });
  console.log('  Search status:', r6.status);
  const data = await r6.json();
  console.log('  Total count:', data.payload?.page?.totalCount || data.totalCount || data.data?.length || 0);

  await mongoose.disconnect();
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/debug_ce_login.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node debug_ce_login.js && rm -f debug_ce_login.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()

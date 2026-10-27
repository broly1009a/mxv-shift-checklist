import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

remote_code = '''
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
  getCookieHeader() { return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; '); }
  getSessionCookie() { return this.cookies.get('SESSION') ? `SESSION=${this.cookies.get('SESSION')}` : this.getCookieHeader(); }
}

function decrypt(encryptedText, secretKeyStr) {
  const parts = encryptedText.split(':');
  const secretKey = crypto.createHash('sha256').update(secretKeyStr).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, Buffer.from(parts[0], 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(parts[1], 'hex')), decipher.final()]).toString('utf8');
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  const decrypted = JSON.parse(decrypt(credDoc.value, 'mxv_default_secret_key_32_chars_long!'));
  const baseUrl = 'https://coreccp.vnclear.vn';

  const jar = new CookieJar();
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=${encodeURIComponent(baseUrl + '/validate_code')}&scope=openid%20profile`;
  const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(initRes.headers);

  let loc = initRes.headers.get('location');
  const loginPageRes = await fetch(loc.startsWith('http') ? loc : `${baseUrl}${loc}`, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name=["\\']_csrf["\\']\\s+value=["\\']([^"\\']+)["\\']/i);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const loginBody = new URLSearchParams({ _csrf: csrf, username: decrypted.username, password: decrypted.password, page: 'login_ccp' });
  const postLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader() },
    body: loginBody.toString(),
    redirect: 'manual',
  });
  jar.setFromHeaders(postLogin.headers);

  let nextUrl = postLogin.headers.get('location');
  let authCode = null;
  while (nextUrl) {
    const u = new URL(nextUrl.startsWith('http') ? nextUrl : `${baseUrl}${nextUrl}`);
    if (u.searchParams.has('code')) {
      authCode = u.searchParams.get('code');
      break;
    }
    const hop = await fetch(u.toString(), { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
    jar.setFromHeaders(hop.headers);
    nextUrl = hop.headers.get('location');
  }

  const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: `${baseUrl}/validate_code`,
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const sessionCookie = jar.getSessionCookie();

  // Call with 200000
  const res = await fetch(`${baseUrl}/ccp/inquiry/OMS_ACM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM`,
    },
    body: JSON.stringify({ searchcode: 'OMS_ACCOUNT', search: {}, page: 1, pageSize: 200000 }),
  });
  const json = await res.json();
  const data = json.payload?.data || [];
  console.log('Total accounts fetched with pageSize 200000:', data.length);

  // Check 001C0990000 index
  const idx = data.findIndex(d => (d.accountId || d.dmaAccount || '').includes('001C0990000'));
  console.log('Index of 001C0990000 in full list:', idx);
  if (idx !== -1) {
    console.log('Record 001C0990000 in OMS:', JSON.stringify(data[idx]));
  } else {
    console.log('001C0990000 is NOT in OMS data!');
  }

  // Also check ACCTMARGIN_ALL for 001C0990000
  const qlRes = await fetch(`${baseUrl}/ccp/inquiry/maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/RISKMNG/ACCTMARGIN_ALL`,
    },
    body: JSON.stringify({ searchcode: 'ACCTMARGIN_ALL', search: {}, filter: {}, orderBy: {}, page: { pageIndex: 1, pageSize: 200000 } })
  });
  const qlJson = await qlRes.json();
  const qlData = qlJson.data || qlJson.payload?.data || [];
  console.log('Total accounts in QLTTTKGD:', qlData.length);
  const qlIdx = qlData.findIndex(d => (d.INVESTORCODE || d['Mã TKGD'] || d.AFACCTNO || '').includes('001C0990000'));
  console.log('Index of 001C0990000 in QLTTTKGD:', qlIdx);
  if (qlIdx !== -1) {
    console.log('Record 001C0990000 in QLTTTKGD:', JSON.stringify(qlData[qlIdx]));
  }

  process.exit(0);
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_acc.js', 'w') as f:
    f.write(remote_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_acc.js')
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print('STDERR:', err)
ssh.close()

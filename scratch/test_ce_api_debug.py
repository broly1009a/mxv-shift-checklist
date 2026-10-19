import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

script = r"""
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const crypto = require('crypto');

const getSecretKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  return crypto.createHash('sha256').update(rawKey).digest();
};

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return '';
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

class CookieJar {
  constructor() { this.cookies = new Map(); }
  setFromHeaders(headers) {
    let raw = [];
    if (typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else if (headers.raw && typeof headers.raw === 'function') {
      raw = headers.raw()['set-cookie'] || [];
    } else {
      const single = typeof headers.get === 'function' ? headers.get('set-cookie') : null;
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
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.collection('system_settings');
  const ceDoc = await db.findOne({ key: 'bot_credentials_ce' });
  const rawDec = decrypt(ceDoc.value);
  const parsed = JSON.parse(rawDec);
  
  let baseUrl = parsed.url || 'https://coreexchange.mxv.com.vn';
  try {
    const u = new URL(baseUrl);
    baseUrl = u.origin;
  } catch {}

  const username = parsed.username;
  const password = parsed.password;
  const clientId = parsed.clientId || 'web-exchange-mxv';

  const jar = new CookieJar();
  const redirectUri = `${baseUrl}/validate_code`;
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile`;

  const initRes = await fetch(authUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0' },
    redirect: 'manual'
  });
  jar.setFromHeaders(initRes.headers);
  let loginUrl = initRes.headers.get('location');
  if (!loginUrl.startsWith('http')) loginUrl = `${baseUrl}${loginUrl}`;

  const loginPageRes = await fetch(loginUrl, {
    headers: {
      Cookie: jar.getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0'
    },
    redirect: 'manual'
  });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);
  const csrf = csrfMatch[1];

  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', username);
  bodyParams.append('password', password);
  bodyParams.append('page', 'login');

  const postLoginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
      Origin: baseUrl,
      Referer: loginUrl,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0'
    },
    body: bodyParams.toString(),
    redirect: 'manual'
  });
  jar.setFromHeaders(postLoginRes.headers);

  let nextUrl = postLoginRes.headers.get('location');
  if (!nextUrl.startsWith('http')) nextUrl = `${baseUrl}${nextUrl}`;

  const nextRes = await fetch(nextUrl, {
    headers: {
      Cookie: jar.getCookieHeader(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0'
    },
    redirect: 'manual'
  });
  jar.setFromHeaders(nextRes.headers);

  let validateUrl = nextRes.headers.get('location');
  console.log('Validate Code URL:', validateUrl);

  if (validateUrl) {
    if (!validateUrl.startsWith('http')) validateUrl = `${baseUrl}${validateUrl}`;
    console.log('Fetching validate_code...');
    const valRes = await fetch(validateUrl, {
      headers: {
        Cookie: jar.getCookieHeader(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0'
      },
      redirect: 'manual'
    });
    jar.setFromHeaders(valRes.headers);
    console.log('Validate status:', valRes.status);
    console.log('Validate location:', valRes.headers.get('location'));
    console.log('Cookies after validate:', jar.getCookieHeader());

    // Test a sample API route, e.g. /PRODUCT/SETTLEMENT or /ORDERS/ORDERMATCH_DETAIL_ACM
    console.log('Testing search API /PRODUCT/SETTLEMENT...');
    const testApi = await fetch(`${baseUrl}/PRODUCT/SETTLEMENT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Cookie: jar.getCookieHeader(),
        Referer: `${baseUrl}/DASHBOARD`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0'
      },
      body: JSON.stringify({ targetDate: '2026-10-19', pageSize: 10 })
    });
    console.log('API Status:', testApi.status);
    const apiData = await testApi.text();
    console.log('API Response (first 500 chars):', apiData.substring(0, 500));
  }

  await mongoose.disconnect();
}
run();
"""

cmd = f"node << 'EOF'\n{script}\nEOF"
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()

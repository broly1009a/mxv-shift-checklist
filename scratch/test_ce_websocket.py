import paramiko
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = r"""
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const crypto = require('crypto');
const WebSocket = require('/opt/mxv-checklist/backend/node_modules/ws');

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
        this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
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
  const parsed = JSON.parse(decrypt(ceDoc.value));
  await mongoose.disconnect();

  let baseUrl = parsed.url || 'https://coreexchange.mxv.com.vn';
  try { baseUrl = new URL(baseUrl).origin; } catch {}
  const username = parsed.username;
  const password = parsed.password;
  const clientId = parsed.clientId || 'web-exchange-mxv';
  const clientSecret = baseUrl.includes('uat') ? 'jY3lgfDQQdJceOILsjKIxKLa0MQ7IU' : '865lhHVYOWQ93CicOirSZv4NR5JBe8';

  const jar = new CookieJar();
  const redirectUri = `${baseUrl}/validate_code`;
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile`;

  const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(initRes.headers);
  let loginUrl = initRes.headers.get('location');
  if (!loginUrl.startsWith('http')) loginUrl = `${baseUrl}${loginUrl}`;

  const loginPageRes = await fetch(loginUrl, { headers: { Cookie: jar.getCookieHeader(), 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);
  const csrf = csrfMatch[1];

  const bodyParams = new URLSearchParams({ _csrf: csrf, username, password, page: 'login' });
  const postLoginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader(), Origin: baseUrl, Referer: loginUrl },
    body: bodyParams.toString(),
    redirect: 'manual'
  });
  jar.setFromHeaders(postLoginRes.headers);
  let nextUrl = postLoginRes.headers.get('location');
  if (!nextUrl.startsWith('http')) nextUrl = `${baseUrl}${nextUrl}`;

  const nextRes = await fetch(nextUrl, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
  jar.setFromHeaders(nextRes.headers);
  let validateUrl = nextRes.headers.get('location');
  if (!validateUrl.startsWith('http')) validateUrl = `${baseUrl}${validateUrl}`;

  const valRes = await fetch(validateUrl, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
  jar.setFromHeaders(valRes.headers);

  let oauthCode = '';
  try {
    const valObj = new URL(validateUrl);
    oauthCode = valObj.searchParams.get('code') || '';
  } catch {}

  let accessToken = '';
  if (oauthCode) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.getCookieHeader() },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: oauthCode, redirect_uri: redirectUri }).toString()
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    accessToken = tokenJson.access_token || '';
  }

  console.log('Access token:', accessToken ? accessToken.substring(0, 30) + '...' : 'none');

  // Kiểm tra decode JWT để lấy userId
  let userId = 9;
  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      console.log('JWT Payload:', JSON.stringify(payload));
      userId = payload.user_id || payload.sub || 9;
    } catch (e) {
      console.log('Decode JWT error:', e.message);
    }
  }

  // 1. Thử lấy wsTicket nếu có
  let wsTicket = '';
  try {
    const ticketRes = await fetch(`${baseUrl}/sso/api/v1/oauth/issue-ws-ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, Cookie: jar.getCookieHeader() }
    });
    console.log('issue-ws-ticket status:', ticketRes.status);
    const ticketJson = await ticketRes.json().catch(() => ({}));
    console.log('issue-ws-ticket response:', JSON.stringify(ticketJson));
    if (ticketJson.payload?.[0]) wsTicket = ticketJson.payload[0];
  } catch (e) {
    console.log('issue-ws-ticket error:', e.message);
  }

  // 2. Thử kết nối WebSocket NotiSocket
  const parsedHost = new URL(baseUrl);
  const wsUrl = `wss://${parsedHost.hostname}/notisocket/socket.io/?ticket=${wsTicket}&userId=${userId}&EIO=4&transport=websocket`;
  console.log('Connecting to WebSocket:', wsUrl);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Cookie: jar.getCookieHeader(),
      Origin: baseUrl,
    }
  });

  const fekey = `ORDERMATCH_DETAIL_ACM_${Date.now()}`;

  ws.on('open', () => {
    console.log('✓ WebSocket connected!');
  });

  ws.on('message', async (data) => {
    const msg = data.toString();
    console.log('WS <<', msg.substring(0, 150));

    if (msg.startsWith('0')) {
      ws.send('40');
      console.log('WS >> 40');
    } else if (msg.startsWith('40')) {
      const sub = `42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":${userId},"room":["NOTI","REPORT","SOCKET"]}]`;
      ws.send(sub);
      console.log('WS >>', sub);

      // Trigger export
      console.log(`Triggering export for ${fekey}...`);
      const expRes = await fetch(`${baseUrl}/exchange/export/create`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: `Bearer ${accessToken}`,
          connectkey: 'fsscssiam2021',
          'Content-Type': 'application/json',
          Cookie: jar.getCookieHeader(),
          Origin: baseUrl,
          Referer: `${baseUrl}/ORDERS/ORDERMATCH_DETAIL_ACM`
        },
        body: JSON.stringify({
          searchcode: 'ORDERMATCH_DETAIL_ACM',
          search: {},
          filter: {},
          orderBy: {},
          page: { pageIndex: 1, pageSize: 20 },
          exptype: 'XLSX',
          fekey
        })
      });
      console.log('Export create status:', expRes.status);
      const expJson = await expRes.json().catch(() => ({}));
      console.log('Export create body:', JSON.stringify(expJson));
    } else if (msg === '2') {
      ws.send('3');
      console.log('WS >> 3 (pong)');
    } else if (msg.startsWith('42')) {
      console.log('*** EVENT RECEIVED! ***', msg);
      try {
        const jsonIdx = msg.indexOf('[');
        const [evName, evData] = JSON.parse(msg.substring(jsonIdx));
        console.log('Event name:', evName, 'Data:', JSON.stringify(evData));
        const content = evData?.content || evData;
        const reportId = content?.autoid || content?.reportId || content?.id || evData?.reportId;
        console.log('Captured reportId:', reportId);

        if (reportId) {
          console.log(`Downloading report ${reportId}...`);
          const dlRes = await fetch(`${baseUrl}/exchange/report/download/${reportId}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              connectkey: 'fsscssiam2021',
              Cookie: jar.getCookieHeader(),
              Origin: baseUrl,
              Referer: `${baseUrl}/ORDERS/ORDERMATCH_DETAIL_ACM`
            }
          });
          console.log('Download status:', dlRes.status);
          const buf = await dlRes.arrayBuffer();
          console.log(`Downloaded file size: ${buf.byteLength} bytes!`);
          ws.close();
          process.exit(0);
        }
      } catch (e) {
        console.log('Parse event error:', e.message);
      }
    }
  });

  ws.on('error', (err) => {
    console.log('WS error:', err.message);
  });

  setTimeout(() => {
    console.log('Timeout reached. Exiting...');
    ws.close();
    process.exit(0);
  }, 30000);
}

run().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_ce_ws.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command("node /tmp/test_ce_ws.js")
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
with open('scratch/ce_ws_output.txt', 'w', encoding='utf-8') as f:
    f.write("OUTPUT:\n" + out + "\nERROR:\n" + err)
print("Saved to scratch/ce_ws_output.txt")
ssh.close()

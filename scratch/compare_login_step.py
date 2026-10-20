import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = r"""
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { SystemSettingsService } = require('./dist/modules/system-settings/system-settings.service');
const { decrypt } = require('./dist/shared');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const settingsService = app.get(SystemSettingsService);

  let baseUrl = 'https://coreexchange.mxv.com.vn';
  let username = '';
  let password = '';
  let clientId = 'web-exchange-mxv';
  let clientSecret = '865lhHVYOWQ93CicOirSZv4NR5JBe8';

  const rawCred = await settingsService.getSetting('bot_credentials_ce', '');
  if (rawCred) {
    const decrypted = JSON.parse(decrypt(rawCred));
    if (decrypted.url) baseUrl = decrypted.url;
    if (decrypted.username) username = decrypted.username;
    if (decrypted.password) password = decrypted.password;
    if (decrypted.clientId) clientId = decrypted.clientId;
    if (decrypted.clientSecret) clientSecret = decrypted.clientSecret;
  }

  try {
    const parsedUrl = new URL(baseUrl);
    baseUrl = parsedUrl.origin;
  } catch {}

  console.log('Parameters:');
  console.log('  baseUrl:', baseUrl);
  console.log('  username:', username);
  console.log('  password:', password ? (password.substring(0, 3) + '***') : 'NONE');
  console.log('  clientId:', clientId);

  const cookies = new Map();
  function addCookies(headers) {
    let raw = [];
    if (headers && typeof headers.getSetCookie === 'function') raw = headers.getSetCookie();
    else if (headers && typeof headers.get === 'function' && headers.get('set-cookie')) raw = [headers.get('set-cookie')];
    raw.forEach(str => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
      }
    });
  }
  function getCookieHeader() {
    return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'vi,en;q=0.9',
  };

  const redirectUri = `${baseUrl}/validate_code`;
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=openid%20profile`;

  console.log('\nStep 1: GET', authUrl);
  const initRes = await fetch(authUrl, {
    headers: { ...commonHeaders, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreEX-Ingress/1.0' },
    redirect: 'manual',
  });
  console.log('  Status:', initRes.status);
  addCookies(initRes.headers);
  console.log('  Cookies after Step 1:', getCookieHeader());

  let loginUrl = initRes.headers.get('location') || `${baseUrl}/login`;
  if (!loginUrl.startsWith('http')) loginUrl = `${baseUrl}${loginUrl}`;

  console.log('\nStep 2: GET', loginUrl);
  const loginPageRes = await fetch(loginUrl, {
    headers: { ...commonHeaders, Cookie: getCookieHeader(), Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'manual',
  });
  console.log('  Status:', loginPageRes.status);
  addCookies(loginPageRes.headers);
  console.log('  Cookies after Step 2:', getCookieHeader());
  const html = await loginPageRes.text();

  const csrfMatch =
    html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) ||
    html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);
  const csrf = csrfMatch ? csrfMatch[1] : null;
  console.log('  CSRF:', csrf);

  console.log('\nStep 3: POST /login');
  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', username);
  bodyParams.append('password', password);
  bodyParams.append('page', 'login');

  const postLoginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: getCookieHeader(),
      Origin: baseUrl,
      Referer: loginUrl,
    },
    body: bodyParams.toString(),
    redirect: 'manual',
  });

  console.log('  Status:', postLoginRes.status);
  console.log('  Location:', postLoginRes.headers.get('location'));
  addCookies(postLoginRes.headers);
  console.log('  Cookies after Step 3:', getCookieHeader());

  await app.close();
  process.exit(0);
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/compare_login_step.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node compare_login_step.js && rm -f compare_login_step.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()

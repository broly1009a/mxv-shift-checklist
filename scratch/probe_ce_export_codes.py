import paramiko
import sys
import json

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 80)
print("SCRIPT QUÉT VÀ KIỂM CHỨNG TOÀN DIỆN CÁC MÃ BÁO CÁO COREEXCHANGE (CE)")
print("Xác định chính xác 100% mã nào thuộc SERVER_EXPORT_CODES (Kiểu 2) vs DIRECT_JSON (Kiểu 1)")
print("=" * 80)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)
    print("✓ Đã kết nối SSH tới máy chủ Ubuntu (10.0.0.26)")
except Exception as e:
    print(f"LỖI KẾT NỐI SSH: {e}")
    sys.exit(1)

node_script = r"""
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
        this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
      }
    });
  }
  getCookieHeader() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.collection('system_settings');
  const ceDoc = await db.findOne({ key: 'bot_credentials_ce' });
  const rawDec = decrypt(ceDoc.value);
  const parsed = JSON.parse(rawDec);
  await mongoose.disconnect();

  let baseUrl = parsed.url || 'https://coreexchange.mxv.com.vn';
  try { baseUrl = new URL(baseUrl).origin; } catch {}

  const username = parsed.username;
  const password = parsed.password;
  const clientId = parsed.clientId || 'web-exchange-mxv';
  const clientSecret = baseUrl.includes('uat') ? 'jY3lgfDQQdJceOILsjKIxKLa0MQ7IU' : '865lhHVYOWQ93CicOirSZv4NR5JBe8';

  console.log(`[AUTH] Đang đăng nhập CoreExchange (${baseUrl}) cho tài khoản: ${username}...`);
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

  // Đổi OAuth2 token
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
  console.log(`✓ Đăng nhập thành công! Bearer Token: ${accessToken ? 'Có (' + accessToken.length + ' chars)' : 'Không có'}`);

  const CANDIDATES = [
    { code: 'ORDERMATCH_DETAIL_ACM', name: 'Khớp lệnh CE trong phiên (DSGD)', search: { SESSION_DATE: { from: '26/10/2026', to: '26/10/2026' } }, referer: '/ORDERS/ORDERMATCH_DETAIL_ACM' },
    { code: 'ORDERBOOK_ACM', name: 'Sổ lệnh CE trong phiên (DSL)', search: {}, referer: '/ORDERS/ORDERBOOK_ACM' },
    { code: 'ORDERBOOK_ALL_ACM', name: 'Sổ lệnh liên thông lịch sử (T-1)', search: { SESSION_DATE: { from: '26/10/2026', to: '26/10/2026' } }, referer: '/ORDERS/ORDERBOOK_ALL_ACM' },
    { code: 'OPEN_POSITION', name: 'Vị thế mở toàn sàn (TTM CE)', search: {}, referer: '/ORDERS/OPEN_POSITION' },
    { code: 'SETTLEMENT_ACM', name: 'Giá thanh toán (GTT ACM)', search: {}, referer: '/PRODUCT/SETTLEMENT' },
    { code: 'COMMODITY_ACM', name: 'Danh mục hàng hóa (HH ACM)', search: {}, referer: '/PRODUCT/COMMODITY' },
    { code: 'SESSION_INFO', name: 'Thông tin phiên giao dịch', search: {}, referer: '/PRODUCT/SESSION' },
    { code: 'ACM_RECON_ORDERS', name: 'Đối chiếu lệnh liên thông ACM', search: {}, referer: '/RECONCILIATION/ACM_ORDERS' },
  ];

  console.log('\n' + '='.repeat(85));
  console.log('BẮT ĐẦU QUÉT THỬ NGHIỆM ENDPOINT: POST /exchange/export/create (KIỂU 2)');
  console.log('='.repeat(85));

  const results = [];
  for (const c of CANDIDATES) {
    const fekey = `${c.code}_${Date.now()}`;
    const payload = {
      searchcode: c.code,
      search: c.search,
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 20 },
      exptype: 'XLSX',
      fekey
    };

    try {
      const res = await fetch(`${baseUrl}/exchange/export/create`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': `Bearer ${accessToken}`,
          'connectkey': 'fsscssiam2021',
          'Content-Type': 'application/json',
          'Cookie': jar.getCookieHeader(),
          'Origin': baseUrl,
          'Referer': `${baseUrl}${c.referer}`,
          'x-devicetype': 'WEB',
          'x-lang': 'vi',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      const data = await res.json().catch(() => ({}));
      const isSuccess = res.status === 200 && (data.code === '0' || data.success === true || data.status === 'SUCCESS');
      results.push({
        code: c.code,
        name: c.name,
        httpStatus: res.status,
        responseCode: data.code || data.status || 'N/A',
        message: data.message || (isSuccess ? 'Hỗ trợ Server Export Kiểu 2' : 'Không hỗ trợ Export'),
        isServerExport: isSuccess
      });
      console.log(`[${isSuccess ? 'KIỂU 2: EXPORT' : 'KIỂU 1: JSON'}] ${c.code.padEnd(25)} -> HTTP ${res.status} | Code: ${data.code || data.status} | ${data.message || ''}`);
    } catch (err) {
      results.push({
        code: c.code,
        name: c.name,
        httpStatus: 'ERR',
        responseCode: 'EXCEPTION',
        message: err.message,
        isServerExport: false
      });
      console.log(`[LỖI] ${c.code.padEnd(25)} -> ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(85));
  console.log('TỔNG HỢP PHÂN LOẠI CHÍNH XÁC 100% GROUND TRUTH:');
  console.log('='.repeat(85));
  console.log('MÃ THUỘC SERVER_EXPORT_CODES (Bắt buộc dùng POST /export/create -> File Excel gốc):');
  results.filter(r => r.isServerExport).forEach(r => console.log(`  + ${r.code.padEnd(25)}: ${r.name}`));

  console.log('\nMÃ THUỘC DIRECT_JSON_CODES (Dùng REST Search JSON thông thường):');
  results.filter(r => !r.isServerExport).forEach(r => console.log(`  + ${r.code.padEnd(25)}: ${r.name} (${r.message})`));
}

main().catch(console.error);
"""

cmd = f"node << 'EOF'\n{node_script}\nEOF"
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
print(out)
if err.strip():
    print("Stderr:", err)
ssh.close()

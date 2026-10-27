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
  console.log('=== BẮT ĐẦU GỌI TRỰC TIẾP API CORECCP (LIVE SERVER) ===\\n');
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
  const rawBaseUrl = (urlDoc?.value || decrypted.url || 'https://coreccp.vnclear.vn').replace(/\\/+$/, '');
  const baseUrl = new URL(rawBaseUrl).origin;
  const username = decrypted.username;
  const password = decrypted.password;

  console.log('1. Đang đăng nhập CoreCCP OAuth2...');
  const jar = new CookieJar();
  const authUrl = `${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=${encodeURIComponent(baseUrl + '/validate_code')}&scope=openid%20profile`;
  const initRes = await fetch(authUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  jar.setFromHeaders(initRes.headers);

  let loc = initRes.headers.get('location');
  const loginPageRes = await fetch(loc.startsWith('http') ? loc : `${baseUrl}${loc}`, { headers: { Cookie: jar.getCookieHeader() }, redirect: 'manual' });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const loginBody = new URLSearchParams({ _csrf: csrf, username, password, page: 'login_ccp' });
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

  console.log('   -> Đăng nhập thành công! access_token nhận được.');

  // TEST 1: OMS_ACCOUNT với pageSize: 9999
  console.log('\\n2. GỌI API OMS_ACCOUNT (pageSize = 9999)...');
  let t0 = Date.now();
  const res9999 = await fetch(`${baseUrl}/ccp/inquiry/OMS_ACM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM`,
    },
    body: JSON.stringify({
      searchcode: 'OMS_ACCOUNT',
      search: {},
      page: 1,
      pageSize: 9999,
    }),
  });
  const json9999 = await res9999.json();
  console.log(`   -> Status: ${res9999.status} (${Date.now() - t0}ms)`);
  console.log('   -> json9999.code:', json9999.code, '| success:', json9999.success);
  console.log('   -> payload.page:', JSON.stringify(json9999.payload?.page || json9999.page));
  console.log('   -> payload.typeObject:', json9999.payload?.typeObject || json9999.typeObject);
  const data9999 = json9999.payload?.data || json9999.data || [];
  console.log('   -> data9999.length:', data9999.length);

  // TEST 2: OMS_ACCOUNT với pageSize: 200000 (để lấy hết hoặc xem server giới hạn ra sao)
  console.log('\\n3. GỌI API OMS_ACCOUNT (pageSize = 200000)...');
  t0 = Date.now();
  const res200k = await fetch(`${baseUrl}/ccp/inquiry/OMS_ACM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM`,
    },
    body: JSON.stringify({
      searchcode: 'OMS_ACCOUNT',
      search: {},
      page: 1,
      pageSize: 200000,
    }),
  });
  const json200k = await res200k.json();
  console.log(`   -> Status: ${res200k.status} (${Date.now() - t0}ms)`);
  console.log('   -> payload.page:', JSON.stringify(json200k.payload?.page || json200k.page));
  const data200k = json200k.payload?.data || json200k.data || [];
  console.log('   -> data200k.length:', data200k.length);

  // TEST 3: ACCTMARGIN_ALL (QLTTTKGD)
  console.log('\\n4. GỌI API ACCTMARGIN_ALL (maintain/ACCTMARGIN_ALL/search/ACCTMARGIN_ALL)...');
  t0 = Date.now();
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
    body: JSON.stringify({
      searchcode: 'ACCTMARGIN_ALL',
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 }
    })
  });
  const qlJson = await qlRes.json();
  console.log(`   -> Status: ${qlRes.status} (${Date.now() - t0}ms)`);
  console.log('   -> qlJson page:', JSON.stringify(qlJson.page || qlJson.payload?.page));
  console.log('   -> qlJson typeObject:', qlJson.typeObject || qlJson.payload?.typeObject);
  const qlData = qlJson.data || qlJson.payload?.data || [];
  console.log('   -> qlData.length:', qlData.length);

  // Phân tích dữ liệu data200k vs data9999
  const targetData = data200k.length > 0 ? data200k : data9999;
  if (Array.isArray(targetData) && targetData.length > 0) {
    let rmaGt0 = 0;
    let rmoGt0 = 0;
    let imCashGt0 = 0;
    let activeAny = 0;
    let allZero = 0;
    for (const d of targetData) {
      const rma = parseFloat(d.rma) || 0;
      const rmo = parseFloat(d.rmo) || 0;
      const im = parseFloat(d.imCash) || 0;
      if (rma > 0) rmaGt0++;
      if (rmo > 0) rmoGt0++;
      if (im > 0) imCashGt0++;
      if (rma > 0 || rmo > 0 || im > 0) activeAny++;
      if (rma === 0 && rmo === 0 && im === 0) allZero++;
    }
    console.log(`\\n5. THỐNG KÊ CHI TIẾT ${targetData.length} TÀI KHOẢN TỪ OMS:`);
    console.log(`   - Số TK có RMA > 0              : ${rmaGt0}`);
    console.log(`   - Số TK có RMO > 0              : ${rmoGt0}`);
    console.log(`   - Số TK có IM_CASH > 0          : ${imCashGt0}`);
    console.log(`   - Số TK có phát sinh (RMA>0 || RMO>0 || IM>0) : ${activeAny}`);
    console.log(`   - Số TK rỗng hoàn toàn (0 cả 3) : ${allZero}`);
    console.log('\\n   - Mẫu 3 bản ghi:');
    targetData.slice(0, 3).forEach((d, i) => {
      console.log(`     #${i+1}: accountId=${d.accountId || d.dmaAccount}, memberCode=${d.memberCode}, rma=${d.rma}, rmo=${d.rmo}, imCash=${d.imCash}`);
    });
  }

  // TEST 4: Thử gọi OMS_ACCOUNT với filter hoặc xem có cái nào trả về total = 1717 không
  console.log('\\n6. KIỂM TRA TÌM KIẾM CÁC TÀI KHOẢN CÓ PHÁT SINH HOẶC TOTAL = 1717...');
  // Thử filter imCash > 0 hoặc tương tự
  const resFilter = await fetch(`${baseUrl}/ccp/inquiry/OMS_ACM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      connectkey: 'fsscssiam2021',
      Cookie: sessionCookie,
      Authorization: `Bearer ${accessToken}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM`,
    },
    body: JSON.stringify({
      searchcode: 'OMS_ACCOUNT',
      search: { accountId: '0' },
      page: 1,
      pageSize: 9999,
    }),
  });
  const jsonFilter = await resFilter.json();
  console.log('   - Filter search:{accountId: "0"} page:', JSON.stringify(jsonFilter.payload?.page || jsonFilter.page));

  await mongoose.disconnect();
  console.log('\\n=== KẾT THÚC KIỂM CHỨNG ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_real_oms_account.js', 'w') as f:
    f.write(remote_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_real_oms_account.js')
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:", err)
ssh.close()

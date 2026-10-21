/**
 * TEST SCRIPT: Tải báo cáo từ sàn CoreExchange UAT
 * URL: https://uat-coreexchange.mxv.com.vn
 * User: hieptruong / Pass: Taovipko0!
 */

const fs = require('fs');
const path = require('path');
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  try {
    ExcelJS = require(path.join(__dirname, '..', 'backend', 'node_modules', 'exceljs'));
  } catch {
    ExcelJS = require(path.join(process.cwd(), 'node_modules', 'exceljs'));
  }
}

const UAT_BASE_URL = 'https://uat-coreexchange.mxv.com.vn';
const USERNAME = 'hieptruong';
const PASSWORD = 'Taovipko0!';
const CLIENT_ID = 'web-exchange-mxv';
const CLIENT_SECRET = 'jY3lgfDQQdJceOILsjKIxKLa0MQ7IU';
const CONNECT_KEY = 'fsscssiam2021';

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'test_uat_ce');

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
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
      const pair = str.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const k = pair.substring(0, idx).trim();
        const v = pair.substring(idx + 1).trim();
        this.cookies.set(k, v);
      }
    });
  }
  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function loginUat() {
  console.log(`[1/5] Khởi tạo phiên OAuth2 Authorize tới ${UAT_BASE_URL}...`);
  const jar = new CookieJar();
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'vi,en;q=0.9',
  };

  const redirectUri = `${UAT_BASE_URL}/validate_code`;
  const authUrl = `${UAT_BASE_URL}/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile`;

  const initRes = await fetch(authUrl, {
    headers: { ...commonHeaders },
    redirect: 'manual',
  });
  jar.setFromHeaders(initRes.headers);

  let loginUrl = initRes.headers.get('location') || `${UAT_BASE_URL}/login`;
  if (!loginUrl.startsWith('http')) loginUrl = `${UAT_BASE_URL}${loginUrl}`;

  console.log(`[2/5] Truy cập trang đăng nhập để bẫy _csrf token...`);
  const loginPageRes = await fetch(loginUrl, {
    headers: { ...commonHeaders, Cookie: jar.getCookieHeader(), Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'manual',
  });
  jar.setFromHeaders(loginPageRes.headers);
  const html = await loginPageRes.text();

  const csrfMatch =
    html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i) ||
    html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/i);

  if (!csrfMatch) {
    throw new Error('Không bẫy được _csrf token từ form HTML của UAT CoreExchange!');
  }
  const csrf = csrfMatch[1];
  console.log(`   _csrf: ${csrf.slice(0, 15)}... | Cookie: ${jar.getCookieHeader()}`);

  console.log(`[3/5] Gửi thông tin đăng nhập (User: ${USERNAME})...`);
  const bodyParams = new URLSearchParams();
  bodyParams.append('_csrf', csrf);
  bodyParams.append('username', USERNAME);
  bodyParams.append('password', PASSWORD);
  bodyParams.append('page', 'login');

  const postLoginRes = await fetch(`${UAT_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.getCookieHeader(),
      Origin: UAT_BASE_URL,
      Referer: loginUrl,
    },
    body: bodyParams.toString(),
    redirect: 'manual',
  });

  jar.setFromHeaders(postLoginRes.headers);
  let nextUrl = postLoginRes.headers.get('location');

  if (!nextUrl || nextUrl.includes('error') || postLoginRes.status === 401) {
    throw new Error(`Đăng nhập thất bại: Sai tên đăng nhập/mật khẩu hoặc tài khoản UAT bị khóa! HTTP: ${postLoginRes.status}`);
  }

  console.log(`[4/5] Theo dõi chuyển hướng OAuth2 để lấy Authorization Code...`);
  let code = '';
  let currentUrl = nextUrl.startsWith('http') ? nextUrl : `${UAT_BASE_URL}${nextUrl}`;
  let hops = 0;

  while (currentUrl && hops < 5) {
    hops++;
    const stepRes = await fetch(currentUrl, {
      headers: { ...commonHeaders, Cookie: jar.getCookieHeader() },
      redirect: 'manual',
    });
    jar.setFromHeaders(stepRes.headers);

    try {
      const parsed = new URL(currentUrl);
      if (parsed.searchParams.has('code')) {
        code = parsed.searchParams.get('code');
        break;
      }
    } catch {}

    const loc = stepRes.headers.get('location');
    if (loc) {
      currentUrl = loc.startsWith('http') ? loc : `${UAT_BASE_URL}${loc}`;
      try {
        const p2 = new URL(currentUrl);
        if (p2.searchParams.has('code')) {
          code = p2.searchParams.get('code');
          break;
        }
      } catch {}
    } else {
      break;
    }
  }

  if (!code) {
    throw new Error('Đăng nhập thành công nhưng không lấy được mã Authorization Code!');
  }
  console.log(`   Authorization Code: ${code.slice(0, 15)}...`);

  console.log(`[5/5] Đổi Code lấy Bearer Access Token...`);
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('code', code);
  tokenParams.append('redirect_uri', redirectUri);

  const tokenRes = await fetch(`${UAT_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Cookie: jar.getCookieHeader(),
      Origin: UAT_BASE_URL,
      Referer: `${UAT_BASE_URL}/validate_code`,
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Đổi OAuth2 token thất bại (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  console.log(` ĐĂNG NHẬP UAT COREEXCHANGE THÀNH CÔNG!`);
  console.log(`   Access Token: Bearer ${tokenData.access_token.slice(0, 25)}...`);
  return {
    accessToken: tokenData.access_token,
    cookieHeader: jar.getCookieHeader(),
  };
}

async function searchUat(session, searchCode, parentCode = null, searchFilter = {}) {
  const parent = parentCode || searchCode;
  const endpoint = `/exchange/inquiry/maintain/${parent}/search/${searchCode}`;
  const fullUrl = `${UAT_BASE_URL}${endpoint}`;

  const payload = {
    searchcode: searchCode,
    search: searchFilter,
    filter: {},
    orderBy: {},
    page: { pageIndex: 1, pageSize: 200000 },
  };

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${session.accessToken}`,
      connectkey: CONNECT_KEY,
      Cookie: session.cookieHeader,
      Origin: UAT_BASE_URL,
      Referer: `${UAT_BASE_URL}/`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Lỗi gọi API ${searchCode} (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const rows = data.payload?.data || data.data || [];
  const totalCount = data.payload?.page?.totalCount || rows.length;
  return { rows, totalCount };
}

async function exportToExcel(rows, sheetName, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName || 'Sheet1');

  if (rows.length === 0) {
    ws.addRow(['(Không có dữ liệu trên môi trường UAT)']);
  } else {
    const headers = Object.keys(rows[0]);
    ws.columns = headers.map(k => ({ header: k, key: k, width: Math.max(k.length + 4, 15) }));
    rows.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
  }

  await wb.xlsx.writeFile(filePath);
}

(async () => {
  console.log('========================================================================');
  console.log(' BẮT ĐẦU KIỂM THỬ TẢI COREEXCHANGE TRÊN MÔI TRƯỜNG UAT');
  console.log(` URL: ${UAT_BASE_URL} | Tài khoản: ${USERNAME}`);
  console.log(` Thư mục lưu kết quả: ${OUTPUT_DIR}`);
  console.log('========================================================================\n');

  try {
    const session = await loginUat();

    const reportsToDownload = [
      { code: 'COMMODITY_ACM', name: 'Danh mục Hàng hóa', fileName: 'HH ACM_UAT.xlsx' },
      { code: 'ORDERMATCH_DETAIL_ACM', name: 'Danh sách Giao dịch CE (Khớp lệnh)', fileName: 'DSGD ACM CE_UAT.xlsx', derived: ['DSGD ALL ACM CE_UAT.xlsx', 'DSGD MM CE_UAT.xlsx'] },
      { code: 'ORDERBOOK_ALL_ACM', name: 'Sổ lệnh Tổng hợp CE', fileName: 'DSL ACM CE_UAT.xlsx', derived: ['DSLDK ACM CE_UAT.xlsx', 'DSLCK ACM CE_UAT.xlsx', 'DSLH ACM CE_UAT.xlsx', 'DSL Trong Phien CE_UAT.xlsx', 'DSL MM CE_UAT.xlsx'] },
      { code: 'SETTLEMENT', name: 'Giá Thanh toán ACM', fileName: 'GTT ACM_UAT.xlsx' },
      { code: 'SESSION_INFO', name: 'Thông tin Phiên trong ngày', fileName: 'SESSION_INFO_UAT.xlsx' },
      { code: 'SESSION_CONFIG_ALL', name: 'Cấu hình Phiên', fileName: 'SESSION_CONFIG_UAT.xlsx' },
      { code: 'OPEN_POSITION', name: 'Trạng thái Mở CE (TTM)', fileName: 'TTM CE_UAT.xlsx' },
      { code: 'ACM_RECON_ORDERS', name: 'Đối chiếu Lệnh ACM', fileName: 'Doi chieu lenh ACM_UAT.xlsx' },
    ];

    let totalFilesCount = 0;

    for (let i = 0; i < reportsToDownload.length; i++) {
      const rep = reportsToDownload[i];
      console.log(`\n--- [${i + 1}/${reportsToDownload.length}] TẢI: ${rep.name} (${rep.code}) ---`);
      try {
        const searchRes = await searchUat(session, rep.code);
        console.log(`   -> Tìm thấy ${searchRes.totalCount} dòng dữ liệu.`);
        const filePath = path.join(OUTPUT_DIR, rep.fileName);
        await exportToExcel(searchRes.rows, rep.code, filePath);
        const fSize = fs.statSync(filePath).size;
        console.log(`   Đã lưu: ${filePath} (${fSize} bytes)`);
        totalFilesCount++;

        // Nếu là COMMODITY_ACM, tự động trích xuất toàn bộ hợp đồng chi tiết theo từng hàng hóa
        if (rep.code === 'COMMODITY_ACM' && Array.isArray(searchRes.rows)) {
          console.log(`\n   >>> [TỰ ĐỘNG QUÉT HỢP ĐỒNG ĐỘNG (INSTRUMENTS_ACM)] <<<`);
          for (const comm of searchRes.rows) {
            const uacode = (comm.UACODE || comm.uacode || comm.SYMBOL || '').trim();
            if (!uacode) continue;
            console.log(`      Đang tải hợp đồng cho hàng hóa ${uacode} (${comm.VN_FULLNAME || ''})...`);
            try {
              const contractRes = await searchUat(session, 'INSTRUMENTS_ACM', 'COMMODITY_ACM', { KEYVAL: uacode });
              console.log(`      -> ${uacode}: ${contractRes.totalCount} hợp đồng.`);
              const hdPath = path.join(OUTPUT_DIR, `HĐ ${uacode}_UAT.xlsx`);
              await exportToExcel(contractRes.rows, uacode, hdPath);
              console.log(`         Đã lưu: ${hdPath} (${fs.statSync(hdPath).size} bytes)`);
              totalFilesCount++;
            } catch (hdErr) {
              console.warn(`         Lỗi tải HĐ ${uacode}: ${hdErr.message}`);
            }
          }
        }

        // Tự động sao chép các file phái sinh phục vụ ca trực (nếu có)
        if (rep.derived && rep.derived.length > 0) {
          console.log(`   >>> [TẠO BẢN SAO PHÁI SINH CHO CA TRỰC] <<<`);
          for (const derFileName of rep.derived) {
            const derPath = path.join(OUTPUT_DIR, derFileName);
            fs.copyFileSync(filePath, derPath);
            console.log(`      Đã tạo file phái sinh: ${derPath} (${fs.statSync(derPath).size} bytes)`);
            totalFilesCount++;
          }
        }
      } catch (err) {
        console.error(`    Lỗi tải ${rep.code}: ${err.message}`);
      }
    }

    console.log('\n========================================================================');
    console.log(` KIỂM THỬ TẢI TOÀN BỘ COREEXCHANGE HOÀN TẤT! ĐÃ LƯU TỔNG CỘNG ${totalFilesCount} FILE.`);
    console.log(` Kiểm tra các file tại: ${OUTPUT_DIR}`);
    console.log('========================================================================');
  } catch (err) {
    console.error('\n LỖI TRONG QUÁ TRÌNH KIỂM THỬ UAT:', err.message);
  }
})();

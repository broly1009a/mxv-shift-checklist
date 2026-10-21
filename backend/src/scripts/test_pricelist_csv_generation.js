const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function decrypt(text) {
  if (!text) return '';
  const parts = text.split(':');
  const secretKey = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!').digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, Buffer.from(parts[0], 'hex'));
  let dec = decipher.update(Buffer.from(parts[1], 'hex'));
  return Buffer.concat([dec, decipher.final()]).toString('utf8');
}
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const CSV_HEADERS = [
  'Mã hợp đồng', 'Tên hợp đồng', 'Mã hàng hoá', 'KL chào mua', 'Giá chào mua',
  'KL đang chờ khớp mua', 'Giá chào bán', 'KL chào bán', 'KL chờ khớp bán',
  'Giá khớp', 'KL khớp', 'Thay đổi', 'Thay đổi (%)', 'Giá mở cửa', 'Giá cao nhất',
  'Giá thấp nhất', 'Giá đóng cửa', 'Giá đóng cửa phiên trước', 'Giá thanh toán',
  'Bước giá tối thiểu', 'Giá hợp đồng', 'KL giao dịch', 'Ngày giờ cập nhật gần nhất'
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function convertPriceListToCsv(items) {
  const lines = [];
  lines.push(CSV_HEADERS.map(escapeCsv).join(','));
  for (const item of items) {
    const row = [
      item.contractCode || '',
      item.contractName || '',
      item.commodityCode || '',
      item.bidQty != null ? item.bidQty : '',
      item.bidPrice != null ? item.bidPrice : '',
      item.pendingBuy != null ? item.pendingBuy : '',
      item.offerPrice != null ? item.offerPrice : '',
      item.offerQty != null ? item.offerQty : '',
      item.pendingSell != null ? item.pendingSell : '',
      item.filledPrice != null ? item.filledPrice : '',
      item.filledQty != null ? item.filledQty : '',
      item.change != null ? item.change : '',
      item.percentageChange != null ? item.percentageChange : '',
      item.openPrice != null ? item.openPrice : '',
      item.highestPrice != null ? item.highestPrice : '',
      item.lowestPrice != null ? item.lowestPrice : '',
      item.closePrice != null ? item.closePrice : '',
      item.prevClosePrice != null ? item.prevClosePrice : '',
      item.settlePrice != null ? item.settlePrice : '',
      item.priceUnit != null ? item.priceUnit : '',
      item.contractVolume != null ? item.contractVolume : '',
      item.volume != null ? item.volume : '',
      item.lastUpdateDatetime ? new Date(item.lastUpdateDatetime).toISOString() : '',
    ];
    lines.push(row.map(escapeCsv).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  const creds = JSON.parse(decrypt(s.value));
  await mongoose.disconnect();
  const baseUrl = creds.apiUrl || 'https://msapi.mxv.com.vn';
  const r1 = await fetch(baseUrl + '/am/admin/users/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password })
  });
  const d1 = await r1.json();
  const userId = d1.data.user.id || d1.data.user._id;
  const tempToken = d1.data.user.accessToken;
  const r2 = await fetch(baseUrl + '/am/admin/users/verifyPin/' + userId, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tempToken },
    body: JSON.stringify({ pin: String(creds.pin) })
  });
  const d2 = await r2.json();
  const token = d2.data.user.accessToken;

  const t0 = Date.now();
  const rPrice = await fetch(baseUrl + '/market/priceList', {
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' }
  });
  const dPrice = await rPrice.json();
  const items = dPrice.data || [];
  const csvStr = convertPriceListToCsv(items);
  const outPath = path.join(__dirname, '..', '..', 'data', 'temp', 'api_generated_market.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csvStr, 'utf8');

  console.log(' Đã tạo thành công file market.csv qua Direct REST API!');
  console.log('⏱ Thời gian thực thi API & Sinh CSV:', Date.now() - t0, 'ms');
  console.log('📦 Dung lượng file:', fs.statSync(outPath).size, 'bytes');
  console.log('📊 Tổng số dòng:', csvStr.split('\r\n').length);

  // So sánh 5 dòng đầu với market.csv của Playwright
  const originalPath = path.join(__dirname, '..', '..', 'data', 'temp', 'sniff_ms', 'market.csv');
  if (fs.existsSync(originalPath)) {
    const orig = fs.readFileSync(originalPath, 'utf8').split('\n').slice(0, 5);
    const gen = csvStr.split('\r\n').slice(0, 5);
    console.log('\n--- SO SÁNH 3 DÒNG ĐẦU GIỮA BROWSER VÀ REST API ---');
    for (let i = 0; i < 3; i++) {
      console.log(`[Dòng ${i + 1}] BROWSER : ${orig[i]?.trim()}`);
      console.log(`[Dòng ${i + 1}] REST API: ${gen[i]?.trim()}`);
    }
  }
}

test().catch(console.error);

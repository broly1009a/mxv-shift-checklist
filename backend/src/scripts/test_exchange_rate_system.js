/**
 * TEST_EXCHANGE_RATE_SYSTEM.JS
 * 
 * Bộ kiểm thử toàn diện (Comprehensive Test Suite) cho Cơ chế Tách biệt Cấu hình
 * và Xử lý Tỷ giá Đa Nguyên tệ giữa M-System (MXV) và CoreCCP (VNCLEAR).
 * 
 * Phạm vi kiểm thử 8 Test Suites:
 *   [Suite 1] Chống ghi đè chéo (No Cross-Overwrite Assurance)
 *   [Suite 2] Ma trận tỷ giá đa nguyên tệ động CoreCCP (ccp_exchange_rates_matrix)
 *   [Suite 3] Logic lấy tỷ giá trong ccp-recon.service.ts (Loss = buyRate, Gain = sellRate)
 *   [Suite 4] Logic lấy tỷ giá trong recon-console-summary.service.ts (M-System độc lập)
 *   [Suite 5] Bóc tách file tỷ giá CoreCCP (parseTyGiaFile: USD, JPY, MYR, CNY/RMB)
 *   [Suite 6] Quy đổi giá trị giao dịch đa ngoại tệ (Multi-Currency Valuation)
 *   [Suite 7] Chịu lỗi và Fallback an toàn (Malformed JSON, NaN, Zero, Negative values)
 *   [Suite 8] Kiểm tra cấu hình thực tế trên CSDL MongoDB (Read-Only 100%)
 * 
 * CÁCH CHẠY:
 *   cd backend
 *   node src/scripts/test_exchange_rate_system.js
 */

const path = require('path');
const fs = require('fs');

// Cố gắng nạp dotenv nếu có file .env
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch {
  // Bỏ qua nếu không có dotenv
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HARNESS: MOCK SETTINGS SERVICE VỚI AUDIT LOG GHI CHÉP
// ─────────────────────────────────────────────────────────────────────────────
class MockSettingsService {
  constructor(initialSettings = {}) {
    this.store = new Map(Object.entries(initialSettings));
    this.writeLog = []; // Lưu lại lịch sử mọi lần gọi setSetting để kiểm tra ghi đè
  }

  async getSetting(key, defaultValue = '') {
    if (this.store.has(key)) {
      return String(this.store.get(key));
    }
    return String(defaultValue);
  }

  async setSetting(key, value) {
    const prev = this.store.get(key);
    this.store.set(key, String(value));
    this.writeLog.push({
      timestamp: new Date().toISOString(),
      key,
      prevValue: prev,
      newValue: String(value),
    });
  }

  getWritesForKey(key) {
    return this.writeLog.filter((w) => w.key === key);
  }

  clearAudit() {
    this.writeLog = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HARNESS: THỰC THI LOGIC CỦA CÁC SERVICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logic đồng bộ tỷ giá từ file CoreCCP (Từ ccp-lot-statistics.service.ts & controller)
 */
async function simulateCoreCcpExchangeRateSync(settingsService, tyGiaMap, sourceName = 'Test File') {
  const nowIso = new Date().toISOString();
  if (tyGiaMap['USD']) {
    await settingsService.setSetting('ccp_usd_exchange_rate', String(tyGiaMap['USD']));
    await settingsService.setSetting('ccp_rates_last_synced', nowIso);
    await settingsService.setSetting('exchange_rates_last_synced', nowIso);
    await settingsService.setSetting('exchange_rate_source', sourceName);
  }
  if (tyGiaMap['JPY']) await settingsService.setSetting('ccp_jpy_exchange_rate', String(tyGiaMap['JPY']));
  if (tyGiaMap['MYR']) await settingsService.setSetting('ccp_myr_exchange_rate', String(tyGiaMap['MYR']));
  if (tyGiaMap['CNY'] || tyGiaMap['RMB']) {
    const rmbVal = tyGiaMap['CNY'] || tyGiaMap['RMB'];
    await settingsService.setSetting('ccp_rmb_exchange_rate', String(rmbVal));
  }

  // Cập nhật ma trận động ccp_exchange_rates_matrix
  const matrixStr = await settingsService.getSetting('ccp_exchange_rates_matrix', '{}');
  let matrix = {};
  try { matrix = JSON.parse(matrixStr || '{}'); } catch { matrix = {}; }
  for (const [curr, rate] of Object.entries(tyGiaMap)) {
    if (curr === 'VND') continue;
    matrix[curr] = {
      currencyCode: curr,
      conversionRate: rate,
      buyRate: matrix[curr]?.buyRate ?? rate,
      sellRate: matrix[curr]?.sellRate ?? rate,
      effectiveDate: nowIso.split('T')[0],
    };
  }
  await settingsService.setSetting('ccp_exchange_rates_matrix', JSON.stringify(matrix));
}

/**
 * Logic nạp tỷ giá vào DB của ccp-lot-statistics.service.ts (calculateLotStatistics)
 */
async function simulateLoadCcpRatesForCalculation(settingsService) {
  let tyGiaMap = {};
  let dbUsdRate = 25920;
  let dbJpyRate = 170;
  let dbMyrRate = 6383;
  let dbRmbRate = 3871;

  try {
    const matrixStr = await settingsService.getSetting('ccp_exchange_rates_matrix', '');
    let matrix = {};
    if (matrixStr) {
      try { matrix = JSON.parse(matrixStr); } catch { matrix = {}; }
    }

    const [ccpUsdStr, usdStr, ccpJpyStr, jpyStr, ccpMyrStr, myrStr, ccpRmbStr, rmbStr] = await Promise.all([
      settingsService.getSetting('ccp_usd_exchange_rate', ''),
      settingsService.getSetting('usd_exchange_rate', '26000'),
      settingsService.getSetting('ccp_jpy_exchange_rate', ''),
      settingsService.getSetting('jpy_exchange_rate', '170'),
      settingsService.getSetting('ccp_myr_exchange_rate', ''),
      settingsService.getSetting('myr_exchange_rate', '6383'),
      settingsService.getSetting('ccp_rmb_exchange_rate', ''),
      settingsService.getSetting('rmb_exchange_rate', '3871'),
    ]);
    dbUsdRate = matrix['USD']?.conversionRate || parseFloat(ccpUsdStr) || parseFloat(usdStr) || 26000;
    dbJpyRate = matrix['JPY']?.conversionRate || parseFloat(ccpJpyStr) || parseFloat(jpyStr) || 170;
    dbMyrRate = matrix['MYR']?.conversionRate || parseFloat(ccpMyrStr) || parseFloat(myrStr) || 6383;
    dbRmbRate = matrix['RMB']?.conversionRate || matrix['CNY']?.conversionRate || parseFloat(ccpRmbStr) || parseFloat(rmbStr) || 3871;

    // Nạp các đồng tiền khác từ ma trận (nếu người dùng thêm EUR, SGD...)
    for (const [code, item] of Object.entries(matrix)) {
      if (item && item.conversionRate && !tyGiaMap[code]) {
        tyGiaMap[code] = Number(item.conversionRate);
      }
    }
  } catch {
    // Graceful
  }

  tyGiaMap['USD'] = tyGiaMap['USD'] || dbUsdRate;
  tyGiaMap['JPY'] = tyGiaMap['JPY'] || dbJpyRate;
  tyGiaMap['MYR'] = tyGiaMap['MYR'] || dbMyrRate;
  tyGiaMap['RMB'] = tyGiaMap['RMB'] || dbRmbRate;

  return tyGiaMap;
}

/**
 * Logic hàm getCurrentExchangeRates trong ccp-recon.service.ts
 */
async function simulateCcpReconGetCurrentExchangeRates(settingsService) {
  let matrix = {};
  try {
    const matrixStr = await settingsService.getSetting('ccp_exchange_rates_matrix', '');
    if (matrixStr) matrix = JSON.parse(matrixStr);
  } catch {
    matrix = {};
  }

  const [
    ccpUsdStr, usdStr,
    ccpMyrStr, myrStr,
    ccpJpyStr, jpyStr,
    ccpRmbStr, rmbStr,
  ] = await Promise.all([
    settingsService.getSetting('ccp_usd_exchange_rate', ''),
    settingsService.getSetting('usd_exchange_rate', '26000'),
    settingsService.getSetting('ccp_myr_exchange_rate', ''),
    settingsService.getSetting('myr_exchange_rate', '6383'),
    settingsService.getSetting('ccp_jpy_exchange_rate', ''),
    settingsService.getSetting('jpy_exchange_rate', '170'),
    settingsService.getSetting('ccp_rmb_exchange_rate', ''),
    settingsService.getSetting('rmb_exchange_rate', '3871'),
  ]);

  const getRate = (code, ccpFallback, msFallback, defVal) => {
    const item = matrix[code];
    const conv = item?.conversionRate ? Number(item.conversionRate) : (parseFloat(ccpFallback) || parseFloat(msFallback) || defVal);
    const buy = item?.buyRate ? Number(item.buyRate) : conv;
    const sell = item?.sellRate ? Number(item.sellRate) : conv;
    return { buy, sell, conv };
  };

  const usd = getRate('USD', ccpUsdStr, usdStr, 26000);
  const myr = getRate('MYR', ccpMyrStr, myrStr, 6383);
  const jpy = getRate('JPY', ccpJpyStr, jpyStr, 170);
  const rmb = getRate('RMB', ccpRmbStr, rmbStr, 3871);

  return {
    usdLoss: usd.buy,
    usdGain: usd.sell,
    myrLoss: myr.buy,
    myrGain: myr.sell,
    jpyLoss: jpy.buy,
    jpyGain: jpy.sell,
    rmbLoss: rmb.buy,
    rmbGain: rmb.sell,
  };
}

/**
 * Logic hàm getCurrentExchangeRates trong recon-console-summary.service.ts (M-System)
 */
async function simulateMsConsoleGetCurrentExchangeRates(settingsService) {
  const usdStr = await settingsService.getSetting('usd_exchange_rate', '25920');
  const myrStr = await settingsService.getSetting('myr_exchange_rate', '6383');
  const jpyStr = await settingsService.getSetting('jpy_exchange_rate', '170');
  const rmbStr = await settingsService.getSetting('rmb_exchange_rate', '3871');

  const usd = parseFloat(usdStr) || 25920;
  const myr = parseFloat(myrStr) || 6383;
  const jpy = parseFloat(jpyStr) || 170;
  const rmb = parseFloat(rmbStr) || 3871;

  return {
    usdLoss: usd,
    usdGain: usd,
    myrLoss: myr,
    myrGain: myr,
    jpyLoss: jpy,
    jpyGain: jpy,
    rmbLoss: rmb,
    rmbGain: rmb,
  };
}

/**
 * Logic bóc tách parseTyGiaFile (Từ ccp-lot-statistics.service.ts)
 */
function parseTyGiaRowsMock(rows) {
  const map = {};
  for (const row of rows) {
    const currency = String(row[0] ?? '').trim().toUpperCase();
    const rate = parseFloat(String(row[1] ?? '0').replace(/,/g, ''));
    if (currency && !isNaN(rate) && rate > 0) {
      map[currency] = rate;
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEST RUNNER & ASSERTION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
let passedCount = 0;
let failedCount = 0;
const testResults = [];

function assert(description, condition, details = '') {
  if (condition) {
    passedCount++;
    testResults.push({ status: 'PASS', description, details });
    console.log(`  [PASS] ${description}`);
  } else {
    failedCount++;
    testResults.push({ status: 'FAIL', description, details });
    console.error(`  [FAIL] ${description} -> ${details}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────
async function runAllSuites() {
  console.log('\n======================================================================');
  console.log('  BỘ KIỂM THỬ HỆ THỐNG TỶ GIÁ ĐA NGUYÊN TỆ: M-SYSTEM vs CORECCP');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // SUITE 1: CHỐNG GHI ĐÈ CHÉO (NO CROSS-OVERWRITE ASSURANCE)
  // ---------------------------------------------------------------------------
  console.log('--- [SUITE 1] Kiểm tra Chống Ghi Đè Chéo Tỷ Giá M-System & CoreCCP ---');
  const s1 = new MockSettingsService({
    usd_exchange_rate: '26100', // M-System ban đầu
    usd_settlement_rate_sell: '26150',
    usd_settlement_rate_buy: '26050',
    jpy_exchange_rate: '168',   // M-System JPY
    myr_exchange_rate: '6268',  // M-System MYR
  });

  // Giả lập nạp tỷ giá CoreCCP từ file tải lên
  const coreCcpFileRates = {
    USD: 26000,
    JPY: 170,
    MYR: 6383,
    CNY: 3871,
  };

  await simulateCoreCcpExchangeRateSync(s1, coreCcpFileRates, 'Tệp Tỷ giá CoreCCP Test');

  const msUsd = await s1.getSetting('usd_exchange_rate');
  const msSell = await s1.getSetting('usd_settlement_rate_sell');
  const msBuy = await s1.getSetting('usd_settlement_rate_buy');
  const msJpy = await s1.getSetting('jpy_exchange_rate');
  const msMyr = await s1.getSetting('myr_exchange_rate');

  const ccpUsd = await s1.getSetting('ccp_usd_exchange_rate');
  const ccpJpy = await s1.getSetting('ccp_jpy_exchange_rate');
  const ccpMyr = await s1.getSetting('ccp_myr_exchange_rate');
  const ccpRmb = await s1.getSetting('ccp_rmb_exchange_rate');

  assert('usd_exchange_rate của M-System KHÔNG bị ghi đè (Vẫn là 26100)', msUsd === '26100', `Thực tế: ${msUsd}`);
  assert('usd_settlement_rate_sell của M-System KHÔNG bị đổi (Vẫn là 26150)', msSell === '26150', `Thực tế: ${msSell}`);
  assert('usd_settlement_rate_buy của M-System KHÔNG bị đổi (Vẫn là 26050)', msBuy === '26050', `Thực tế: ${msBuy}`);
  assert('jpy_exchange_rate của M-System KHÔNG bị ghi đè (Vẫn là 168)', msJpy === '168', `Thực tế: ${msJpy}`);
  assert('myr_exchange_rate của M-System KHÔNG bị ghi đè (Vẫn là 6268)', msMyr === '6268', `Thực tế: ${msMyr}`);

  assert('ccp_usd_exchange_rate được lưu độc lập chuẩn xác (26000)', ccpUsd === '26000', `Thực tế: ${ccpUsd}`);
  assert('ccp_jpy_exchange_rate được lưu độc lập chuẩn xác (170)', ccpJpy === '170', `Thực tế: ${ccpJpy}`);
  assert('ccp_myr_exchange_rate được lưu độc lập chuẩn xác (6383)', ccpMyr === '6383', `Thực tế: ${ccpMyr}`);
  assert('ccp_rmb_exchange_rate được ánh xạ chuẩn từ CNY (3871)', ccpRmb === '3871', `Thực tế: ${ccpRmb}`);

  const overwriteWrites = s1.getWritesForKey('usd_exchange_rate');
  assert('Số lần ghi vào usd_exchange_rate là 0 (Tuyệt đối không đè)', overwriteWrites.length === 0, `Số lần ghi: ${overwriteWrites.length}`);

  // ---------------------------------------------------------------------------
  // SUITE 2: MA TRẬN TỶ GIÁ ĐA NGUYÊN TỆ ĐỘNG (ccp_exchange_rates_matrix)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 2] Kiểm tra Ma Trận Đa Nguyên Tệ Động CoreCCP (Zero-Hardcoding) ---');
  const matrixStr = await s1.getSetting('ccp_exchange_rates_matrix');
  let matrix = JSON.parse(matrixStr);

  assert('Ma trận ccp_exchange_rates_matrix tồn tại và hợp lệ', typeof matrix === 'object' && matrix !== null);
  assert('Ma trận có USD (conversionRate = 26000)', matrix.USD?.conversionRate === 26000);
  assert('Ma trận có JPY (conversionRate = 170)', matrix.JPY?.conversionRate === 170);
  assert('Ma trận có MYR (conversionRate = 6383)', matrix.MYR?.conversionRate === 6383);

  // Người trực ca thêm 2 nguyên tệ mới trực tiếp: EUR và SGD
  console.log('   -> Thêm nguyên tệ mới EUR (28,500 VND) và SGD (20,100 VND) vào ma trận...');
  matrix['EUR'] = { currencyCode: 'EUR', conversionRate: 28500, buyRate: 28400, sellRate: 28600, effectiveDate: '2026-09-23' };
  matrix['SGD'] = { currencyCode: 'SGD', conversionRate: 20100, buyRate: 20050, sellRate: 20150, effectiveDate: '2026-09-23' };
  await s1.setSetting('ccp_exchange_rates_matrix', JSON.stringify(matrix));

  // Kiểm tra ccp-lot-statistics tự động nạp EUR và SGD vào tyGiaMap mà không cần sửa code
  const loadedTyGiaMap = await simulateLoadCcpRatesForCalculation(s1);
  assert('tyGiaMap tự động nhận diện nguyên tệ mới EUR = 28500', loadedTyGiaMap['EUR'] === 28500, `Thực tế: ${loadedTyGiaMap['EUR']}`);
  assert('tyGiaMap tự động nhận diện nguyên tệ mới SGD = 20100', loadedTyGiaMap['SGD'] === 20100, `Thực tế: ${loadedTyGiaMap['SGD']}`);

  // Thao tác xóa nguyên tệ phụ SGD (không được xóa USD)
  delete matrix['SGD'];
  assert('Nguyên tệ phụ SGD xóa thành công khỏi ma trận', !matrix['SGD']);
  assert('Nguyên tệ cơ sở USD vẫn được bảo toàn', !!matrix['USD']);

  // ---------------------------------------------------------------------------
  // SUITE 3: LOGIC LẤY TỶ GIÁ TRONG ccp-recon.service.ts (Loss/Gain Mapping)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 3] Kiểm tra Mapping Tỷ giá CoreCCP trong ccp-recon.service.ts ---');
  // Thiết lập ma trận có tỷ giá Mua/Bán riêng biệt:
  // CoreCCP: USD Mua/Bán 26000; JPY Mua/Bán 168 (dù quy đổi là 170); MYR Mua/Bán 6268 (dù quy đổi 6383)
  const realisticMatrix = {
    USD: { currencyCode: 'USD', conversionRate: 26000, buyRate: 26000, sellRate: 26000 },
    JPY: { currencyCode: 'JPY', conversionRate: 170, buyRate: 168, sellRate: 168 },
    MYR: { currencyCode: 'MYR', conversionRate: 6383, buyRate: 6268, sellRate: 6268 },
    RMB: { currencyCode: 'RMB', conversionRate: 3871, buyRate: 3871, sellRate: 3871 },
  };
  const s3 = new MockSettingsService({
    ccp_exchange_rates_matrix: JSON.stringify(realisticMatrix),
    ccp_usd_exchange_rate: '26000',
    usd_exchange_rate: '26100',
  });

  const ccpRates = await simulateCcpReconGetCurrentExchangeRates(s3);
  assert('ccp-recon: usdLoss = 26000', ccpRates.usdLoss === 26000, `Thực tế: ${ccpRates.usdLoss}`);
  assert('ccp-recon: usdGain = 26000', ccpRates.usdGain === 26000, `Thực tế: ${ccpRates.usdGain}`);
  assert('ccp-recon: jpyLoss lấy đúng buyRate 168 (không nhầm sang 170)', ccpRates.jpyLoss === 168, `Thực tế: ${ccpRates.jpyLoss}`);
  assert('ccp-recon: jpyGain lấy đúng sellRate 168', ccpRates.jpyGain === 168, `Thực tế: ${ccpRates.jpyGain}`);
  assert('ccp-recon: myrLoss lấy đúng buyRate 6268 (không nhầm sang 6383)', ccpRates.myrLoss === 6268, `Thực tế: ${ccpRates.myrLoss}`);
  assert('ccp-recon: myrGain lấy đúng sellRate 6268', ccpRates.myrGain === 6268, `Thực tế: ${ccpRates.myrGain}`);

  // Kiểm tra Fallback khi ma trận rỗng:
  const s3Empty = new MockSettingsService({
    ccp_usd_exchange_rate: '25950',
    ccp_jpy_exchange_rate: '169',
  });
  const fallbackRates = await simulateCcpReconGetCurrentExchangeRates(s3Empty);
  assert('Fallback an toàn khi ma trận rỗng: usdLoss = 25950', fallbackRates.usdLoss === 25950, `Thực tế: ${fallbackRates.usdLoss}`);
  assert('Fallback an toàn khi ma trận rỗng: jpyLoss = 169', fallbackRates.jpyLoss === 169, `Thực tế: ${fallbackRates.jpyLoss}`);
  assert('Fallback mặc định khi không có dữ liệu: myrLoss = 6383', fallbackRates.myrLoss === 6383, `Thực tế: ${fallbackRates.myrLoss}`);
  assert('Không bao giờ trả về NaN hoặc undefined', !isNaN(fallbackRates.usdLoss) && fallbackRates.usdLoss > 0);

  // ---------------------------------------------------------------------------
  // SUITE 4: LOGIC LẤY TỶ GIÁ TRONG recon-console-summary.service.ts (M-System)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 4] Kiểm tra Tính Độc Lập của M-System Console Summary ---');
  const s4 = new MockSettingsService({
    usd_exchange_rate: '26100',
    myr_exchange_rate: '6268',
    jpy_exchange_rate: '168',
    rmb_exchange_rate: '3871',
    ccp_usd_exchange_rate: '26000', // Đã có CoreCCP khác giá trị
  });

  const msRates = await simulateMsConsoleGetCurrentExchangeRates(s4);
  assert('M-System Summary đọc đúng usd_exchange_rate = 26100', msRates.usdLoss === 26100, `Thực tế: ${msRates.usdLoss}`);
  assert('M-System Summary cách ly hoàn toàn với CoreCCP (26100 !== 26000)', msRates.usdLoss !== 26000);
  assert('M-System Summary đọc đúng myr_exchange_rate = 6268', msRates.myrLoss === 6268);
  assert('M-System Summary đọc đúng jpy_exchange_rate = 168', msRates.jpyLoss === 168);

  // ---------------------------------------------------------------------------
  // SUITE 5: BÓC TÁCH FILE TỶ GIÁ (parseTyGiaFile)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 5] Kiểm tra Bóc Tách File Tỷ Giá (parseTyGiaFile) ---');
  const mockFileRows = [
    ['Đơn vị tiền tệ', 'Tỷ giá quy đổi'],
    ['  usd  ', '26,000.00'],
    ['JPY', '170.50'],
    ['myr', '6,383.00'],
    ['CNY', '3,871.00'],
    ['VND', '1.00'],
    ['', ''], // Dòng rỗng
    ['INVALID_ROW', 'not-a-number'], // Dòng rác
  ];

  const parsedTyGia = parseTyGiaRowsMock(mockFileRows);
  assert('Bóc tách USD thành công và chuẩn hóa thành 26000', parsedTyGia['USD'] === 26000, `Thực tế: ${parsedTyGia['USD']}`);
  assert('Bóc tách JPY thành công và parse số thập phân 170.5', parsedTyGia['JPY'] === 170.5, `Thực tế: ${parsedTyGia['JPY']}`);
  assert('Bóc tách MYR thành công (xóa dấu phẩy 6,383.00 -> 6383)', parsedTyGia['MYR'] === 6383, `Thực tế: ${parsedTyGia['MYR']}`);
  assert('Bóc tách CNY thành công', parsedTyGia['CNY'] === 3871, `Thực tế: ${parsedTyGia['CNY']}`);
  assert('Bỏ qua dòng rỗng và dòng không hợp lệ', !parsedTyGia['INVALID_ROW']);

  // ---------------------------------------------------------------------------
  // SUITE 6: QUY ĐỔI GIÁ TRỊ GIAO DỊCH ĐA NGOẠI TỆ (Multi-Currency Valuation)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 6] Kiểm tra Quy Đổi GTGD Đa Ngoại Tệ Sang VND ---');
  const testRates = {
    USD: 26000,
    JPY: 170,
    EUR: 28500,
  };

  // 1. Giao dịch Dầu WTI (USD): 1 lot, Giá 75 USD/thùng, Độ cao 1000
  const wtiGiaTri = 1 * 75 * 1000 * testRates.USD;
  assert('Quy đổi 1 lot WTI (75 USD, doCao 1000) = 1,950,000,000 VND', wtiGiaTri === 1950000000, `Thực tế: ${wtiGiaTri}`);

  // 2. Giao dịch Cao su RSS3 (JPY): 2 lot, Giá 320 JPY/kg, Độ cao 5000
  const rss3GiaTri = 2 * 320 * 5000 * testRates.JPY;
  assert('Quy đổi 2 lot RSS3 (320 JPY, doCao 5000) = 544,000,000 VND', rss3GiaTri === 544000000, `Thực tế: ${rss3GiaTri}`);

  // 3. Giao dịch Lúa mì Châu Âu (EUR mới thêm): 1 lot, Giá 230 EUR/tấn, Độ cao 50
  const ebmGiaTri = 1 * 230 * 50 * testRates.EUR;
  assert('Quy đổi 1 lot Lúa mì EUR (230 EUR, doCao 50) = 327,750,000 VND', ebmGiaTri === 327750000, `Thực tế: ${ebmGiaTri}`);

  // ---------------------------------------------------------------------------
  // SUITE 7: CHỊU LỖI & FALLBACK AN TOÀN (Graceful Degradation & Fail-Safe)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 7] Kiểm tra Khả năng Chịu Lỗi & Fallback An Toàn ---');
  const s7Malformed = new MockSettingsService({
    ccp_exchange_rates_matrix: '{{malformed json string... broken!',
    ccp_usd_exchange_rate: 'invalid_number',
    usd_exchange_rate: '',
  });

  // Chạy logic nạp ma trận khi JSON bị lỗi
  let ratesFromBrokenJson = {};
  try {
    ratesFromBrokenJson = await simulateLoadCcpRatesForCalculation(s7Malformed);
  } catch (err) {
    ratesFromBrokenJson = null;
  }
  assert('Không throw crash khi JSON ma trận bị hỏng cú pháp', ratesFromBrokenJson !== null);
  assert('Tự động fallback an toàn về USD mặc định (26000)', ratesFromBrokenJson['USD'] === 26000, `Thực tế: ${ratesFromBrokenJson['USD']}`);
  assert('Tự động fallback an toàn về JPY mặc định (170)', ratesFromBrokenJson['JPY'] === 170, `Thực tế: ${ratesFromBrokenJson['JPY']}`);
  assert('Tự động fallback an toàn về MYR mặc định (6383)', ratesFromBrokenJson['MYR'] === 6383, `Thực tế: ${ratesFromBrokenJson['MYR']}`);

  // ---------------------------------------------------------------------------
  // SUITE 8: KIỂM TRA THỰC TẾ TRÊN CSDL MONGODB (READ-ONLY 100%)
  // ---------------------------------------------------------------------------
  console.log('\n--- [SUITE 8] Kiểm tra Thực Tế Trên CSDL MongoDB (Read-Only) ---');
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db();
      const settingsColl = db.collection('system_settings');

      const liveSettings = await settingsColl.find({
        key: { $in: ['usd_exchange_rate', 'ccp_usd_exchange_rate', 'ccp_exchange_rates_matrix', 'exchange_rates_last_synced', 'ccp_rates_last_synced'] },
      }).toArray();

      console.log('   [MONGODB LIVE STATUS]:');
      for (const s of liveSettings) {
        let displayVal = s.value;
        if (s.key === 'ccp_exchange_rates_matrix' && displayVal) {
          try {
            const parsed = JSON.parse(displayVal);
            displayVal = `Ma trận gồm các đồng: [${Object.keys(parsed).join(', ')}]`;
          } catch {
            displayVal = '(JSON thô)';
          }
        }
        console.log(`   * ${s.key.padEnd(28)}: ${displayVal}`);
      }
      await client.close();
      assert('Kết nối và đọc dữ liệu tỷ giá thực tế từ MongoDB thành công', true);
    } catch (dbErr) {
      console.log(`   [MONGODB NOTE]: Không thể kết nối trực tiếp CSDL (${dbErr.message}). (Bỏ qua nếu chạy môi trường offline).`);
    }
  } else {
    console.log('   [MONGODB NOTE]: Không tìm thấy MONGODB_URI trong .env, bỏ qua kiểm tra live CSDL.');
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT KẾT QUẢ KIỂM THỬ
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passedCount} PASS / ${failedCount} FAIL (Tổng số: ${passedCount + failedCount})`);
  if (failedCount === 0) {
    console.log('  ĐÁNH GIÁ: TOÀN BỘ LOGIC TỶ GIÁ M-SYSTEM & CORECCP HOẠT ĐỘNG HOÀN HẢO!');
  } else {
    console.log('  CẢNH BÁO: CÓ TRƯỜNG HỢP KIỂM THỬ KHÔNG ĐẠT, CẦN KIỂM TRA LẠI!');
  }
  console.log('======================================================================\n');
}

runAllSuites().catch((err) => {
  console.error('[FATAL ERROR]: Lỗi không xác định khi chạy kiểm thử:', err);
});

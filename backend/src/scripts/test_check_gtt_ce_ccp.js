/**
 * ========================================================================================
 * SCRIPT KIỂM THỬ ĐỐI CHIẾU GIÁ THANH TOÁN: COREEX (CE) VS CORECCP (VNCLEAR)
 * (TEST CHECK GTT: COREEX ACM VS CORECCP SETTLEMENT RECONCILIATION)
 * ========================================================================================
 *
 * Mục tiêu:
 *   1. Quét và nạp dữ liệu Giá thanh toán từ 2 nguồn:
 *      - Phân hệ CoreEX (CE): File "GTT ACM.xlsx" (và "HH ACM.xlsx" để lấy bước giá)
 *      - Phân hệ CoreCCP (VNCLEAR): File "GTT CCP.xlsx" hoặc "LSGTT.xlsx" (và "HH.xlsx")
 *   2. Đối chiếu chi tiết từng mã hợp đồng:
 *      - Tính độ lệch tuyệt đối: Diff = |GTT_CE - GTT_CCP|
 *      - So sánh với bước giá tối thiểu (TickSize) của từng mặt hàng:
 *        + MATCH      : Diff < 0.0001 (Khớp 100%)
 *        + MINOR_DIFF : 0.0001 <= Diff <= TickSize (Lệch nhỏ trong biên độ 1 tick)
 *        + DIFF       : Diff > TickSize (Lệch bất thường, cần điều chỉnh)
 *        + CE_ONLY    : Hợp đồng chỉ có trên sàn CoreEX
 *        + CCP_ONLY   : Hợp đồng chỉ có trên CoreCCP
 *   3. Xuất bảng đối chiếu chi tiết ra Console và tạo file báo cáo Excel:
 *      - "temp/Bao_Cao_CheckGTT_CE_CCP.xlsx"
 *      - "temp/Dieu_Chinh_GTT_CE_CCP.xlsx" (nếu có mã bị DIFF)
 *
 * Cách chạy:
 *   # 1. Chạy mặc định (Tự động quét các thư mục chuẩn trên máy):
 *   node backend/src/scripts/test_check_gtt_ce_ccp.js
 *
 *   # 2. Chỉ định file CE và CCP tùy ý:
 *   node backend/src/scripts/test_check_gtt_ce_ccp.js \
 *     --ce-gtt "đường_dẫn_GTT_ACM.xlsx" \
 *     --ccp-gtt "đường_dẫn_GTT_CCP.xlsx" \
 *     --ce-hh "đường_dẫn_HH_ACM.xlsx"
 *
 *   # 3. Lọc theo danh sách hợp đồng mở (TTM):
 *   node backend/src/scripts/test_check_gtt_ce_ccp.js --filter-open
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ─── 1. BẢNG BƯỚC GIÁ DỰ PHÒNG (FALLBACK TICK SIZES) ────────────────────────
const FALLBACK_TICK_SIZES = {
  // Hàng hóa ACM Nano
  PL1NY: 0.1,    // Bạch kim Nano ACM (USD)
  CP2CO: 0.0005, // Đồng Nano ACM (USD)
  SI5CO: 0.005,  // Bạc Nano ACM (USD)
  // Các mặt hàng Futures tiêu chuẩn
  CLE: 0.01,
  KCE: 0.05,
  ZCE: 0.25,
  ZSE: 0.25,
  ZLE: 0.01,
  ZME: 0.1,
  CPE: 0.0005,
  VNC: 10,
};

// ─── 2. HELPER ĐỌC THAM SỐ DÒNG LỆNH ───────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal = null) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const hasFlag = (flag) => args.includes(flag);

// ─── 3. TỰ ĐỘNG TÌM ĐƯỜNG DẪN FILE TRÊN Ổ C VÀ THƯ MỤC DỰ ÁN ──────────────
function findFirstExistingPath(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

const defaultCeGttCandidates = [
  getArg('--ce-gtt'),
  'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Pictures\\Dữ liệu chuẩn ngày 25\\25.09 CE\\25.09\\GTT ACM.xlsx',
  'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures\\GTT ACM.xlsx',
  path.join(__dirname, '..', '..', 'temp', 'test_ce_downloads', 'GTT ACM.xlsx'),
  path.join(__dirname, '..', '..', 'temp', 'gtt', 'GTT ACM.xlsx'),
];

const defaultCeHhCandidates = [
  getArg('--ce-hh'),
  'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Pictures\\Dữ liệu chuẩn ngày 25\\25.09 CE\\25.09\\HH ACM.xlsx',
  'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures\\HH ACM.xlsx',
  path.join(__dirname, '..', '..', 'temp', 'test_ce_downloads', 'HH ACM.xlsx'),
];

const defaultCcpGttCandidates = [
  getArg('--ccp-gtt'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_25_downloads', 'GTT CCP.xlsx'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_downloads', 'GTT CCP.xlsx'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_25_downloads', 'LSGTT.xlsx'),
  'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\GTT CCP.xlsx',
  'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\GTT CCP.xlsx',
];

const defaultCcpHhCandidates = [
  getArg('--ccp-hh'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_25_downloads', 'HH.xlsx'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_downloads', 'HH.xlsx'),
  'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\HH.xlsx',
  'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\HH.xlsx',
];

const defaultCcpTtmCandidates = [
  getArg('--ttm'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_25_downloads', 'TTM CCP.xlsx'),
  path.join(__dirname, '..', '..', 'temp', 'test_ccp_downloads', 'TTM CCP.xlsx'),
  'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\TTM CCP.xlsx',
];

// ─── 4. PARSER CÁC FILE EXCEL ──────────────────────────────────────────────
function parseGttFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { map: new Map(), date: null, rows: [], filePath: null };
  }

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rawRows || rawRows.length < 2) {
    return { map: new Map(), date: null, rows: [], filePath };
  }

  const header = rawRows[0].map((h) => String(h || '').trim());
  const symbolIdx = header.findIndex((h) => /mã hợp đồng|symbol|contract/i.test(h));
  const priceIdx = header.findIndex((h) => /giá thanh toán|settle|gtt/i.test(h));
  const commIdx = header.findIndex((h) => /mã hàng hóa|commodity/i.test(h));
  const dateIdx = header.findIndex((h) => /ngày phiên|ngày giao dịch|date/i.test(h));
  const currIdx = header.findIndex((h) => /tiền tệ|currency/i.test(h));

  if (symbolIdx === -1 || priceIdx === -1) {
    throw new Error(`File ${label} (${path.basename(filePath)}) thiếu cột bắt buộc: 'Mã hợp đồng' hoặc 'Giá thanh toán'. Các cột hiện có: [${header.slice(0, 8).join(', ')}]`);
  }

  const map = new Map();
  const parsedRows = [];
  let detectedDate = null;

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    const symbol = String(row[symbolIdx] || '').trim().toUpperCase();
    if (!symbol) continue;

    const rawPrice = row[priceIdx];
    const price = rawPrice !== undefined && rawPrice !== null && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null;
    const commodity = commIdx !== -1 ? String(row[commIdx] || '').trim().toUpperCase() : symbol.slice(0, 5);
    const dateStr = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : null;
    const currency = currIdx !== -1 && row[currIdx] ? String(row[currIdx]).trim() : '';

    if (!detectedDate && dateStr) detectedDate = dateStr;

    const item = { symbol, commodity, price, date: dateStr, currency };
    map.set(symbol, item);
    parsedRows.push(item);
  }

  return { map, date: detectedDate, rows: parsedRows, filePath };
}

function parseTickSizes(filePath) {
  const tickMap = new Map();
  if (!filePath || !fs.existsSync(filePath)) return tickMap;

  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) return tickMap;

    const header = rawRows[0].map((h) => String(h || '').trim());
    const commIdx = header.findIndex((h) => /mã hàng hóa|commodity/i.test(h));
    const tickIdx = header.findIndex((h) => /tick giá thay đổi|bước giá|tick size/i.test(h));

    if (commIdx !== -1 && tickIdx !== -1) {
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !row[commIdx]) continue;
        const code = String(row[commIdx]).trim().toUpperCase();
        const tick = parseFloat(row[tickIdx]);
        if (code && !isNaN(tick) && tick > 0) {
          tickMap.set(code, tick);
        }
      }
    }
  } catch (err) {
    console.warn(`[Cảnh báo] Lỗi đọc file bước giá ${filePath}: ${err.message}`);
  }
  return tickMap;
}

function parseOpenContracts(filePath) {
  const openSet = new Set();
  if (!filePath || !fs.existsSync(filePath)) return openSet;

  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) return openSet;

    const header = rawRows[0].map((h) => String(h || '').trim());
    const symbolIdx = header.findIndex((h) => /mã hợp đồng|symbol|contract/i.test(h));

    if (symbolIdx !== -1) {
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row && row[symbolIdx]) {
          openSet.add(String(row[symbolIdx]).trim().toUpperCase());
        }
      }
    }
  } catch {}
  return openSet;
}

// ─── 5. HÀM CHÍNH: KIỂM THỬ ĐỐI CHIẾU ──────────────────────────────────────
async function runCheckGttTest() {
  console.log('========================================================================================');
  console.log('   KIỂM THỬ ĐỐI CHIẾU GIÁ THANH TOÁN (GTT): COREEX (CE) VS CORECCP (VNCLEAR)');
  console.log(`   Thời gian thực thi: ${new Date().toLocaleString('vi-VN')}`);
  console.log('========================================================================================\n');

  const ceGttPath = findFirstExistingPath(defaultCeGttCandidates);
  const ccpGttPath = findFirstExistingPath(defaultCcpGttCandidates);
  const ceHhPath = findFirstExistingPath(defaultCeHhCandidates);
  const ccpHhPath = findFirstExistingPath(defaultCcpHhCandidates);
  const ttmPath = findFirstExistingPath(defaultCcpTtmCandidates);

  console.log('1. TRẠNG THÁI FILE ĐẦU VÀO TRÊN MÁY:');
  console.log(` • File GTT CoreEX (CE)   : ${ceGttPath ? `✅ ${ceGttPath}` : '❌ KHÔNG TÌM THẤY'}`);
  console.log(` • File GTT CoreCCP (CCP) : ${ccpGttPath ? `✅ ${ccpGttPath}` : '❌ KHÔNG TÌM THẤY'}`);
  console.log(` • File Bước giá CE (HH)  : ${ceHhPath ? `✅ ${ceHhPath}` : '⚠️ Dùng Fallback mặc định'}`);
  console.log(` • File Bước giá CCP (HH) : ${ccpHhPath ? `✅ ${ccpHhPath}` : '⚠️ Dùng Fallback mặc định'}`);
  console.log(` • File Vị thế mở (TTM)   : ${ttmPath ? `✅ ${ttmPath}` : '⚠️ Không lọc (So khớp toàn bộ)'}\n`);

  // Kiểm tra thiếu file và hướng dẫn lệnh tải
  const missingFiles = [];
  if (!ceGttPath) missingFiles.push('CoreEX (GTT ACM.xlsx)');
  if (!ccpGttPath) missingFiles.push('CoreCCP (GTT CCP.xlsx / LSGTT.xlsx)');

  if (missingFiles.length > 0) {
    console.log('----------------------------------------------------------------------------------------');
    console.log(`❌ THIẾU DỮ LIỆU ĐỐI SOÁT: ${missingFiles.join(' và ')}`);
    console.log('----------------------------------------------------------------------------------------');
    console.log('👉 VUI LÒNG CHẠY CÁC CÂU LỆNH SAU TRÊN TERMINAL ĐỂ TẢI DỮ LIỆU VỀ:');
    if (!ceGttPath) {
      console.log('   1. Tải báo cáo CoreEX (CE):');
      console.log('      node backend/src/scripts/test_ce_headless_download.js --all --headed');
    }
    if (!ccpGttPath) {
      console.log('   2. Tải báo cáo CoreCCP (CCP):');
      console.log('      node backend/src/scripts/test_ccp_download_25_files.js --headed');
      console.log('      (Hoặc tải riêng LSGTT: node backend/src/scripts/test_ccp_download_benchmark.js --headed --report LSGTT)');
    }
    console.log('----------------------------------------------------------------------------------------\n');
    return;
  }

  // 2. Parse dữ liệu
  const ceData = parseGttFile(ceGttPath, 'CoreEX');
  const ccpData = parseGttFile(ccpGttPath, 'CoreCCP');
  const ceTicks = parseTickSizes(ceHhPath);
  const ccpTicks = parseTickSizes(ccpHhPath);
  const openContracts = parseOpenContracts(ttmPath);

  console.log('2. THỐNG KÊ BẢN GHI ĐỌC ĐƯỢC:');
  console.log(` • CoreEX (CE)  : ${ceData.map.size} hợp đồng (Ngày phiên: ${ceData.date || 'N/A'})`);
  console.log(` • CoreCCP (CCP): ${ccpData.map.size} hợp đồng (Ngày phiên: ${ccpData.date || 'N/A'})`);
  if (ceData.date && ccpData.date && ceData.date !== ccpData.date) {
    console.log(` ⚠️ CẢNH BÁO: Ngày phiên giữa 2 file KHÁC NHAU! CE=[${ceData.date}] vs CCP=[${ccpData.date}]. Độ lệch có thể do khác ngày giao dịch.`);
  }
  console.log();

  // 3. Tiến hành đối chiếu so khớp
  const isFilterOpen = hasFlag('--filter-open') && openContracts.size > 0;
  let targetSymbols = Array.from(new Set([...ceData.map.keys(), ...ccpData.map.keys()]));
  if (isFilterOpen) {
    targetSymbols = targetSymbols.filter((s) => openContracts.has(s));
    console.log(`🔍 Áp dụng lọc theo ${openContracts.size} hợp đồng đang mở vị thế (TTM). Số mã cần check: ${targetSymbols.length}`);
  }

  const comparisonRows = [];
  let countMatch = 0;
  let countMinorDiff = 0;
  let countDiff = 0;
  let countCeOnly = 0;
  let countCcpOnly = 0;
  let countNoPrice = 0;

  for (const symbol of targetSymbols) {
    const ceItem = ceData.map.get(symbol);
    const ccpItem = ccpData.map.get(symbol);
    const priceCe = ceItem?.price ?? null;
    const priceCcp = ccpItem?.price ?? null;

    // Xác định Commodity Code để tra bước giá (TickSize)
    const commodity = ceItem?.commodity || ccpItem?.commodity || symbol.slice(0, 5);
    let tickSize = ceTicks.get(commodity) || ccpTicks.get(commodity) || FALLBACK_TICK_SIZES[commodity] || null;
    if (tickSize === null) {
      // Thử tìm theo tiền tố
      for (const [k, v] of Object.entries(FALLBACK_TICK_SIZES)) {
        if (symbol.startsWith(k)) {
          tickSize = v;
          break;
        }
      }
    }
    if (tickSize === null) tickSize = 0.05; // Fallback an toàn

    let status = 'MATCH';
    let diff = null;

    if (priceCe === null && priceCcp === null) {
      status = 'NO_PRICE';
      countNoPrice++;
    } else if (priceCe === null) {
      status = 'CCP_ONLY';
      countCcpOnly++;
    } else if (priceCcp === null) {
      status = 'CE_ONLY';
      countCeOnly++;
    } else {
      diff = parseFloat(Math.abs(priceCe - priceCcp).toFixed(6));
      if (diff < 0.0001) {
        status = 'MATCH';
        countMatch++;
      } else if (diff <= tickSize + 0.00001) {
        status = 'MINOR_DIFF';
        countMinorDiff++;
      } else {
        status = 'DIFF';
        countDiff++;
      }
    }

    comparisonRows.push({
      symbol,
      commodity,
      priceCe,
      priceCcp,
      diff,
      tickSize,
      status,
      dateCe: ceItem?.date || '',
      dateCcp: ccpItem?.date || '',
      currency: ceItem?.currency || ccpItem?.currency || '',
    });
  }

  // Sắp xếp: DIFF lên đầu -> MINOR_DIFF -> CE_ONLY -> CCP_ONLY -> MATCH cuối cùng
  const statusOrder = { DIFF: 0, MINOR_DIFF: 1, CE_ONLY: 2, CCP_ONLY: 3, NO_PRICE: 4, MATCH: 5 };
  comparisonRows.sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 6) - (statusOrder[b.status] ?? 6);
    if (orderDiff !== 0) return orderDiff;
    return a.symbol.localeCompare(b.symbol);
  });

  // 4. In bảng kết quả trực quan
  console.log('3. BẢNG KẾT QUẢ ĐỐI SOÁT GIÁ THANH TOÁN (TOP 25 BẢN GHI ĐÁNG CHÚ Ý):');
  console.log('---------------------------------------------------------------------------------------------------------------');
  console.log(
    'STT'.padEnd(4) +
    'MÃ HỢP ĐỒNG'.padEnd(14) +
    'GIÁ COREEX (CE)'.padEnd(18) +
    'GIÁ CORECCP'.padEnd(16) +
    'ĐỘ LỆCH (DIFF)'.padEnd(16) +
    'TICK SIZE'.padEnd(12) +
    'TRẠNG THÁI'
  );
  console.log('---------------------------------------------------------------------------------------------------------------');

  const printLimit = Math.min(comparisonRows.length, 25);
  for (let i = 0; i < printLimit; i++) {
    const r = comparisonRows[i];
    const stt = String(i + 1).padEnd(4);
    const sym = r.symbol.padEnd(14);
    const pCe = (r.priceCe !== null ? r.priceCe.toString() : '---').padEnd(18);
    const pCcp = (r.priceCcp !== null ? r.priceCcp.toString() : '---').padEnd(16);
    const dStr = (r.diff !== null ? r.diff.toString() : '---').padEnd(16);
    const tickStr = r.tickSize.toString().padEnd(12);

    let tag = r.status;
    if (r.status === 'MATCH') tag = '✅ KHỚP (MATCH)';
    else if (r.status === 'MINOR_DIFF') tag = '⚠️ LỆCH NHỎ (<= 1 tick)';
    else if (r.status === 'DIFF') tag = '❌ LỆCH GIÁ (DIFF)';
    else if (r.status === 'CE_ONLY') tag = '🔵 CHỈ CÓ TRÊN CE';
    else if (r.status === 'CCP_ONLY') tag = '🟣 CHỈ CÓ TRÊN CCP';

    console.log(`${stt}${sym}${pCe}${pCcp}${dStr}${tickStr}${tag}`);
  }

  if (comparisonRows.length > printLimit) {
    console.log(`... và còn ${comparisonRows.length - printLimit} mã khác đã so khớp (Xem file Excel đầy đủ bên dưới).`);
  }
  console.log('---------------------------------------------------------------------------------------------------------------\n');

  // 5. Tổng kết KPI
  console.log('========================================================================================');
  console.log('4. TỔNG KẾT KPI ĐỐI CHIẾU:');
  console.log(` • Tổng số mã hợp đồng kiểm tra : ${comparisonRows.length}`);
  console.log(` • Khớp hoàn toàn (MATCH)       : ${countMatch} mã (${((countMatch / comparisonRows.length) * 100).toFixed(1)}%)`);
  console.log(` • Lệch trong biên độ 1 tick    : ${countMinorDiff} mã`);
  console.log(` • Lệch bất thường (DIFF)       : ${countDiff} mã ${countDiff > 0 ? '❌ (CẦN XỬ LÝ)' : '✅'}`);
  console.log(` • Chỉ có trên CoreEX (CE)      : ${countCeOnly} mã`);
  console.log(` • Chỉ có trên CoreCCP          : ${countCcpOnly} mã`);
  console.log('========================================================================================\n');

  // 6. Xuất báo cáo Excel
  const tempDir = path.join(__dirname, '..', '..', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const excelRows = comparisonRows.map((r, idx) => ({
    'STT': idx + 1,
    'Mã hợp đồng': r.symbol,
    'Mã hàng hóa': r.commodity,
    'Giá CoreEX (CE)': r.priceCe,
    'Giá CoreCCP': r.priceCcp,
    'Độ lệch (|CE - CCP|)': r.diff,
    'Bước giá (Tick Size)': r.tickSize,
    'Trạng thái': r.status,
    'Ngày phiên CE': r.dateCe,
    'Ngày phiên CCP': r.dateCcp,
    'Tiền tệ': r.currency,
  }));

  const reportWb = XLSX.utils.book_new();
  const reportWs = XLSX.utils.json_to_sheet(excelRows);
  XLSX.utils.book_append_sheet(reportWb, reportWs, 'Doi_Soat_GTT');
  const reportPath = path.join(tempDir, 'Bao_Cao_CheckGTT_CE_CCP.xlsx');
  XLSX.writeFile(reportWb, reportPath);
  console.log(`📁 Đã xuất file báo cáo đối soát đầy đủ: ${reportPath}`);

  // Xuất file điều chỉnh giá nếu có mã DIFF
  const diffRows = comparisonRows.filter((r) => r.status === 'DIFF');
  if (diffRows.length > 0) {
    const fixRows = diffRows.map((r) => ({
      'Mã hợp đồng': r.symbol,
      'Giá CoreEX': r.priceCe,
      'Giá CoreCCP hiện tại': r.priceCcp,
      'Giá đề xuất điều chỉnh': r.priceCe, // Đề xuất lấy theo giá sàn CoreEX
      'Độ lệch': r.diff,
    }));
    const fixWb = XLSX.utils.book_new();
    const fixWs = XLSX.utils.json_to_sheet(fixRows);
    XLSX.utils.book_append_sheet(fixWb, fixWs, 'Dieu_Chinh_GTT');
    const fixPath = path.join(tempDir, 'Dieu_Chinh_GTT_CE_CCP.xlsx');
    XLSX.writeFile(fixWb, fixPath);
    console.log(`📁 Đã xuất file danh sách hợp đồng cần điều chỉnh giá: ${fixPath}`);
  }
}

runCheckGttTest().catch((err) => {
  console.error('❌ Lỗi tiến trình kiểm thử:', err.message);
  process.exit(1);
});

/**
 * extract_monthly_report.js
 * Tool bóc tách toàn diện dữ liệu từ file Excel Báo cáo tháng của MXV
 * Đầu vào: File Excel 'Bao cao thang [MM].[YYYY] - Final.xlsx'
 * Đầu ra: File JSON cấu trúc chuẩn hóa cho Backend & Frontend
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');

function parseMonthlyExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];

  function val(cellAddr) {
    const c = ws[cellAddr];
    return c ? c.v : null;
  }

  function text(cellAddr) {
    const c = ws[cellAddr];
    if (!c) return '';
    return c.w !== undefined ? String(c.w).trim() : String(c.v).trim();
  }

  function num(cellAddr) {
    const c = ws[cellAddr];
    if (!c || c.v === undefined || c.v === null || c.v === '') return 0;
    const n = Number(c.v);
    return isNaN(n) ? 0 : n;
  }

  function parseDateStr(cellAddr) {
    const c = ws[cellAddr];
    if (!c || c.v === undefined || c.v === null) return '';
    if (typeof c.v === 'number' && c.v > 40000) {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(c.v);
      const day = String(d.d).padStart(2, '0');
      const month = String(d.m).padStart(2, '0');
      return `${day}/${month}`;
    }
    return c.w ? c.w.trim() : String(c.v).trim();
  }

  // ==========================================
  // PHẦN I: TÌNH HÌNH GIAO DỊCH THEO TVKD
  // ==========================================
  const tvkdCqg = [];
  for (let r = 5; r <= 39; r++) {
    const rawName = text('B' + r);
    if (!rawName) continue;
    const parts = rawName.split('-');
    const code = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name = parts.length > 1 ? parts.slice(0, -1).join('-').trim() : rawName;

    tvkdCqg.push({
      stt: num('A' + r),
      fullName: rawName,
      tvkdName: name,
      tvkdCode: code,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      growthRate: val('E' + r),
      maxLotDay: num('F' + r),
      maxDate: parseDateStr('G' + r),
      minLotDay: num('H' + r),
      minDate: parseDateStr('I' + r)
    });
  }

  const summaryTvkdCqg = {
    title: text('A40'),
    lotPreviousMonth: num('C40'),
    lotCurrentMonth: num('D40'),
    growthPercent: text('E40'),
    marketPeakLot: num('F40'),
    marketPeakDate: parseDateStr('G40'),
    marketTroughLot: num('H40'),
    marketTroughDate: parseDateStr('I40')
  };

  const tvkdAcm = [];
  for (let r = 42; r <= 66; r++) {
    const rawName = text('B' + r);
    if (!rawName) continue;
    const parts = rawName.split('-');
    const code = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name = parts.length > 1 ? parts.slice(0, -1).join('-').trim() : rawName;

    tvkdAcm.push({
      stt: num('A' + r),
      fullName: rawName,
      tvkdName: name,
      tvkdCode: code,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      growthRate: val('E' + r),
      maxLotDay: num('F' + r),
      maxDate: parseDateStr('G' + r),
      minLotDay: num('H' + r),
      minDate: parseDateStr('I' + r)
    });
  }

  const summaryTvkdAcm = {
    title: text('A67'),
    lotPreviousMonth: num('C67'),
    lotCurrentMonth: num('D67'),
    growthPercent: text('E67'),
    marketPeakLot: num('F67'),
    marketPeakDate: parseDateStr('G67'),
    marketTroughLot: num('H67'),
    marketTroughDate: parseDateStr('I67')
  };

  // ==========================================
  // PHẦN II: TÌNH HÌNH GIAO DỊCH THEO MẶT HÀNG
  // ==========================================
  const commoditiesCqg = [];
  for (let r = 73; r <= 123; r++) {
    const name = text('B' + r);
    if (!name) continue;
    commoditiesCqg.push({
      stt: num('A' + r),
      commodityName: name,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      growthRate: val('E' + r),
      marketSharePercent: text('F' + r),
      marketShareRate: val('F' + r),
      note: text('G' + r)
    });
  }

  const summaryCommoditiesCqg = {
    title: text('A124'),
    lotPreviousMonth: num('C124'),
    lotCurrentMonth: num('D124'),
    growthPercent: text('E124'),
    marketSharePercent: text('F124')
  };

  const commoditiesAcm = [];
  for (let r = 126; r <= 128; r++) {
    const name = text('B' + r);
    if (!name) continue;
    commoditiesAcm.push({
      stt: num('A' + r),
      commodityName: name,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      growthRate: val('E' + r),
      marketSharePercent: text('F' + r),
      marketShareRate: val('F' + r),
      note: text('G' + r)
    });
  }

  const summaryCommoditiesAcm = {
    title: text('A129'),
    lotPreviousMonth: num('C129'),
    lotCurrentMonth: num('D129'),
    growthPercent: text('E129'),
    marketSharePercent: text('F129')
  };

  // ==========================================
  // PHẦN III: SPREAD, LME, OPTIONS
  // ==========================================
  // 1. Spread
  const spreadList = [];
  for (let r = 135; r <= 148; r++) {
    const rawName = text('B' + r);
    if (!rawName) continue;
    const parts = rawName.split('-');
    const code = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name = parts.length > 1 ? parts.slice(0, -1).join('-').trim() : rawName;

    spreadList.push({
      stt: num('A' + r),
      fullName: rawName,
      tvkdName: name,
      tvkdCode: code,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      activeAccountsPreviousMonth: num('F' + r),
      activeAccountsCurrentMonth: num('G' + r),
      totalActiveAccounts: num('H' + r)
    });
  }

  const summarySpread = {
    title: text('A149'),
    lotPreviousMonth: num('C149'),
    lotCurrentMonth: num('D149'),
    growthPercent: text('E149'),
    activeAccountsPreviousMonth: num('F149'),
    activeAccountsCurrentMonth: num('G149'),
    totalActiveAccounts: num('H149')
  };

  // 2. LME
  const lmeList = [];
  for (let r = 154; r <= 160; r++) {
    const rawName = text('B' + r);
    if (!rawName) continue;
    const parts = rawName.split('-');
    const code = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name = parts.length > 1 ? parts.slice(0, -1).join('-').trim() : rawName;

    lmeList.push({
      stt: num('A' + r),
      fullName: rawName,
      tvkdName: name,
      tvkdCode: code,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      activeAccountsPreviousMonth: num('F' + r),
      activeAccountsCurrentMonth: num('G' + r),
      totalActiveAccounts: num('H' + r)
    });
  }

  const summaryLme = {
    title: text('A161'),
    lotPreviousMonth: num('C161'),
    lotCurrentMonth: num('D161'),
    growthPercent: text('E161'),
    activeAccountsPreviousMonth: num('F161'),
    activeAccountsCurrentMonth: num('G161'),
    totalActiveAccounts: num('H161')
  };

  // 3. Options
  const optionsList = [];
  for (let r = 166; r <= 178; r++) {
    const rawName = text('B' + r);
    if (!rawName) continue;
    const parts = rawName.split('-');
    const code = parts.length > 1 ? parts[parts.length - 1].trim() : '';
    const name = parts.length > 1 ? parts.slice(0, -1).join('-').trim() : rawName;

    optionsList.push({
      stt: num('A' + r),
      fullName: rawName,
      tvkdName: name,
      tvkdCode: code,
      lotPreviousMonth: num('C' + r),
      lotCurrentMonth: num('D' + r),
      growthPercent: text('E' + r),
      activeAccountsPreviousMonth: num('F' + r),
      activeAccountsCurrentMonth: num('G' + r),
      totalActiveAccounts: num('H' + r)
    });
  }

  const summaryOptions = {
    title: text('A179'),
    lotPreviousMonth: num('C179'),
    lotCurrentMonth: num('D179'),
    growthPercent: text('E179'),
    activeAccountsPreviousMonth: num('F179'),
    activeAccountsCurrentMonth: num('G179'),
    totalActiveAccounts: num('H179')
  };

  return {
    reportTitle: 'BÁO CÁO TÌNH HÌNH GIAO DỊCH TOÀN THỊ TRƯỜNG THÁNG 09.2026',
    extractedAt: new Date().toISOString(),
    sourceFile: path.basename(filePath),
    section1Tvkd: {
      cqg: {
        totalMembers: tvkdCqg.length,
        items: tvkdCqg,
        summary: summaryTvkdCqg
      },
      acm: {
        totalMembers: tvkdAcm.length,
        items: tvkdAcm,
        summary: summaryTvkdAcm
      }
    },
    section2Commodities: {
      cqg: {
        totalCommodities: commoditiesCqg.length,
        items: commoditiesCqg,
        summary: summaryCommoditiesCqg
      },
      acm: {
        totalCommodities: commoditiesAcm.length,
        items: commoditiesAcm,
        summary: summaryCommoditiesAcm
      }
    },
    section3Specials: {
      spread: {
        totalMembers: spreadList.length,
        items: spreadList,
        summary: summarySpread
      },
      lme: {
        totalMembers: lmeList.length,
        items: lmeList,
        summary: summaryLme
      },
      options: {
        totalMembers: optionsList.length,
        items: optionsList,
        summary: summaryOptions
      }
    }
  };
}

// Chạy trực tiếp CLI
if (require.main === module) {
  const targetFile = path.resolve(__dirname, 'Bao cao thang 09.2026 - Final.xlsx');
  const outputFile = path.resolve(__dirname, 'monthly_report_09_2026_extracted.json');

  console.log(`Đang phân tích file: ${targetFile}...`);
  try {
    const result = parseMonthlyExcel(targetFile);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
    console.log(`✅ Bóc tách thành công! Đã lưu kết quả tại: ${outputFile}`);
    console.log(`- Section I: TVKD CQG (${result.section1Tvkd.cqg.totalMembers}), TVKD ACM (${result.section1Tvkd.acm.totalMembers})`);
    console.log(`- Section II: Hàng hóa CQG (${result.section2Commodities.cqg.totalCommodities}), Hàng hóa ACM (${result.section2Commodities.acm.totalCommodities})`);
    console.log(`- Section III: Spread (${result.section3Specials.spread.totalMembers}), LME (${result.section3Specials.lme.totalMembers}), Options (${result.section3Specials.options.totalMembers})`);
  } catch (err) {
    console.error('❌ Lỗi khi bóc tách:', err);
    process.exit(1);
  }
}

module.exports = { parseMonthlyExcel };


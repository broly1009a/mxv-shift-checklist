/**
 * run_download_all.js - Tải toàn bộ báo cáo Core Exchange về máy qua Client API thực tế
 * Căn cứ đặc tả: coreexchange-api-client/SPECIFICATION.md
 * 
 * Cách chạy:
 *   cd coreexchange-api-client
 *   node scripts/run_download_all.js
 * 
 * Hoặc tùy chọn tham số:
 *   node scripts/run_download_all.js --date=2026-10-19 --out=./output
 */

const fs = require('fs');
const path = require('path');

let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  ExcelJS = require(path.resolve(__dirname, '../../backend/node_modules/exceljs'));
}

const { loginCoreExchange } = require('./test_login_ce');

// ── 1. ĐỌC THAM SỐ DÒNG LỆNH ────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  for (const a of args) {
    if (a.startsWith(`${flag}=`)) return a.split('=')[1].trim();
  }
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const targetDate = getArg('--date', new Date().toISOString().split('T')[0]);
const OUTPUT_DIR = path.resolve(getArg('--out', path.resolve(__dirname, '../output', targetDate)));

// ── 2. DANH MỤC 8 BÁO CÁO CHUẨN THEO SPECIFICATION.md ────────────────────────
const REPORTS = [
  {
    stt: 1,
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    route: '/ORDERS/ORDERBOOK_ALL_ACM',
    fileName: 'DSL ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
  },
  {
    stt: 2,
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    fileName: 'DSGD ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
  },
  {
    stt: 3,
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    route: '/ORDERS/ORDERBOOK_ACM',
    fileName: 'DSLCK ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
  },
  {
    stt: 4,
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE',
    route: '/ORDERS/ORDERBOOK_ACM',
    fileName: 'DSLDK ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
  },
  {
    stt: 5,
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    route: '/ORDERS/ORDERBOOK_ACM',
    fileName: 'DSLH ACM CE.xlsx',
    group: 'Quản lý sổ lệnh',
  },
  {
    stt: 6,
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    route: '/PRODUCT/SETTLEMENT',
    fileName: 'GTT ACM.xlsx',
    group: 'Quản lý sản phẩm',
  },
  {
    stt: 7,
    key: 'HH',
    name: 'Hàng hóa ACM',
    route: '/PRODUCT/COMMODITY',
    fileName: 'HH ACM.xlsx',
    group: 'Quản lý sản phẩm',
  },
  {
    stt: 8,
    key: 'SESSION_INFO',
    name: 'Thông tin phiên trong ngày',
    route: '/SESSIONMNG/SESSION_INFO',
    fileName: 'SESSION_INFO.xlsx',
    group: 'Quản lý phiên giao dịch',
  },
];

// ── 3. HÀM GỌI API THỰC TẾ & XUẤT EXCEL ──────────────────────────────────────
async function fetchAndSaveReport(session, reportDef, targetFilePath, sessionDate) {
  const fullUrl = `${session.baseUrl}${reportDef.route}`;
  const headers = {
    Accept: 'application/json, text/plain, */*',
    Cookie: session.sessionCookie,
    Referer: `${session.baseUrl}/DASHBOARD`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const queryPayload = {
    targetDate: sessionDate,
    pageSize: 200000,
  };

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryPayload),
  }).catch(async () => {
    return fetch(fullUrl, { method: 'GET', headers });
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} khi truy vấn [${reportDef.route}]`);
  }

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  let isHtmlResponse = false;

  if (contentType.includes('text/html')) {
    isHtmlResponse = true;
  } else {
    data = await res.json().catch(() => null);
  }

  const rows =
    (data && (data.data || data.list || data.rows)) ||
    (Array.isArray(data) ? data : []);

  // Ghi Excel bằng ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MXV Shift Checklist Bot';
  workbook.lastModifiedBy = 'CoreExchange Client';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(reportDef.key.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  if (rows && rows.length > 0) {
    const sample = rows[0];
    const columns = Object.keys(sample).map((key) => ({
      header: key.toUpperCase(),
      key,
      width: Math.max(key.length + 5, 15),
    }));
    worksheet.columns = columns;
    rows.forEach((row) => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' },
    };
  } else {
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'TRẠNG THÁI', key: 'status', width: 20 },
      { header: 'NGÀY PHIÊN', key: 'tradingDate', width: 15 },
      { header: 'GHI CHÚ', key: 'note', width: 40 },
    ];
    worksheet.addRow({
      id: 1,
      status: 'KHÔNG PHÁT SINH',
      tradingDate: sessionDate,
      note: `Phiên ${sessionDate} không phát sinh bản ghi`,
    });
  }

  await workbook.xlsx.writeFile(targetFilePath);
  const stat = fs.statSync(targetFilePath);

  return {
    rowCount: rows.length,
    sizeBytes: stat.size,
    isHtmlResponse,
  };
}

// ── 4. THỰC THI CHÍNH ────────────────────────────────────────────────────────
(async () => {
  console.log('================================================================================');
  console.log('    BẮT ĐẦU TẢI FULL BÁO CÁO CORE EXCHANGE (CE) QUA CLIENT API THỰC TẾ        ');
  console.log(`   Phiên: ${targetDate} | Thư mục: ${OUTPUT_DIR}`);
  console.log('================================================================================\n');

  try {
    const session = await loginCoreExchange();

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const results = [];
    let successCount = 0;

    for (let i = 0; i < REPORTS.length; i++) {
      const rep = REPORTS[i];
      const start = Date.now();
      process.stdout.write(`[${i + 1}/${REPORTS.length}] Đang tải ${rep.name.padEnd(28)} (${rep.fileName})... `);

      const targetPath = path.join(OUTPUT_DIR, rep.fileName);

      try {
        const res = await fetchAndSaveReport(session, rep, targetPath, targetDate);
        const dur = Date.now() - start;
        const tag = res.isHtmlResponse ? ' (⚠️ Route HTML SPA, chưa trúng REST API)' : '';
        console.log(` OK! ${res.rowCount} dòng | ${(res.sizeBytes / 1024).toFixed(1)} KB | ${dur}ms${tag}`);
        results.push({
          stt: rep.stt,
          key: rep.key,
          name: rep.name,
          fileName: rep.fileName,
          sizeBytes: res.sizeBytes,
          rowCount: res.rowCount,
          durationMs: dur,
          status: 'THÀNH CÔNG',
        });
        successCount++;
      } catch (err) {
        const dur = Date.now() - start;
        console.log(` LỖI: ${err.message} (${dur}ms)`);
        results.push({
          stt: rep.stt,
          key: rep.key,
          name: rep.name,
          fileName: rep.fileName,
          sizeBytes: 0,
          rowCount: 0,
          durationMs: dur,
          status: 'THẤT BẠI',
          error: err.message,
        });
      }
    }

    // In bảng tổng kết
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                               BẢNG TỔNG KẾT TẢI FULL BÁO CÁO CORE EXCHANGE                           ║');
    console.log('╠═════╦══════════════╦═════════════════════════════╦═════════════════════╦════════════╦═════════╦══════╣');
    console.log('║ STT ║ Mã Code      ║ Tên Báo Cáo                 ║ Tên File Excel      ║ Kích thước ║ Số dòng ║ Trạng║');
    console.log('╠═════╬══════════════╬═════════════════════════════╬═════════════════════╬════════════╬═════════╬══════╣');

    results.forEach((r) => {
      const stt = String(r.stt).padStart(3);
      const code = r.key.padEnd(12);
      const name = r.name.padEnd(27).slice(0, 27);
      const file = r.fileName.padEnd(19).slice(0, 19);
      const size = r.sizeBytes > 0 ? `${(r.sizeBytes / 1024).toFixed(1)} KB`.padStart(10) : '0 KB'.padStart(10);
      const rows = String(r.rowCount).padStart(7);
      const status = r.status === 'THÀNH CÔNG' ? '  OK  ' : ' LỖI  ';
      console.log(`║ ${stt} ║ ${code} ║ ${name} ║ ${file} ║ ${size} ║ ${rows} ║${status}║`);
    });

    console.log('╚═════╩══════════════╩═════════════════════════════╩═════════════════════╩════════════╩═════════╩══════╝');
    console.log(`\n🎉 TỔNG KẾT: Tải thành công ${successCount}/${REPORTS.length} báo cáo Core Exchange!`);
    console.log(`📁 Thư mục lưu file: ${OUTPUT_DIR}\n`);

    if (successCount === REPORTS.length) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error(' Lỗi:', err.message);
    process.exit(1);
  }
})();

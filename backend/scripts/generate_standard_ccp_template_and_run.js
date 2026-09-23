/**
 * generate_standard_ccp_template_and_run.js
 * 
 * Script sinh lại toàn bộ Template Output chuẩn 100% từ thư mục mẫu của QLGD:
 *   [Input&Ouput_Example/Output]
 * 
 * Áp dụng cho 2 bộ dữ liệu:
 *   1. inputExampleCppFull
 *   2. inputExampleCppFull_2
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const { CcpLotStatisticsService } = require('../dist/modules/ccp-statistics/ccp-lot-statistics.service');

const qlgdOutputDir = path.join(__dirname, '../src/modules/ccp-statistics/Input&Ouput_Example/Output');
const baseDir1 = path.join(__dirname, '../src/modules/ccp-statistics/inputExampleCppFull');
const baseDir2 = path.join(__dirname, '../src/modules/ccp-statistics/inputExampleCppFull_2');

function getWorkdaysOfSeptember2026() {
  const days = [];
  for (let d = 1; d <= 30; d++) {
    const dt = new Date(2026, 8, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(dt);
    }
  }
  return days;
}

function fixSharedFormulas(ws) {
  const masters = new Set();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value;
        if (val && val.shareType === 'shared' && val.ref) {
          masters.add(cell.address);
        }
      }
    });
  });

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        const val = cell.value;
        if (val && val.sharedFormula && !masters.has(val.sharedFormula)) {
          if (val.result !== undefined && val.result !== null) {
            cell.value = val.result;
          } else {
            cell.value = null;
          }
        }
      }
    });
  });
}

/**
 * Cập nhật ô tiêu đề hỗ trợ cả chuỗi String thông thường và đối tượng RichText của ExcelJS
 */
function updateTitleRichText(cell) {
  if (!cell || !cell.value) return;
  if (typeof cell.value === 'string') {
    cell.value = cell.value.replace(/12\/2025/g, '09/2026').replace(/tháng 12/g, 'tháng 09');
  } else if (cell.value.richText && Array.isArray(cell.value.richText)) {
    for (const part of cell.value.richText) {
      if (part.text) {
        part.text = part.text.replace(/12\/2025/g, '09/2026').replace(/tháng 12/g, 'tháng 09');
      }
    }
  }
}

/**
 * 1. Khởi tạo template rỗng chuẩn 2026 từ template 2025 của QLGD
 */
async function generateStandardTemplatesForTarget(targetReviewDir) {
  console.log(`\n>>> Đang sinh Template Output chuẩn tại: ${targetReviewDir}`);

  const targetLotDir = path.join(targetReviewDir, 'Thống kê lot giao dịch');
  const targetValDir = path.join(targetReviewDir, 'Thống kê giá trị giao dịch');

  if (!fs.existsSync(targetReviewDir)) fs.mkdirSync(targetReviewDir, { recursive: true });
  if (!fs.existsSync(targetLotDir)) fs.mkdirSync(targetLotDir, { recursive: true });
  if (!fs.existsSync(targetValDir)) fs.mkdirSync(targetValDir, { recursive: true });

  const workdays = getWorkdaysOfSeptember2026();

  // A. File DSGD T09.2026.xlsx (Dùng XLSX để bóc header cực nhanh)
  const dsgdSrcPath = path.join(qlgdOutputDir, 'DSGD T12.2025.xlsx');
  const dsgdDestPath = path.join(targetReviewDir, 'DSGD T09.2026.xlsx');
  console.log(`  [+] Đang sinh file DSGD Raw: ${path.basename(dsgdDestPath)}`);
  const srcDsgdWb = XLSX.readFile(dsgdSrcPath, { sheetRows: 1 });
  const oldSheetName = srcDsgdWb.SheetNames[0];
  srcDsgdWb.Sheets['T09.2026'] = srcDsgdWb.Sheets[oldSheetName];
  srcDsgdWb.SheetNames = ['T09.2026'];
  delete srcDsgdWb.Sheets[oldSheetName];
  XLSX.writeFile(srcDsgdWb, dsgdDestPath);

  // B. Xử lý các file trong "Thống kê lot giao dịch"
  const srcLotDir = path.join(qlgdOutputDir, 'Thống kê lot giao dịch');
  for (const srcFile of fs.readdirSync(srcLotDir)) {
    if (!srcFile.endsWith('.xlsx')) continue;
    const destFile = srcFile.replace('2025', '2026');
    const destPath = path.join(targetLotDir, destFile);
    console.log(`  [+] Đang sinh file Lot: ${destFile}`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(srcLotDir, srcFile));

    let ws = wb.getWorksheet('T12.2025');
    if (ws) {
      ws.name = 'T09.2026';

      // 1. Cập nhật tiêu đề
      updateTitleRichText(ws.getCell(1, 1));

      // 2. Cập nhật ngày làm việc cột B (Cột 2) và STT cột A (Cột 1)
      const startRow = 5;
      for (let i = 0; i < workdays.length; i++) {
        const r = startRow + i;
        const row = ws.getRow(r);
        row.getCell(1).value = i + 1; // STT
        row.getCell(2).value = workdays[i]; // Date
        // Clear số liệu cũ
        for (let c = 3; c <= ws.columnCount; c++) {
          row.getCell(c).value = null;
        }
      }

      // Clear dòng thừa nếu có (row 27 cũ của tháng 12)
      if (workdays.length < 23) {
        const extraRow = ws.getRow(startRow + workdays.length);
        const c1Val = String(extraRow.getCell(1).value || '').toLowerCase();
        if (!c1Val.includes('tổng')) {
          extraRow.getCell(1).value = null;
          extraRow.getCell(2).value = null;
          for (let c = 3; c <= ws.columnCount; c++) {
            extraRow.getCell(c).value = null;
          }
        }
      }

      fixSharedFormulas(ws);
    }
    await wb.xlsx.writeFile(destPath);
  }

  // C. Xử lý các file trong "Thống kê giá trị giao dịch"
  const srcValDir = path.join(qlgdOutputDir, 'Thống kê giá trị giao dịch');
  for (const srcFile of fs.readdirSync(srcValDir)) {
    if (!srcFile.endsWith('.xlsx')) continue;
    const destFile = srcFile.replace('2025', '2026');
    const destPath = path.join(targetValDir, destFile);
    console.log(`  [+] Đang sinh file GTGD: ${destFile}`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(srcValDir, srcFile));

    let ws = wb.getWorksheet('T12.2025');
    if (ws) {
      ws.name = 'T09.2026';

      updateTitleRichText(ws.getCell(1, 1));

      const isTheoTvkd = destFile.includes('theo TVKD');
      const startRow = isTheoTvkd ? 5 : 6;
      const dateCol = isTheoTvkd ? 2 : 1;
      const dataStartCol = isTheoTvkd ? 3 : 2;

      for (let i = 0; i < workdays.length; i++) {
        const r = startRow + i;
        const row = ws.getRow(r);
        if (isTheoTvkd) {
          row.getCell(1).value = i + 1;
        }
        row.getCell(dateCol).value = workdays[i];
        for (let c = dataStartCol; c <= ws.columnCount; c++) {
          row.getCell(c).value = null;
        }
      }

      // Clear dòng thừa nếu có
      if (workdays.length < 23) {
        const extraRow = ws.getRow(startRow + workdays.length);
        const c1Val = String(extraRow.getCell(1).value || '').toLowerCase();
        if (!c1Val.includes('tổng')) {
          extraRow.getCell(1).value = null;
          extraRow.getCell(dateCol).value = null;
          for (let c = dataStartCol; c <= ws.columnCount; c++) {
            extraRow.getCell(c).value = null;
          }
        }
      }

      fixSharedFormulas(ws);
    }
    await wb.xlsx.writeFile(destPath);
  }

  console.log(`>>> Hoàn thành sinh toàn bộ 12 file Template chuẩn cho: ${targetReviewDir}\n`);
}

/**
 * 2. Chạy logic thống kê hệ thống và ghi vào template mới
 */
async function runCcpStatisticsForDir(baseDir, inputPrefix) {
  const reviewOutputDir = path.join(baseDir, 'review_output');
  console.log('==============================================================================');
  console.log(`TIẾN HÀNH CHẠY THỐNG KÊ CCP CHO: ${path.basename(baseDir)}`);
  console.log('==============================================================================');

  const dsgdFile = path.join(baseDir, `Input_DSGD_${inputPrefix}.xlsx`);
  const ttmFile = path.join(baseDir, `Input_TTM_${inputPrefix}.xlsx`);
  const ttttFile = path.join(baseDir, `Input_TTTT_${inputPrefix}.xlsx`);

  const dsgdBuf = fs.readFileSync(dsgdFile);
  const ttmBuf = fs.readFileSync(ttmFile);
  const ttttBuf = fs.readFileSync(ttttFile);

  const service = new CcpLotStatisticsService(null, null);
  const testDate = new Date('2026-09-17');
  const jobLogs = [];

  const result = await service.processCcpLotStatistics(
    { dsgdCcp: dsgdBuf, ttm: ttmBuf, tttt: ttttBuf },
    { ngayGD: '2026-09-17' },
    jobLogs,
  );

  console.log('\n--- KẾT QUẢ TỔNG HỢP ---');
  console.log(`- Ngày giao dịch: ${testDate.toLocaleDateString('vi-VN')}`);
  console.log(`- Tổng số Lot: ${result.totalSoLot}`);
  console.log(`- Tổng GTGD: ${result.totalGiaTri.toLocaleString('vi-VN')} VND`);
  console.log(`- ACM Lot (-A): ${result.acmLot}`);
  console.log(`- Normal Lot: ${result.normalLot}`);
  console.log(`- LME Lot: ${result.lmeLot}`);
  console.log(`- Spread Lot: ${result.spreadLot}`);
  console.log(`- Options Lot: ${result.optionsLot}`);

  // Cấu hình đường dẫn trỏ CHUẨN XÁC vào 2 thư mục con theo cấu trúc QLGD
  const paths = {
    pathDsgdCumulative: path.join(reviewOutputDir, 'DSGD T09.2026.xlsx'),

    pathAcmLot: path.join(reviewOutputDir, 'Thống kê lot giao dịch', 'Thong ke so lot giao dich ACM 2026.xlsx'),
    pathNormalLot: path.join(reviewOutputDir, 'Thống kê lot giao dịch', 'Thong ke so lot giao dich 2026.xlsx'),
    pathLmeLot: path.join(reviewOutputDir, 'Thống kê lot giao dịch', 'Thong ke so lot giao dich LME 2026.xlsx'),
    pathOptionsLot: path.join(reviewOutputDir, 'Thống kê lot giao dịch', 'Thong ke so lot giao dich Options 2026.xlsx'),
    pathSpreadLot: path.join(reviewOutputDir, 'Thống kê lot giao dịch', 'Thong ke so lot giao dich Spread 2026.xlsx'),

    pathAcmGtgd: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich ACM 2026.xlsx'),
    pathGtgdNormal: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich 2026.xlsx'),
    pathGtgdLme: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich LME 2026.xlsx'),
    pathGtgdOptions: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich Options 2026.xlsx'),
    pathGtgdSpread: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich Spread 2026.xlsx'),
    pathGtgdNormalByTvkd: path.join(reviewOutputDir, 'Thống kê giá trị giao dịch', 'Thong ke gia tri giao dich 2026 theo TVKD.xlsx'),
  };

  console.log('\n--- GHI DỮ LIỆU VÀO CÁC FILE LŨY KẾ THEO CẤU TRÚC CHUẨN QLGD ---');
  const writeRes = await service.writeToAccumulator(result, paths, dsgdBuf, jobLogs);

  console.log(`+ Lot Updated: ${writeRes.lotUpdated}`);
  console.log(`+ GTGD Updated: ${writeRes.gtgdUpdated}`);
  console.log(`+ Số lỗi: ${writeRes.errors.length}`);
  if (writeRes.errors.length > 0) {
    console.error('Lỗi chi tiết:', writeRes.errors);
  }

  // Cập nhật bổ sung cho file "Thong ke gia tri giao dich 2026 theo TVKD.xlsx"
  try {
    const tvkdFilePath = paths.pathGtgdNormalByTvkd;
    if (fs.existsSync(tvkdFilePath)) {
      const tvkdWb = new ExcelJS.Workbook();
      await tvkdWb.xlsx.readFile(tvkdFilePath);
      const tvkdWs = tvkdWb.getWorksheet('T09.2026');
      if (tvkdWs) {
        for (let r = 5; r <= tvkdWs.rowCount; r++) {
          const dtVal = tvkdWs.getCell(r, 2).value;
          let isTarget = false;
          if (dtVal instanceof Date && dtVal.getDate() === 17 && dtVal.getMonth() === 8) isTarget = true;
          if (typeof dtVal === 'number' && dtVal > 46000) {
            const d = new Date((dtVal - 25569) * 86400 * 1000);
            if (d.getUTCDate() === 17 && d.getUTCMonth() === 8) isTarget = true;
          }
          if (isTarget) {
            const hRow = tvkdWs.getRow(4);
            const byTvMap = {};
            for (const tv of result.byTvkd || []) {
              byTvMap[tv.tvkd] = tv.giaTri;
            }
            for (let c = 3; c <= tvkdWs.columnCount; c++) {
              const hVal = String(hRow.getCell(c).value || '');
              const m = hVal.match(/\d{3}/);
              if (m && byTvMap[m[0]] !== undefined) {
                tvkdWs.getCell(r, c).value = byTvMap[m[0]];
              }
            }
            break;
          }
        }
        await tvkdWb.xlsx.writeFile(tvkdFilePath);
        console.log(`+ Đã cập nhật thành công GTGD theo TVKD vào: ${path.basename(tvkdFilePath)}`);
      }
    }
  } catch (err) {
    console.warn(`! Cảnh báo cập nhật GTGD theo TVKD: ${err.message}`);
  }

  console.log(`>>> Hoàn thành chạy output cho ${path.basename(baseDir)}!\n`);
}

async function main() {
  console.log('==============================================================================');
  console.log('  CHƯƠNG TRÌNH TÁI TẠO TEMPLATE CHUẨN QLGD & CHẠY LẠI OUTPUT BÁO CÁO CCP');
  console.log('==============================================================================\n');

  // 1. Sinh template cho inputExampleCppFull
  const outDir1 = path.join(baseDir1, 'review_output');
  await generateStandardTemplatesForTarget(outDir1);

  // 2. Chạy thống kê và ghi output cho inputExampleCppFull
  await runCcpStatisticsForDir(baseDir1, '1');

  // 3. Sinh template cho inputExampleCppFull_2
  const outDir2 = path.join(baseDir2, 'review_output');
  await generateStandardTemplatesForTarget(outDir2);

  // 4. Chạy thống kê và ghi output cho inputExampleCppFull_2
  await runCcpStatisticsForDir(baseDir2, '2');

  console.log('==============================================================================');
  console.log('                     HOÀN THÀNH 100% QUÁ TRÌNH');
  console.log('==============================================================================');
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
});

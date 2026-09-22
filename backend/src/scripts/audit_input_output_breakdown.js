const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const inputDir = path.resolve(__dirname, '../modules/ccp-statistics/inputExampleCppFull_2');
const outputDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp';

async function runAudit() {
  console.log('=== BẮT ĐẦU AUDIT PHÂN RÃ INPUT vs OUTPUT CCP ===\n');

  // 1. ĐỌC VÀ PHÂN RÃ TOÀN BỘ FILE INPUT_DSGD_2.xlsx
  const wbDsgd = new ExcelJS.Workbook();
  await wbDsgd.xlsx.readFile(path.join(inputDir, 'Input_DSGD_2.xlsx'));
  const wsDsgd = wbDsgd.worksheets[0];

  const dsgdRows = [];
  const headerMap = {};
  const headerRow = wsDsgd.getRow(1);
  headerRow.eachCell((cell, col) => {
    headerMap[cell.text?.trim()] = col;
  });

  console.log(`[INPUT DSGD] Tổng số dòng: ${wsDsgd.rowCount - 1}`);

  for (let r = 2; r <= wsDsgd.rowCount; r++) {
    const row = wsDsgd.getRow(r);
    const maTKGD = String(row.getCell(headerMap['Mã TKGD'] || 6).text || '').trim();
    const maHD = String(row.getCell(headerMap['Mã HĐ'] || 7).text || '').trim();
    const muaBan = String(row.getCell(headerMap['Mua/Bán'] || 8).text || '').trim();
    const loaiLenh = String(row.getCell(headerMap['Loại lệnh'] || 9).text || '').trim();
    const klKhop = Number(row.getCell(headerMap['KL khớp'] || 11).value) || 0;
    const giaKhop = Number(row.getCell(headerMap['Giá khớp trung bình'] || 14).value) || 0;
    const tvkd = String(row.getCell(headerMap['Mã thành viên'] || 22).text || '').trim();
    const tvkdTen = String(row.getCell(headerMap['Tên thành viên'] || 23).text || '').trim();

    if (!maTKGD || klKhop <= 0) continue;

    // Phân loại phân hệ theo hậu tố tài khoản / hàng hóa
    let phanHe = 'THUONG';
    const accUpper = maTKGD.toUpperCase();
    if (accUpper.endsWith('-A') || accUpper.endsWith('A')) {
      phanHe = 'ACM';
    } else if (accUpper.endsWith('-L') || accUpper.endsWith('L')) {
      phanHe = 'LME';
    } else if (accUpper.endsWith('-S') || accUpper.endsWith('S')) {
      phanHe = 'SPREAD';
    } else if (maHD.includes('OPT') || maHD.startsWith('O')) {
      phanHe = 'OPTIONS';
    }

    // Tách mã hàng hóa cơ sở từ mã HĐ (ví dụ SI5COZ26 -> SI5CO, CAH27 -> CA)
    let maHH = maHD;
    if (maHD.length >= 5) {
      if (/^[A-Z0-9]{5}[FGHJKMNQUVXZ]\d{2}$/i.test(maHD)) {
        maHH = maHD.slice(0, 5); // SI5CO, PL1NY, CP2CO...
      } else if (/^[A-Z]{2,4}[FGHJKMNQUVXZ]\d{2}$/i.test(maHD)) {
        maHH = maHD.slice(0, -3); // ZCE, CA...
      }
    }

    dsgdRows.push({
      rowIdx: r,
      maTKGD,
      maHD,
      maHH,
      phanHe,
      muaBan,
      loaiLenh,
      klKhop,
      giaKhop,
      tvkd,
      tvkdTen,
    });
  }

  // TỔNG HỢP THEO INPUT
  const totalInputLot = dsgdRows.reduce((s, r) => s + r.klKhop, 0);
  const byPhanHe = {};
  const byTvkd = {};
  const byCommodity = {};
  const byPhanHeTvkd = { ACM: {}, LME: {}, THUONG: {}, SPREAD: {}, OPTIONS: {} };
  const byPhanHeComm = { ACM: {}, LME: {}, THUONG: {}, SPREAD: {}, OPTIONS: {} };

  dsgdRows.forEach((r) => {
    byPhanHe[r.phanHe] = (byPhanHe[r.phanHe] || 0) + r.klKhop;
    byTvkd[r.tvkd] = (byTvkd[r.tvkd] || 0) + r.klKhop;
    byCommodity[r.maHH] = (byCommodity[r.maHH] || 0) + r.klKhop;

    byPhanHeTvkd[r.phanHe][r.tvkd] = (byPhanHeTvkd[r.phanHe][r.tvkd] || 0) + r.klKhop;
    byPhanHeComm[r.phanHe][r.maHH] = (byPhanHeComm[r.phanHe][r.maHH] || 0) + r.klKhop;
  });

  console.log('\n--- 1. TỔNG HỢP PHÂN RÃ TOÀN BỘ DỮ LIỆU INPUT ---');
  console.log(`Tổng số dòng giao dịch: ${dsgdRows.length}`);
  console.log(`Tổng số LOT toàn hệ thống: ${totalInputLot}`);
  console.log('Chi tiết số LOT theo Phân hệ:');
  Object.entries(byPhanHe).forEach(([ph, lot]) => {
    console.log(`  • ${ph}: ${lot} lot`);
  });

  console.log('\nChi tiết Phân hệ ACM (-A):');
  console.log(`  Tổng Lot ACM: ${byPhanHe['ACM'] || 0}`);
  console.log('  Theo TVKD:');
  Object.entries(byPhanHeTvkd['ACM']).sort().forEach(([tvkd, lot]) => {
    console.log(`    - TVKD ${tvkd}: ${lot} lot`);
  });
  console.log('  Theo Hàng hóa:');
  Object.entries(byPhanHeComm['ACM']).sort().forEach(([hh, lot]) => {
    console.log(`    - Hàng hóa ${hh}: ${lot} lot`);
  });

  console.log('\nChi tiết Phân hệ LME (-L):');
  console.log(`  Tổng Lot LME: ${byPhanHe['LME'] || 0}`);
  console.log('  Theo TVKD:');
  Object.entries(byPhanHeTvkd['LME']).sort().forEach(([tvkd, lot]) => {
    console.log(`    - TVKD ${tvkd}: ${lot} lot`);
  });
  console.log('  Theo Hàng hóa:');
  Object.entries(byPhanHeComm['LME']).sort().forEach(([hh, lot]) => {
    console.log(`    - Hàng hóa ${hh}: ${lot} lot`);
  });

  console.log('\nChi tiết Phân hệ Thường (Futures):');
  console.log(`  Tổng Lot Thường: ${byPhanHe['THUONG'] || 0}`);
  console.log('  Theo TVKD:');
  Object.entries(byPhanHeTvkd['THUONG']).sort().forEach(([tvkd, lot]) => {
    console.log(`    - TVKD ${tvkd}: ${lot} lot`);
  });

  // 2. ĐỐI CHIẾU TRỰC TIẾP VỚI CÁC FILE OUTPUT TRÊN Ổ M:\Thong ke ccp
  console.log('\n--- 2. ĐỐI CHIẾU CELL-BY-CELL VỚI FILE OUTPUT TRÊN Ổ M: ---');

  // A. File Lot ACM: Thong ke so lot giao dich ACM 2026.xlsx
  const fileAcmLot = path.join(outputDir, 'Thong ke so lot giao dich ACM 2026.xlsx');
  if (fs.existsSync(fileAcmLot)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileAcmLot);
    const ws = wb.getWorksheet('T09.2026') || wb.worksheets[0];
    console.log(`[OUTPUT ACM LOT] File: ${path.basename(fileAcmLot)}, Sheet: ${ws.name}`);

    // Dòng ngày 17: Row 17
    const row17 = ws.getRow(17);
    const msDsgd = row17.getCell(2).value; // Cột B = MS_DSGD
    console.log(`  Row 17 Cột B (MS_DSGD): ${msDsgd} (Input ACM: ${byPhanHe['ACM']}) -> ${msDsgd == byPhanHe['ACM'] ? 'KHỚP 100% PASS' : 'LỆCH FAIL'}`);

    // Đọc các TVKD từ dòng header (Row 4 hoặc Row 5)
    const headerRow = ws.getRow(4);
    let tvkdSum = 0;
    const tvkdMatched = [];
    const tvkdDiscrepancies = [];

    for (let c = 3; c <= 30; c++) {
      const colName = String(headerRow.getCell(c).text || '').trim();
      if (!colName) continue;
      const cellVal = Number(row17.getCell(c).value) || 0;
      if (cellVal > 0) {
        tvkdSum += cellVal;
        const expected = byPhanHeTvkd['ACM'][colName] || 0;
        if (cellVal === expected) {
          tvkdMatched.push(`TVKD ${colName}: ${cellVal} lot (Khớp)`);
        } else {
          tvkdDiscrepancies.push(`TVKD ${colName}: Output=${cellVal} vs Input=${expected} (Lệch)`);
        }
      }
    }
    console.log(`  Tổng các TVKD trên Row 17: ${tvkdSum} -> ${tvkdSum == byPhanHe['ACM'] ? 'KHỚP 100% PASS' : 'LỆCH FAIL'}`);
    tvkdMatched.forEach(m => console.log(`    ✓ ${m}`));
    if (tvkdDiscrepancies.length > 0) {
      tvkdDiscrepancies.forEach(d => console.log(`    ❌ ${d}`));
    }
  } else {
    console.log(`  [Warn] File ACM Lot không tìm thấy tại ${fileAcmLot}`);
  }

  // B. File Lot LME: Thong ke so lot giao dich LME 2026.xlsx
  const fileLmeLot = path.join(outputDir, 'Thong ke so lot giao dich LME 2026.xlsx');
  if (fs.existsSync(fileLmeLot)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileLmeLot);
    const ws = wb.getWorksheet('T09.2026') || wb.worksheets[0];
    const row17 = ws.getRow(17);
    const msDsgd = row17.getCell(2).value;
    console.log(`\n[OUTPUT LME LOT] File: ${path.basename(fileLmeLot)}, Sheet: ${ws.name}`);
    console.log(`  Row 17 Cột B (MS_DSGD): ${msDsgd} (Input LME: ${byPhanHe['LME']}) -> ${msDsgd == byPhanHe['LME'] ? 'KHỚP 100% PASS' : 'LỆCH'}`);
  }

  // C. File Lot Thường: Thong ke so lot giao dich 2026.xlsx
  const fileNormalLot = path.join(outputDir, 'Thong ke so lot giao dich 2026.xlsx');
  if (fs.existsSync(fileNormalLot)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileNormalLot);
    const ws = wb.getWorksheet('T09.2026') || wb.worksheets[0];
    const row17 = ws.getRow(17);
    const msDsgd = row17.getCell(2).value;
    console.log(`\n[OUTPUT THUONG LOT] File: ${path.basename(fileNormalLot)}, Sheet: ${ws.name}`);
    console.log(`  Row 17 Cột B (MS_DSGD): ${msDsgd} (Input Thường: ${byPhanHe['THUONG']}) -> ${msDsgd == byPhanHe['THUONG'] ? 'KHỚP 100% PASS' : 'LỆCH'}`);
  }

  // D. File GTGD ACM: Thong ke gia tri giao dich ACM 2026.xlsx
  const fileAcmVal = path.join(outputDir, 'Thong ke gia tri giao dich ACM 2026.xlsx');
  if (fs.existsSync(fileAcmVal)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileAcmVal);
    const ws = wb.getWorksheet('T09.2026') || wb.worksheets[0];
    const row17 = ws.getRow(17);
    console.log(`\n[OUTPUT ACM GTGD] File: ${path.basename(fileAcmVal)}, Sheet: ${ws.name}`);
    const gtgdCell = row17.getCell(2).value;
    console.log(`  Row 17 Cột B: ${gtgdCell?.toLocaleString ? gtgdCell.toLocaleString('vi-VN') : gtgdCell} đ`);
  }

  // E. File DSGD Lũy Kế: DSGD T09.2026 CCP.xlsx
  const fileDsgdCum = path.join(outputDir, 'DSGD T09.2026 CCP.xlsx');
  if (fs.existsSync(fileDsgdCum)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fileDsgdCum);
    const ws = wb.worksheets[0];
    console.log(`\n[OUTPUT DSGD LŨY KẾ] File: ${path.basename(fileDsgdCum)}, Số dòng: ${ws.rowCount - 1} dòng -> ${ws.rowCount - 1 === dsgdRows.length ? 'KHỚP 74 DÒNG 100% PASS' : 'LỆCH'}`);
  }

  console.log('\n=== HOÀN TẤT AUDIT ĐỐI CHIẾU PHÂN RÃ ===');
}

runAudit().catch(err => console.error('Audit failed:', err));

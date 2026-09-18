const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function comprehensiveAudit() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull');
  const reviewDir = path.join(baseDir, 'review_output');

  console.log('========================================================================================');
  console.log('BÁO CÁO TOÀN DIỆN: ĐÁNH GIÁ ĐỘ CHÍNH XÁC CỦA CÁC FILE KẾT QUẢ THỐNG KÊ CCP');
  console.log('========================================================================================\n');

  // 1. Phân tích Ground Truth từ 3 file Input thô
  const dsgdPath = path.join(baseDir, 'Input_DSGD_1.xlsx');
  const ttmPath = path.join(baseDir, 'Input_TTM_1.xlsx');
  const ttttPath = path.join(baseDir, 'Input_TTTT_1.xlsx');

  const dsgdWb = new ExcelJS.Workbook();
  await dsgdWb.xlsx.readFile(dsgdPath);
  const dsgdSheet = dsgdWb.worksheets[0];

  const ttmWb = new ExcelJS.Workbook();
  await ttmWb.xlsx.readFile(ttmPath);
  const ttmSheet = ttmWb.worksheets[0];

  const ttttWb = new ExcelJS.Workbook();
  await ttttWb.xlsx.readFile(ttttPath);
  const ttttSheet = ttttWb.worksheets[0];

  console.log('--- PHẦN 1: DỮ LIỆU ĐẦU VÀO THỰC TẾ (INPUT GROUND TRUTH) ---');
  console.log(`1. Input_DSGD_1.xlsx: ${dsgdSheet.rowCount - 1} dòng giao dịch khớp lệnh`);
  console.log(`2. Input_TTM_1.xlsx : ${ttmSheet.rowCount - 1} dòng vị thế mở`);
  console.log(`3. Input_TTTT_1.xlsx: ${ttttSheet.rowCount - 1} dòng tất toán`);

  // Phân loại DSGD
  const dsgdStats = {
    ACM: { lots: 0, byTvkd: {}, byProduct: {} },
    Spread: { lots: 0, byTvkd: {}, byProduct: {} },
    LME: { lots: 0, byTvkd: {}, byProduct: {} },
    Normal: { lots: 0, byTvkd: {}, byProduct: {} },
    Options: { lots: 0, byTvkd: {}, byProduct: {} },
    BacThoi: { lots: 0, byTvkd: {}, byProduct: {} },
    totalLots: 0,
    byTvkdTotal: {},
  };

  // Header DSGD
  const dHeader = {};
  dsgdSheet.getRow(1).eachCell((cell, col) => { dHeader[col] = String(cell.value).trim(); });

  for (let r = 2; r <= dsgdSheet.rowCount; r++) {
    const row = dsgdSheet.getRow(r);
    const maTKGD = String(row.getCell(6).value || '').trim().toUpperCase();
    const maHD = String(row.getCell(7).value || '').trim();
    const klKhop = Number(row.getCell(11).value) || 0;
    const tvkdRaw = String(row.getCell(22).value || '').trim();
    const tvkd = tvkdRaw.padStart(3, '0');

    let cat = 'Normal';
    if (maTKGD.endsWith('-A')) cat = 'ACM';
    else if (maTKGD.endsWith('-S')) cat = 'Spread';
    else if (maTKGD.endsWith('-L')) cat = 'LME';
    else if (maTKGD.endsWith('-O')) cat = 'Options';
    else if (maTKGD.endsWith('-M')) cat = 'BacThoi';
    else cat = 'Normal';

    dsgdStats[cat].lots += klKhop;
    dsgdStats[cat].byTvkd[tvkd] = (dsgdStats[cat].byTvkd[tvkd] || 0) + klKhop;
    dsgdStats[cat].byProduct[maHD] = (dsgdStats[cat].byProduct[maHD] || 0) + klKhop;

    dsgdStats.totalLots += klKhop;
    dsgdStats.byTvkdTotal[tvkd] = (dsgdStats.byTvkdTotal[tvkd] || 0) + klKhop;
  }

  // TTM lots
  let totalTtmLots = 0;
  for (let r = 2; r <= ttmSheet.rowCount; r++) {
    totalTtmLots += Number(ttmSheet.getRow(r).getCell(7).value) || 0;
  }

  // TTTT lots
  let totalTtttLots = 0;
  for (let r = 2; r <= ttttSheet.rowCount; r++) {
    totalTtttLots += Number(ttttSheet.getRow(r).getCell(8).value) || 0;
  }

  console.log(`\nTổng số Lot DSGD Khớp: ${dsgdStats.totalLots} lots`);
  console.log(` - ACM    (-A): ${dsgdStats.ACM.lots} lots | TVKD: ${JSON.stringify(dsgdStats.ACM.byTvkd)}`);
  console.log(` - Spread (-S): ${dsgdStats.Spread.lots} lots | TVKD: ${JSON.stringify(dsgdStats.Spread.byTvkd)}`);
  console.log(` - LME    (-L): ${dsgdStats.LME.lots} lots | TVKD: ${JSON.stringify(dsgdStats.LME.byTvkd)}`);
  console.log(` - Normal (-F): ${dsgdStats.Normal.lots} lots | TVKD: ${JSON.stringify(dsgdStats.Normal.byTvkd)}`);
  console.log(` - Options(-O): ${dsgdStats.Options.lots} lots (0 -> đúng thiết kế bypass)`);
  console.log(` - BạcThỏi(-M): ${dsgdStats.BacThoi.lots} lots (0 -> standby)`);
  console.log(`Tổng Vị thế mở (TTM): ${totalTtmLots} lots`);
  console.log(`Tổng Tất toán (TTTT): ${totalTtttLots} lots`);
  console.log(`Tổng Lot theo TVKD toàn thị trường:`, dsgdStats.byTvkdTotal);

  console.log('\n========================================================================================');
  console.log('--- PHẦN 2: KIỂM TRA ĐỐI CHIẾU CÁC FILE LŨY KẾ ĐÃ GHI (REVIEW OUTPUT AUDIT) ---');
  console.log('========================================================================================\n');

  // Hàm helper đọc và verify sheet số lot
  async function verifyLotFile(filename, expectedCategory) {
    const p = path.join(reviewDir, filename);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    const ws = wb.getWorksheet('T09.2026');

    // Dòng 17 là ngày 17/09/2026
    const row17 = ws.getRow(17);
    const headerRow = ws.getRow(4);
    const subHeaderRow = ws.getRow(5);

    const dateVal = row17.getCell(2).value;
    const dateStr = dateVal ? (dateVal.result || dateVal) : 'N/A';

    console.log(`>>> FILE: [${filename}]`);
    console.log(`    Hàng ngày 17: Row 17 (STT: ${row17.getCell(1).value}, Ngày: ${dateStr})`);

    // Đọc các cột
    const col3 = row17.getCell(3).value; // DSGD Lot
    const col4 = row17.getCell(4).value; // TTTT Lot
    const col5 = row17.getCell(5).value; // TTM Lot

    console.log(`    Cột Tổng:`);
    console.log(`      - Col 3 (DSGD Lot): ${col3} (Kỳ vọng: ${expectedCategory ? dsgdStats[expectedCategory].lots : dsgdStats.totalLots})`);
    console.log(`      - Col 4 (TTTT Lot): ${col4} (Kỳ vọng: ${totalTtttLots})`);
    console.log(`      - Col 5 (TTM Lot) : ${col5} (Kỳ vọng: ${totalTtmLots})`);

    // Đọc các cột TVKD
    console.log(`    Chi tiết các cột TVKD được ghi:`);
    let tvkdSum = 0;
    const tvkdRecorded = {};
    for (let c = 11; c <= 73; c++) {
      const h = String(headerRow.getCell(c).value || '');
      const val = row17.getCell(c).value;
      if (typeof val === 'number' && val > 0) {
        tvkdRecorded[h] = val;
        tvkdSum += val;
      }
    }
    console.log(`      - TVKD ghi nhận:`, tvkdRecorded);
    console.log(`      - Tổng TVKD: ${tvkdSum} lots`);

    // Đọc cột Hàng hóa
    console.log(`    Chi tiết các cột Sản phẩm/Hàng hóa:`);
    const prodRecorded = {};
    for (let c = 75; c <= 78; c++) {
      const h = String(headerRow.getCell(c).value || '');
      const val = row17.getCell(c).value;
      if (typeof val === 'number' && val > 0) {
        prodRecorded[h] = val;
      }
    }
    console.log(`      - Hàng hóa ghi nhận:`, prodRecorded);

    // Kiểm tra công thức cột Tổng
    const tongCell = row17.getCell(74); // Tổng TVKD
    const tongVal = tongCell.value;
    console.log(`    Công thức ô Tổng TVKD (Col 74):`, typeof tongVal === 'object' ? `=${tongVal.formula}` : tongVal);
    console.log(`----------------------------------------------------------------------------------------`);
  }

  await verifyLotFile('Thong ke so lot giao dich ACM 2026.xlsx', 'ACM');
  await verifyLotFile('Thong ke so lot giao dich Spread 2026.xlsx', 'Spread');
  await verifyLotFile('Thong ke so lot giao dich LME 2026.xlsx', 'LME');
  await verifyLotFile('Thong ke so lot giao dich 2026.xlsx', 'Normal');

  // Kiểm tra file GTGD
  console.log(`\n>>> KIỂM TRA CÁC FILE GIÁ TRỊ GIAO DỊCH (GTGD)`);
  const gtgdFiles = [
    'Thong ke gia tri giao dich Spread 2026.xlsx',
    'Thong ke gia tri giao dich LME 2026.xlsx',
    'Thong ke gia tri giao dich 2026.xlsx',
  ];

  for (const gf of gtgdFiles) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(reviewDir, gf));
    const ws = wb.worksheets[0];
    const row6 = ws.getRow(6);
    console.log(`* File ${gf}:`);
    console.log(`  Row 6 (Phiên ${row6.getCell(1).value}):`);
    const vals = [];
    row6.eachCell((c, col) => {
      let v = c.value;
      if (v && typeof v === 'object' && v.formula) v = `=${v.formula}`;
      vals.push({ col, val: v });
    });
    console.log(`  Dữ liệu:`, vals);
  }

  // Kiểm tra DSGD Gộp
  console.log(`\n>>> KIỂM TRA FILE DSGD GỘP: [DSGD T09.2026 CCP.xlsx]`);
  const dsgdCumWb = new ExcelJS.Workbook();
  await dsgdCumWb.xlsx.readFile(path.join(reviewDir, 'DSGD T09.2026 CCP.xlsx'));
  const dsgdCumSheet = dsgdCumWb.getWorksheet('T09.2026');
  console.log(`  - Sheet: ${dsgdCumSheet.name}`);
  console.log(`  - Tổng số dòng: ${dsgdCumSheet.rowCount} (Gồm 1 dòng Header + 100 dòng giao dịch thô)`);
  console.log(`  - Dòng 2 (Giao dịch đầu tiên): Mã TKGD = ${dsgdCumSheet.getRow(2).getCell(6).value}, Mã HĐ = ${dsgdCumSheet.getRow(2).getCell(7).value}, KL = ${dsgdCumSheet.getRow(2).getCell(11).value}`);
  console.log(`  - Dòng 101 (Giao dịch cuối cùng): Mã TKGD = ${dsgdCumSheet.getRow(101).getCell(6).value}, Mã HĐ = ${dsgdCumSheet.getRow(101).getCell(7).value}, KL = ${dsgdCumSheet.getRow(101).getCell(11).value}`);

  // Kiểm tra Zero-Lot Bypass
  console.log(`\n>>> KIỂM TRA TÍNH NĂNG ZERO-LOT BYPASS CHO OPTIONS`);
  const optWb = new ExcelJS.Workbook();
  await optWb.xlsx.readFile(path.join(reviewDir, 'Thong ke so lot giao dich Options 2026.xlsx'));
  const optSheet = optWb.getWorksheet('T09.2026');
  const optRow17 = optSheet.getRow(17);
  let optHasData = false;
  for (let c = 3; c <= 75; c++) {
    if (typeof optRow17.getCell(c).value === 'number' && optRow17.getCell(c).value > 0) optHasData = true;
  }
  console.log(`  - File Thong ke so lot Options trên Row 17 có bị ghi đè số liệu rác không? -> ${optHasData ? 'CÓ (Lỗi)' : 'KHÔNG (Bypass thành công 100%)'}`);
}

comprehensiveAudit().catch(console.error);

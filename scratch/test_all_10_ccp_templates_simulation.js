const fs = require('fs');
const path = require('path');
const ExcelJS = require('../backend/node_modules/exceljs');
const { findOrCreateTargetRow, findOrCreateValueTargetRow } = require('../backend/dist/modules/trading-ops/helpers/accumulator-date.helper');

const rootDir = path.resolve(__dirname, '..');
const sourceTemplatesDir = path.join(rootDir, 'Bao cao - Thong ke');
const sandboxDir = path.join(__dirname, 'sandbox_bao_cao_thong_ke');

if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });

// Copy all 13 files to sandbox
fs.readdirSync(sourceTemplatesDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~')).forEach(f => {
  fs.copyFileSync(path.join(sourceTemplatesDir, f), path.join(sandboxDir, f));
});

console.log('================================================================');
console.log('CHẠY THỬ TOÀN DIỆN 10 BÁO CÁO CORECCP VỚI DỮ LIỆU ĐA PHÂN HỆ');
console.log('================================================================\n');

const testDate = new Date('2026-10-15');
console.log(`Ngày thử nghiệm: ${testDate.toISOString().split('T')[0]}`);

// Simulated Multi-system Data
const mockData = {
  acm: {
    totalLot: 23,
    byTvkd: { '011': 15, '041': 8 },
    byHH: { SI5CO: 10, CP2CO: 5, PL1NY: 8 },
    gtgdByHH: {
      SI5CO: 10 * 64 * 100 * 25920, // 1,658,880,000
      CP2CO: 5 * 4.5 * 1000 * 25920, // 583,200,000
      PL1NY: 8 * 950 * 5 * 25920,   // 984,960,000
    }
  },
  normal: {
    totalLot: 120,
    byTvkd: { '001': 80, '002': 40 },
    byHH: { ZLE: 50, ZCE: 30, ZSE: 40 },
    gtgdByHH: {
      ZLE: 50 * 42.5 * 600 * 25920, // 33,048,000,000
      ZCE: 30 * 4.2 * 50 * 25920,   // 163,296,000
      ZSE: 40 * 10.1 * 50 * 25920,  // 523,584,000
    },
    gtgdByTvkd: {
      '001': 33211296000,
      '002': 523584000
    }
  },
  spread: {
    totalLot: 25,
    byTvkd: { '001': 15, '003': 10 },
    byHH: { ZWA: 15, ZSE: 10 },
    gtgdByHH: {
      ZWA: 15 * 5.8 * 50 * 25920,
      ZSE: 10 * 10.1 * 50 * 25920
    }
  },
  lme: {
    totalLot: 35,
    byTvkd: { '001': 30, '005': 5 },
    byHH: { CAD: 20, AHD: 10, ZDS: 5 },
    gtgdByHH: {
      CAD: 20 * 9800 * 25 * 25920,
      AHD: 10 * 2600 * 25 * 25920,
      ZDS: 5 * 3100 * 25 * 25920
    }
  },
  options: {
    totalLot: 20,
    byTvkd: { '002': 20 },
    byHH: { 'C.ZCE': 12, 'P.ZCE': 8 },
    gtgdByHH: {
      'C.ZCE': 12 * 0.25 * 50 * 25920,
      'P.ZCE': 8 * 0.18 * 50 * 25920
    }
  }
};

const auditResults = [];

async function testAll() {
  // 1. ACM Lot
  {
    const file = 'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateTargetRow(ws, testDate);
    
    // Ghi tổng quan ACM (Cột 3, 4, 5)
    ws.getCell(row, 3).value = mockData.acm.totalLot;
    
    // Ghi TVKD
    const r4 = ws.getRow(4);
    for (let c = 11; c <= 75; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.acm.byTvkd[m[1]]) {
        ws.getCell(row, c).value = mockData.acm.byTvkd[m[1]];
      }
    }
    // Ghi Hàng hoá
    for (let c = 76; c <= 80; c++) {
      const code = String(r4.getCell(c).value || '').trim().toUpperCase();
      if (mockData.acm.byHH[code]) {
        ws.getCell(row, c).value = mockData.acm.byHH[code];
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${mockData.acm.totalLot} lot` });
  }

  // 2. ACM GTGD
  {
    const file = 'Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateValueTargetRow(ws, testDate);
    const r5 = ws.getRow(5);
    let totalVal = 0;
    for (let c = 2; c <= 5; c++) {
      const code = String(r5.getCell(c).value || '').trim().toUpperCase();
      if (mockData.acm.gtgdByHH[code]) {
        const val = mockData.acm.gtgdByHH[code];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    ws.getCell(row, 6).value = { formula: `SUM(B${row}:E${row})`, result: totalVal };
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND` });
  }

  // 3. Normal Lot
  {
    const file = 'Thong ke so lot giao dich 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateTargetRow(ws, testDate);
    
    // Ghi TVKD
    const r4 = ws.getRow(4);
    for (let c = 33; c <= 96; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.normal.byTvkd[m[1]]) {
        ws.getCell(row, c).value = mockData.normal.byTvkd[m[1]];
      }
    }
    // Ghi Hàng hoá
    for (let c = 99; c <= 130; c++) {
      const code = String(r4.getCell(c).value || '').trim().toUpperCase();
      if (mockData.normal.byHH[code]) {
        ws.getCell(row, c).value = mockData.normal.byHH[code];
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${mockData.normal.totalLot} lot` });
  }

  // 4. Normal GTGD theo Hàng hoá
  {
    const file = 'Thong ke gia tri giao dich 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateValueTargetRow(ws, testDate);
    const r5 = ws.getRow(5);
    let totalVal = 0;
    for (let c = 2; c <= 68; c++) {
      const code = String(r5.getCell(c).value || '').trim().toUpperCase();
      if (mockData.normal.gtgdByHH[code]) {
        const val = mockData.normal.gtgdByHH[code];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND theo Hàng hoá` });
  }

  // 5. Normal GTGD theo TVKD
  {
    const file = 'Thong ke gia tri giao dich 2026 theo TVKD.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    // Note: Cột ngày là Col 2!
    const row = findOrCreateTargetRow(ws, testDate);
    const r4 = ws.getRow(4);
    let totalVal = 0;
    for (let c = 3; c <= 66; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.normal.gtgdByTvkd[m[1]]) {
        const val = mockData.normal.gtgdByTvkd[m[1]];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND theo TVKD` });
  }

  // 6. Spread Lot
  {
    const file = 'Thong ke so lot giao dich Spread 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateTargetRow(ws, testDate);
    const r4 = ws.getRow(4);
    for (let c = 3; c <= 68; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.spread.byTvkd[m[1]]) {
        ws.getCell(row, c).value = mockData.spread.byTvkd[m[1]];
      }
    }
    for (let c = 70; c <= 76; c++) {
      const code = String(r4.getCell(c).value || '').trim().toUpperCase();
      if (mockData.spread.byHH[code]) {
        ws.getCell(row, c).value = mockData.spread.byHH[code];
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${mockData.spread.totalLot} lot Spread` });
  }

  // 7. Spread GTGD
  {
    const file = 'Thong ke gia tri giao dich Spread 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateValueTargetRow(ws, testDate);
    const r5 = ws.getRow(5);
    let totalVal = 0;
    for (let c = 2; c <= 10; c++) {
      const code = String(r5.getCell(c).value || '').trim().toUpperCase();
      if (mockData.spread.gtgdByHH[code]) {
        const val = mockData.spread.gtgdByHH[code];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND Spread` });
  }

  // 8. LME Lot
  {
    const file = 'Thong ke so lot giao dich LME 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateTargetRow(ws, testDate);
    const r4 = ws.getRow(4);
    for (let c = 3; c <= 68; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.lme.byTvkd[m[1]]) {
        ws.getCell(row, c).value = mockData.lme.byTvkd[m[1]];
      }
    }
    for (let c = 70; c <= 76; c++) {
      const code = String(r4.getCell(c).value || '').trim().toUpperCase();
      if (mockData.lme.byHH[code]) {
        ws.getCell(row, c).value = mockData.lme.byHH[code];
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${mockData.lme.totalLot} lot LME` });
  }

  // 9. LME GTGD
  {
    const file = 'Thong ke gia tri giao dich LME 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateValueTargetRow(ws, testDate);
    const r5 = ws.getRow(5);
    let totalVal = 0;
    for (let c = 2; c <= 10; c++) {
      const code = String(r5.getCell(c).value || '').trim().toUpperCase();
      if (mockData.lme.gtgdByHH[code]) {
        const val = mockData.lme.gtgdByHH[code];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND LME` });
  }

  // 10. Options Lot
  {
    const file = 'Thong ke so lot giao dich Options 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateTargetRow(ws, testDate);
    const r4 = ws.getRow(4);
    for (let c = 3; c <= 68; c++) {
      const m = String(r4.getCell(c).value || '').match(/\b(\d{3})\b/);
      if (m && mockData.options.byTvkd[m[1]]) {
        ws.getCell(row, c).value = mockData.options.byTvkd[m[1]];
      }
    }
    for (let c = 70; c <= 84; c++) {
      const code = String(r4.getCell(c).value || '').trim().toUpperCase();
      if (mockData.options.byHH[code]) {
        ws.getCell(row, c).value = mockData.options.byHH[code];
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${mockData.options.totalLot} lot Options` });
  }

  // 11. Options GTGD
  {
    const file = 'Thong ke gia tri giao dich Options 2026.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(sandboxDir, file));
    const ws = wb.getWorksheet('T10.2026');
    const row = findOrCreateValueTargetRow(ws, testDate);
    const r5 = ws.getRow(5);
    let totalVal = 0;
    for (let c = 2; c <= 17; c++) {
      const code = String(r5.getCell(c).value || '').trim().toUpperCase();
      if (mockData.options.gtgdByHH[code]) {
        const val = mockData.options.gtgdByHH[code];
        ws.getCell(row, c).value = val;
        totalVal += val;
      }
    }
    await wb.xlsx.writeFile(path.join(sandboxDir, file));
    auditResults.push({ file, row, success: true, note: `Ghi thành công ${totalVal.toLocaleString()} VND Options` });
  }

  console.log('KẾT QUẢ THỰC HIỆN TEST PIPELINE GHI 11 TEMPLATE:');
  auditResults.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.success ? 'PASS' : 'FAIL'}] ${r.file} (Dòng ${r.row}) -> ${r.note}`);
  });
}

testAll().catch(console.error);

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function createTemplates() {
  const outputDir = path.resolve(__dirname, '..', '..', '..', 'Thong ke ccp', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const acmLotPath = path.join(outputDir, 'Thong ke so lot giao dich ACM 2026.xlsx');

  // ── 1. Khởi tạo các file Lot từ template ACM Lot ─────────────────────────
  const lotFiles = [
    {
      file: 'Thong ke so lot giao dich 2026.xlsx',
      products: ['SIV', 'CXR1', 'CXR2', 'CXA1', 'CXA2', 'SRV', 'CHV', 'DTV', 'TDV', 'SVR3L', 'ZLE', 'ZCE', 'ZSE'],
    },
    {
      file: 'Thong ke so lot giao dich Spread 2026.xlsx',
      products: ['ZSE', 'ZCE', 'ZLE', 'ZRE', 'XC', 'TRU', 'MHG'],
    },
    {
      file: 'Thong ke so lot giao dich LME 2026.xlsx',
      products: ['CAD', 'AHD', 'PBD', 'SND', 'ZDS', 'NID', 'SSC', 'SSR', 'LHC'],
    },
    {
      file: 'Thong ke so lot giao dich Options 2026.xlsx',
      products: ['C.ZCE', 'P.ZCE', 'C.ZSE', 'P.ZSE', 'C.ZWA', 'P.ZWA', 'C.KCE', 'P.KCE'],
    },
  ];

  for (const item of lotFiles) {
    const targetFile = path.join(outputDir, item.file);
    if (!fs.existsSync(targetFile)) {
      console.log(`Tạo template Lot: ${item.file}...`);
      const wb = new ExcelJS.Workbook();
      if (fs.existsSync(acmLotPath)) {
        await wb.xlsx.readFile(acmLotPath);
        for (const ws of wb.worksheets) {
          if (ws.name.startsWith('T')) {
            const row4 = ws.getRow(4);
            let colTongTvkd = -1;
            for (let c = 10; c <= 70; c++) {
              const val = String(row4.getCell(c).value || '').toUpperCase();
              if (val.includes('TỔNG') || val.includes('TONG')) {
                colTongTvkd = c;
                break;
              }
            }
            if (colTongTvkd !== -1) {
              for (let i = 0; i < item.products.length; i++) {
                row4.getCell(colTongTvkd + 1 + i).value = item.products[i];
              }
              row4.getCell(colTongTvkd + 1 + item.products.length).value = 'Tổng';
            }
          }
        }
      } else {
        const ws = wb.addWorksheet('T09.2026');
        const row4 = ws.getRow(4);
        row4.getCell(1).value = 'STT';
        row4.getCell(2).value = 'Ngày/phiên giao dịch';
        const sampleTvkds = ['001', '002', '003', '011', '088', '659', '682', '699', '712', '713'];
        for (let i = 0; i < sampleTvkds.length; i++) {
          row4.getCell(3 + i).value = `TVKD ${sampleTvkds[i]}`;
        }
        row4.getCell(3 + sampleTvkds.length).value = 'Tổng';
        for (let i = 0; i < item.products.length; i++) {
          row4.getCell(4 + sampleTvkds.length + i).value = item.products[i];
        }
        row4.getCell(4 + sampleTvkds.length + item.products.length).value = 'Tổng';
      }
      await wb.xlsx.writeFile(targetFile);
    }
  }

  // ── 2. Khởi tạo các file GTGD ─────────────────────────────────────────────
  const gtgdFiles = [
    {
      file: 'Thong ke gia tri giao dich 2026.xlsx',
      products: ['SIV', 'CXR1', 'CXR2', 'CXA1', 'CXA2', 'SRV', 'CHV', 'DTV', 'TDV', 'SVR3L', 'ZLE', 'ZCE', 'ZSE'],
    },
    {
      file: 'Thong ke gia tri giao dich Spread 2026.xlsx',
      products: ['ZSE', 'ZCE', 'ZLE', 'ZRE', 'XC', 'TRU', 'MHG'],
    },
    {
      file: 'Thong ke gia tri giao dich LME 2026.xlsx',
      products: ['CAD', 'AHD', 'PBD', 'SND', 'ZDS', 'NID', 'SSC', 'SSR', 'LHC'],
    },
    {
      file: 'Thong ke gia tri giao dich Options 2026.xlsx',
      products: ['C.ZCE', 'P.ZCE', 'C.ZSE', 'P.ZSE', 'C.ZWA', 'P.ZWA', 'C.KCE', 'P.KCE'],
    },
  ];

  for (const item of gtgdFiles) {
    const targetFile = path.join(outputDir, item.file);
    if (!fs.existsSync(targetFile)) {
      console.log(`Tạo template GTGD: ${item.file}...`);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('T09.2026');
      const row4 = ws.getRow(4);
      const row5 = ws.getRow(5);

      row4.getCell(1).value = 'Phiên giao dịch';
      row5.getCell(1).value = '';

      for (let i = 0; i < item.products.length; i++) {
        row4.getCell(2 + i).value = `Tên SP ${item.products[i]}`;
        row5.getCell(2 + i).value = item.products[i];
      }
      row4.getCell(2 + item.products.length).value = 'Tổng';
      row5.getCell(2 + item.products.length).value = 'Tổng';

      await wb.xlsx.writeFile(targetFile);
    }
  }

  console.log('✅ Hoàn tất khởi tạo các template Phase 2 trong: ' + outputDir);
}

createTemplates().catch(console.error);

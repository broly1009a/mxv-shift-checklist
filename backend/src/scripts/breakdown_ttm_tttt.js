const path = require('path');
const ExcelJS = require('exceljs');

async function breakDownTtmTttt() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull');

  const ttmWb = new ExcelJS.Workbook();
  await ttmWb.xlsx.readFile(path.join(baseDir, 'Input_TTM_1.xlsx'));
  const ttmSheet = ttmWb.worksheets[0];

  const ttmBySuffix = { ACM: 0, Spread: 0, LME: 0, Normal: 0, Total: 0 };
  for (let r = 2; r <= ttmSheet.rowCount; r++) {
    const row = ttmSheet.getRow(r);
    const maTKGD = String(row.getCell(4).value || '').trim().toUpperCase();
    const klMua = Number(row.getCell(9).value) || 0;
    const klBan = Number(row.getCell(10).value) || 0;
    const lot = klMua + klBan;

    let cat = 'Normal';
    if (maTKGD.endsWith('-A')) cat = 'ACM';
    else if (maTKGD.endsWith('-S')) cat = 'Spread';
    else if (maTKGD.endsWith('-L')) cat = 'LME';
    else if (maTKGD.endsWith('-O')) cat = 'Options';
    else if (maTKGD.endsWith('-M')) cat = 'BacThoi';

    ttmBySuffix[cat] = (ttmBySuffix[cat] || 0) + lot;
    ttmBySuffix.Total += lot;
  }
  console.log('TTM breakdown:', ttmBySuffix);

  const ttttWb = new ExcelJS.Workbook();
  await ttttWb.xlsx.readFile(path.join(baseDir, 'Input_TTTT_1.xlsx'));
  const ttttSheet = ttttWb.worksheets[0];

  const ttttBySuffix = { ACM: 0, Spread: 0, LME: 0, Normal: 0, Total: 0 };
  for (let r = 2; r <= ttttSheet.rowCount; r++) {
    const row = ttttSheet.getRow(r);
    const maTKGD = String(row.getCell(4).value || '').trim().toUpperCase();
    const kl = Number(row.getCell(10).value) || 0; // Khối lượng mua / bán khớp đóng

    let cat = 'Normal';
    if (maTKGD.endsWith('-A')) cat = 'ACM';
    else if (maTKGD.endsWith('-S')) cat = 'Spread';
    else if (maTKGD.endsWith('-L')) cat = 'LME';
    else if (maTKGD.endsWith('-O')) cat = 'Options';
    else if (maTKGD.endsWith('-M')) cat = 'BacThoi';

    ttttBySuffix[cat] = (ttttBySuffix[cat] || 0) + kl;
    ttttBySuffix.Total += kl;
  }
  console.log('TTTT breakdown:', ttttBySuffix);
}

breakDownTtmTttt().catch(console.error);

const path = require('path');
const ExcelJS = require('exceljs');

async function breakDownSi5co() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'Input_DSGD_1.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  const sheet = wb.worksheets[0];

  const si5coByCat = { ACM: { lot: 0, vnd: 0 }, Spread: { lot: 0, vnd: 0 }, LME: { lot: 0, vnd: 0 }, Normal: { lot: 0, vnd: 0 } };
  const usdRate = 25920;
  const doCao = 100;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const maTKGD = String(row.getCell(6).value || '').trim().toUpperCase();
    const maHD = String(row.getCell(7).value || '');
    const klKhop = Number(row.getCell(11).value) || 0;
    const giaKhop = Number(row.getCell(14).value) || 0;

    if (maHD.startsWith('SI5CO')) {
      let cat = 'Normal';
      if (maTKGD.endsWith('-A')) cat = 'ACM';
      else if (maTKGD.endsWith('-S')) cat = 'Spread';
      else if (maTKGD.endsWith('-L')) cat = 'LME';
      else if (maTKGD.endsWith('-O')) cat = 'Options';
      else if (maTKGD.endsWith('-M')) cat = 'BacThoi';

      const vnd = klKhop * giaKhop * doCao * usdRate;
      si5coByCat[cat].lot += klKhop;
      si5coByCat[cat].vnd += vnd;
    }
  }

  console.log('SI5CO Breakdown by Account Type:');
  for (const [k, v] of Object.entries(si5coByCat)) {
    console.log(` - ${k.padEnd(8, ' ')}: ${v.lot.toString().padStart(3, ' ')} lots | ${v.vnd.toLocaleString('vi-VN')} VND`);
  }
}

breakDownSi5co().catch(console.error);

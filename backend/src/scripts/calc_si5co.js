const path = require('path');
const ExcelJS = require('exceljs');

async function calcSi5co() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'Input_DSGD_1.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  const sheet = wb.worksheets[0];

  let totalSi5coLot = 0;
  let totalSi5coVnd = 0;

  // Giả sử tỷ giá USD = 25920, doCao của SI5CO = 100
  const usdRate = 25920;
  const doCao = 100;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const maHD = String(row.getCell(7).value || '');
    const klKhop = Number(row.getCell(11).value) || 0;
    const giaKhop = Number(row.getCell(14).value) || 0;

    if (maHD.startsWith('SI5CO')) {
      totalSi5coLot += klKhop;
      const usd = klKhop * giaKhop * doCao;
      const vnd = usd * usdRate;
      totalSi5coVnd += vnd;
    }
  }

  console.log(`SI5CO Total Lot in Input_DSGD_1.xlsx: ${totalSi5coLot}`);
  console.log(`SI5CO Calculated GTGD (VND): ${totalSi5coVnd.toLocaleString('vi-VN')} VND`);
}

calcSi5co().catch(console.error);

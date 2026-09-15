const ExcelJS = require('exceljs');

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('temp/test_ms_downloads/TTTT_test.xlsx');
  const ws = wb.worksheets[0];
  console.log('Total rows:', ws.rowCount);
  
  const headers = [];
  ws.getRow(1).eachCell((c, i) => headers[i] = c.text);
  console.log('Headers:', headers);

  const accCol = headers.indexOf('Mã TKGD');
  const muaCol = headers.indexOf('KL Mua');
  const banCol = headers.indexOf('KL Bán');
  const contractCol = headers.indexOf('Mã HĐ');
  console.log(`Column indices: Mã TKGD = ${accCol}, KL Mua = ${muaCol}, KL Bán = ${banCol}`);

  let acmRows = 0, acmMua = 0, acmBan = 0;
  let nonAcmRows = 0, nonAcmMua = 0, nonAcmBan = 0;
  const accounts = {};

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const acc = (row.getCell(accCol).text || '').trim();
    const mua = parseFloat(row.getCell(muaCol).value) || 0;
    const ban = parseFloat(row.getCell(banCol).value) || 0;

    if (acc.startsWith('003C')) {
      acmRows++;
      acmMua += mua;
      acmBan += ban;
      if (!accounts[acc]) accounts[acc] = { mua: 0, ban: 0 };
      accounts[acc].mua += mua;
      accounts[acc].ban += ban;
    } else {
      nonAcmRows++;
      nonAcmMua += mua;
      nonAcmBan += ban;
    }
  }

  console.log(`\n=== KẾT QUẢ ĐỐI SOÁT TTTT VỪA TẢI TỰ ĐỘNG ===`);
  console.log(`- ACM (003C): ${acmRows} dòng | Mua: ${acmMua} lot | Bán: ${acmBan} lot`);
  console.log(`- Non-ACM   : ${nonAcmRows} dòng | Mua: ${nonAcmMua} lot | Bán: ${nonAcmBan} lot`);
  console.log(`\nChi tiết tài khoản ACM:`);
  console.table(accounts);
}

inspect();

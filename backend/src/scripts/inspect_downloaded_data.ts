import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function check() {
  const ccpPath = path.resolve(__dirname, '..', '..', 'temp', 'test_ccp_output', 'DSGD CCP.xlsx');
  const cePath = path.resolve(__dirname, '..', '..', 'temp', 'test_ce_output', 'DSGD ACM CE.xlsx');

  console.log('=== 1. KIỂM TRA FILE CCP ===');
  const ccpWb = new ExcelJS.Workbook();
  await ccpWb.xlsx.readFile(ccpPath);
  const ccpWs = ccpWb.worksheets[0];
  console.log('Sheet name:', ccpWs.name);
  console.log('Total rows:', ccpWs.rowCount);
  console.log('Headers (Row 1):', ccpWs.getRow(1).values);
  console.log('Sample Data (Row 2):', ccpWs.getRow(2).values);
  console.log('Sample Data (Row 3):', ccpWs.getRow(3).values);
  console.log('Sample Data (Row 10):', ccpWs.getRow(10).values);

  // Check unique session dates in CCP
  const dates = new Set<string>();
  const accounts = new Set<string>();
  for (let r = 2; r <= ccpWs.rowCount; r++) {
    const row = ccpWs.getRow(r);
    const dateVal = row.getCell(3).value; // Ngày phiên
    const acctVal = row.getCell(7).value; // Mã TKGD
    if (dateVal) dates.add(String(dateVal));
    if (acctVal) accounts.add(String(acctVal));
  }
  console.log('Ngày phiên trong CCP:', Array.from(dates));
  console.log('Số lượng tài khoản khác nhau:', accounts.size);
  console.log('Ví dụ tài khoản:', Array.from(accounts).slice(0, 5));

  console.log('\n=== 2. KIỂM TRA FILE CE ===');
  const ceWb = new ExcelJS.Workbook();
  await ceWb.xlsx.readFile(cePath);
  const ceWs = ceWb.worksheets[0];
  console.log('Sheet name:', ceWs.name);
  console.log('Total rows:', ceWs.rowCount);
  console.log('Headers (Row 1):', ceWs.getRow(1).values);
  console.log('Sample Data (Row 2):', ceWs.getRow(2).values);
  console.log('Sample Data (Row 3):', ceWs.getRow(3).values);

  const ceDates = new Set<string>();
  const ceAccounts = new Set<string>();
  for (let r = 2; r <= ceWs.rowCount; r++) {
    const row = ceWs.getRow(r);
    const dateVal = row.getCell(2).value; // Ngày phiên
    const acctVal = row.getCell(8).value; // Số tài khoản
    if (dateVal) ceDates.add(String(dateVal));
    if (acctVal) ceAccounts.add(String(acctVal));
  }
  console.log('Ngày phiên trong CE:', Array.from(ceDates));
  console.log('Số lượng tài khoản khác nhau:', ceAccounts.size);
  console.log('Ví dụ tài khoản:', Array.from(ceAccounts).slice(0, 5));
}

check().catch(console.error);

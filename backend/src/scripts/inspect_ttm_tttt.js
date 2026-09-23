const path = require('path');
const ExcelJS = require('exceljs');

async function inspectTtmTttt() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull');

  const ttmWb = new ExcelJS.Workbook();
  await ttmWb.xlsx.readFile(path.join(baseDir, 'Input_TTM_1.xlsx'));
  const ttmSheet = ttmWb.worksheets[0];
  console.log('--- Input_TTM_1.xlsx ---');
  console.log('Headers:', ttmSheet.getRow(1).values);
  for (let r = 2; r <= 5; r++) {
    console.log(`Row ${r}:`, ttmSheet.getRow(r).values);
  }

  const ttttWb = new ExcelJS.Workbook();
  await ttttWb.xlsx.readFile(path.join(baseDir, 'Input_TTTT_1.xlsx'));
  const ttttSheet = ttttWb.worksheets[0];
  console.log('\n--- Input_TTTT_1.xlsx ---');
  console.log('Headers:', ttttSheet.getRow(1).values);
  for (let r = 2; r <= 5; r++) {
    console.log(`Row ${r}:`, ttttSheet.getRow(r).values);
  }
}

inspectTtmTttt().catch(console.error);

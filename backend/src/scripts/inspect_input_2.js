const XLSX = require('xlsx');
const path = require('path');

const dir2 = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2');
const dsgdPath = path.join(dir2, 'Input_DSGD_2.xlsx');
const ttmPath = path.join(dir2, 'Input_TTM_2.xlsx');
const ttttPath = path.join(dir2, 'Input_TTTT_2.xlsx');

const wbDsgd = XLSX.readFile(dsgdPath);
const sheetDsgd = wbDsgd.Sheets[wbDsgd.SheetNames[0]];
const rowsDsgd = XLSX.utils.sheet_to_json(sheetDsgd, { header: 1 });
console.log('=== DSGD_2 Rows count:', rowsDsgd.length);
console.log('Row 0:', rowsDsgd[0]);
console.log('Row 1:', rowsDsgd[1]);
console.log('Row 2:', rowsDsgd[2]);

// Find dates in DSGD
const dates = new Set();
for (let i = 1; i < rowsDsgd.length; i++) {
  const r = rowsDsgd[i];
  if (r && r.length > 0) {
    // Check possible date columns
    for (let c = 0; c < r.length; c++) {
      const val = String(r[c]);
      if (val.match(/\d{4}-\d{2}-\d{2}/) || val.match(/\d{2}\/\d{2}\/\d{4}/)) {
        dates.add(`col ${c}: ${val}`);
      }
    }
  }
}
console.log('Detected dates in DSGD_2:', Array.from(dates).slice(0, 10));

const wbTtm = XLSX.readFile(ttmPath);
console.log('TTM_2 sheets:', wbTtm.SheetNames);
const wbTttt = XLSX.readFile(ttttPath);
console.log('TTTT_2 sheets:', wbTttt.SheetNames);

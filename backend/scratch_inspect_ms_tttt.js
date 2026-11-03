const XLSX = require('./node_modules/xlsx');
const path = '../tool-C#/operate-transaction-app/bin/Debug/Download/BackupMS/2025/T08.2025/01.08/TTTT.xlsx';
try {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('MS TTTT Headers:', rows[0]?.slice(0, 20));
  for (let i = 1; i <= Math.min(rows.length - 1, 3); i++) {
    console.log(`MS TTTT Row ${i}:`, rows[i]?.slice(0, 20));
  }
} catch (e) {
  console.error(e.message);
}

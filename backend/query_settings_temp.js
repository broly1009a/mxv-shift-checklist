const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T07.2026\\22.07';
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.xlsx')) continue;
    const fullPath = path.join(dir, file);
    try {
      const workbook = XLSX.readFile(fullPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length > 1) {
        const row = rows[1];
        const ngayMo = row[7];
        const maThanhVien = row[3];
        const soTKGD = row[1];
        console.log(`File: ${file} | col count: ${row.length}`);
        console.log(`  row[1] (soTKGD): ${soTKGD}`);
        console.log(`  row[3] (maThanhVien): ${maThanhVien}`);
        console.log(`  row[7] (ngayMo): ${ngayMo}`);
      }
    } catch (e) {
      console.log(`Error parsing ${file}: ${e.message}`);
    }
  }
} else {
  console.log(`Dir not found: ${dir}`);
}

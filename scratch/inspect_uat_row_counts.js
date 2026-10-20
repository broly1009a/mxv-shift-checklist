const path = require('path');
const fs = require('fs');
const ExcelJS = require(path.join(__dirname, '..', 'backend', 'node_modules', 'exceljs'));

const dir = path.join(__dirname, '..', 'data', 'test_uat_ce');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));

(async () => {
  console.log('=== THỐNG KÊ ROW COUNT DỮ LIỆU TẢI QUA API (test_uat_ce) ===');
  for (const f of files) {
    const full = path.join(dir, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(full);
    const ws = wb.worksheets[0];
    const totalRows = ws.rowCount;
    // Data rows exclude header (row 1)
    const dataRows = Math.max(0, totalRows - 1);
    const firstCell = ws.getRow(1).getCell(1).value;
    const isSpecialEmpty = firstCell && typeof firstCell === 'string' && firstCell.includes('Không có dữ liệu');
    const actualDataRows = isSpecialEmpty ? 0 : dataRows;
    console.log(`${f.padEnd(30)}: ${actualDataRows.toString().padStart(5)} dòng data | ${fs.statSync(full).size.toString().padStart(8)} bytes ${actualDataRows === 0 ? ' [FILE RỖNG 0 RECORD]' : ''}`);
  }
})();

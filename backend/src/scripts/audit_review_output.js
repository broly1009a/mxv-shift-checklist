const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function auditReviewOutput() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull');
  const reviewDir = path.join(baseDir, 'review_output');

  console.log('================================================================');
  console.log('AUDIT BÁO CÁO KẾT QUẢ ĐỐI CHIẾU VÀ ĐÁNH GIÁ ĐỘ CHÍNH XÁC');
  console.log('================================================================\n');

  // Danh sách các file kết quả cần kiểm tra
  const filesToCheck = [
    { name: 'Thong ke so lot giao dich ACM 2026.xlsx', type: 'Lot ACM' },
    { name: 'Thong ke so lot giao dich Spread 2026.xlsx', type: 'Lot Spread' },
    { name: 'Thong ke so lot giao dich LME 2026.xlsx', type: 'Lot LME' },
    { name: 'Thong ke so lot giao dich 2026.xlsx', type: 'Lot Thường (Normal)' },
    { name: 'Thong ke so lot giao dich Options 2026.xlsx', type: 'Lot Options (Bypass Test)' },
    { name: 'Thong ke gia tri giao dich ACM 2026.xlsx', type: 'GTGD ACM' },
    { name: 'Thong ke gia tri giao dich Spread 2026.xlsx', type: 'GTGD Spread' },
    { name: 'Thong ke gia tri giao dich LME 2026.xlsx', type: 'GTGD LME' },
    { name: 'Thong ke gia tri giao dich 2026.xlsx', type: 'GTGD Thường (Normal)' },
    { name: 'DSGD T09.2026 CCP.xlsx', type: 'DSGD Gộp Tháng 9' },
  ];

  for (const item of filesToCheck) {
    const filePath = path.join(reviewDir, item.name);
    if (!fs.existsSync(filePath)) {
      console.log(`[NOT FOUND] ${item.name}`);
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`FILE: ${item.name} (${item.type})`);
    console.log(`------------------------------------------------------------`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    wb.eachSheet((sheet, sheetId) => {
      console.log(`* Sheet ${sheetId}: "${sheet.name}" (Rows: ${sheet.rowCount}, Cols: ${sheet.columnCount})`);

      // Tìm hàng ngày 17/09/2026 hoặc 17/09
      let targetRowIndex = -1;
      let headerRowIndex = 4; // Mặc định hoặc dò tìm

      // Dò header row (tìm hàng chứa "Ngày" hoặc "Mã TV" / "Tổng")
      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const row = sheet.getRow(r);
        const text = row.values.join(' ');
        if (text.includes('Ngày') || text.includes('Tổng') || text.includes('003')) {
          headerRowIndex = r;
          break;
        }
      }

      // Đọc header
      const headers = {};
      const headerRow = sheet.getRow(headerRowIndex);
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? String(cell.value).trim() : '';
        if (val) headers[colNumber] = val;
      });

      // Tìm hàng ngày 17
      for (let r = 1; r <= sheet.rowCount; r++) {
        const cellVal = sheet.getRow(r).getCell(1).value;
        let dateStr = '';
        if (cellVal instanceof Date) {
          dateStr = cellVal.toISOString().slice(0, 10);
        } else if (cellVal) {
          dateStr = String(cellVal).trim();
        }

        if (dateStr.includes('17') || (cellVal instanceof Date && cellVal.getDate() === 17)) {
          targetRowIndex = r;
          break;
        }
      }

      if (targetRowIndex !== -1) {
        const targetRow = sheet.getRow(targetRowIndex);
        console.log(`  -> Tìm thấy hàng ghi dữ liệu tại Dòng ${targetRowIndex} (Ngày: ${targetRow.getCell(1).value})`);

        // Đọc các ô có giá trị trong hàng này
        const nonZeroCells = [];
        targetRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
          const colName = headers[colNum] || `Cột ${colNum}`;
          let val = cell.value;
          if (val && typeof val === 'object' && val.result !== undefined) {
            val = `Formula: ${val.formula} -> Result: ${val.result}`;
          }
          nonZeroCells.push({ colNum, colName, val, numFmt: cell.numFmt });
        });

        console.log(`  -> Chi tiết các ô có dữ liệu trên dòng ngày 17:`);
        nonZeroCells.forEach(c => {
          console.log(`     [Cột ${c.colNum.toString().padStart(2, '0')}] ${c.colName.padEnd(20, ' ')}: ${c.val} (Format: ${c.numFmt || 'None'})`);
        });
      } else {
        console.log(`  -> Không tìm thấy hàng ngày 17/09 trong sheet này (có thể là template chưa ghi hoặc bypass).`);
      }
    });
  }

  // Kiểm tra file standby Bạc thỏi
  console.log(`\n------------------------------------------------------------`);
  console.log(`KIỂM TRA FILE STANDBY BẠC THỎI (-M)`);
  console.log(`------------------------------------------------------------`);
  const standbyFiles = fs.readdirSync(reviewDir).filter(f => f.startsWith('Standby_Bac_Thoi'));
  if (standbyFiles.length > 0) {
    standbyFiles.forEach(f => {
      console.log(`Tìm thấy file Standby: ${f}`);
      const content = fs.readFileSync(path.join(reviewDir, f), 'utf-8');
      console.log(`Nội dung:\n${content}`);
    });
  } else {
    console.log(`Không có file Standby nào (Do input test không có dòng nào thuộc -M).`);
  }
}

auditReviewOutput().catch(err => {
  console.error('Audit Error:', err);
});

import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';

async function debugTttt() {
  const ttttPath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\TTTT.xlsx';
  if (!fs.existsSync(ttttPath)) {
    console.log('Không tìm thấy file TTTT.xlsx');
    return;
  }
  const buf = fs.readFileSync(ttttPath);
  const sheet = await parseExcelBuffer(buf);
  console.log(`Đã đọc được ${sheet.rows.length} dòng từ TTTT.xlsx`);
  
  if (sheet.rows.length > 0) {
    console.log('Tiêu đề cột nhận diện được:', Object.keys(sheet.rows[0]));
  }

  // Tìm các dòng LME (kết thúc bằng L)
  const lmeRows = sheet.rows.filter((r: any) => {
    const acc = String(r['Mã TKGD'] ?? r['col8'] ?? '').trim().toUpperCase();
    return acc.endsWith('L');
  });

  console.log(`\nTìm thấy ${lmeRows.length} dòng LME:`);
  lmeRows.forEach((r, idx) => {
    console.log(`Dòng ${idx + 1}:`, JSON.stringify(r));
  });
}

debugTttt().catch(console.error);

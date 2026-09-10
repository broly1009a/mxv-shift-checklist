import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

/**
 * Script kiểm tra chi tiết logic tính toán TTTT của ACM
 * Đối chiếu giữa C# IT Tool gốc (line 345) và thực tế file M-System
 */

async function main() {
  console.log('========================================================================');
  console.log('🔍 KIỂM TRA ĐỐI CHIẾU LOGIC TÍNH TTTT CỦA ACM (M-SYSTEM)');
  console.log('========================================================================\n');

  const baseDir = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T09.2026\\10.09';
  const filePath = path.join(baseDir, 'TTTT.xlsx');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file: ${filePath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const header = rows[0].map((h) => String(h || '').trim());
  const accIdx = header.indexOf('Mã TKGD');
  const symIdx = header.indexOf('Mã HĐ');
  const muaIdx = header.indexOf('KL Mua');
  const banIdx = header.indexOf('KL Bán');

  console.log(` File kiểm tra: ${filePath}`);
  console.log(`📊 Tổng số dòng dữ liệu: ${rows.length - 1}`);
  console.log(`📌 Cột nhận diện: Mã TKGD (col ${accIdx}), Mã HĐ (col ${symIdx}), KL Mua (col ${muaIdx}), KL Bán (col ${banIdx})\n`);

  let acmBan = 0;
  let acmMua = 0;
  let nonBan = 0;
  let nonMua = 0;

  const acmDetailMap: Record<string, { mua: number; ban: number; total: number }> = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const acc = String(r[accIdx] || '').trim().toUpperCase();
    const mua = parseFloat(r[muaIdx]) || 0;
    const ban = parseFloat(r[banIdx]) || 0;

    if (acc.endsWith('A')) {
      acmBan += ban;
      acmMua += mua;

      if (!acmDetailMap[acc]) acmDetailMap[acc] = { mua: 0, ban: 0, total: 0 };
      acmDetailMap[acc].mua += mua;
      acmDetailMap[acc].ban += ban;
      acmDetailMap[acc].total += (mua + ban);
    } else {
      nonBan += ban;
      nonMua += mua;
    }
  }

  console.log('------------------------------------------------------------------------');
  console.log('📌 KẾT QUẢ TÍNH TOÁN CỦA KHỐI ACM (TÀI KHOẢN ĐUÔI A):');
  console.log('------------------------------------------------------------------------');
  console.log(`1. Cách C# IT Tool dòng 345 (Chỉ cộng KL Bán):           ${acmBan.toLocaleString()} lot`);
  console.log(`2. Chiều ngược lại (Chỉ cộng KL Mua):                    ${acmMua.toLocaleString()} lot`);
  console.log(`3. Tổng khối lượng tất toán thực tế (Cả Mua + Bán):      ${(acmBan + acmMua).toLocaleString()} lot\n`);

  console.log('------------------------------------------------------------------------');
  console.log('📌 KẾT QUẢ TÍNH TOÁN CỦA KHỐI THƯỜNG (NON-A):');
  console.log('------------------------------------------------------------------------');
  console.log(`1. Cách C# IT Tool dòng 349 (Chỉ cộng KL Bán):           ${nonBan.toLocaleString()} lot`);
  console.log(`2. Chiều ngược lại (Chỉ cộng KL Mua):                    ${nonMua.toLocaleString()} lot`);
  console.log(`3. Tổng khối lượng tất toán thực tế (Cả Mua + Bán):      ${(nonBan + nonMua).toLocaleString()} lot\n`);

  console.log('------------------------------------------------------------------------');
  console.log('📋 TOP 5 TÀI KHOẢN ACM CÓ KHỐI LƯỢNG TẤT TOÁN LỚN NHẤT PHIÊN:');
  console.log('------------------------------------------------------------------------');
  const sortedAcm = Object.entries(acmDetailMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  sortedAcm.forEach(([acc, d], idx) => {
    console.log(`  [${idx + 1}] TK ${acc}: KL Mua = ${d.mua.toLocaleString()} lot | KL Bán = ${d.ban.toLocaleString()} lot => Tổng = ${d.total.toLocaleString()} lot`);
  });

  console.log('\n========================================================================');
  console.log('🎯 ĐÁNH GIÁ NGUYÊN NHÂN BUG:');
  console.log('• Trong C# IT Tool dòng 276-277 (TTM - Trạng thái mở):');
  console.log('    totalACM += tongBan;');
  console.log('    totalACM += tongMua;  <-- TTM cộng ĐỦ cả Mua và Bán.');
  console.log('• Nhưng ở dòng 343-350 (TTTT - Trạng thái tất toán):');
  console.log('    totalACM += tongBan;   <-- TTTT chỉ cộng tongBan, BỎ QUÊN tongMua!');
  console.log('• Kết quả:');
  console.log(`    - Nếu theo C# gốc:            ${acmBan.toLocaleString()} lot`);
  console.log(`    - Nếu tính đủ cả 2 chiều:     ${(acmBan + acmMua).toLocaleString()} lot`);
  console.log('========================================================================\n');
}

main().catch(console.error);

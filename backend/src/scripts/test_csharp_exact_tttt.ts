import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script kiểm tra chi tiết logic C# gốc (TransactionCheckingService.cs & FileUtils.cs)
 * đối với file TTTT.xlsx của M-System.
 * 
 * Logic C# chuẩn (TransactionCheckingService.cs dòng 341-351):
 * foreach (var (maTKGD, maHD, tongLaiLoUSD, tongMua, tongBan) in ttttData)
 * {
 *     if (maTKGD.EndsWith("A"))
 *     {
 *         totalACM += tongBan; // Dòng 345 C#
 *     }
 *     else
 *     {
 *         totalTTTT += tongBan;
 *     }
 * }
 */

interface TTTTRow {
  rowIdx: number;
  maTKGD: string;
  maHD: string;
  tongLaiLoUSD: number;
  tongMua: number;
  tongBan: number;
}

function analyzeTTTTFile(filePath: string, label: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📂 PHÂN TÍCH FILE: [${label}]`);
  console.log(`Đường dẫn: ${filePath}`);
  console.log(`${'='.repeat(70)}`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File không tồn tại!`);
    return;
  }

  const stat = fs.statSync(filePath);
  console.log(`Dung lượng file: ${(stat.size / 1024).toFixed(1)} KB, Chỉnh sửa lần cuối: ${stat.mtime.toLocaleString('vi-VN')}`);

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  console.log(`Tổng số dòng thô trong Sheet [${sheetName}]: ${rawRows.length}`);

  // Tìm dòng tiêu đề (Header row) giống C# FileUtils.cs
  let maTKGDIndex = -1;
  let maHDIndex = -1;
  let tongLaiLoUSDIndex = -1;
  let tongMuaIndex = -1;
  let tongBanIndex = -1;
  let headerRow = -1;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    for (let c = 0; c < row.length; c++) {
      const cellText = String(row[c] || '').trim().toLowerCase();
      if (cellText === 'mã tkgd') maTKGDIndex = c;
      if (cellText === 'mã hđ') maHDIndex = c;
      if (cellText === 'lãi lỗ thực tế') tongLaiLoUSDIndex = c;
      if (cellText === 'kl mua') tongMuaIndex = c;
      if (cellText === 'kl bán') tongBanIndex = c;
    }
    if (maTKGDIndex !== -1 && maHDIndex !== -1 && tongBanIndex !== -1) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === -1) {
    console.log(`❌ Không tìm thấy dòng tiêu đề chuẩn M-System trong 10 dòng đầu!`);
    return;
  }

  console.log(`✅ Tìm thấy tiêu đề tại dòng ${headerRow + 1} (index ${headerRow}):`);
  console.log(`   - Cột [Mã TKGD] : Index ${maTKGDIndex}`);
  console.log(`   - Cột [Mã HĐ]   : Index ${maHDIndex}`);
  console.log(`   - Cột [KL Mua]   : Index ${tongMuaIndex}`);
  console.log(`   - Cột [KL Bán]   : Index ${tongBanIndex}`);
  console.log(`   - Cột [Lãi lỗ]   : Index ${tongLaiLoUSDIndex}`);

  const allRows: TTTTRow[] = [];
  const acmRows: TTTTRow[] = [];
  const nonAcmRows: TTTTRow[] = [];

  for (let r = headerRow + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const maTKGD = String(row[maTKGDIndex] || '').trim();
    const maHD = String(row[maHDIndex] || '').trim();

    if (!maTKGD || !maHD) continue;

    const tongMua = parseFloat(String(row[tongMuaIndex] || '0').replace(/,/g, '')) || 0;
    const tongBan = parseFloat(String(row[tongBanIndex] || '0').replace(/,/g, '')) || 0;
    const tongLaiLoUSD = parseFloat(String(row[tongLaiLoUSDIndex] || '0').replace(/,/g, '')) || 0;

    const item: TTTTRow = { rowIdx: r + 1, maTKGD, maHD, tongLaiLoUSD, tongMua, tongBan };
    allRows.push(item);

    if (maTKGD.endsWith('A') || maTKGD.endsWith('a')) {
      acmRows.push(item);
    } else {
      nonAcmRows.push(item);
    }
  }

  // 1. TỔNG KẾT THEO ĐÚNG CODE C# (TransactionCheckingService.cs)
  let totalACM_Csharp = 0; // line 345: totalACM += tongBan
  let totalACM_tongMua = 0;
  let totalTTTT_Csharp = 0; // line 349: totalTTTT += tongBan
  let totalTTTT_tongMua = 0;

  for (const row of acmRows) {
    totalACM_Csharp += row.tongBan;
    totalACM_tongMua += row.tongMua;
  }
  for (const row of nonAcmRows) {
    totalTTTT_Csharp += row.tongBan;
    totalTTTT_tongMua += row.tongMua;
  }

  console.log(`\n📊 KẾT QUẢ TÍNH THEO CÔNG THỨC C# GỐC (Dòng 341-351):`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`• TTTT M-System thường (Non-ACM) [totalTTTT += tongBan] : ${totalTTTT_Csharp.toLocaleString('vi-VN')} lot`);
  console.log(`• TTTT M-System thường (Non-ACM) [tongMua]              : ${totalTTTT_tongMua.toLocaleString('vi-VN')} lot`);
  console.log(`• TTTT ACM (Mã tận cùng 'A')   [totalACM += tongBan]    : ${totalACM_Csharp.toLocaleString('vi-VN')} lot (Số C# hiển thị)`);
  console.log(`• TTTT ACM (Mã tận cùng 'A')   [tongMua]                : ${totalACM_tongMua.toLocaleString('vi-VN')} lot`);
  console.log(`• TTTT ACM Tổng (tongMua + tongBan)                     : ${(totalACM_Csharp + totalACM_tongMua).toLocaleString('vi-VN')} lot`);
  console.log(`• Tổng số bản ghi ACM: ${acmRows.length} dòng / Tổng số bản ghi file: ${allRows.length} dòng`);

  // 2. PHÂN TÍCH CHI TIẾT TÀI KHOẢN ACM (Xem có tài khoản hoặc mã hàng nào ra ~250 không)
  console.log(`\n🔍 PHÂN TÍCH TỪNG TÀI KHOẢN ACM:`);
  const accMap: Record<string, { count: number, tongBan: number, tongMua: number, sum: number }> = {};
  for (const row of acmRows) {
    if (!accMap[row.maTKGD]) accMap[row.maTKGD] = { count: 0, tongBan: 0, tongMua: 0, sum: 0 };
    accMap[row.maTKGD].count++;
    accMap[row.maTKGD].tongBan += row.tongBan;
    accMap[row.maTKGD].tongMua += row.tongMua;
    accMap[row.maTKGD].sum += (row.tongBan + row.tongMua);
  }
  console.table(accMap);

  // 3. PHÂN TÍCH CHI TIẾT THEO MÃ HÀNG HÓA NANO (SI5CO, PL1NY, CP2CO...)
  console.log(`\n🔍 PHÂN TÍCH THEO MÃ MẶT HÀNG (COMMODITY):`);
  const commMap: Record<string, { count: number, tongBan: number, tongMua: number, sum: number }> = {};
  for (const row of acmRows) {
    const prefix = row.maHD.substring(0, 5) || row.maHD;
    if (!commMap[prefix]) commMap[prefix] = { count: 0, tongBan: 0, tongMua: 0, sum: 0 };
    commMap[prefix].count++;
    commMap[prefix].tongBan += row.tongBan;
    commMap[prefix].tongMua += row.tongMua;
    commMap[prefix].sum += (row.tongBan + row.tongMua);
  }
  console.table(commMap);

  // 4. KIỂM TRA CÁC GIÁ TRỊ GẦN ~250
  console.log(`\n🎯 TÌM KIẾM CÁC CON SỐ ~250 (HAI TRĂM NĂM MẤY):`);
  let foundMatch = false;
  for (const [k, v] of Object.entries(accMap)) {
    if (v.tongBan >= 200 && v.tongBan <= 300) {
      console.log(`   👉 Tài khoản ${k} có KL Bán = ${v.tongBan} (khớp tầm ~250)!`);
      foundMatch = true;
    }
  }
  for (const [k, v] of Object.entries(commMap)) {
    if (v.tongBan >= 200 && v.tongBan <= 300) {
      console.log(`   👉 Mặt hàng ${k} có KL Bán = ${v.tongBan} (khớp tầm ~250)!`);
      foundMatch = true;
    }
    if (v.tongMua >= 200 && v.tongMua <= 300) {
      console.log(`   👉 Mặt hàng ${k} có KL Mua = ${v.tongMua} (khớp tầm ~250)!`);
      foundMatch = true;
    }
  }
  if (!foundMatch) {
    console.log(`   (Không có mặt hàng hay tài khoản đơn lẻ nào của ngày này có KL Bán nằm trong khoảng 200 - 300)`);
  }
}

// Chạy phân tích trên các ngày gần nhất
const baseDir = `C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T09.2026`;

const datesToCheck = ['10.09', '09.09', '05.09', '03.09'];

for (const d of datesToCheck) {
  const fPath = path.join(baseDir, d, 'TTTT.xlsx');
  analyzeTTTTFile(fPath, `Phiên ngày ${d}`);
}

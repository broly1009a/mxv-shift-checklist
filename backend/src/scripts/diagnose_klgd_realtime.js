const path = require('path');
const fs = require('fs');

/**
 * Script Chẩn Đoán Lệch KLGD & TTTT (Đối Chiếu Trong Phiên)
 * Kiểm tra trực tiếp các file backup thực tế giữa M-System và CQG.
 */

const baseMs = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T09.2026\\09.09';
const baseCqg = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures\\2026\\T09.2026\\09.09';

console.log('='.repeat(90));
console.log('🔎 CHẨN ĐOÁN CHI TIẾT LỆCH KHỚP LỆNH & TẤT TOÁN (NGÀY 09.09)');
console.log('='.repeat(90));

function inspectDir(title, dirPath) {
  console.log(`\n ${title}: ${dirPath}`);
  if (!fs.existsSync(dirPath)) {
    console.log('    Thư mục không tồn tại!');
    return [];
  }
  const files = fs.readdirSync(dirPath);
  const details = files.map(f => {
    const stat = fs.statSync(path.join(dirPath, f));
    return {
      name: f,
      size: (stat.size / 1024).toFixed(1) + ' KB',
      sizeBytes: stat.size,
      mtime: stat.mtime.toLocaleString('vi-VN')
    };
  });
  console.table(details);
  return details;
}

const msFiles = inspectDir('M-SYSTEM BACKUP (09.09)', baseMs);
const cqgFiles = inspectDir('CQG BACKUP (09.09)', baseCqg);

// Phân tích thời gian sửa đổi giữa file gộp và file thô
const frMerged = cqgFiles.find(f => f.name === 'FR.xlsx');
const fr1 = cqgFiles.find(f => f.name === 'FR1.xlsx');
const fr2 = cqgFiles.find(f => f.name === 'FR2.xlsx');

console.log('\n🔍 PHÂN TÍCH ĐỒNG BỘ FILE CQG (FILE GỘP VS FILE THÔ):');
if (frMerged && fr1 && fr2) {
  console.log(`   - FR.xlsx (File gộp):   Sửa đổi lúc ${frMerged.mtime} (${frMerged.size})`);
  console.log(`   - FR1.xlsx (File thô 1): Sửa đổi lúc ${fr1.mtime} (${fr1.size})`);
  console.log(`   - FR2.xlsx (File thô 2): Sửa đổi lúc ${fr2.mtime} (${fr2.size})`);
  const mtimeFR = fs.statSync(path.join(baseCqg, 'FR.xlsx')).mtimeMs;
  const mtimeFR1 = fs.statSync(path.join(baseCqg, 'FR1.xlsx')).mtimeMs;
  const mtimeFR2 = fs.statSync(path.join(baseCqg, 'FR2.xlsx')).mtimeMs;
  if (mtimeFR < mtimeFR1 || mtimeFR < mtimeFR2) {
    console.log('    BÁO ĐỘNG: File gộp FR.xlsx CŨ HƠN file thô FR1/FR2!');
    console.log('      → Bot đã bỏ qua bước ghép file vì tưởng FR.xlsx "đã tồn tại hôm nay".');
    console.log('      → Hậu quả: Đối chiếu DSGD mới nhất với FR.xlsx cũ dẫn đến hàng ngàn lệnh lệch giả!');
  } else {
    console.log('    File FR.xlsx đã mới hơn file thô.');
  }
}

const psMerged = cqgFiles.find(f => f.name === 'PS.xlsx');
const ps1 = cqgFiles.find(f => f.name === 'PS1.xlsx');
const ps2 = cqgFiles.find(f => f.name === 'PS2.xlsx');

if (psMerged && ps1 && ps2) {
  console.log(`\n   - PS.xlsx (File gộp):   Sửa đổi lúc ${psMerged.mtime} (${psMerged.size})`);
  console.log(`   - PS1.xlsx (File thô 1): Sửa đổi lúc ${ps1.mtime} (${ps1.size})`);
  console.log(`   - PS2.xlsx (File thô 2): Sửa đổi lúc ${ps2.mtime} (${ps2.size})`);
  const mtimePS = fs.statSync(path.join(baseCqg, 'PS.xlsx')).mtimeMs;
  const mtimePS1 = fs.statSync(path.join(baseCqg, 'PS1.xlsx')).mtimeMs;
  const mtimePS2 = fs.statSync(path.join(baseCqg, 'PS2.xlsx')).mtimeMs;
  if (mtimePS < mtimePS1 || mtimePS < mtimePS2) {
    console.log('    BÁO ĐỘNG: File gộp PS.xlsx CŨ HƠN file thô PS1/PS2!');
    console.log('      → Bot bỏ qua ghép PS.xlsx khiến dữ liệu Tất toán TTTT bị lệch hàng trăm tài khoản!');
  } else {
    console.log('    File PS.xlsx đã mới hơn file thô.');
  }
}

const fs = require('fs');
const path = require('path');

// Target base directory
const baseDir = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong';
const srcDateStr = '08.07';

// Calculate today (T), yesterday (T-1), and day-before-yesterday (T-2)
const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const dayBefore = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

// Helper to format date parts
function formatDateParts(date) {
  const yyyy = date.getFullYear().toString();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = yyyy.substring(2);
  return { yyyy, mm, dd, yy };
}

const T = formatDateParts(today);
const T1 = formatDateParts(yesterday);
const T2 = formatDateParts(dayBefore);

const destDateStr = `${T.dd}.${T.mm}`;
const destYear = T.yyyy;
const destMonthYear = `T${T.mm}.${T.yyyy}`;

console.log(`\n======================================================`);
console.log(`ĐANG GIẢ LẬP DỮ LIỆU CHO NGÀY HÔM NAY: ${T.dd}/${T.mm}/${T.yyyy}`);
console.log(`- Ngày hôm nay (T): ${T.dd}.${T.mm}.${T.yyyy}`);
console.log(`- Ngày hôm qua (T-1): ${T1.dd}.${T1.mm}.${T1.yyyy}`);
console.log(`- Ngày hôm kia (T-2): ${T2.dd}.${T2.mm}.${T2.yyyy}`);
console.log(`======================================================\n`);

const srcFolderMs = path.join(baseDir, 'Backup MS', 'Futures', '2026', 'T07.2026', srcDateStr);
const destFolderMs = path.join(baseDir, 'Backup MS', 'Futures', destYear, destMonthYear, destDateStr);

const srcFolderCqg = path.join(baseDir, 'Backup CQG', 'Futures', '2026', 'T07.2026', srcDateStr);
const destFolderCqg = path.join(baseDir, 'Backup CQG', 'Futures', destYear, destMonthYear, destDateStr);

const srcFolderAcm = path.join(baseDir, 'Backup MS', 'ACM', '2026', 'T07.2026', srcDateStr);
const destFolderAcm = path.join(baseDir, 'Backup MS', 'ACM', destYear, destMonthYear, destDateStr);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[+] Tạo thư mục: ${dir}`);
  }
}

function copyFiles(srcDir, destDir, renameFn) {
  if (!fs.existsSync(srcDir)) {
    console.error(`[-] Thư mục nguồn không tồn tại: ${srcDir}`);
    return;
  }
  ensureDir(destDir);
  const files = fs.readdirSync(srcDir);
  let count = 0;
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    
    // Bỏ qua các file nháp Excel tạm thời
    if (file.startsWith('~$')) {
      continue;
    }

    let destName = file;
    if (renameFn) {
      destName = renameFn(file);
    }
    const destPath = path.join(destDir, destName);
    fs.copyFileSync(srcPath, destPath);
    count++;
  }
  console.log(`[✓] Đã copy thành công ${count} file tới: ${destDir}`);
}

// 1. Copy MS Futures
console.log('[1/3] Đang xử lý file Backup MS Futures...');
copyFiles(srcFolderMs, destFolderMs, (filename) => {
  if (filename.includes('06.07.26')) {
    return filename.replace('06.07.26', `${T2.dd}.${T2.mm}.${T2.yy}`);
  }
  if (filename.includes('2026-07-06')) {
    return filename.replace('2026-07-06', `${T2.yyyy}-${T2.mm}-${T2.dd}`);
  }
  return filename;
});

// 2. Copy CQG Futures
console.log('\n[2/3] Đang xử lý file Backup CQG...');
copyFiles(srcFolderCqg, destFolderCqg);

// 3. Copy ACM
console.log('\n[3/3] Đang xử lý file Backup ACM...');
copyFiles(srcFolderAcm, destFolderAcm, (filename) => {
  if (filename.includes('2026-07-07')) {
    return filename.replace('2026-07-07', `${T.yyyy}-${T.mm}-${T.dd}`);
  }
  if (filename.includes('07072026')) {
    return filename.replace('07072026', `${T.dd}${T.mm}${T.yyyy}`);
  }
  return filename;
});

console.log(`\n======================================================`);
console.log(`🎉 HOÀN THÀNH GIẢ LẬP DỮ LIỆU NGÀY HÔM NAY THÀNH CÔNG!`);
console.log(`======================================================\n`);

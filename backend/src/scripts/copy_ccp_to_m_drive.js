const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../modules/ccp-statistics/inputExampleCppFull_2/review_output');
const srcInputDir = path.resolve(__dirname, '../modules/ccp-statistics/inputExampleCppFull_2');
const destDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp';

console.log('Source Dir:', srcDir);
console.log('Dest Dir:', destDir);

if (!fs.existsSync(destDir)) {
  console.error('Destination directory does not exist: ' + destDir);
  process.exit(1);
}

// 1. Backup các file cũ trong destDir
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(destDir, 'Backup_Snapshots', timestamp);
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const existingFiles = fs.readdirSync(destDir);
for (const f of existingFiles) {
  if (f.endsWith('.xlsx')) {
    fs.copyFileSync(path.join(destDir, f), path.join(backupDir, f));
    console.log(`Backed up old file: ${f}`);
  }
}

// 2. Copy toàn bộ 11 file kết quả vào destDir
const resultFiles = fs.readdirSync(srcDir);
for (const f of resultFiles) {
  if (f.endsWith('.xlsx')) {
    const srcFile = path.join(srcDir, f);
    const destFile = path.join(destDir, f);
    fs.copyFileSync(srcFile, destFile);
    console.log(`✓ Copied to M:\\: ${f} (${fs.statSync(destFile).size} bytes)`);
  }
}

// 3. Đồng bộ vào thư mục output nếu có
const outputSubdir = path.join(destDir, 'output');
if (fs.existsSync(outputSubdir)) {
  for (const f of resultFiles) {
    if (f.endsWith('.xlsx')) {
      fs.copyFileSync(path.join(srcDir, f), path.join(outputSubdir, f));
    }
  }
  console.log('✓ Synchronized to output subfolder.');
}

// 4. Đồng bộ file input mới vào thư mục input
const inputSubdir = path.join(destDir, 'input');
if (fs.existsSync(inputSubdir)) {
  const inputFiles = fs.readdirSync(srcInputDir);
  for (const f of inputFiles) {
    if (f.endsWith('.xlsx')) {
      fs.copyFileSync(path.join(srcInputDir, f), path.join(inputSubdir, f));
      console.log(`✓ Updated input file in M:\\: ${f}`);
    }
  }
}

console.log('\n=== HOÀN TẤT TẠO TOÀN BỘ FILE THỐNG KÊ CCP TRÊN Ổ M: ===');

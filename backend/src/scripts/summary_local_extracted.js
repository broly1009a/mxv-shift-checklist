const fs = require('fs');
const path = require('path');

// We have rendered pages or images for all 14 accounts in backend/src/scripts/extracted_cccd_local
const baseDir = path.join(__dirname, 'extracted_cccd_local');
const dirs = fs.readdirSync(baseDir);

console.log('=== SUMMARY OF EXTRACTED FILES PER ACCOUNT ===');
dirs.forEach(code => {
  const p = path.join(baseDir, code);
  if (fs.statSync(p).isDirectory()) {
    const files = fs.readdirSync(p);
    console.log(`[${code}]:`);
    files.forEach(f => {
      const sz = Math.round(fs.statSync(path.join(p, f)).size / 1024);
      console.log(`   - ${f} (${sz} KB)`);
    });
  }
});

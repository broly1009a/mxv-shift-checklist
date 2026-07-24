const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T07.2026\\24.07';

if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  console.log(`Directory exists. Total files: ${files.length}`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(dir, f));
    console.log(`- ${f} (${stat.size} bytes, mtime: ${stat.mtime.toISOString()})`);
  });
} else {
  console.log(`Directory does NOT exist: ${dir}`);
}

const fs = require('fs');
const path = require('path');

function searchFiles(dir, pattern) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (err) {
        continue; // skip files we can't access
      }
      
      if (stat.isDirectory()) {
        // avoid deep scanning system dirs or node_modules
        if (file === 'node_modules' || file === '.git' || file === 'AppData') continue;
        results = results.concat(searchFiles(filePath, pattern));
      } else if (pattern.test(file) || pattern.test(filePath)) {
        results.push({ path: filePath, size: stat.size, mtime: stat.mtime });
      }
    }
  } catch (e) {}
  return results;
}

const searchPattern = /(?:22\.07|22072026|20260722|2026-07-22)/;
console.log('Searching for files matching 22.07 / 22072026 / 20260722 / 2026-07-22 in Downloads...');
const found = searchFiles('C:\\Users\\hiepth\\Downloads', searchPattern);
found.sort((a, b) => b.mtime - a.mtime);
found.slice(0, 30).forEach(f => {
  console.log(`- Path: ${f.path} | Size: ${f.size} | Modified: ${f.mtime.toLocaleString()}`);
});

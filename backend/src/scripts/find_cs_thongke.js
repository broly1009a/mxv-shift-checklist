const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\it-tool-src\\operate-transaction-app';

function searchFiles(dir, pattern) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'bin' && f.name !== 'obj' && f.name !== '.git') {
        searchFiles(full, pattern);
      }
    } else if (f.name.endsWith('.cs') || f.name.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf8');
      if (pattern.test(content)) {
        console.log(`Matched in: ${full}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            console.log(`  L${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching for Thong ke in C# files...');
searchFiles(targetDir, /Thong ke|thống kê|ThongKe|BackupService|Thong ke so lot/i);

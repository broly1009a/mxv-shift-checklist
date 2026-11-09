const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCAN_DIRS = [
  path.join(ROOT_DIR, 'backend', 'src'),
  path.join(ROOT_DIR, 'frontend', 'src'),
];

// Patterns to detect
const AUDIT_RULES = [
  {
    category: '1. HARDCODED_ABSOLUTE_WINDOWS_PATH',
    pattern: /['"`][A-Za-z]:\\[^'"`\n]+['"`]|['"`][A-Za-z]:\/[^'"`\n]+['"`]/g,
    ignorePattern: /node_modules|\.git|dist|\.next|\.env|\.example|file-path\.helper\.ts/i,
    description: 'Đường dẫn ổ đĩa tuyệt đối Windows (C:\\, M:\\...) trong code',
  },
  {
    category: '2. HARDCODED_LINUX_MOUNT_PATH',
    pattern: /['"`]\/mnt\/qlgd-it[^'"`\n]*['"`]/g,
    ignorePattern: /node_modules|\.git|dist|\.next|\.env|\.example|file-path\.helper\.ts|deploy|scratch/i,
    description: 'Đường dẫn mount tĩnh Linux (/mnt/qlgd-it) không qua SystemSettings / process.env',
  },
  {
    category: '3. SPECULATIVE_PATH_REGEX_REPLACE',
    pattern: /\.replace\(\s*\/\[?[\\/]?Backup\s+(?:MS|CQG|CCP|ACM|CE)/gi,
    ignorePattern: /node_modules|\.git|dist|\.next/i,
    description: 'Regex thay thế chuỗi phỏng đoán trên đường dẫn Backup',
  },
  {
    category: '4. HARDCODED_CURRENCY_ARRAY',
    pattern: /\[\s*['"`]USD\/VND['"`]\s*,\s*['"`]JPY\/VND['"`]/g,
    ignorePattern: /node_modules|\.git|dist|\.next/i,
    description: 'Mảng danh sách ngoại tệ gán chết tĩnh',
  },
  {
    category: '5. HARDCODED_IP_ADDRESS',
    pattern: /['"`]10\.0\.0\.26['"`]|https?:\/\/10\.0\.0\.26(?!:\d+\/api)/g,
    ignorePattern: /node_modules|\.git|dist|\.next|\.env|\.example|scratch|ssh/i,
    description: 'IP máy chủ 10.0.0.26 hardcode thay vì dùng biến môi trường hoặc cấu hình',
  },
];

const findings = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.next' || f === 'dist' || f === '.git' || f === 'legacy') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(f)) {
      scanFile(full);
    }
  }
}

function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const rule of AUDIT_RULES) {
    if (rule.ignorePattern && rule.ignorePattern.test(relPath)) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      const matches = line.match(rule.pattern);
      if (matches) {
        findings.push({
          category: rule.category,
          description: rule.description,
          file: relPath,
          line: i + 1,
          codeSnippet: trimmed,
          matches,
        });
      }
    }
  }
}

console.log('='.repeat(90));
console.log('         LOOP ENGINEERING HARDCODE AUDIT ENGINE (MXV SHIFT SYSTEM)');
console.log('='.repeat(90));
console.log('Đang quét toàn diện backend/src và frontend/src...\n');

for (const d of SCAN_DIRS) {
  if (fs.existsSync(d)) walk(d);
}

// Group findings by category
const byCategory = {};
findings.forEach((f) => {
  if (!byCategory[f.category]) byCategory[f.category] = [];
  byCategory[f.category].push(f);
});

console.log(`TỔNG CỘNG PHÁT HIỆN: ${findings.length} ĐIỂM CẦN LƯU Ý/XỬ LÝ\n`);

for (const [cat, items] of Object.entries(byCategory)) {
  console.log(`[${cat}] -> ${items.length} phát hiện:`);
  items.slice(0, 15).forEach((item) => {
    console.log(`   - ${item.file}:${item.line}`);
    console.log(`     Code: ${item.codeSnippet}`);
  });
  if (items.length > 15) {
    console.log(`   ... và ${items.length - 15} vị trí khác.`);
  }
  console.log('-'.repeat(90));
}

// Save complete json report
fs.writeFileSync(
  path.join(__dirname, 'hardcode_audit_report.json'),
  JSON.stringify(findings, null, 2),
  'utf8'
);
console.log(`Đã xuất báo cáo chi tiết ra: scratch/hardcode_audit_report.json`);

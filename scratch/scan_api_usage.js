const fs = require('fs');
const path = require('path');

function getAllFiles(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist' || file === 'legacy') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, filter));
    } else if (filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Lấy tất cả file frontend (.tsx, .ts, .js)
const frontendFiles = getAllFiles('frontend/src', f => /\.(tsx?|jsx?)$/.test(f));
console.log('Frontend active files:', frontendFiles.length);

// Đọc toàn bộ nội dung frontend vào 1 chuỗi để đối soát regex
let allFrontendText = '';
frontendFiles.forEach(f => {
  allFrontendText += ' ' + fs.readFileSync(f, 'utf8');
});

// 2. Phân tích các controllers trong backend
const controllerFiles = getAllFiles('backend/src', f => f.endsWith('.controller.ts'));

const endpoints = [];

controllerFiles.forEach(cFile => {
  const content = fs.readFileSync(cFile, 'utf8');
  // Lấy prefix controller: @Controller('...')
  const controllerMatch = content.match(/@Controller\((?:['"`](.*?)['"`])?\)/);
  const basePrefix = controllerMatch && controllerMatch[1] ? controllerMatch[1].replace(/^\/|\/$/g, '') : '';

  // Tìm các phương thức @Get, @Post, @Put, @Delete, @Patch
  const routeRegex = /@(Get|Post|Put|Delete|Patch)\((?:['"`](.*?)['"`])?\)\s*(?:@.*?\s*)*(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const subPath = (match[2] || '').replace(/^\/|\/$/g, '');
    const functionName = match[3];

    // Tạo đường dẫn API tương đối
    const fullRoute = [basePrefix, subPath].filter(Boolean).join('/');
    
    // Tìm line number
    const lineNum = content.substring(0, match.index).split('\n').length;

    endpoints.push({
      file: cFile,
      line: lineNum,
      method,
      controllerPrefix: basePrefix,
      subPath,
      fullRoute,
      functionName,
    });
  }
});

console.log(`Extracted ${endpoints.length} endpoints from ${controllerFiles.length} controllers.`);

// 3. Kiểm tra xem route có xuất hiện trong Frontend không
const results = endpoints.map(ep => {
  // Các từ khóa nhận diện:
  // - subPath đặc trưng (ví dụ: 'run-test-local', 'sample-dates')
  // - fullRoute hoặc một phần độc nhất của route
  // - functionName (nếu là gọi API client sinh sẵn)
  
  let isReferenced = false;
  let matchReason = '';

  // 1. Kiểm tra subPath nếu có độ dài > 3 ký tự và không phải param như :id
  if (ep.subPath && !ep.subPath.startsWith(':') && ep.subPath.length > 3) {
    // Escape regex
    const cleanSub = ep.subPath.split('/')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanSub && allFrontendText.includes(cleanSub)) {
      isReferenced = true;
      matchReason = `Matched subPath keyword: '${cleanSub}'`;
    }
  }

  // 2. Kiểm tra controllerPrefix nếu subPath rỗng
  if (!isReferenced && ep.controllerPrefix) {
    const cleanPrefix = ep.controllerPrefix.split('/')[0];
    if (cleanPrefix && allFrontendText.includes(cleanPrefix)) {
      // prefix có mặt, kiểm tra sâu hơn xem có endpoint cụ thể không
      // Nếu subPath rỗng (ví dụ: GET /api/v1/users) thì chỉ cần prefix
      if (!ep.subPath) {
        isReferenced = true;
        matchReason = `Matched controller prefix: '${cleanPrefix}'`;
      }
    }
  }

  // 3. Kiểm tra các route có chữ 'test', 'sample', 'mock', 'tmp', 'dummy', 'debug'
  const isLikelyTest = /(test|sample|mock|debug|dummy|temp)/i.test(ep.subPath) || /(test|sample|mock|debug|dummy|temp)/i.test(ep.functionName);

  return {
    ...ep,
    isReferenced,
    matchReason,
    isLikelyTest
  };
});

const unreferenced = results.filter(r => !r.isReferenced);
const testEndpoints = results.filter(r => r.isLikelyTest);

console.log(`\n--- PHÂN TÍCH ---`);
console.log(`Total Endpoints: ${results.length}`);
console.log(`Unreferenced in Frontend: ${unreferenced.length}`);
console.log(`Likely Test Endpoints: ${testEndpoints.length}`);

fs.writeFileSync('scratch/api_usage_scan.json', JSON.stringify({
  total: results.length,
  unreferenced,
  testEndpoints,
  all: results
}, null, 2));

console.log('\n--- CÁC ENDPOINT TEST HOẶC TẠM THỜI (LIKELY TEST/SAMPLE/DEBUG) ---');
testEndpoints.forEach(e => {
  console.log(`[${e.method}] /${e.fullRoute} (${e.file}:${e.line}) -> Referenced in FE: ${e.isReferenced}`);
});


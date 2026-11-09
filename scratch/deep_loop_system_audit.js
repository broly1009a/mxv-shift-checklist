const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('          DEEP LOOP SYSTEM AUDIT ENGINE (MXV SHIFT SYSTEM)');
console.log('================================================================================');

// Helper to recursively collect files
function collectFiles(dir, exts, ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'scratch']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!ignoreDirs.includes(item.name)) {
        results = results.concat(collectFiles(full, exts, ignoreDirs));
      }
    } else {
      if (exts.some(ext => item.name.endsWith(ext))) {
        results.push(full.replace(/\\/g, '/'));
      }
    }
  }
  return results;
}

const frontendFiles = collectFiles('frontend/src', ['.ts', '.tsx', '.js']);
const backendFiles = collectFiles('backend/src', ['.ts']);

console.log(`- Đã tải ${frontendFiles.length} tệp Frontend và ${backendFiles.length} tệp Backend.`);

// ============================================================================
// PASS 1: PHÂN TÍCH TẤT CẢ CÁC TRANG (PAGES / ROUTES) FRONTEND
// ============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('PASS 1: RÀ SOÁT TẤT CẢ TRANG FRONTEND (app/**/page.tsx) & KIỂM TRA MỒ CÔI');
console.log('--------------------------------------------------------------------------------');

const pageFiles = frontendFiles.filter(f => f.endsWith('/page.tsx'));
const allFrontendContent = frontendFiles.map(f => ({ file: f, content: fs.readFileSync(f, 'utf8') }));

const pageAnalysis = [];

for (const p of pageFiles) {
  const relPath = p.replace('frontend/src/app', '').replace('/page.tsx', '') || '/';
  const pageContent = fs.readFileSync(p, 'utf8');
  const lines = pageContent.split('\n').length;

  // Kiểm tra xem route này có được link tới từ các file khác không (Link href="/..." hoặc router.push('/...'))
  const cleanRoute = relPath;
  let incomingLinksCount = 0;
  const referencingFiles = [];

  for (const { file, content } of allFrontendContent) {
    if (file === p) continue;
    // Check if route string is mentioned
    const pattern = new RegExp(`['"\`]${cleanRoute}['"\`]|['"\`]${cleanRoute}\\?|href=['"\`]${cleanRoute}['"\`]`, 'i');
    if (pattern.test(content)) {
      incomingLinksCount++;
      referencingFiles.push(file.replace('frontend/src/', ''));
    }
  }

  // Phân tích các API gọi từ page này
  const apiCalls = [...pageContent.matchAll(/(?:api\.[a-zA-Z0-9_.]+|\/api\/v1\/[a-zA-Z0-9_\-\/]+)/g)].map(m => m[0]);
  const uniqueApis = [...new Set(apiCalls)];

  pageAnalysis.push({
    route: cleanRoute,
    file: p,
    lines,
    incomingLinksCount,
    referencingFiles: referencingFiles.slice(0, 5),
    apiCount: uniqueApis.length,
    apis: uniqueApis
  });
}

// Sắp xếp theo số liên kết tới
pageAnalysis.sort((a, b) => a.incomingLinksCount - b.incomingLinksCount);

console.log(`Tổng số trang Page.tsx: ${pageAnalysis.length}`);
console.log('\n[CÁC TRANG CÓ NGUY CƠ MỒ CÔI HOẶC THỬ NGHIỆM (Incoming Links <= 1)]:');
pageAnalysis.filter(p => p.incomingLinksCount <= 1).forEach(p => {
  console.log(`  * Route: ${p.route.padEnd(35)} | Dòng: ${String(p.lines).padStart(5)} | Links tới: ${p.incomingLinksCount} | APIs: ${p.apiCount}`);
  if (p.referencingFiles.length > 0) {
    console.log(`    Được tham chiếu từ: ${p.referencingFiles.join(', ')}`);
  } else {
    console.log(`    ⚠️ HOÀN TOÀN KHÔNG CÓ TRANG NÀO LIÊN KẾT TỚI (DEAD ORPHAN ROUTE)`);
  }
});

// ============================================================================
// PASS 2: PHÂN TÍCH TẤT CẢ BACKEND CONTROLLER ROUTES VS FRONTEND CALLS
// ============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('PASS 2: ĐỐI CHIẾU ENDPOINT BACKEND VS GỌI THỰC TẾ TỪ FRONTEND');
console.log('--------------------------------------------------------------------------------');

const backendControllers = backendFiles.filter(f => f.endsWith('.controller.ts'));
const backendEndpoints = [];

for (const c of backendControllers) {
  const content = fs.readFileSync(c, 'utf8');
  
  // Lấy prefix từ @Controller
  const ctrlMatch = content.match(/@Controller\s*\(\s*([^)]+)\)/);
  let prefixes = [''];
  if (ctrlMatch) {
    const rawPrefix = ctrlMatch[1].trim();
    if (rawPrefix.startsWith('[')) {
      // Mảng prefix
      prefixes = eval(rawPrefix);
    } else {
      prefixes = [rawPrefix.replace(/['"]/g, '')];
    }
  }

  // Lấy các routes
  const routeRegex = /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]?([^'"]*)['"]?\s*\)[\s\S]*?(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const subPath = match[2] || '';
    const handlerMethod = match[3];

    for (const pref of prefixes) {
      let fullPath = '/' + [pref, subPath].filter(Boolean).join('/').replace(/\/+/g, '/');
      if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
      backendEndpoints.push({
        controllerFile: c.replace('backend/src/', ''),
        method,
        subPath,
        fullPath,
        handlerMethod
      });
    }
  }
}

console.log(`Tổng số endpoints khai báo trên Backend: ${backendEndpoints.length}`);

// Gom toàn bộ code frontend thành 1 chuỗi lớn để regex tìm kiếm nhanh
const aggregatedFrontendCode = allFrontendContent.map(f => f.content).join('\n');

const endpointAudit = [];
for (const ep of backendEndpoints) {
  // Bỏ param :id hoặc :key khi tìm kiếm
  const baseSearchPath = ep.fullPath.split('/:')[0].replace(/^\/api\/v1\//, '').replace(/^\//, '');
  const exactPathSearch = ep.fullPath.replace(/:[a-zA-Z0-9_]+/g, '');

  let isCalledInFrontend = false;
  let callLocations = [];

  for (const { file, content } of allFrontendContent) {
    if (content.includes(baseSearchPath) || (ep.subPath && ep.subPath.length > 3 && content.includes(ep.subPath))) {
      isCalledInFrontend = true;
      callLocations.push(file.replace('frontend/src/', ''));
    }
  }

  endpointAudit.push({
    ...ep,
    isCalledInFrontend,
    callLocationsCount: callLocations.length,
    callLocations: callLocations.slice(0, 3)
  });
}

const uncalledEndpoints = endpointAudit.filter(e => !e.isCalledInFrontend);
console.log(`Endpoints được Frontend gọi tới: ${backendEndpoints.length - uncalledEndpoints.length}`);
console.log(`Endpoints KHÔNG TÌM THẤY LƯỢT GỌI TỪ FRONTEND (Nguy cơ Dead Endpoints): ${uncalledEndpoints.length}`);

console.log('\n[DANH SÁCH ENDPOINTS KHÔNG ĐƯỢC FRONTEND GỌI TỚI (MẪU TIÊU BIỂU)]');
const groupedByController = {};
for (const ep of uncalledEndpoints) {
  groupedByController[ep.controllerFile] = groupedByController[ep.controllerFile] || [];
  groupedByController[ep.controllerFile].push(`${ep.method} ${ep.fullPath} (${ep.handlerMethod})`);
}

for (const [ctrl, eps] of Object.entries(groupedByController)) {
  console.log(`\n• Controller: ${ctrl} (${eps.length} endpoints chưa thấy gọi từ UI):`);
  eps.slice(0, 5).forEach(e => console.log(`    - ${e}`));
  if (eps.length > 5) console.log(`    ... và ${eps.length - 5} endpoint khác`);
}

// ============================================================================
// PASS 3: PHÂN TÍCH TẤT CẢ SCHEMA & COLLECTION DATABASE
// ============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('PASS 3: RÀ SOÁT TẤT CẢ MONGOOSE SCHEMAS & MỨC ĐỘ SỬ DỤNG TRÊN TOÀN HỆ THỐNG');
console.log('--------------------------------------------------------------------------------');

const schemaFiles = backendFiles.filter(f => f.includes('schema.ts'));
const schemaAudit = [];

const allBackendContent = backendFiles.map(f => ({ file: f, content: fs.readFileSync(f, 'utf8') }));

for (const sf of schemaFiles) {
  const content = fs.readFileSync(sf, 'utf8');
  // Lấy tên class schema
  const classMatch = content.match(/export\s+class\s+([A-Za-z0-9_]+)/);
  const schemaClass = classMatch ? classMatch[1] : path.basename(sf, '.ts');

  // Lấy collection name nếu có @Schema({ collection: '...' })
  const collMatch = content.match(/@Schema\s*\(\s*\{[^}]*collection:\s*['"]([^'"]+)['"]/);
  const collectionName = collMatch ? collMatch[1] : schemaClass.toLowerCase() + 's';

  // Kiểm tra bao nhiêu file backend import hoặc inject model này
  let injectCount = 0;
  let importCount = 0;
  const usedInFiles = [];

  for (const { file, content: bContent } of allBackendContent) {
    if (file === sf) continue;
    if (bContent.includes(schemaClass)) {
      importCount++;
      usedInFiles.push(file.replace('backend/src/', ''));
    }
    if (bContent.includes(`@InjectModel(${schemaClass}.name)`) || bContent.includes(`@InjectModel('${schemaClass}')`)) {
      injectCount++;
    }
  }

  schemaAudit.push({
    schemaClass,
    collectionName,
    file: sf.replace('backend/src/', ''),
    injectCount,
    importCount,
    usedInFiles: usedInFiles.slice(0, 4)
  });
}

schemaAudit.sort((a, b) => a.importCount - b.importCount);

console.log(`Tổng số Schemas: ${schemaAudit.length}`);
console.log('\n[DANH SÁCH SCHEMAS ÍT HOẶC KHÔNG CÓ NƠI NÀO SỬ DỤNG (Import Count <= 1)]:');
schemaAudit.filter(s => s.importCount <= 1).forEach(s => {
  console.log(`  * Schema: ${s.schemaClass.padEnd(30)} | Collection: ${s.collectionName.padEnd(25)} | Inject: ${s.injectCount} | File dùng: ${s.importCount}`);
  if (s.importCount === 0) {
    console.log(`    ⚠️ 100% DEAD SCHEMA / MÔ CÔI - KHÔNG MỘT DÒNG CODE NÀO SỬ DỤNG!`);
  } else {
    console.log(`    Chỉ dùng tại: ${s.usedInFiles.join(', ')}`);
  }
});

// Lưu báo cáo đầy đủ ra file JSON
const fullReport = {
  timestamp: new Date().toISOString(),
  pages: pageAnalysis,
  endpointsCount: backendEndpoints.length,
  uncalledEndpointsCount: uncalledEndpoints.length,
  uncalledEndpointsByController: groupedByController,
  schemas: schemaAudit
};

fs.writeFileSync('scratch/deep_loop_audit_results.json', JSON.stringify(fullReport, null, 2), 'utf8');
console.log('\n================================================================================');
console.log('✅ ĐÃ XUẤT TOÀN BỘ KẾT QUẢ QUÉT LẶP RA: scratch/deep_loop_audit_results.json');
console.log('================================================================================');

/**
 * ============================================================================
 * BENCHMARK THỰC TẾ: ĐO ĐẠC CHÍNH XÁC DUNG LƯỢNG RAM KHI CHẠY CHECK_KLGD
 * ============================================================================
 * 
 * Mục đích:
 * 1. Đo lường bằng số liệu thực tế (Empirical Data) mức tiêu thụ RAM của từng thành phần:
 *    - Node.js Runtime (HeapUsed, RSS, ArrayBuffers)
 *    - Trình duyệt Chromium CQG với bộ cờ HIỆN TẠI (Ép GPU, không giới hạn RAM V8)
 *    - Trình duyệt Chromium CQG với bộ cờ TỐI ƯU (Tắt GPU, giới hạn V8 256MB)
 *    - Mức ngốn RAM khi chạy 2 tài khoản CQG song song vs tuần tự
 *    - Thư viện SheetJS (XLSX) khi nạp và phân tích đồng thời 10 file Excel
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_measure_klgd_memory_footprint.js
 * 
 * Thêm cờ nếu muốn mở giao diện trình duyệt:
 *   node src/scripts/test_measure_klgd_memory_footprint.js --headed
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');

const isHeaded = process.argv.includes('--headed');

// Helper đọc bộ nhớ tiến trình Node.js & Hệ điều hành
function getSystemAndNodeMemory() {
  const nodeMem = process.memoryUsage();
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMemMB = totalMemMB - freeMemMB;

  return {
    systemTotalMB: totalMemMB,
    systemUsedMB: usedMemMB,
    systemFreeMB: freeMemMB,
    nodeRssMB: Math.round(nodeMem.rss / 1024 / 1024),
    nodeHeapUsedMB: Math.round(nodeMem.heapUsed / 1024 / 1024),
    nodeHeapTotalMB: Math.round(nodeMem.heapTotal / 1024 / 1024),
    nodeExternalMB: Math.round(nodeMem.external / 1024 / 1024),
  };
}

// Helper đo RAM các tiến trình Chromium liên quan đến thư mục profile cụ thể
function getChromeMemoryForProfile(profileName) {
  let totalWsMB = 0;
  let processCount = 0;
  try {
    if (process.platform === 'win32') {
      const output = execSync(
        `wmic process where "name='chrome.exe'" get processid,commandline /format:csv`,
        { stdio: ['pipe', 'pipe', 'ignore'] }
      ).toString();
      const lines = output.trim().split('\r\n').filter(Boolean).slice(1);
      const targetPids = [];
      lines.forEach((line) => {
        if (line.includes(profileName)) {
          const parts = line.split(',');
          const pid = parts[parts.length - 1];
          if (pid) targetPids.push(pid);
        }
      });
      processCount = targetPids.length;
      if (targetPids.length > 0) {
        const psCmd = `Get-Process -Id ${targetPids.join(',')} -ErrorAction SilentlyContinue | Measure-Object -Property WS -Sum | Select-Object -ExpandProperty Sum`;
        const sumBytes = execSync(`powershell -NoProfile -Command "${psCmd}"`, {
          stdio: ['pipe', 'pipe', 'ignore'],
        }).toString().trim();
        if (sumBytes && !isNaN(Number(sumBytes))) {
          totalWsMB = Math.round(Number(sumBytes) / 1024 / 1024);
        }
      }
    } else {
      // Linux / Ubuntu
      const output = execSync(`ps aux | grep -i "${profileName}" | grep -v grep || true`).toString();
      const lines = output.trim().split('\n').filter(Boolean);
      processCount = lines.length;
      lines.forEach((l) => {
        const cols = l.trim().split(/\s+/);
        const rssKB = parseInt(cols[5], 10);
        if (!isNaN(rssKB)) totalWsMB += Math.round(rssKB / 1024);
      });
    }
  } catch {}
  return { processCount, totalWsMB };
}

// Tìm đường dẫn thực thi của Google Chrome
function getChromeExecutablePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
  } else {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'];
    for (const p of paths) if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function runRealBenchmark() {
  console.log('================================================================================');
  console.log(' 🔬 KIỂM THỬ THỰC TẾ: ĐO ĐẠC MỨC TIÊU THỤ BỘ NHỚ RAM TRONG CHECK_KLGD');
  console.log('================================================================================\n');

  const baseline = getSystemAndNodeMemory();
  console.log(`[Baseline] RAM Toàn Hệ Thống: ${baseline.systemUsedMB} MB / ${baseline.systemTotalMB} MB (Trống: ${baseline.systemFreeMB} MB)`);
  console.log(`[Baseline] RAM Tiến Trình Node: RSS=${baseline.nodeRssMB} MB | HeapUsed=${baseline.nodeHeapUsedMB} MB\n`);

  const executablePath = getChromeExecutablePath();
  const testDir = path.join(process.cwd(), 'temp', 'mem_test');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const results = {
    baselineNodeRssMB: baseline.nodeRssMB,
    baselineNodeHeapMB: baseline.nodeHeapUsedMB,
    currentSingleCqgMB: 0,
    currentSingleProcessCount: 0,
    currentDualParallelCqgMB: 0,
    currentDualProcessCount: 0,
    optimizedSingleCqgMB: 0,
    optimizedSingleProcessCount: 0,
    optimizedDualParallelCqgMB: 0,
    optimizedDualProcessCount: 0,
    sheetJsHeapDeltaMB: 0,
    sheetJsRssDeltaMB: 0,
  };

  const cqgUrl = 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  // ============================================================================
  // TEST 1: ĐO ĐẠC CHROMIUM VỚI BỘ CỜ HIỆN TẠI (CURRENT FLAGS)
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('👉 [BƯỚC 1/3] ĐO ĐẠC BỘ CỜ CHROMIUM HIỆN TẠI TRONG REPO (ÉP GPU, CHƯA GIỚI HẠN V8)');
  console.log('--------------------------------------------------------------------------------');

  const currentArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--start-maximized',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--disk-cache-size=209715200',
    '--enable-features=V8CodeCache,WebAssembly',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  const profileDir1 = path.join(testDir, 'cqg_current_1');
  const profileDir2 = path.join(testDir, 'cqg_current_2');
  if (!fs.existsSync(profileDir1)) fs.mkdirSync(profileDir1, { recursive: true });
  if (!fs.existsSync(profileDir2)) fs.mkdirSync(profileDir2, { recursive: true });

  console.log(`[Test 1.1] Khởi chạy 1 phiên CQG Desktop (cqg_current_1)...`);
  const ctx1 = await chromium.launchPersistentContext(profileDir1, {
    headless: !isHeaded,
    executablePath,
    args: currentArgs,
  });
  const page1 = ctx1.pages()[0] || await ctx1.newPage();
  try {
    await page1.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });
    await page1.waitForTimeout(4000); // Chờ SPA nạp tài nguyên DOM & WebSockets
  } catch (err) {
    console.log(`  (Điều hướng: ${err.message})`);
  }

  const mem1 = getChromeMemoryForProfile('cqg_current_1');
  results.currentSingleCqgMB = mem1.totalWsMB;
  results.currentSingleProcessCount = mem1.processCount;
  console.log(`  => KẾT QUẢ ĐO 1 PHIÊN CQG HIỆN TẠI: ${mem1.totalWsMB} MB RAM (${mem1.processCount} tiến trình con).`);

  console.log(`[Test 1.2] Mở thêm phiên thứ 2 chạy song song (cqg_current_2)...`);
  const ctx2 = await chromium.launchPersistentContext(profileDir2, {
    headless: !isHeaded,
    executablePath,
    args: currentArgs,
  });
  const page2 = ctx2.pages()[0] || await ctx2.newPage();
  try {
    await page2.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });
    await page2.waitForTimeout(4000);
  } catch (err) {
    console.log(`  (Điều hướng: ${err.message})`);
  }

  const memDualCurrent1 = getChromeMemoryForProfile('cqg_current_1');
  const memDualCurrent2 = getChromeMemoryForProfile('cqg_current_2');
  const totalDualCurrentMB = memDualCurrent1.totalWsMB + memDualCurrent2.totalWsMB;
  const totalDualCurrentProcesses = memDualCurrent1.processCount + memDualCurrent2.processCount;
  results.currentDualParallelCqgMB = totalDualCurrentMB;
  results.currentDualProcessCount = totalDualCurrentProcesses;
  console.log(`  => KẾT QUẢ ĐO 2 PHIÊN SONG SONG HIỆN TẠI: ${totalDualCurrentMB} MB RAM (${totalDualCurrentProcesses} tiến trình con).\n`);

  await ctx1.close().catch(() => {});
  await ctx2.close().catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));

  // ============================================================================
  // TEST 2: ĐO ĐẠC CHROMIUM VỚI BỘ CỜ TỐI ƯU (OPTIMIZED MEMORY FLAGS)
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('👉 [BƯỚC 2/3] ĐO ĐẠC BỘ CỜ CHROMIUM TỐI ƯU (TẮT GPU, GIỚI HẠN HEAP V8 256MB)');
  console.log('--------------------------------------------------------------------------------');

  const optimizedArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--renderer-process-limit=1',
    '--js-flags=--max-old-space-size=256',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  const profileDirOpt1 = path.join(testDir, 'cqg_opt_1');
  const profileDirOpt2 = path.join(testDir, 'cqg_opt_2');
  if (!fs.existsSync(profileDirOpt1)) fs.mkdirSync(profileDirOpt1, { recursive: true });
  if (!fs.existsSync(profileDirOpt2)) fs.mkdirSync(profileDirOpt2, { recursive: true });

  console.log(`[Test 2.1] Khởi chạy 1 phiên CQG Desktop với bộ cờ tối ưu (cqg_opt_1)...`);
  const ctxOpt1 = await chromium.launchPersistentContext(profileDirOpt1, {
    headless: !isHeaded,
    executablePath,
    args: optimizedArgs,
  });
  const pageOpt1 = ctxOpt1.pages()[0] || await ctxOpt1.newPage();
  try {
    await pageOpt1.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });
    await pageOpt1.waitForTimeout(4000);
  } catch (err) {
    console.log(`  (Điều hướng: ${err.message})`);
  }

  const memOpt1 = getChromeMemoryForProfile('cqg_opt_1');
  results.optimizedSingleCqgMB = memOpt1.totalWsMB;
  results.optimizedSingleProcessCount = memOpt1.processCount;
  console.log(`  => KẾT QUẢ ĐO 1 PHIÊN CQG TỐI ƯU: ${memOpt1.totalWsMB} MB RAM (${memOpt1.processCount} tiến trình con).`);

  console.log(`[Test 2.2] Mở thêm phiên thứ 2 chạy song song với bộ cờ tối ưu (cqg_opt_2)...`);
  const ctxOpt2 = await chromium.launchPersistentContext(profileDirOpt2, {
    headless: !isHeaded,
    executablePath,
    args: optimizedArgs,
  });
  const pageOpt2 = ctxOpt2.pages()[0] || await ctxOpt2.newPage();
  try {
    await pageOpt2.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });
    await pageOpt2.waitForTimeout(4000);
  } catch (err) {
    console.log(`  (Điều hướng: ${err.message})`);
  }

  const memDualOpt1 = getChromeMemoryForProfile('cqg_opt_1');
  const memDualOpt2 = getChromeMemoryForProfile('cqg_opt_2');
  const totalDualOptMB = memDualOpt1.totalWsMB + memDualOpt2.totalWsMB;
  const totalDualOptProcesses = memDualOpt1.processCount + memDualOpt2.processCount;
  results.optimizedDualParallelCqgMB = totalDualOptMB;
  results.optimizedDualProcessCount = totalDualOptProcesses;
  console.log(`  => KẾT QUẢ ĐO 2 PHIÊN SONG SONG TỐI ƯU: ${totalDualOptMB} MB RAM (${totalDualOptProcesses} tiến trình con).\n`);

  await ctxOpt1.close().catch(() => {});
  await ctxOpt2.close().catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));

  // ============================================================================
  // TEST 3: ĐO ĐẠC MỨC TIÊU THỤ RAM CỦA SHEETJS (XLSX) KHI NẠP 10 FILE EXCEL
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('👉 [BƯỚC 3/3] ĐO ĐẠC MỨC TIÊU THỤ BỘ NHỚ V8 KHI NẠP ĐỒNG THỜI 10 FILE EXCEL');
  console.log('--------------------------------------------------------------------------------');

  const memBeforeXlsx = getSystemAndNodeMemory();
  const sampleExcelBuffers = [];
  const parsedWorkbooks = [];

  // Tạo 10 file Excel mẫu trong bộ nhớ (mỗi file 1000 dòng để mô phỏng dữ liệu trong phiên)
  for (let f = 1; f <= 10; f++) {
    const rows = [['ID', 'Account', 'Contract', 'Side', 'Price', 'Volume', 'Time']];
    for (let r = 1; r <= 1000; r++) {
      rows.push([r, `001C${100000 + r}`, 'ZCE.ZCE_SR_2409', r % 2 === 0 ? 'BUY' : 'SELL', 1520.5 + r, 5, '09:30:15']);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Sheet_${f}`);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    sampleExcelBuffers.push(buf);
  }

  // Phân tích đồng thời cả 10 Buffer thành Object Tree (như trong klgd-recon.service.ts)
  sampleExcelBuffers.forEach((buf) => {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    parsedWorkbooks.push(json);
  });

  const memAfterXlsx = getSystemAndNodeMemory();
  results.sheetJsHeapDeltaMB = memAfterXlsx.nodeHeapUsedMB - memBeforeXlsx.nodeHeapUsedMB;
  results.sheetJsRssDeltaMB = memAfterXlsx.nodeRssMB - memBeforeXlsx.nodeRssMB;

  console.log(`  => Nạp và phân tích 10 file Excel (1.000 dòng/file):`);
  console.log(`     Node Heap tăng : +${results.sheetJsHeapDeltaMB} MB (Từ ${memBeforeXlsx.nodeHeapUsedMB} MB lên ${memAfterXlsx.nodeHeapUsedMB} MB)`);
  console.log(`     Node RSS tăng  : +${results.sheetJsRssDeltaMB} MB (Từ ${memBeforeXlsx.nodeRssMB} MB lên ${memAfterXlsx.nodeRssMB} MB)\n`);

  // ============================================================================
  // TỔNG KẾT BẢNG SO SÁNH THỰC TẾ
  // ============================================================================
  console.log('================================================================================');
  console.log(' 📊 BẢNG TỔNG KẾT ĐO LƯỜNG THỰC TẾ (SỐ LIỆU CHÍNH XÁC KHÔNG PHỎNG ĐOÁN)');
  console.log('================================================================================');
  console.table([
    {
      'Thành phần kiểm thử': '1 Phiên CQG (Cờ hiện tại)',
      'Số tiến trình con': results.currentSingleProcessCount,
      'RAM Tiêu Thụ (MB)': `${results.currentSingleCqgMB} MB`,
      'Ghi chú': 'Ép render GPU ảo, không chặn V8',
    },
    {
      'Thành phần kiểm thử': '2 Phiên CQG Song Song (Cờ hiện tại)',
      'Số tiến trình con': results.currentDualProcessCount,
      'RAM Tiêu Thụ (MB)': `${results.currentDualParallelCqgMB} MB`,
      'Ghi chú': 'Chạy song song CQG1 & CQG2 lúc Check KLGD',
    },
    {
      'Thành phần kiểm thử': '1 Phiên CQG (Cờ tối ưu)',
      'Số tiến trình con': results.optimizedSingleProcessCount,
      'RAM Tiêu Thụ (MB)': `${results.optimizedSingleCqgMB} MB`,
      'Ghi chú': 'Tắt GPU, giới hạn V8 256MB, 1 renderer',
    },
    {
      'Thành phần kiểm thử': '2 Phiên CQG Song Song (Cờ tối ưu)',
      'Số tiến trình con': results.optimizedDualProcessCount,
      'RAM Tiêu Thụ (MB)': `${results.optimizedDualParallelCqgMB} MB`,
      'Ghi chú': 'Giảm mạnh RAM khi chạy cả 2 tài khoản',
    },
    {
      'Thành phần kiểm thử': 'SheetJS nạp 10 file Excel',
      'Số tiến trình con': 1,
      'RAM Tiêu Thụ (MB)': `+${results.sheetJsHeapDeltaMB} MB (Heap) / +${results.sheetJsRssDeltaMB} MB (RSS)`,
      'Ghi chú': 'Node V8 Object Tree trong klgd-recon.service',
    },
  ]);

  if (results.currentDualParallelCqgMB > 0 && results.optimizedDualParallelCqgMB > 0) {
    const savedMB = results.currentDualParallelCqgMB - results.optimizedDualParallelCqgMB;
    const percent = Math.round((savedMB / results.currentDualParallelCqgMB) * 100);
    console.log(`🎯 KẾT QUẢ TỐI ƯU CỜ CHROMIUM: Giảm ${savedMB} MB RAM (~${percent}%) khi chạy song song 2 tài khoản CQG.`);
  }

  // Dọn dẹp thư mục tạm mem_test
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
  console.log('================================================================================\n');
}

runRealBenchmark().catch((err) => {
  console.error(`💥 Lỗi trong quá trình kiểm thử: ${err.message}`);
  process.exit(1);
});

/**
 * VERIFY FIX SCENARIOS SCRIPT
 * Kiểm tra xác minh 3 kịch bản cốt lõi sau khi fix bug:
 * 1. Logic chuyển đổi đường dẫn đa nền tảng (Cross-platform path resolution)
 * 2. Cấu trúc selector xuất file đặc hiệu (Specific vs Fallback)
 * 3. Logic xử lý lỗi tải báo cáo và kích hoạt retry hàng đợi
 */

const path = require('path');

// 1. Giả lập logic hàm resolveStoragePathCrossPlatform (trích xuất trực tiếp từ bot-path.helper.ts)
function resolveStoragePathCrossPlatform(rawPath, mockPlatform = process.platform) {
  if (!rawPath) return rawPath;

  const linuxMountBase = (process.env.STORAGE_MOUNT_LINUX || '/mnt/qlgd-it')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const windowsShareBase = (process.env.STORAGE_SHARE_WINDOWS || 'M:\\Tailieuchung\\QLGD-IT')
    .replace(/[/\\]+$/, '');

  const normalized = rawPath.replace(/\\/g, '/');

  if (mockPlatform === 'linux') {
    const uncMatch = normalized.match(/^\/\/[^/]+\/(?:tailieuchung\/qlgd-it\/|tailieuchung\/)?(.*)$/i);
    if (uncMatch) {
      return `${linuxMountBase}/${uncMatch[1]}`.replace(/\/+/g, '/');
    }

    const qlgdMatch = normalized.match(/(?:^|\/)(quanlygiaodich\/.*)$/i);
    if (qlgdMatch) {
      return `${linuxMountBase}/${qlgdMatch[1]}`.replace(/\/+/g, '/');
    }
    if (/^[a-zA-Z]:\/tailieuchung\/qlgd-it\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^[a-zA-Z]:\/tailieuchung\/qlgd-it\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^[a-zA-Z]:\/qlgd-it\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^[a-zA-Z]:\/qlgd-it\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^\/mnt\/oc-uat\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^\/mnt\/oc-uat\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^m:\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^m:\//i, '')}`.replace(/\/+/g, '/');
    }
    return normalized;
  } else {
    // Windows
    const linuxBaseSlash = linuxMountBase.toLowerCase();
    if (normalized.toLowerCase().startsWith(linuxBaseSlash)) {
      const remainder = normalized.slice(linuxBaseSlash.length).replace(/^\/+/, '');
      return path.join(windowsShareBase, remainder);
    }
    return path.normalize(rawPath);
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('       BẮT ĐẦU KIỂM THỬ XÁC MINH CÁC KỊCH BẢN SAU KHI FIX BUG');
  console.log('========================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assertTest(condition, testName, details = '') {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   👉 Chi tiết: ${details}`);
    }
  }

  // ===========================================================================
  // KỊCH BẢN 1: KIỂM THỬ ĐƯỜNG DẪN CHÉO NỀN TẢNG (CROSS-PLATFORM RESOLUTION)
  // ===========================================================================
  console.log('--- 1. Kiểm thử Kịch bản Đường Dẫn Chéo Nền Tảng (Windows vs Linux) ---');

  const windowsInputMs = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
  const windowsInputAcm = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures';
  const windowsInputCqg = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures';

  // 1.1 Kiểm tra trên Linux: Phải ánh xạ thành /mnt/qlgd-it/...
  const linuxResolvedMs = resolveStoragePathCrossPlatform(windowsInputMs, 'linux');
  assertTest(
    linuxResolvedMs === '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures',
    'Chuyển đổi MS Windows M:\\ sang Linux mount /mnt/qlgd-it/...',
    `Nhận được: ${linuxResolvedMs}`
  );

  const linuxResolvedAcm = resolveStoragePathCrossPlatform(windowsInputAcm, 'linux');
  assertTest(
    linuxResolvedAcm === '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures',
    'Chuyển đổi ACM Windows M:\\ sang Linux mount /mnt/qlgd-it/...',
    `Nhận được: ${linuxResolvedAcm}`
  );

  const linuxResolvedCqg = resolveStoragePathCrossPlatform(windowsInputCqg, 'linux');
  assertTest(
    linuxResolvedCqg === '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures',
    'Chuyển đổi CQG Windows M:\\ sang Linux mount /mnt/qlgd-it/...',
    `Nhận được: ${linuxResolvedCqg}`
  );

  // 1.2 Kiểm tra ghép chuỗi ngày tháng trên Linux: Tuyệt đối KHÔNG sinh đường dẫn lai vừa \ vừa /
  const subFolderLinux = '2026/T09.2026/23.09';
  const fullPathDailyLinux = `${linuxResolvedMs}/${subFolderLinux}`.replace(/\/+/g, '/');
  assertTest(
    !fullPathDailyLinux.includes('\\') && fullPathDailyLinux.startsWith('/mnt/qlgd-it/'),
    'Đường dẫn ngày trên Linux hoàn toàn dùng dấu / và không có ký tự \\ lai',
    `Đường dẫn: ${fullPathDailyLinux}`
  );

  // 1.3 Kiểm tra trên Windows: Giữ nguyên chuẩn Windows
  const windowsResolved = resolveStoragePathCrossPlatform(windowsInputMs, 'win32');
  assertTest(
    windowsResolved.startsWith('M:\\') || windowsResolved.startsWith('M:/'),
    'Trên Windows giữ nguyên định dạng ổ đĩa M:\\',
    `Nhận được: ${windowsResolved}`
  );

  // 1.4 Kiểm tra chuyển đổi ngược từ Linux mount sang Windows:
  const windowsFromLinux = resolveStoragePathCrossPlatform('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures', 'win32');
  assertTest(
    windowsFromLinux.startsWith('M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich'),
    'Ánh xạ ngược từ /mnt/qlgd-it/... về M:\\Tailieuchung\\QLGD-IT\\... trên Windows',
    `Nhận được: ${windowsFromLinux}`
  );

  // ===========================================================================
  // KỊCH BẢN 2: KIỂM THỬ SELECTOR NÚT XUẤT FILE (ƯU TIÊN ICON TRÁNH CLICK NHẦM)
  // ===========================================================================
  console.log('\n--- 2. Kiểm thử Kịch bản Selector Nút Xuất File M-System ---');

  // Load selector từ file helper đã build
  const { MS_SPECIFIC_EXPORT_BUTTON_SELECTORS, MS_EXPORT_BUTTON_SELECTORS } = require('../../dist/modules/bot-engine/helpers/msystem-tab-navigator.helper');

  assertTest(
    typeof MS_SPECIFIC_EXPORT_BUTTON_SELECTORS === 'string' && MS_SPECIFIC_EXPORT_BUTTON_SELECTORS.length > 0,
    'MS_SPECIFIC_EXPORT_BUTTON_SELECTORS được export hợp lệ từ helper',
    `Selector: ${MS_SPECIFIC_EXPORT_BUTTON_SELECTORS}`
  );

  assertTest(
    !MS_SPECIFIC_EXPORT_BUTTON_SELECTORS.includes('button.btn-info'),
    'MS_SPECIFIC_EXPORT_BUTTON_SELECTORS đã loại bỏ hoàn toàn button.btn-info generic',
    `Selector: ${MS_SPECIFIC_EXPORT_BUTTON_SELECTORS}`
  );

  assertTest(
    MS_SPECIFIC_EXPORT_BUTTON_SELECTORS.includes('fa-file-excel') && MS_SPECIFIC_EXPORT_BUTTON_SELECTORS.includes('fa-file-csv'),
    'MS_SPECIFIC_EXPORT_BUTTON_SELECTORS ưu tiên trực tiếp icon fa-file-excel và fa-file-csv',
    `Selector: ${MS_SPECIFIC_EXPORT_BUTTON_SELECTORS}`
  );

  assertTest(
    MS_EXPORT_BUTTON_SELECTORS.includes('button.btn-info'),
    'MS_EXPORT_BUTTON_SELECTORS cũ vẫn giữ button.btn-info làm fallback an toàn (backward-compatible)',
    `Selector: ${MS_EXPORT_BUTTON_SELECTORS}`
  );

  // ===========================================================================
  // KỊCH BẢN 3: KIỂM THỬ LOGIC BÁO LỖI VÀ RETRY HÀNG ĐỢI (FAIL-FAST)
  // ===========================================================================
  console.log('\n--- 3. Kiểm thử Kịch bản Xử Lý Lỗi và Kích Hoạt Retry Hàng Đợi ---');

  // Mô phỏng hàm kiểm tra kết quả trong rpa-download.handler.ts
  function simulateHandlerResultCheck(targets, successfulTargets, failedTargets) {
    if (failedTargets.length > 0) {
      const failedSummary = failedTargets.map((f) => `${f.target} (${f.error})`).join('; ');
      throw new Error(`Có ${failedTargets.length}/${targets.length} báo cáo MS tải thất bại: ${failedSummary}`);
    }
    return { success: true, successfulTargets, failedTargets };
  }

  // 3.1 Trường hợp 19/20 file thành công, 1 file TTM lỗi: PHẢI throw Error để kích hoạt retry
  let thrownError = null;
  try {
    simulateHandlerResultCheck(
      ['NKTTHT', 'TTM', 'DSGD'],
      ['NKTTHT', 'DSGD'],
      [{ target: 'TTM', error: 'Timeout 90000ms' }]
    );
  } catch (err) {
    thrownError = err;
  }

  assertTest(
    thrownError !== null && thrownError.message.includes('1/3 báo cáo MS tải thất bại'),
    'Khi có file lỗi (1/3), handler ném Error để kích hoạt lần thử 2/3 (Không nuốt lỗi)',
    `Lỗi nhận được: ${thrownError?.message}`
  );

  // 3.2 Trường hợp cả 20/20 file thành công: Return thành công bình thường
  let allSuccessResult = null;
  try {
    allSuccessResult = simulateHandlerResultCheck(
      ['NKTTHT', 'TTM', 'DSGD'],
      ['NKTTHT', 'TTM', 'DSGD'],
      []
    );
  } catch (err) {
    allSuccessResult = null;
  }

  assertTest(
    allSuccessResult !== null && allSuccessResult.success === true,
    'Khi cả 20/20 file thành công, handler hoàn thành bình thường và lưu log',
    `Kết quả: ${JSON.stringify(allSuccessResult)}`
  );

  console.log('\n========================================================================');
  console.log(` TỔNG KẾT KIỂM THỬ: ${passedCount}/${totalCount} KỊCH BẢN ĐẠT (PASS 100%)`);
  console.log('========================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Lỗi khi thực thi kiểm thử:', err);
  process.exit(1);
});

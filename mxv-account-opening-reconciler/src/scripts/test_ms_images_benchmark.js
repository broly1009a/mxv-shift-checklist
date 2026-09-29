#!/usr/bin/env node
/**
 * TEST BENCHMARK TRÍCH XUẤT ẢNH CCCD M-SYSTEM THỰC TẾ
 * ============================================================================
 * Đường dẫn mặc định: M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD\HoSo_DinhKem
 * 
 * Mục tiêu:
 *   1. Quét các thư mục ngày / tài khoản thực tế trên ổ đĩa M: (hoặc đường dẫn local).
 *   2. Đọc thử nghiệm các file ảnh _MS_CCCD_truoc và _MS_CCCD_sau.
 *   3. Đo lường độ ổn định: tỷ lệ đọc Số CCCD, Họ tên, Ngày sinh, Giới tính, Ngày cấp.
 *   4. Thống kê độ phân giải ảnh MS thực tế, phát hiện các ngoại lệ/bug (ảnh quá nhỏ, mất nét, thiếu ngày cấp).
 *   5. Xuất báo cáo chi tiết để phục vụ việc tinh chỉnh và nâng cấp bộ bóc tách.
 * 
 * Hướng dẫn sử dụng trên Terminal:
 *   # Chạy test 1 tài khoản cụ thể:
 *   node src/scripts/test_ms_images_benchmark.js --code 001C0122369
 * 
 *   # Chạy test 10 tài khoản trong ngày gần nhất:
 *   node src/scripts/test_ms_images_benchmark.js --limit 10
 * 
 *   # Chạy test ngày cụ thể:
 *   node src/scripts/test_ms_images_benchmark.js --date 2026-09-14 --limit 20
 * 
 *   # Tùy chỉnh thư mục gốc (nếu không dùng ổ M:):
 *   node src/scripts/test_ms_images_benchmark.js --dir "M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem"
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// ─── CẤU HÌNH THƯ MỤC GỐC ──────────────────────────────────────────────────
const DEFAULT_BASE_DIR = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem';

// Phân tích tham số dòng lệnh CLI
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const targetCode = getArg('--code');
const targetDate = getArg('--date');
const targetDates = getArg('--dates'); // Danh sách ngày phân tách bởi dấu phẩy, vd: 2026-09-08,2026-09-14,2026-09-22
const samplePerDate = parseInt(getArg('--sample-per-date', '0'), 10); // Lấy N hồ sơ trên MỖI ngày
const limitCount = parseInt(getArg('--limit', '10'), 10);
const baseDir = getArg('--dir', DEFAULT_BASE_DIR);

function getPythonBin() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function getWorkerScript() {
  const candidate = path.resolve(__dirname, '../python/tkgd_extractor_worker.py');
  if (fs.existsSync(candidate)) return candidate;
  const distCandidate = path.resolve(__dirname, '../../dist/python/tkgd_extractor_worker.py');
  if (fs.existsSync(distCandidate)) return distCandidate;
  return candidate;
}

function runPythonWorker(code, frontPath, backPath, hdPath = null) {
  return new Promise((resolve) => {
    const workerScript = getWorkerScript();
    const pythonBin = getPythonBin();
    const cliArgs = [
      workerScript,
      '--code', code || '',
    ];
    if (frontPath && fs.existsSync(frontPath)) cliArgs.push('--front', frontPath);
    if (backPath && fs.existsSync(backPath)) cliArgs.push('--back', backPath);
    if (hdPath && fs.existsSync(hdPath)) cliArgs.push('--hopdong', hdPath);

    const start = Date.now();
    execFile(pythonBin, cliArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' }, (err, stdout, stderr) => {
      const elapsedMs = Date.now() - start;
      if (err) {
        return resolve({ success: false, elapsedMs, error: err.message, stderr });
      }
      try {
        const json = JSON.parse(stdout);
        resolve({ success: true, elapsedMs, data: json });
      } catch (parseErr) {
        resolve({ success: false, elapsedMs, error: `Parse JSON thất bại: ${parseErr.message}`, rawOutput: stdout });
      }
    });
  });
}

// Đọc kích thước ảnh thô (Width x Height) từ JPEG/PNG buffer
function getImageDimensions(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    // JPEG
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      let idx = 2;
      while (idx < buf.length) {
        if (buf[idx] === 0xFF && (buf[idx + 1] >= 0xC0 && buf[idx + 1] <= 0xC3)) {
          const h = buf.readUInt16BE(idx + 5);
          const w = buf.readUInt16BE(idx + 7);
          return { width: w, height: h, sizeBytes: buf.length };
        }
        idx++;
      }
    }
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      return { width: w, height: h, sizeBytes: buf.length };
    }
    return { width: 0, height: 0, sizeBytes: buf.length };
  } catch {
    return { width: 0, height: 0, sizeBytes: 0 };
  }
}

// ─── THU THẬP DANH SÁCH TEST CASES TỪ ĐĨA M: ────────────────────────────────
function collectTestCases() {
  if (!fs.existsSync(baseDir)) {
    console.error(`[LỖI] Thư mục gốc không tồn tại: ${baseDir}`);
    console.error(`Vui lòng kiểm tra kết nối ổ đĩa mạng M: hoặc truyền cờ --dir <đường_dẫn>`);
    process.exit(1);
  }

  let dateFolders = [];
  if (targetDate) {
    const dPath = path.join(baseDir, targetDate);
    if (fs.existsSync(dPath)) dateFolders.push(targetDate);
  } else if (targetDates) {
    const dList = targetDates.split(',').map((s) => s.trim()).filter(Boolean);
    for (const d of dList) {
      if (fs.existsSync(path.join(baseDir, d))) dateFolders.push(d);
    }
  } else {
    dateFolders = fs.readdirSync(baseDir)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse(); // Ưu tiên ngày mới nhất
  }

  const cases = [];

  for (const df of dateFolders) {
    const datePath = path.join(baseDir, df);
    let accFolders = [];
    try {
      accFolders = fs.readdirSync(datePath).filter((f) => fs.statSync(path.join(datePath, f)).isDirectory());
    } catch {
      continue;
    }

    let dateCaseCount = 0;
    for (const acc of accFolders) {
      if (targetCode && !acc.toUpperCase().includes(targetCode.toUpperCase())) {
        continue;
      }

      const accPath = path.join(datePath, acc);
      let files = [];
      try {
        files = fs.readdirSync(accPath);
      } catch {
        continue;
      }

      // Tìm ảnh mặt trước và mặt sau của MS
      const msFront = files.find((f) => /_ms_cccd_truoc\.(jpe?g|png)$/i.test(f) || /_ms_.*truoc\.(jpe?g|png)$/i.test(f));
      const msBack = files.find((f) => /_ms_cccd_sau\.(jpe?g|png)$/i.test(f) || /_ms_.*sau\.(jpe?g|png)$/i.test(f));
      const hdFile = files.find((f) => /h[oôơ].*d[oôơ]ng|h[dđ]/i.test(f) && /\.(pdf|jpe?g|png)$/i.test(f));

      if (msFront || msBack) {
        cases.push({
          date: df,
          code: acc,
          folderPath: accPath,
          frontFile: msFront ? path.join(accPath, msFront) : null,
          backFile: msBack ? path.join(accPath, msBack) : null,
          hdFile: hdFile ? path.join(accPath, hdFile) : null,
        });
        dateCaseCount++;
      }

      if (targetCode && cases.length > 0) break;
      if (samplePerDate > 0 && dateCaseCount >= samplePerDate) break;
      if (!samplePerDate && !targetCode && cases.length >= limitCount) break;
    }

    if (samplePerDate > 0 && limitCount > 0 && cases.length >= limitCount) break;
    if (!samplePerDate && cases.length >= limitCount) break;
  }

  return cases;
}

// ─── CHẠY TEST VÀ ĐÁNH GIÁ ──────────────────────────────────────────────────
async function main() {
  console.log(`==================================================================================`);
  console.log(`🔍 KIỂM THỬ ĐỘ ỔN ĐỊNH BÓC TÁCH ẢNH CCCD M-SYSTEM THỰC TẾ TRÊN Ổ ĐĨA M:`);
  console.log(`   - Thư mục nguồn: ${baseDir}`);
  console.log(`   - Bộ lọc ngày:   ${targetDate || 'TẤT CẢ (Ưu tiên ngày mới nhất)'}`);
  console.log(`   - Mã tài khoản:  ${targetCode || 'TẤT CẢ'}`);
  console.log(`   - Số lượng mẫu:  ${targetCode ? 1 : limitCount}`);
  console.log(`==================================================================================\n`);

  const testCases = collectTestCases();
  if (testCases.length === 0) {
    console.log(`⚠️ Không tìm thấy hồ sơ nào chứa ảnh M-System với điều kiện đã chọn.`);
    return;
  }

  console.log(`📦 Đã thu thập được ${testCases.length} hồ sơ mẫu có ảnh M-System. Bắt đầu chạy OCR...\n`);

  let successCount = 0;
  let hasCccdCount = 0;
  let hasNameCount = 0;
  let hasDobCount = 0;
  let hasGenderCount = 0;
  let hasIssueDateCount = 0;
  let mrzSourceCount = 0;
  let totalTimeMs = 0;

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    process.stdout.write(`[${i + 1}/${testCases.length}] Đang test ${tc.code} (${tc.date})... `);

    const frontDim = tc.frontFile ? getImageDimensions(tc.frontFile) : null;
    const backDim = tc.backFile ? getImageDimensions(tc.backFile) : null;

    const res = await runPythonWorker(tc.code, tc.frontFile, tc.backFile, tc.hdFile);
    totalTimeMs += res.elapsedMs;

    if (res.success && res.data) {
      const cc = res.data.canCuoc || {};
      const warnings = cc.canhBaoChatLuong || [];

      const gotCccd = !!cc.soCCCD;
      const gotName = !!cc.hoTen;
      const gotDob = !!cc.ngaySinh;
      const gotGender = !!cc.gioiTinh;
      const gotIssueDate = !!cc.ngayCap;
      const source = cc.source || 'NONE';

      const anomalyReasons = cc.anomalyReasons || [];
      const autoHealed = cc.autoHealed || false;
      const healedFields = cc.healedFields || [];

      if (gotCccd) hasCccdCount++;
      if (gotName) hasNameCount++;
      if (gotDob) hasDobCount++;
      if (gotGender) hasGenderCount++;
      if (gotIssueDate) hasIssueDateCount++;
      if (source === 'MRZ') mrzSourceCount++;
      successCount++;

      let healTag = '';
      if (autoHealed && healedFields.length > 0) {
        healTag = ` 🌟 [HEALED: ${healedFields.join(', ')}]`;
      }
      console.log(`✅ [${res.elapsedMs}ms] CCCD: ${cc.soCCCD || '❌'} | Tên: ${cc.hoTen || '❌'} | Sinh: ${cc.ngaySinh || '❌'} | Cấp: ${cc.ngayCap || '❌'} | Nguồn: ${source}${healTag}`);
      if (anomalyReasons.length > 0) {
        console.log(`   ⚠️ Bất thường phát hiện: ${anomalyReasons.join('; ')}`);
      }

      results.push({
        code: tc.code,
        date: tc.date,
        frontDim: frontDim ? `${frontDim.width}x${frontDim.height}` : 'KHÔNG CÓ',
        backDim: backDim ? `${backDim.width}x${backDim.height}` : 'KHÔNG CÓ',
        timeMs: res.elapsedMs,
        soCCCD: cc.soCCCD || '-',
        hoTen: cc.hoTen || '-',
        ngaySinh: cc.ngaySinh || '-',
        gioiTinh: cc.gioiTinh || '-',
        ngayCap: cc.ngayCap || '-',
        source,
        warnings,
        anomalyReasons,
        autoHealed,
        healedFields,
      });
    } else {
      console.log(`❌ THẤT BẠI [${res.elapsedMs}ms]: ${res.error || 'Lỗi không xác định'}`);
      results.push({
        code: tc.code,
        date: tc.date,
        frontDim: frontDim ? `${frontDim.width}x${frontDim.height}` : 'KHÔNG CÓ',
        backDim: backDim ? `${backDim.width}x${backDim.height}` : 'KHÔNG CÓ',
        timeMs: res.elapsedMs,
        error: res.error || 'Lỗi thực thi',
      });
    }
  }

  // ─── TỔNG HỢP VÀ ĐÁNH GIÁ ──────────────────────────────────────────────────
  const avgTime = Math.round(totalTimeMs / testCases.length);
  const n = testCases.length;

  console.log(`\n==================================================================================`);
  console.log(`📊 BẢNG TỔNG HỢP KẾT QUẢ ĐO LƯỜNG ĐỘ ỔN ĐỊNH BÓC TÁCH ẢNH M-SYSTEM:`);
  console.log(`==================================================================================`);
  console.log(`- Tổng số hồ sơ kiểm thử:        ${n}`);
  console.log(`- Tỷ lệ chạy thành công:         ${successCount}/${n} (${Math.round((successCount / n) * 100)}%)`);
  console.log(`- Tốc độ xử lý trung bình:       ${avgTime} ms / hồ sơ (~${(avgTime / 1000).toFixed(2)}s)`);
  console.log(`----------------------------------------------------------------------------------`);
  console.log(`- Tỷ lệ trích xuất SỐ CCCD:      ${hasCccdCount}/${n} (${Math.round((hasCccdCount / n) * 100)}%)`);
  console.log(`- Tỷ lệ trích xuất HỌ VÀ TÊN:    ${hasNameCount}/${n} (${Math.round((hasNameCount / n) * 100)}%)`);
  console.log(`- Tỷ lệ trích xuất NGÀY SINH:    ${hasDobCount}/${n} (${Math.round((hasDobCount / n) * 100)}%)`);
  console.log(`- Tỷ lệ trích xuất GIỚI TÍNH:    ${hasGenderCount}/${n} (${Math.round((hasGenderCount / n) * 100)}%)`);
  console.log(`- Tỷ lệ trích xuất NGÀY CẤP:     ${hasIssueDateCount}/${n} (${Math.round((hasIssueDateCount / n) * 100)}%)`);
  console.log(`- Số ca giải mã qua MRZ:         ${mrzSourceCount}/${n} (${Math.round((mrzSourceCount / n) * 100)}%)`);
  console.log(`==================================================================================\n`);

  // Phân tích các ngoại lệ/vấn đề cần nâng cấp
  console.log(`🔍 PHÂN TÍCH NGOẠI LỆ & ĐỀ XUẤT NÂNG CẤP KỸ THUẬT:`);
  const lowResList = results.filter((r) => r.frontDim && parseInt(r.frontDim.split('x')[0], 10) < 400);
  if (lowResList.length > 0) {
    console.log(`⚠️ 1. ĐỘ PHÂN GIẢI THẤP (${lowResList.length}/${n} ca có chiều rộng < 400px):`);
    console.log(`   -> Các ảnh này cào từ web bị thu nhỏ thành thumbnail (ví dụ 310x200px, 400x249px).`);
    console.log(`   -> KHUYẾN NGHỊ: Nâng cấp crawler dùng Network Interception bắt link ảnh gốc hoặc bổ sung Super-Resolution 2x trong OpenCV.`);
  }

  const missingIssueDate = results.filter((r) => r.soCCCD !== '-' && r.ngayCap === '-');
  if (missingIssueDate.length > 0) {
    console.log(`⚠️ 2. THIẾU NGÀY CẤP (${missingIssueDate.length}/${n} ca chưa đọc được Ngày cấp từ ảnh sau):`);
    console.log(`   -> Nguyên nhân: Dòng "Ngày cấp" ở mặt sau in chữ rất nhỏ bên cạnh phôi chip; ảnh < 500px sẽ bị mờ.`);
    console.log(`   -> KHUYẾN NGHỊ: Kế thừa ngày cấp từ Hợp đồng PDF (HĐ luôn có ngày cấp rõ ràng), hoặc nội suy theo niên hạn (Hạn sử dụng - 10 năm/20 năm).`);
  }

  // Lưu file báo cáo Markdown
  const reportPath = path.resolve(process.cwd(), 'BENCHMARK_MS_IMAGES_REPORT.md');
  let md = `# BÁO CÁO BENCHMARK BÓC TÁCH ẢNH CCCD M-SYSTEM THỰC TẾ\n\n`;
  md += `*Thời gian kiểm thử*: ${new Date().toLocaleString('vi-VN')}\n`;
  md += `*Thư mục kiểm thử*: \`${baseDir}\`\n\n`;
  md += `## 1. Tổng quan hiệu năng\n\n`;
  md += `| Chỉ số | Kết quả |\n|---|---|\n`;
  md += `| Tổng số mẫu | ${n} |\n`;
  md += `| Tỷ lệ thành công | ${successCount}/${n} (${Math.round((successCount / n) * 100)}%) |\n`;
  md += `| Thời gian trung bình | ${avgTime} ms |\n`;
  md += `| Trích xuất Số CCCD | ${hasCccdCount}/${n} (${Math.round((hasCccdCount / n) * 100)}%) |\n`;
  md += `| Trích xuất Họ tên | ${hasNameCount}/${n} (${Math.round((hasNameCount / n) * 100)}%) |\n`;
  md += `| Trích xuất Ngày sinh | ${hasDobCount}/${n} (${Math.round((hasDobCount / n) * 100)}%) |\n`;
  md += `| Trích xuất Ngày cấp | ${hasIssueDateCount}/${n} (${Math.round((hasIssueDateCount / n) * 100)}%) |\n\n`;

  md += `## 2. Chi tiết từng tài khoản\n\n`;
  md += `| STT | Mã TK | Ngày | Kích thước Trước/Sau | Thời gian | Số CCCD | Họ và tên | Ngày sinh | Giới tính | Ngày cấp | Nguồn |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
  results.forEach((r, idx) => {
    md += `| ${idx + 1} | ${r.code} | ${r.date} | ${r.frontDim} / ${r.backDim} | ${r.timeMs}ms | ${r.soCCCD} | ${r.hoTen} | ${r.ngaySinh} | ${r.gioiTinh} | ${r.ngayCap} | ${r.source} |\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\n📄 Đã xuất báo cáo chi tiết ra file: ${reportPath}`);
}

main().catch((e) => console.error(e));

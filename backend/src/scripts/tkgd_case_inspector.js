#!/usr/bin/env node
/**
 * TKGD Case Inspector & Re-test Tool
 * -------------------------------------------------------------
 * Công cụ tự động kết nối Ubuntu, bóc tách và lưu cache các tài khoản lệch (hoặc trạng thái khác),
 * cho phép kiểm tra, bóc tách thử nghiệm từng case và lưu lịch sử vào cache temp.
 * 
 * Cách sử dụng:
 *   1. Lấy danh sách tài khoản lệch từ DB Ubuntu vào cache:
 *      node src/scripts/tkgd_case_inspector.js --fetch
 *      node src/scripts/tkgd_case_inspector.js --fetch --code 046C0002936
 *      node src/scripts/tkgd_case_inspector.js --fetch --date 2026-09-16
 *      node src/scripts/tkgd_case_inspector.js --fetch --status ALL
 * 
 *   2. Liệt kê các tài khoản đang lưu trong cache (không cần SSH):
 *      node src/scripts/tkgd_case_inspector.js --list
 * 
 *   3. Xem chi tiết thông tin hồ sơ & các trường lệch của 1 tài khoản từ cache:
 *      node src/scripts/tkgd_case_inspector.js --inspect 046C0002936
 * 
 *   4. Chạy bóc tách kiểm tra thử nghiệm (Test Run) trên Ubuntu và lưu kết quả vào cache:
 *      node src/scripts/tkgd_case_inspector.js --test 046C0002936
 * 
 *   5. Chạy test toàn bộ các tài khoản trong cache:
 *      node src/scripts/tkgd_case_inspector.js --test-all
 * 
 *   6. Kích hoạt reparse chính thức trên backend Ubuntu (cập nhật DB):
 *      node src/scripts/tkgd_case_inspector.js --reparse 046C0002936
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Cấu hình kết nối SSH Ubuntu (có thể cấu hình qua biến môi trường)
const SSH_CONFIG = {
  host: process.env.UBUNTU_HOST || '10.0.0.26',
  port: parseInt(process.env.UBUNTU_PORT || '22', 10),
  username: process.env.UBUNTU_USER || 'mxvadmin',
  password: process.env.UBUNTU_PASSWORD || 'MxV!,#2o26',
};

// Đường dẫn file cache cục bộ
const CACHE_DIR = path.resolve(__dirname, '../../.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'tkgd_cases_cache.json');

// Đảm bảo thư mục cache tồn tại
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function normalizeDateStr(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  return s;
}

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[CACHE] File cache bị lỗi định dạng, khởi tạo mới.');
    }
  }
  return {
    lastUpdated: null,
    filter: {},
    summary: {},
    accounts: {},
  };
}

function saveCache(cacheData) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
  console.log(`[CACHE] Đã lưu cache vào: ${CACHE_FILE}`);
}

function executeSshCommand(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          let stdout = '';
          let stderr = '';
          stream.on('data', (d) => (stdout += d.toString()));
          stream.stderr.on('data', (d) => (stderr += d.toString()));
          stream.on('close', (code) => {
            conn.end();
            resolve({ code, stdout, stderr });
          });
        });
      })
      .on('error', (err) => {
        reject(err);
      })
      .connect(SSH_CONFIG);
  });
}

// ============================================================================
// 1. FETCH CASES TỪ UBUNTU DB VÀ FILESYSTEM
// ============================================================================
async function fetchCases(options = {}) {
  const statusFilter = options.status || 'LECH';
  const dateFilter = options.date || null;
  const codeFilter = options.code || null;

  console.log(`\n======================================================`);
  console.log(`[FETCH] Đang kết nối tới Ubuntu (${SSH_CONFIG.host}) để lấy danh sách hồ sơ...`);
  console.log(`[FETCH] Bộ lọc: Trạng thái=${statusFilter}, Ngày=${dateFilter || 'TẤT CẢ'}, Mã TKGD=${codeFilter || 'TẤT CẢ'}`);
  console.log(`======================================================\n`);

  const remoteScript = `
cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config({ path: "/opt/mxv-checklist/backend/.env" });
  const { MongoClient } = require("mongodb");
  const fs = require("fs");
  const path = require("path");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error(JSON.stringify({ error: "MONGODB_URI not found" }));
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection("clean_account_records");

  const query = {};
  const status = "${statusFilter}";
  if (status !== "ALL") {
    query["ketLuan.trangThai"] = status;
  }
  const date = "${dateFilter || ''}";
  if (date) {
    query.batchDate = date;
  }
  const code = "${codeFilter || ''}";
  if (code) {
    query.$or = [{ maTKGD: code }, { maTKGDBase: code }];
  }

  const records = await col.find(query).sort({ batchDate: -1, createdAt: -1 }).toArray();

  const baseFolder = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem";

  const results = [];
  for (const r of records) {
    const accCode = r.maTKGD || r.maTKGDBase;
    const batchDate = r.batchDate || "";
    let folderPath = "";
    let diskFiles = [];

    if (accCode) {
      const bases = [
        "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem",
        "/opt/mxv-checklist/backend/data/temp_tkgd_attachments",
        path.join(process.cwd(), "data/temp_tkgd_attachments")
      ];
      const targetDirs = [];
      for (const base of bases) {
        if (!fs.existsSync(base)) continue;
        if (batchDate && fs.existsSync(path.join(base, batchDate, accCode))) {
          targetDirs.push(path.join(base, batchDate, accCode));
        }
        if (fs.existsSync(path.join(base, accCode))) {
          targetDirs.push(path.join(base, accCode));
        }
        try {
          const subdirs = fs.readdirSync(base);
          for (const d of subdirs) {
            const p = path.join(base, d, accCode);
            if (fs.existsSync(p) && !targetDirs.includes(p)) targetDirs.push(p);
          }
        } catch {}
      }
      folderPath = targetDirs[0] || (batchDate ? path.join(bases[0], batchDate, accCode) : "");

      const seen = new Set();
      for (const tDir of targetDirs) {
        try {
          const list = fs.readdirSync(tDir);
          for (const f of list) {
            if (seen.has(f)) continue;
            seen.add(f);
            const fp = path.join(tDir, f);
            const stat = fs.statSync(fp);
            if (!stat.isFile()) continue;
            diskFiles.push({
              name: f,
              path: fp,
              sizeBytes: stat.size,
              isCustomerFile: (() => {
                const lower = f.toLowerCase();
                if (lower.includes("chuky") || lower.includes("signature")) return false;
                if (/(^|[^a-z0-9])cccd[-_\s]*(ms|mt)([^a-z0-9]|$)/i.test(lower)) return true;
                if (/^(ms|mt)[-_\s]+[0-9a-z]{3,15}/i.test(lower)) return true;
                if (/^[0-9a-z]{3,15}_ms_/i.test(f) || lower.includes('_ms_cccd_')) return false;
                return !f.includes("_MS_");
              })(),
              isCccd: /cccd|cmnd|can.?cuoc/i.test(f),
              isContract: /h[oôơọợòóỏõóồốổỗộờớởỡ].{0,2}[dđ][oôơọợòóỏõóồốổỗộờớởỡ]ng|\\bhd\\b|\\bhđ\\b/i.test(f),
              isPl01: /pl01|phu.?luc/i.test(f),
              ext: path.extname(f).toLowerCase()
            });
          }
        } catch {}
      }
    }

    results.push({
      _id: String(r._id),
      maTKGD: r.maTKGD,
      maTKGDBase: r.maTKGDBase,
      batchDate: r.batchDate,
      hoTen: r.hoTen || r.ms?.hoVaTen || r.hopDong?.hoTen || "",
      folderPath,
      diskFiles,
      ketLuan: r.ketLuan || {},
      hopDong: r.hopDong || {},
      canCuoc: r.canCuoc || {},
      phuLuc: r.phuLuc || {},
      ms: r.ms || {},
      noiDungMail: r.noiDungMail || {},
      updatedAt: r.updatedAt || r.createdAt
    });
  }

  await client.close();
  console.log("###DATA_START###" + JSON.stringify(results) + "###DATA_END###");
})().catch(e => {
  console.error("###ERR_START###" + e.message + "###ERR_END###");
  process.exit(1);
});
'
`;

  try {
    const { stdout, stderr } = await executeSshCommand(remoteScript);
    const startTag = '###DATA_START###';
    const endTag = '###DATA_END###';
    const sIdx = stdout.indexOf(startTag);
    const eIdx = stdout.indexOf(endTag);

    if (sIdx === -1 || eIdx === -1) {
      console.error('[FETCH] Lỗi khi nhận dữ liệu từ Ubuntu:');
      console.error(stderr || stdout);
      return;
    }

    const jsonStr = stdout.substring(sIdx + startTag.length, eIdx);
    const records = JSON.parse(jsonStr);

    const cache = loadCache();
    cache.lastUpdated = new Date().toISOString();
    cache.filter = { status: statusFilter, date: dateFilter, code: codeFilter };

    // Tổng hợp summary
    const summary = {
      total: records.length,
      byStatus: {},
      byErrorType: {
        lechHoTen: 0,
        lechNgaySinh: 0,
        lechCCCD: 0,
        lechGioiTinh: 0,
        lechNgayCap: 0,
        thieuCCCD: 0,
        other: 0,
      },
    };

    records.forEach((r) => {
      const st = r.ketLuan?.trangThai || 'UNKNOWN';
      summary.byStatus[st] = (summary.byStatus[st] || 0) + 1;

      const errs = r.ketLuan?.danhSachLoi || [];
      const joinedErrs = errs.join(' ');
      if (/Lệch họ tên/i.test(joinedErrs)) summary.byErrorType.lechHoTen++;
      if (/Lệch ngày sinh/i.test(joinedErrs)) summary.byErrorType.lechNgaySinh++;
      if (/Lệch số CCCD/i.test(joinedErrs)) summary.byErrorType.lechCCCD++;
      if (/Lệch giới tính/i.test(joinedErrs)) summary.byErrorType.lechGioiTinh++;
      if (/Lệch ngày cấp/i.test(joinedErrs)) summary.byErrorType.lechNgayCap++;
      if (/thiếu CCCD|Không đọc được/i.test(joinedErrs)) summary.byErrorType.thieuCCCD++;

      // Lưu hoặc update vào cache (giữ lại testRuns cũ nếu có)
      const existingTestRuns = cache.accounts[r.maTKGD]?.testRuns || [];
      cache.accounts[r.maTKGD] = {
        ...r,
        testRuns: existingTestRuns,
      };
    });

    cache.summary = summary;
    saveCache(cache);

    console.log(`\n======================================================`);
    console.log(`[SUCCESS] Đã tải thành công ${records.length} hồ sơ vào cache!`);
    console.log(`- Trạng thái:`, summary.byStatus);
    console.log(`- Phân loại lỗi lệch:`, summary.byErrorType);
    console.log(`======================================================\n`);

    printAccountList(cache);
  } catch (err) {
    console.error('[FETCH] Kết nối thất bại:', err.message);
  }
}

// ============================================================================
// 2. LIỆT KÊ TÀI KHOẢN TRONG CACHE
// ============================================================================
function printAccountList(cache, filterField = null) {
  const accounts = Object.values(cache.accounts || {});
  if (accounts.length === 0) {
    console.log('[CACHE] Hiện chưa có tài khoản nào trong cache. Hãy chạy: node src/scripts/tkgd_case_inspector.js --fetch');
    return;
  }

  console.log(`\n====================================================================================================`);
  console.log(`DANH SÁCH TÀI KHOẢN TRONG CACHE (${accounts.length} tài khoản) - Cập nhật lúc: ${cache.lastUpdated || 'N/A'}`);
  console.log(`====================================================================================================`);
  console.log(
    `| STT | Mã TKGD      | Họ và tên            | Ngày đợt   | Trạng thái | Lỗi chính (Mismatch Reasons)                       | Tệp ảnh CCCD`,
  );
  console.log(`|-----|--------------|----------------------|------------|------------|----------------------------------------------------|-------------`);

  accounts.forEach((acc, idx) => {
    const errs = acc.ketLuan?.danhSachLoi || [];
    let errSummary = errs.map((e) => e.split(':')[0]).join(', ');
    if (errSummary.length > 50) errSummary = errSummary.slice(0, 47) + '...';
    if (!errSummary) errSummary = 'None';

    const cccdFiles = (acc.diskFiles || []).filter((f) => f.isCccd && f.isCustomerFile).map((f) => f.name);
    let cccdSummary = cccdFiles.join(', ');
    if (cccdSummary.length > 25) cccdSummary = cccdSummary.slice(0, 22) + '...';
    if (!cccdSummary) cccdSummary = 'Chưa có file ảnh';

    const st = acc.ketLuan?.trangThai || 'N/A';
    const num = String(idx + 1).padStart(3, ' ');
    const code = (acc.maTKGD || '').padEnd(12, ' ');
    const name = (acc.hoTen || '').slice(0, 20).padEnd(20, ' ');
    const date = (acc.batchDate || '').padEnd(10, ' ');
    const stStr = st.padEnd(10, ' ');

    console.log(`| ${num} | ${code} | ${name} | ${date} | ${stStr} | ${errSummary.padEnd(50, ' ')} | ${cccdSummary}`);
  });
  console.log(`====================================================================================================\n`);
}

// ============================================================================
// 3. XEM CHI TIẾT 1 HỒ SƠ TỪ CACHE
// ============================================================================
function inspectAccount(code) {
  const cache = loadCache();
  const acc = cache.accounts[code];
  if (!acc) {
    console.error(`[INSPECT] Không tìm thấy tài khoản "${code}" trong cache!`);
    console.log(`Gợi ý: Chạy "node src/scripts/tkgd_case_inspector.js --fetch --code ${code}" để kéo trực tiếp từ Ubuntu.`);
    return;
  }

  console.log(`\n==================================================================================`);
  console.log(`CHI TIẾT HỒ SƠ: ${acc.maTKGD} - ${acc.hoTen} (Đợt: ${acc.batchDate})`);
  console.log(`==================================================================================`);
  console.log(`- Trạng thái thẩm định: [${acc.ketLuan?.trangThai || 'UNKNOWN'}]`);
  console.log(`- Thư mục lưu trữ: ${acc.folderPath}`);
  console.log(`\n1. CÁC TỆP TIN TRONG THƯ MỤC:`);
  (acc.diskFiles || []).forEach((f) => {
    const role = f.isContract ? '[HỢP ĐỒNG]' : f.isPl01 ? '[PHỤ LỤC 01]' : f.isCccd ? '[CCCD/CMND]' : '[KHÁC]';
    const src = f.isCustomerFile ? '👤 KHÁCH GỬI' : '🤖 M-SYSTEM THUMBNAIL';
    console.log(`   * ${f.name.padEnd(40, ' ')} ${role.padEnd(15, ' ')} (${src}) - ${(f.sizeBytes / 1024).toFixed(1)} KB`);
  });

  console.log(`\n2. ĐỐI SOÁT TRƯỜNG DỮ LIỆU (M-System Web vs Hồ Sơ/OCR):`);
  const fields = [
    { label: 'Họ và tên', ms: acc.ms?.hoVaTen, doc: acc.hopDong?.hoTen || acc.canCuoc?.hoTen },
    { label: 'Số CCCD/Hộ chiếu', ms: acc.ms?.soCMND_HoChieu, doc: acc.hopDong?.soCCCD || acc.canCuoc?.soCCCD },
    { label: 'Ngày sinh', ms: acc.ms?.ngaySinh, doc: acc.hopDong?.ngaySinh || acc.canCuoc?.ngaySinh },
    { label: 'Giới tính', ms: acc.ms?.gioiTinh, doc: acc.hopDong?.gioiTinh || acc.canCuoc?.gioiTinh },
    { label: 'Ngày cấp', ms: acc.ms?.ngayCap, doc: acc.hopDong?.ngayCap || acc.canCuoc?.ngayCap },
    { label: 'Nơi cấp', ms: acc.ms?.noiCap, doc: acc.hopDong?.noiCap || acc.canCuoc?.noiCap },
  ];

  console.log(`   | Trường Thông Tin       | M-System Web         | Hồ Sơ / OCR          | Khớp?`);
  console.log(`   |------------------------|----------------------|----------------------|------`);
  fields.forEach((f) => {
    const isMatch = f.ms && f.doc && f.ms.trim().toUpperCase() === f.doc.trim().toUpperCase();
    const matchIcon = isMatch ? '✅ KHỚP' : '❌ LỆCH';
    console.log(`   | ${f.label.padEnd(22, ' ')} | ${(f.ms || '-').padEnd(20, ' ')} | ${(f.doc || '-').padEnd(20, ' ')} | ${matchIcon}`);
  });

  console.log(`\n3. DANH SÁCH LỖI GHI NHẬN:`);
  const errs = acc.ketLuan?.danhSachLoi || [];
  if (errs.length === 0) {
    console.log(`   (Không có lỗi ghi nhận)`);
  } else {
    errs.forEach((e) => console.log(`   🔴 ${e}`));
  }

  const testRuns = acc.testRuns || [];
  console.log(`\n4. LỊCH SỬ CHẠY THỬ NGHIỆM (TEST RUNS: ${testRuns.length}):`);
  if (testRuns.length === 0) {
    console.log(`   Chưa có lần chạy test nào. Hãy chạy: node src/scripts/tkgd_case_inspector.js --test ${acc.maTKGD}`);
  } else {
    testRuns.forEach((tr, i) => {
      console.log(`   [Run #${i + 1}] Lúc: ${tr.testedAt} -> Kết quả: [${tr.status}]`);
      if (tr.diffNotes && tr.diffNotes.length) {
        tr.diffNotes.forEach((n) => console.log(`      -> ${n}`));
      }
    });
  }
  console.log(`==================================================================================\n`);
}

// ============================================================================
// 4. CHẠY BÓC TÁCH KIỂM TRA THỬ NGHIỆM (TEST RUN) TRÊN UBUNTU
// ============================================================================
async function runTestOnAccount(code, options = {}) {
  const cache = loadCache();
  const acc = cache.accounts[code];
  if (!acc) {
    console.error(`[TEST] Tài khoản "${code}" chưa có trong cache!`);
    console.log(`Đang tự động kéo dữ liệu tài khoản này từ Ubuntu trước...`);
    await fetchCases({ code });
    return runTestOnAccount(code, options);
  }

  console.log(`\n==================================================================================`);
  console.log(`[TEST-RUN] Bắt đầu chạy bóc tách thử nghiệm cho: ${acc.maTKGD} (${acc.hoTen})`);
  console.log(`==================================================================================`);

  // Tìm file hợp đồng, phụ lục, cccd mặt trước, cccd mặt sau từ diskFiles
  const diskFiles = acc.diskFiles || [];
  const hdFile =
    diskFiles.find((f) => f.isContract && f.ext === '.pdf')?.path ||
    diskFiles.find((f) => /(h[o|ô].?d[o|ô]ng|\bhd\b|hđ)/i.test(f.name) && f.ext === '.pdf')?.path ||
    diskFiles.find((f) => f.isContract && ['.jpg', '.jpeg', '.png', '.webp', '.paint'].includes(f.ext))?.path ||
    diskFiles.find((f) => /(h[o|ô].?d[o|ô]ng|\bhd\b|hđ)/i.test(f.name) && ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.paint'].includes(f.ext))?.path ||
    '';
  const plFile =
    diskFiles.find((f) => f.isPl01 && f.ext === '.pdf')?.path ||
    diskFiles.find((f) => /(pl01|phu.?luc)/i.test(f.name) && f.ext === '.pdf')?.path ||
    '';

  // Ưu tiên tệp cccd của khách hàng (lọc bỏ _MS_ và file hợp đồng)
  const cccdCustomer = diskFiles.filter((f) => f.isCccd && f.isCustomerFile && !f.isContract);
  let frontFile = cccdCustomer.find((f) => /truoc|front|mat_?1|(^|[^a-z0-9])mt([^a-z0-9]|$)/i.test(f.name))?.path || '';
  let backFile = cccdCustomer.find((f) => /sau|back|mat_?2|(^|[^a-z0-9])ms([^a-z0-9]|$)/i.test(f.name))?.path || '';

  // Nếu có file PDF CCCD (như CCCD PHAN SƠN HƯNG.pdf)
  const cccdPdf = diskFiles.find((f) => f.isCccd && f.ext === '.pdf')?.path;
  if (!frontFile && cccdPdf) {
    frontFile = cccdPdf;
  }

  // Nếu có file CCCD đơn lẻ (chứa cả 2 mặt hoặc 1 mặt, vd: CCCD Dương Hoàng Hải.paint)
  if (!frontFile && cccdCustomer.length > 0) {
    frontFile = cccdCustomer[0].path;
    if (cccdCustomer.length > 1 && !backFile) {
      backFile = cccdCustomer[1].path;
    }
  }

  // Nếu vẫn chưa có, lấy file ảnh bất kỳ của khách gửi (loại trừ hợp đồng)
  if (!frontFile) {
    const custImages = diskFiles.filter(
      (f) =>
        f.isCustomerFile &&
        !f.isContract &&
        !/h[o|ô].?d[o|ô]ng|\bhd\b/i.test(f.name) &&
        ['.jpg', '.jpeg', '.png', '.webp', '.paint', '.heic', '.heif'].includes(f.ext),
    );
    if (custImages.length >= 2) {
      frontFile = custImages[0].path;
      backFile = custImages[1].path;
    } else if (custImages.length === 1) {
      frontFile = custImages[0].path;
    }
  }

  console.log(`- File Hợp Đồng: ${hdFile || '(Không có)'}`);
  console.log(`- File Phụ Lục:  ${plFile || '(Không có)'}`);
  console.log(`- File Mặt Trước: ${frontFile || '(Không có)'}`);
  console.log(`- File Mặt Sau:   ${backFile || '(Không có)'}`);

  const remoteTestCmd = `
cd /opt/mxv-checklist/backend && python3 -c '
import sys, json, os
sys.path.append("/opt/mxv-checklist/backend/src/scripts/python")
from tkgd_extractor_worker import process_account_files

code = "${acc.maTKGD}"
name = "${acc.hoTen || ''}"
hd = "${hdFile}" if "${hdFile}" and os.path.exists("${hdFile}") else None
pl = "${plFile}" if "${plFile}" and os.path.exists("${plFile}") else None
front = "${frontFile}" if "${frontFile}" and os.path.exists("${frontFile}") else None
back = "${backFile}" if "${backFile}" and os.path.exists("${backFile}") else None

try:
    res = process_account_files(hopdong=hd, phuluc=pl, front=front, back=back, code=code, name=name)
    print("###EXTRACT_START###" + json.dumps(res, ensure_ascii=False) + "###EXTRACT_END###")
except Exception as e:
    import traceback
    traceback.print_exc()
    print("###EXTRACT_ERR###" + str(e) + "###EXTRACT_END###")
'
`;

  try {
    const { stdout, stderr } = await executeSshCommand(remoteTestCmd);
    const startTag = '###EXTRACT_START###';
    const endTag = '###EXTRACT_END###';
    const sIdx = stdout.indexOf(startTag);
    const eIdx = stdout.indexOf(endTag);

    if (sIdx === -1 || eIdx === -1) {
      console.error('[TEST-RUN] Lỗi thực thi Python worker trên Ubuntu:');
      console.error(stderr || stdout);
      return;
    }

    const extractRes = JSON.parse(stdout.substring(sIdx + startTag.length, eIdx));
    const canCuoc = extractRes.canCuoc || {};
    const hopDong = extractRes.hopDong || {};
    const ms = acc.ms || {};

    console.log(`\n==================================================================================`);
    console.log(`KẾT QUẢ BÓC TÁCH MỚI (TEST RUN):`);
    console.log(`==================================================================================`);
    console.log(`- Họ và tên trích xuất:    HĐ: "${hopDong.hoTen || '-'}" | CCCD: "${canCuoc.hoTen || '-'}"`);
    console.log(`- Số CCCD trích xuất:      HĐ: "${hopDong.soCCCD || '-'}" | CCCD: "${canCuoc.soCCCD || '-'}"`);
    console.log(`- Ngày sinh trích xuất:    HĐ: "${hopDong.ngaySinh || '-'}" | CCCD: "${canCuoc.ngaySinh || '-'}"`);
    console.log(`- Giới tính trích xuất:    HĐ: "${hopDong.gioiTinh || '-'}" | CCCD: "${canCuoc.gioiTinh || '-'}"`);
    console.log(`- Ngày cấp trích xuất:     HĐ: "${hopDong.ngayCap || '-'}" | CCCD: "${canCuoc.ngayCap || '-'}"`);
    console.log(`- Nguồn trích xuất CCCD:   [${canCuoc.source || 'NONE'}] (Độ tin cậy: ${Math.round((canCuoc.confidenceScore || 0) * 100)}%)`);

    // So sánh đối chiếu với MS
    const newErrors = [];
    const diffNotes = [];

    // Kiểm tra họ tên
    const expectedName = ms.hoVaTen || acc.hoTen || '';
    const actualName = canCuoc.hoTen || hopDong.hoTen || '';
    if (expectedName && actualName) {
      const normExp = expectedName.trim().toUpperCase();
      const normAct = actualName.trim().toUpperCase();
      if (normExp !== normAct) {
        newErrors.push(`Lệch họ tên: Hồ sơ/OCR "${actualName}" != MS "${expectedName}"`);
      } else {
        diffNotes.push(`✅ Họ tên trùng khớp 100%: "${actualName}"`);
      }
    }

    // Kiểm tra số CCCD
    const expectedCccd = ms.soCMND_HoChieu || '';
    const actualCccd = canCuoc.soCCCD || hopDong.soCCCD || '';
    if (expectedCccd && actualCccd) {
      if (expectedCccd.replace(/\D/g, '') !== actualCccd.replace(/\D/g, '')) {
        newErrors.push(`Lệch số CCCD: Hồ sơ/OCR "${actualCccd}" != MS "${expectedCccd}"`);
      } else {
        diffNotes.push(`✅ Số CCCD trùng khớp 100%: "${actualCccd}"`);
      }
    }

    // Kiểm tra ngày sinh
    const expectedDob = ms.ngaySinh || '';
    const actualDob = canCuoc.ngaySinh || hopDong.ngaySinh || '';
    if (expectedDob && actualDob) {
      const normExpDob = normalizeDateStr(expectedDob);
      const normActDob = normalizeDateStr(actualDob);
      if (normExpDob && normActDob && normExpDob !== normActDob) {
        newErrors.push(`Lệch ngày sinh: Hồ sơ/OCR "${actualDob}" != MS "${expectedDob}"`);
      } else {
        diffNotes.push(`✅ Ngày sinh trùng khớp 100%: "${actualDob}"`);
      }
    }

    // Kiểm tra ngày cấp (nếu có trên cả 2 nguồn)
    const expectedCap = ms.ngayCap || '';
    const normExpCap = normalizeDateStr(expectedCap);
    const normHdCap = normalizeDateStr(hopDong.ngayCap || '');
    const normCccdCap = normalizeDateStr(canCuoc.ngayCap || '');

    if (expectedCap) {
      if (normHdCap && normExpCap && normHdCap === normExpCap) {
        diffNotes.push(`✅ Ngày cấp trùng khớp 100%: "${hopDong.ngayCap}" (HĐ & MS đồng thuận)`);
        if (normCccdCap && normCccdCap !== normExpCap) {
          diffNotes.push(`ℹ️ Ảnh CCCD OCR ra "${canCuoc.ngayCap}" (đã tự động chuẩn hóa theo HĐ & MS)`);
        }
      } else if (normCccdCap && normExpCap && normCccdCap === normExpCap) {
        diffNotes.push(`✅ Ngày cấp trùng khớp 100%: "${canCuoc.ngayCap}" (CCCD & MS đồng thuận)`);
      } else if (normCccdCap && normExpCap && normCccdCap !== normExpCap) {
        newErrors.push(`Lệch ngày cấp: Hồ sơ/OCR "${canCuoc.ngayCap}" != MS "${expectedCap}"`);
      }
    }

    // Kiểm tra giới tính
    const expectedGender = ms.gioiTinh || '';
    const actualGender = canCuoc.gioiTinh || hopDong.gioiTinh || '';
    if (expectedGender && actualGender) {
      if (expectedGender.trim().toLowerCase() !== actualGender.trim().toLowerCase()) {
        newErrors.push(`Lệch giới tính: Hồ sơ/OCR "${actualGender}" != MS "${expectedGender}"`);
      } else {
        diffNotes.push(`✅ Giới tính trùng khớp 100%: "${actualGender}"`);
      }
    }

    // Đánh giá trạng thái mới
    let newStatus = 'KHOP';
    if (newErrors.length > 0) {
      newStatus = 'LECH';
    } else if (!actualCccd || !actualDob) {
      newStatus = 'CAN_KIEM_TRA';
    }

    const oldStatus = acc.ketLuan?.trangThai || 'LECH';
    console.log(`\n==================================================================================`);
    console.log(`ĐÁNH GIÁ SO SÁNH TRƯỚC VÀ SAU:`);
    console.log(`- Trạng thái cũ trong DB:   [${oldStatus}]`);
    console.log(`- Trạng thái mới kiểm thử:  [${newStatus}]`);
    if (oldStatus === 'LECH' && newStatus === 'KHOP') {
      console.log(`🎉 CHUYỂN BIẾN THÀNH CÔNG: ĐÃ KHỚP HOÀN TOÀN 100%!`);
    }

    diffNotes.forEach((n) => console.log(`  ${n}`));
    newErrors.forEach((e) => console.log(`  🔴 ${e}`));

    // Lưu vào testRuns của cache
    const testRecord = {
      testedAt: new Date().toISOString(),
      oldStatus,
      newStatus,
      status: newStatus,
      diffNotes,
      newErrors,
      extracted: {
        canCuoc,
        hopDong,
      },
    };

    acc.testRuns = acc.testRuns || [];
    acc.testRuns.push(testRecord);
    cache.accounts[code] = acc;
    saveCache(cache);

    console.log(`\n[CACHE] Đã lưu kết quả Test Run vào cache tài khoản.`);
    console.log(`- Để xem lại bất kỳ lúc nào: node src/scripts/tkgd_case_inspector.js --inspect ${code}`);
    console.log(`- Để chính thức cập nhật vào DB: node src/scripts/tkgd_case_inspector.js --reparse ${code}`);
    console.log(`==================================================================================\n`);
  } catch (err) {
    console.error('[TEST-RUN] Lỗi:', err.message);
  }
}

// ============================================================================
// 5. CHÍNH THỨC CẬP NHẬT DATABASE QUA API REPARSE TRÊN UBUNTU
// ============================================================================
async function reparseOnUbuntu(code, fallbackBatchDate = '') {
  const cache = loadCache();
  const acc = cache.accounts ? cache.accounts[code] : null;
  const recordId = acc ? acc._id : '';
  const batchDate = (acc && acc.batchDate) ? acc.batchDate : (fallbackBatchDate || '');

  console.log(`\n[REPARSE] Đang gửi yêu cầu Reparse chính thức lên Backend Ubuntu cho ${code}...`);
  const remoteCmd = `
cd /opt/mxv-checklist/backend && node -e '
const http = require("http");
const payload = {
  accountCode: "${code}"
};
${recordId ? `payload.recordId = "${recordId}";` : ''}
${batchDate ? `payload.batchDate = "${batchDate}";` : ''}
const postData = JSON.stringify(payload);

const req = http.request({
  hostname: "127.0.0.1",
  port: 3001,
  path: "/api/v1/tkgd/reparse-account",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    "x-user-email": "hieptruong@mxv.vn"
  },
  timeout: 60000
}, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    console.log("RESPONSE:" + data);
  });
});
req.on("error", e => console.error("ERR:" + e.message));
req.write(postData);
req.end();
'
`;


  try {
    const { stdout, stderr } = await executeSshCommand(remoteCmd);
    console.log(stdout || stderr);
    console.log(`[REPARSE] Hoàn tất reparse cho ${code}. Bạn có thể fetch lại để kiểm tra:`);
    console.log(`  node src/scripts/tkgd_case_inspector.js --fetch --code ${code}`);
  } catch (err) {
    console.error('[REPARSE] Lỗi:', err.message);
  }
}

// ============================================================================
// 6. SCAN ANOMALIES TRÊN UBUNTU DB (Tìm các hồ sơ bị OCR rác, tên ma, ngày ma)
// ============================================================================
async function scanAnomaliesOnUbuntu(options = {}) {
  const dateFilter = options.date || null;
  const statusFilter = options.status || 'ALL';
  console.log(`\n=======================================================================`);
  console.log(`[SCAN-ANOMALIES] Đang kết nối tới Ubuntu (${SSH_CONFIG.host}) quét tìm hồ sơ bất thường...`);
  console.log(`[SCAN-ANOMALIES] Bộ lọc: Ngày=${dateFilter || 'TẤT CẢ'}, Trạng thái=${statusFilter}`);
  console.log(`=======================================================================\n`);

  const innerScript = `
(async () => {
  require("/opt/mxv-checklist/backend/node_modules/dotenv").config({ path: "/opt/mxv-checklist/backend/.env", quiet: true });
  const { MongoClient } = require("/opt/mxv-checklist/backend/node_modules/mongodb");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error(JSON.stringify({ error: "MONGODB_URI not found" }));
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection("clean_account_records");

  const query = {};
  const date = "${dateFilter || ""}";
  if (date) query.batchDate = date;
  const status = "${statusFilter}";
  if (status !== "ALL") query["ketLuan.trangThai"] = status;

  const records = await col.find(query).sort({ batchDate: -1, createdAt: -1 }).toArray();

  const JUNK_NAME_KEYWORDS = [
    "để thực hiện", "thực hiện", "bên b", "công ty", "sở tài chính",
    "đại diện", "giấy phép", "thành lập", "chi nhánh", "ký bởi",
    "mở tài khoản", "hợp đồng", "quy định", "hitech", "gia cát lợi"
  ];

  const JUNK_ISSUE_KEYWORDS = [
    "sở tài chính", "sở kế hoạch", "ủy ban", "uy ban", "hội đồng", "ubnd"
  ];

  const anomalies = [];

  for (const r of records) {
    const accCode = r.maTKGD || r.maTKGDBase || "UNKNOWN";
    const hdName = String(r.hopDong?.hoVaTen || "").trim();
    const ccName = String(r.canCuoc?.hoVaTen || "").trim();
    const msName = String(r.ms?.hoVaTen || r.ms?.tenTKGD || "").trim();
    const mailName = String(r.noiDungMail?.tenTaiKhoan || "").trim();

    const hdIssue = String(r.hopDong?.rawNgayCap || r.hopDong?.ngayCap || "").trim();
    const ccIssue = String(r.canCuoc?.rawNgayCap || r.canCuoc?.ngayCap || "").trim();

    const hdPlace = String(r.hopDong?.noiCap || "").trim();
    const ccPlace = String(r.canCuoc?.noiCap || "").trim();

    const hdCccd = String(r.hopDong?.soCanCuoc || "").trim();
    const ccCccd = String(r.canCuoc?.soCanCuoc || "").trim();
    const msCccd = String(r.ms?.soCMND_HoChieu || "").trim();

    const errors = r.ketLuan?.danhSachLoi || [];
    const reasons = [];

    // 1. Dị thường Tên (OCR hallucination hoặc bắt nhầm từ khóa HĐ)
    for (const name of [hdName, ccName]) {
      if (!name) continue;
      const lower = name.toLowerCase();
      if (JUNK_NAME_KEYWORDS.some(k => lower.includes(k))) {
        reasons.push({ type: "BAD_NAME_KEYWORD", field: "hoTen", value: name, detail: "Chứa từ khóa rác HĐ" });
      }
      if (/[#§@&=+*~|\\_]/.test(name) || (name.length > 15 && name.includes("...") && !/[à-ỹ]/i.test(name)) || /sa\\s*2c|etrift|sixes/i.test(name)) {
        reasons.push({ type: "BAD_NAME_OCR_NOISE", field: "hoTen", value: name, detail: "Ký tự nhiễu hoặc OCR ảo giác" });
      }
      if (name.length > 0 && name.length < 4 && name !== "-" && !["nam", "nữ", "nu"].includes(name.toLowerCase())) {
        reasons.push({ type: "BAD_NAME_TOO_SHORT", field: "hoTen", value: name, detail: "Tên quá ngắn (< 4 ký tự)" });
      }
    }

    // 2. Dị thường Ngày cấp
    for (const issue of [hdIssue, ccIssue]) {
      if (!issue) continue;
      if (/[#§@&=+*~|\\_]/.test(issue) || /(eps|tai|opt|dz4)/i.test(issue) || issue.includes("...")) {
        reasons.push({ type: "BAD_ISSUE_DATE_NOISE", field: "ngayCap", value: issue, detail: "Ngày cấp chứa ký tự rác OCR" });
      }
    }

    // 3. Dị thường Nơi cấp
    for (const place of [hdPlace, ccPlace]) {
      if (!place) continue;
      const pLower = place.toLowerCase();
      if (JUNK_ISSUE_KEYWORDS.some(k => pLower.includes(k))) {
        reasons.push({ type: "BAD_ISSUE_PLACE_CORP", field: "noiCap", value: place, detail: "Bắt nhầm nơi cấp giấy phép TVKD (Sở TC / SKHĐT)" });
      }
      if (/[#§@&=+*~|\\_]/.test(place) || /kaui|ene/i.test(place) || place.includes("...")) {
        reasons.push({ type: "BAD_ISSUE_PLACE_NOISE", field: "noiCap", value: place, detail: "Nơi cấp chứa ký tự rác OCR" });
      }
    }

    // 4. Dị thường Số CCCD
    for (const cccd of [hdCccd, ccCccd]) {
      if (!cccd) continue;
      const digits = cccd.replace(/\\D/g, "");
      if (digits.length !== 9 && digits.length !== 12 && digits.length > 0) {
        reasons.push({ type: "BAD_CCCD_LENGTH", field: "soCanCuoc", value: cccd, detail: "Độ dài CCCD không phải 9 hoặc 12 số (" + digits.length + " số)" });
      }
    }

    // 5. Desync giữa lỗi DB và dữ liệu
    if (errors.some(e => e.includes("Lệch họ tên")) && (hdName === msName || ccName === msName || mailName === msName) && msName) {
      reasons.push({ type: "DESYNC_NAME_ERROR", field: "ketLuan", value: errors.find(e => e.includes("Lệch họ tên")), detail: "Báo lệch tên nhưng tên thực tế đã khớp" });
    }

    if (reasons.length > 0) {
      anomalies.push({
        maTKGD: accCode,
        hoTenMS: msName || mailName || "CHƯA RÕ",
        batchDate: r.batchDate,
        trangThai: r.ketLuan?.trangThai,
        reasons
      });
    }
  }

  const fs = require("fs");
  fs.writeFileSync("/tmp/tkgd_anomalies.json", JSON.stringify({ totalChecked: records.length, anomalies }), "utf-8");
  console.log("---SCAN_DONE---");
  await client.close();
  process.exit(0);
})().catch(e => {
  console.error("ERROR:" + e.message);
  process.exit(1);
});
`;

  const b64 = Buffer.from(innerScript, 'utf-8').toString('base64');
  const remoteCmd = `node -e "eval(Buffer.from('${b64}', 'base64').toString('utf-8'))" && cat /tmp/tkgd_anomalies.json`;

  try {
    const { stdout, stderr } = await executeSshCommand(remoteCmd);
    const jsonStart = stdout.indexOf('{"totalChecked"');
    if (jsonStart === -1) {
      console.error('[SCAN-ANOMALIES] Không tìm thấy JSON từ Ubuntu:', stdout || stderr);
      return;
    }
    const rawJson = stdout.slice(jsonStart);
    const data = JSON.parse(rawJson);
    
    // Lưu kết quả vào file cache để xem chi tiết không bị cắt xén
    const REPORT_FILE = path.join(CACHE_DIR, 'anomalies_report.json');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`=======================================================================`);
    console.log(`KẾT QUẢ QUÉT BẤT THƯỜNG TRÊN UBUNTU DATABASE:`);
    console.log(`- Tổng số hồ sơ kiểm tra:      ${data.totalChecked}`);
    console.log(`- Số hồ sơ phát hiện dị thường: ${data.anomalies.length}`);
    console.log(`- Đã lưu chi tiết vào file:   ${REPORT_FILE}`);
    console.log(`=======================================================================\n`);

    if (data.anomalies.length === 0) {
      console.log('✅ Không phát hiện hồ sơ nào có trường dữ liệu bất thường!');
      return;
    }

    // Phân nhóm theo loại bất thường
    const groupByType = {};
    for (const item of data.anomalies) {
      for (const r of item.reasons) {
        if (!groupByType[r.type]) groupByType[r.type] = [];
        groupByType[r.type].push({
          maTKGD: item.maTKGD,
          hoTenMS: item.hoTenMS,
          batchDate: item.batchDate,
          trangThai: item.trangThai,
          field: r.field,
          value: r.value,
          detail: r.detail,
        });
      }
    }

    console.log(`TỔNG HỢP THEO LOẠI BẤT THƯỜNG:`);
    for (const [type, list] of Object.entries(groupByType)) {
      console.log(`  🔹 [${type}]: ${list.length} trường hợp (${list[0].detail})`);
    }

    console.log(`\n-----------------------------------------------------------------------`);
    console.log(`DANH SÁCH CÁC TRƯỜNG HỢP TIÊU BIỂU CẦN FIX (Tối đa 25 trường hợp):`);
    console.log(`-----------------------------------------------------------------------`);

    const sample = data.anomalies.slice(0, 25);
    for (let i = 0; i < sample.length; i++) {
      const item = sample[i];
      console.log(`\n[#${i + 1}] Mã TKGD: ${item.maTKGD} | KH: ${item.hoTenMS} | Đợt: ${item.batchDate} | [${item.trangThai}]`);
      for (const r of item.reasons) {
        console.log(`    ⚠️ [${r.type}] Trường: ${r.field}`);
        console.log(`       Giá trị lỗi: "${r.value}"`);
        console.log(`       Mô tả: ${r.detail}`);
      }
    }

    if (data.anomalies.length > 25) {
      console.log(`\n... và còn ${data.anomalies.length - 25} trường hợp khác được lưu chi tiết trong: ${REPORT_FILE}`);
    }

    console.log(`\n=======================================================================`);
    console.log(`Gợi ý xử lý:`);
    console.log(`  - Xem chi tiết từng tài khoản: node src/scripts/tkgd_case_inspector.js --inspect <Mã TK>`);
    console.log(`  - Thử nghiệm bóc tách mới:    node src/scripts/tkgd_case_inspector.js --test <Mã TK>`);
  } catch (err) {
    console.error('[SCAN-ANOMALIES] Lỗi thực thi SSH:', err.message);
  }
}

// ============================================================================
// 7. PHÂN TÍCH TẤT CẢ TÀI KHOẢN LỆCH TRÊN UBUNTU DATABASE
// ============================================================================
async function analyzeLechAccountsOnUbuntu(options = {}) {
  const dateFilter = options.date || null;
  console.log(`\n=======================================================================`);
  console.log(`[ANALYZE-LECH] Đang kết nối tới Ubuntu (${SSH_CONFIG.host}) phân tích hồ sơ LỆCH...`);
  console.log(`=======================================================================\n`);

  const innerScript = `
(async () => {
  require("/opt/mxv-checklist/backend/node_modules/dotenv").config({ path: "/opt/mxv-checklist/backend/.env", quiet: true });
  const { MongoClient } = require("/opt/mxv-checklist/backend/node_modules/mongodb");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error(JSON.stringify({ error: "MONGODB_URI not found" }));
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection("clean_account_records");

  const totalAll = await col.countDocuments();
  const statusStats = await col.aggregate([
    { $group: { _id: "$ketLuan.trangThai", count: { $sum: 1 } } }
  ]).toArray();

  const query = { "ketLuan.trangThai": "LECH" };
  const date = "${dateFilter || ""}";
  if (date) query.batchDate = date;

  const lechRecords = await col.find(query).sort({ batchDate: -1, createdAt: -1 }).toArray();

  const categories = {
    MS_MISSING_CCCD: [],
    MISMATCH_CCCD: [],
    MISMATCH_NAME: [],
    MISMATCH_DOB: [],
    MISMATCH_ISSUE_DATE: [],
    MISMATCH_GENDER: [],
    NO_CUSTOMER_FILES: [],
    OTHER_MISMATCH: []
  };

  const byTvkd = {};

  for (const r of lechRecords) {
    const accCode = r.maTKGD || r.maTKGDBase || "UNKNOWN";
    const tvkd = r.maTVKD || accCode.substring(0, 3) || "OTHER";
    byTvkd[tvkd] = (byTvkd[tvkd] || 0) + 1;

    const errors = r.ketLuan?.danhSachLoi || [];
    const joined = errors.join(" ");

    const info = {
      maTKGD: accCode,
      tvkd,
      hoTen: r.ms?.hoVaTen || r.hopDong?.hoVaTen || "N/A",
      batchDate: r.batchDate,
      danhSachLoi: errors,
      msData: {
        hoVaTen: r.ms?.hoVaTen,
        soCCCD: r.ms?.soCMND_HoChieu,
        ngaySinh: r.ms?.rawNgaySinh,
        ngayCap: r.ms?.rawNgayCap
      },
      hopDongData: {
        hoVaTen: r.hopDong?.hoVaTen,
        soCCCD: r.hopDong?.soCanCuoc,
        ngaySinh: r.hopDong?.rawNgaySinh,
        ngayCap: r.hopDong?.rawNgayCap
      },
      canCuocData: {
        hoVaTen: r.canCuoc?.hoVaTen,
        soCCCD: r.canCuoc?.soCanCuoc,
        ngaySinh: r.canCuoc?.rawNgaySinh,
        ngayCap: r.canCuoc?.rawNgayCap
      }
    };

    let categorized = false;
    if (/M-System chưa nhập số CCCD/i.test(joined)) {
      categories.MS_MISSING_CCCD.push(info);
      categorized = true;
    }
    if (/Lệch số CCCD/i.test(joined)) {
      categories.MISMATCH_CCCD.push(info);
      categorized = true;
    }
    if (/Lệch họ tên/i.test(joined)) {
      categories.MISMATCH_NAME.push(info);
      categorized = true;
    }
    if (/Lệch ngày sinh/i.test(joined)) {
      categories.MISMATCH_DOB.push(info);
      categorized = true;
    }
    if (/Lệch ngày cấp/i.test(joined)) {
      categories.MISMATCH_ISSUE_DATE.push(info);
      categorized = true;
    }
    if (/Lệch giới tính/i.test(joined)) {
      categories.MISMATCH_GENDER.push(info);
      categorized = true;
    }
    if (/thiếu file|chưa có file|không đọc được/i.test(joined)) {
      categories.NO_CUSTOMER_FILES.push(info);
      categorized = true;
    }
    if (!categorized) {
      categories.OTHER_MISMATCH.push(info);
    }
  }

  const result = {
    totalAll,
    statusBreakdown: statusStats,
    totalLech: lechRecords.length,
    byTvkd,
    summaryByCategory: {
      MS_MISSING_CCCD: categories.MS_MISSING_CCCD.length,
      MISMATCH_CCCD: categories.MISMATCH_CCCD.length,
      MISMATCH_NAME: categories.MISMATCH_NAME.length,
      MISMATCH_DOB: categories.MISMATCH_DOB.length,
      MISMATCH_ISSUE_DATE: categories.MISMATCH_ISSUE_DATE.length,
      MISMATCH_GENDER: categories.MISMATCH_GENDER.length,
      NO_CUSTOMER_FILES: categories.NO_CUSTOMER_FILES.length,
      OTHER_MISMATCH: categories.OTHER_MISMATCH.length
    },
    categories
  };

  const fs = require("fs");
  fs.writeFileSync("/tmp/tkgd_lech_analysis.json", JSON.stringify(result), "utf-8");
  console.log("---LECH_ANALYSIS_DONE---");
  await client.close();
  process.exit(0);
})().catch(e => {
  console.error("ERROR:" + e.message);
  process.exit(1);
});
`;

  const b64 = Buffer.from(innerScript, 'utf-8').toString('base64');
  const remoteCmd = `node -e "eval(Buffer.from('${b64}', 'base64').toString('utf-8'))" && cat /tmp/tkgd_lech_analysis.json`;

  try {
    const { stdout, stderr } = await executeSshCommand(remoteCmd);
    const jsonStart = stdout.indexOf('{"totalAll"');
    if (jsonStart === -1) {
      console.error('[ANALYZE-LECH] Không tìm thấy JSON từ Ubuntu:', stdout || stderr);
      return;
    }
    const rawJson = stdout.slice(jsonStart);
    const data = JSON.parse(rawJson);

    const REPORT_FILE = path.join(CACHE_DIR, 'lech_analysis_report.json');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`=======================================================================`);
    console.log(`BÁO CÁO PHÂN TÍCH TOÀN BỘ TÀI KHOẢN LỆCH TRÊN UBUNTU DATABASE:`);
    console.log(`- Tổng số hồ sơ trong hệ thống:    ${data.totalAll}`);
    console.log(`- Phân bố trạng thái:`, data.statusBreakdown);
    console.log(`- Tổng số hồ sơ đang bị LỆCH:      ${data.totalLech}`);
    console.log(`- Báo cáo chi tiết đã lưu vào:     ${REPORT_FILE}`);
    console.log(`=======================================================================\n`);

    console.log(`PHÂN LOẠI CHI TIẾT CÁC NGUYÊN NHÂN LỆCH:`);
    console.log(`  1. M-System chưa nhập số CCCD (MS rỗng):     ${data.summaryByCategory.MS_MISSING_CCCD} ca`);
    console.log(`  2. Lệch số CCCD (Hồ sơ != MS):               ${data.summaryByCategory.MISMATCH_CCCD} ca`);
    console.log(`  3. Lệch họ tên (Hồ sơ != MS):                ${data.summaryByCategory.MISMATCH_NAME} ca`);
    console.log(`  4. Lệch ngày cấp CCCD (Hồ sơ != MS):         ${data.summaryByCategory.MISMATCH_ISSUE_DATE} ca`);
    console.log(`  5. Lệch ngày sinh (Hồ sơ != MS):             ${data.summaryByCategory.MISMATCH_DOB} ca`);
    console.log(`  6. Lệch giới tính:                           ${data.summaryByCategory.MISMATCH_GENDER} ca`);
    console.log(`  7. Thiếu file ảnh / Chưa có file:            ${data.summaryByCategory.NO_CUSTOMER_FILES} ca`);
    console.log(`  8. Lý do khác / Sai định dạng:               ${data.summaryByCategory.OTHER_MISMATCH} ca`);

    console.log(`\nPHÂN BỐ TÀI KHOẢN LỆCH THEO TVKD (Top TVKD):`);
    const sortedTvkd = Object.entries(data.byTvkd || {}).sort((a, b) => b[1] - a[1]);
    for (const [tvkd, count] of sortedTvkd.slice(0, 10)) {
      console.log(`  - TVKD ${tvkd}: ${count} tài khoản lệch`);
    }

    return data;
  } catch (err) {
    console.error('[ANALYZE-LECH] Lỗi:', err.message);
  }
}

// ============================================================================
// 8. XUẤT BÁO CÁO DANH SÁCH TÀI KHOẢN M-SYSTEM CHƯA NHẬP CCCD (GỬI GIÁM SÁT)
// ============================================================================
function exportMsMissingCccdAccounts() {
  const REPORT_FILE = path.join(CACHE_DIR, 'lech_analysis_report.json');
  if (!fs.existsSync(REPORT_FILE)) {
    console.log('[EXPORT] Chưa có file lech_analysis_report.json. Vui lòng chạy: node src/scripts/tkgd_case_inspector.js --analyze-lech trước!');
    return;
  }

  const data = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  const list = data.categories?.MS_MISSING_CCCD || [];
  console.log(`\n=======================================================================`);
  console.log(`[EXPORT] Đang xuất danh sách ${list.length} tài khoản M-System chưa nhập số CCCD...`);
  console.log(`=======================================================================\n`);

  // Tạo file CSV với BOM UTF-8 để mở trực tiếp trên Excel không bị lỗi font tiếng Việt
  const CSV_FILE = path.join(CACHE_DIR, 'danh_sach_tk_ms_chua_nhap_cccd.csv');
  const headers = ['STT', 'Mã TKGD', 'TVKD', 'Họ và tên', 'Ngày đợt', 'Số CCCD HĐ', 'Số CCCD Thẻ', 'Ngày sinh', 'Ngày cấp'];
  const rows = [headers.join(',')];

  list.forEach((item, idx) => {
    const cccdHd = item.hopDongData?.soCCCD || '';
    const cccdCard = item.canCuocData?.soCCCD || '';
    const dob = item.canCuocData?.ngaySinh || item.hopDongData?.ngaySinh || '';
    const issue = item.canCuocData?.ngayCap || item.hopDongData?.ngayCap || '';
    rows.push([
      idx + 1,
      `"${item.maTKGD}"`,
      `"${item.tvkd}"`,
      `"${item.hoTen}"`,
      `"${item.batchDate}"`,
      `"${cccdHd}"`,
      `"${cccdCard}"`,
      `"${dob}"`,
      `"${issue}"`
    ].join(','));
  });

  const bom = '\uFEFF';
  fs.writeFileSync(CSV_FILE, bom + rows.join('\r\n'), 'utf-8');

  console.log(`✅ Đã xuất báo cáo thành công ra file Excel/CSV:`);
  console.log(`   ${CSV_FILE}`);
  console.log(`\nTổng số: ${list.length} tài khoản cần TVKD bổ sung số CCCD lên M-System.`);
  console.log(`Bảng phân bố theo TVKD:`);
  const tvkdMap = {};
  list.forEach(i => tvkdMap[i.tvkd] = (tvkdMap[i.tvkd] || 0) + 1);
  for (const [k, v] of Object.entries(tvkdMap).sort((a, b) => b[1] - a[1])) {
    console.log(`  - TVKD ${k}: ${v} tài khoản`);
  }
  console.log(`=======================================================================\n`);
}

// ============================================================================
// 9. RE-EVALUATE TOÀN BỘ TÀI KHOẢN LỆCH QUA API REPARSE (ÁP DỤNG RULES MỚI VÀO DB)
// ============================================================================
async function reevalAllLechAccounts(options = {}) {
  const REPORT_FILE = path.join(CACHE_DIR, 'lech_analysis_report.json');
  if (!fs.existsSync(REPORT_FILE)) {
    console.log('[REEVAL] Chưa có file lech_analysis_report.json.');
    console.log('         Vui lòng chạy trước: node src/scripts/tkgd_case_inspector.js --analyze-lech');
    return;
  }

  const data = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  
  // Lấy tất cả tài khoản LECH từ tất cả categories
  const allCodes = new Set();
  for (const cat of Object.values(data.categories || {})) {
    for (const item of (cat || [])) {
      if (item.maTKGD) allCodes.add(item.maTKGD);
    }
  }

  const codeList = [...allCodes];
  console.log(`\n=======================================================================`);
  console.log(`[REEVAL-ALL-LECH] Bắt đầu re-evaluate ${codeList.length} tài khoản LỆCH...`);
  console.log(`[REEVAL-ALL-LECH] Áp dụng rules mới (Consensus Healing, CAN_KIEM_TRA, v.v.)`);
  console.log(`[REEVAL-ALL-LECH] Thực thi song song: 3 luồng | Delay: 300ms`);
  console.log(`=======================================================================\n`);

  const CONCURRENCY = 3;
  const DELAY_MS = 300;
  let successCount = 0;
  let failCount = 0;
  const failedCodes = [];
  const startTime = Date.now();

  // Xử lý batch theo concurrency
  for (let i = 0; i < codeList.length; i += CONCURRENCY) {
    const batch = codeList.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (code, j) => {
      const idx = i + j + 1;
      console.log(`[${idx}/${codeList.length}] Reparsing ${code}...`);
      try {
        await reparseOnUbuntu(code);
        successCount++;
      } catch (err) {
        failCount++;
        failedCodes.push(code);
        console.error(`  ❌ Lỗi khi reparse ${code}:`, err.message);
      }
    }));
    // Delay giữa các batch
    if (i + CONCURRENCY < codeList.length) {
      await new Promise(res => setTimeout(res, DELAY_MS));
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=======================================================================`);
  console.log(`[REEVAL-ALL-LECH] ✅ HOÀN TẤT! (${elapsed}s)`);
  console.log(`  - Tổng số tài khoản xử lý: ${codeList.length}`);
  console.log(`  - Thành công:               ${successCount}`);
  console.log(`  - Thất bại:                 ${failCount}`);
  if (failedCodes.length > 0) {
    console.log(`  - Mã bị lỗi: ${failedCodes.join(', ')}`);
  }
  console.log(``);
  console.log(`Bước tiếp theo: Chạy lại phân tích để xem số LỆCH còn lại:`);
  console.log(`  node src/scripts/tkgd_case_inspector.js --analyze-lech`);
  console.log(`=======================================================================\n`);

  // Lưu kết quả reeval vào file
  const RESULT_FILE = path.join(CACHE_DIR, 'reeval_lech_result.json');
  fs.writeFileSync(RESULT_FILE, JSON.stringify({
    runAt: new Date().toISOString(),
    totalProcessed: codeList.length,
    successCount,
    failCount,
    failedCodes,
    elapsedSeconds: elapsed,
  }, null, 2), 'utf-8');
  console.log(`[REEVAL] Kết quả chi tiết đã lưu vào: ${RESULT_FILE}`);
}

// ============================================================================
// MAIN CLI DISPATCHER
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
=======================================================================
TKGD CASE INSPECTOR & RE-TEST TOOL (Dành cho Quản lý & Thẩm định TKGD)
=======================================================================
Lệnh khả dụng:
  --fetch                 Kéo các hồ sơ LỆCH từ Ubuntu DB vào cache cục bộ
  --fetch --status ALL    Kéo toàn bộ hồ sơ (bất kể trạng thái)
  --fetch --date YYYY-MM-DD  Kéo hồ sơ theo ngày đợt
  --fetch --code <Mã TK>  Kéo hồ sơ của 1 mã tài khoản cụ thể

  --scan                  Quét toàn bộ DB Ubuntu tìm các hồ sơ có dữ liệu bất thường
  --scan --date YYYY-MM-DD Quét tìm hồ sơ bất thường theo ngày đợt

  --analyze-lech          Phân tích toàn diện và bóc tách nguyên nhân tất cả tài khoản LỆCH
  --analyze-lech --date YYYY-MM-DD Phân tích tài khoản LỆCH theo ngày đợt

  --export-ms-missing     Xuất file CSV danh sách tài khoản M-System chưa nhập số CCCD (gửi Giám sát)

  --list                  Liệt kê bảng tóm tắt các tài khoản đang lưu trong cache
  --inspect <Mã TK>       Xem thông tin chi tiết, đối soát trường và file đính kèm
  
  --test <Mã TK>          Chạy bóc tách kiểm tra thử nghiệm (Test Run) trên Ubuntu
                          (Lưu kết quả & diff vào cache, KHÔNG sửa DB)
  
  --test-all              Chạy test run tuần tự tất cả hồ sơ trong cache
  
  --reparse <Mã TK>       Gọi API reparse chính thức trên Ubuntu cập nhật vào DB
  --reparse-anomalies     Tự động reparse toàn bộ danh sách tài khoản bất thường

  --reeval-all-lech       Re-evaluate TOÀN BỘ tài khoản LỆCH qua API reparse
                          (Áp dụng tất cả rules mới: Consensus Healing, CAN_KIEM_TRA,
                          MRZ healing v.v. vào DB — giảm LỆCH về con số thật sự)
                          Yêu cầu: chạy --analyze-lech trước để có danh sách
=======================================================================
`);
    return;
  }

  if (args.includes('--export-ms-missing')) {
    exportMsMissingCccdAccounts();
    return;
  }


  if (args.includes('--analyze-lech')) {
    const dateIdx = args.indexOf('--date');
    const date = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;
    await analyzeLechAccountsOnUbuntu({ date });
    return;
  }

  if (args.includes('--scan')) {
    const dateIdx = args.indexOf('--date');
    const date = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;
    const statusIdx = args.indexOf('--status');
    const status = statusIdx !== -1 && args[statusIdx + 1] ? args[statusIdx + 1] : 'ALL';
    await scanAnomaliesOnUbuntu({ date, status });
    return;
  }

  if (args.includes('--fetch')) {
    const statusIdx = args.indexOf('--status');
    const status = statusIdx !== -1 && args[statusIdx + 1] ? args[statusIdx + 1] : 'LECH';
    const dateIdx = args.indexOf('--date');
    const date = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;
    const codeIdx = args.indexOf('--code');
    const code = codeIdx !== -1 && args[codeIdx + 1] ? args[codeIdx + 1] : null;
    await fetchCases({ status, date, code });
    return;
  }

  if (args.includes('--list')) {
    const cache = loadCache();
    printAccountList(cache);
    return;
  }

  if (args.includes('--inspect')) {
    const codeIdx = args.indexOf('--inspect');
    const code = args[codeIdx + 1];
    if (!code) {
      console.error('Vui lòng chỉ định mã tài khoản! VD: --inspect 046C0002936');
      return;
    }
    inspectAccount(code);
    return;
  }

  if (args.includes('--test')) {
    const codeIdx = args.indexOf('--test');
    const code = args[codeIdx + 1];
    if (!code) {
      console.error('Vui lòng chỉ định mã tài khoản! VD: --test 046C0002936');
      return;
    }
    await runTestOnAccount(code);
    return;
  }

  if (args.includes('--test-all')) {
    const cache = loadCache();
    const accounts = Object.keys(cache.accounts || {});
    console.log(`[TEST-ALL] Bắt đầu kiểm thử toàn bộ ${accounts.length} tài khoản trong cache...`);
    for (const code of accounts) {
      await runTestOnAccount(code);
    }
    console.log(`[TEST-ALL] Hoàn tất kiểm thử tất cả tài khoản!`);
    return;
  }

  if (args.includes('--reparse')) {
    const codeIdx = args.indexOf('--reparse');
    const code = args[codeIdx + 1];
    if (!code) {
      console.error('Vui lòng chỉ định mã tài khoản! VD: --reparse 046C0002936');
      return;
    }
    await reparseOnUbuntu(code);
    return;
  }

  if (args.includes('--reeval-all-lech')) {
    await reevalAllLechAccounts();
    return;
  }

  if (args.includes('--reparse-anomalies')) {
    const REPORT_FILE = path.join(CACHE_DIR, 'anomalies_report.json');
    if (!fs.existsSync(REPORT_FILE)) {
      console.log('Chưa có file anomalies_report.json. Vui lòng chạy --scan trước!');
      return;
    }
    const data = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
    const list = data.anomalies || [];
    console.log(`[REPARSE-ANOMALIES] Bắt đầu tự động reparse ${list.length} tài khoản bất thường...`);
    let successCount = 0;
    for (let i = 0; i < list.length; i++) {
      const code = list[i].maTKGD;
      const bDate = list[i].batchDate || '';
      console.log(`[${i + 1}/${list.length}] Reparsing ${code} (${list[i].hoTenMS}) [${bDate}]...`);
      try {
        await reparseOnUbuntu(code, bDate);
        successCount++;
      } catch (err) {
        console.error(`  ❌ Lỗi khi reparse ${code}:`, err.message);
      }
    }
    console.log(`\n=============================================================`);
    console.log(`[REPARSE-ANOMALIES] Hoàn tất reparse ${successCount}/${list.length} tài khoản!`);
    console.log(`=============================================================\n`);
    return;
  }

  console.log('Lệnh không hợp lệ. Sử dụng --help để xem hướng dẫn.');
}

main().catch(console.error);

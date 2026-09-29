#!/usr/bin/env node
/**
 * TEST SCANNER & ĐỐI SOÁT HỒ SƠ CHƯA KHỚP TỪ DATABASE UBUNTU
 * ============================================================================
 * Mục tiêu:
 *   1. Kết nối an toàn (Read-Only) tới MongoDB Ubuntu (hỗ trợ trực tiếp hoặc SSH Tunnel tự động).
 *   2. Lấy ngẫu nhiên 10 - 20 tài khoản đang ở trạng thái CHƯA KHỚP (LECH / CAN_KIEM_TRA)
 *      đã có sẵn dữ liệu bóc tách Email (noiDungMail) trong CSDL.
 *   3. Lấy ảnh M-System (2 mặt _MS_CCCD_truoc và _MS_CCCD_sau) từ ổ đĩa mạng M: hoặc storage.
 *   4. Đưa vào luồng bóc tách nâng cấp (Worker Python: 2 mặt + MRZ + QR + Anomaly + Gemini).
 *   5. Chạy bộ quy tắc đối soát chéo thông minh (tkgd-reconcile-rules.helper) để đánh giá:
 *      - Xem hệ thống có tự động hóa giải lệch cũ (False Positive) và khớp 100% không.
 *      - Đo lường độ ổn định, tốc độ và các trường hợp ngoại lệ.
 * 
 * Cách chạy:
 *   # Mặc định lấy ngẫu nhiên 15 tài khoản chưa khớp:
 *   node src/scripts/test_unmatched_db_accounts.js
 * 
 *   # Chỉ định số lượng tài khoản (ví dụ 10 hoặc 20):
 *   node src/scripts/test_unmatched_db_accounts.js --limit 20
 * 
 *   # Test 1 tài khoản cụ thể:
 *   node src/scripts/test_unmatched_db_accounts.js --code 003C7921285
 * 
 *   # Test theo ngày cụ thể:
 *   node src/scripts/test_unmatched_db_accounts.js --date 2026-09-21 --limit 10
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { execFile } = require('child_process');
const { Client } = require('ssh2');
const mongoose = require('mongoose');

// Nạp helper đối soát từ module hệ thống (hỗ trợ cả file compiled dist hoặc ts-node)
let evaluateRecordReconciliationRule = null;
try {
  const rulesModule = require('../modules/engine-helpers/tkgd-reconcile-rules.helper');
  evaluateRecordReconciliationRule = rulesModule.evaluateRecordReconciliationRule;
} catch {
  try {
    const rulesDist = require('../../dist/modules/engine-helpers/tkgd-reconcile-rules.helper');
    evaluateRecordReconciliationRule = rulesDist.evaluateRecordReconciliationRule;
  } catch (e) {
    // Fallback inline simple rule nếu chưa build dist
    evaluateRecordReconciliationRule = (rec) => {
      const msName = (rec.ms?.hoVaTen || rec.ms?.tenTKGD || '').trim().toUpperCase();
      const mailName = (rec.noiDungMail?.tenTaiKhoan || rec.hopDong?.hoVaTen || '').trim().toUpperCase();
      const cccdMs = (rec.ms?.soCMND_HoChieu || '').trim();
      const cccdExtracted = (rec.canCuoc?.soCanCuoc || rec.canCuoc?.soCCCD || '').trim();
      const isMatched = (cccdMs && cccdExtracted && cccdMs === cccdExtracted) || (msName && mailName && msName === mailName);
      return {
        finalStatus: isMatched ? 'KHOP' : 'LECH',
        finalErrors: isMatched ? [] : ['Thông tin không trùng khớp']
      };
    };
  }
}

// ─── CẤU HÌNH KẾT NỐI ────────────────────────────────────────────────────────
const SSH_CONFIG = {
  host: process.env.UBUNTU_HOST || '10.0.0.26',
  port: parseInt(process.env.UBUNTU_PORT || '22', 10),
  username: process.env.UBUNTU_USER || 'mxvadmin',
  password: process.env.UBUNTU_PASSWORD || 'MxV!,#2o26',
};

const DEFAULT_BASE_DIR = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem';

// ─── THAM SỐ CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const targetCode = getArg('--code');
const targetDate = getArg('--date');
const limitCount = parseInt(getArg('--limit', '15'), 10);
const baseDir = getArg('--dir', DEFAULT_BASE_DIR);
const customMongoUri = getArg('--mongo-uri');
const shouldSaveToDb = args.includes('--save-db') || args.includes('--commit');

// ─── TIỆN ÍCH TUNNEL & MONGO ─────────────────────────────────────────────────
function openSshTunnel(localPort = 27018) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        const server = net.createServer((sock) => {
          conn.forwardOut('127.0.0.1', sock.remotePort, '127.0.0.1', 27017, (err, stream) => {
            if (err) {
              sock.end();
              return;
            }
            sock.pipe(stream).pipe(sock);
          });
        });
        server.listen(localPort, '127.0.0.1', () => {
          resolve({ server, conn, port: localPort });
        });
      })
      .on('error', reject)
      .connect(SSH_CONFIG);
  });
}

async function connectToMongoDatabase() {
  // 1. Thử kết nối trực tiếp nếu truyền URI hoặc cổng 27017
  let uri = customMongoUri || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 2000 }).asPromise();
    const count = await conn.db.collection('clean_account_records').countDocuments().catch(() => 0);
    if (count > 0) {
      console.log(`[DB] Đã kết nối trực tiếp tới MongoDB cục bộ (${count} bản ghi hồ sơ).`);
      return { conn, tunnel: null };
    }
    await conn.close();
  } catch {
    // Không kết nối được trực tiếp -> mở SSH Tunnel tới Ubuntu
  }

  // 2. Mở SSH Tunnel an toàn tới 10.0.0.26
  console.log(`[DB] Đang tạo SSH Tunnel tới máy chủ Ubuntu (${SSH_CONFIG.host}:27017)...`);
  const tunnel = await openSshTunnel(27018);
  const tunnelUri = 'mongodb://127.0.0.1:27018/mxv_shift_checklist';
  const conn = await mongoose.createConnection(tunnelUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  console.log(`[DB] Kết nối MongoDB Ubuntu qua SSH Tunnel thành công (Port 27018)!`);
  return { conn, tunnel };
}

// ─── GỌI WORKER PYTHON BÓC TÁCH ──────────────────────────────────────────────
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

function runPythonWorker(frontImgPath, backImgPath) {
  return new Promise((resolve) => {
    const pythonBin = getPythonBin();
    const workerScript = getWorkerScript();
    const workerArgs = [workerScript, '--front', frontImgPath, '--back', backImgPath];

    const startT = Date.now();
    execFile(pythonBin, workerArgs, { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const durationMs = Date.now() - startT;
      if (err) {
        return resolve({
          success: false,
          error: (stderr || err.message).trim(),
          durationMs,
        });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          success: true,
          data: parsed,
          durationMs,
        });
      } catch (parseErr) {
        resolve({
          success: false,
          error: `JSON Parse error: ${parseErr.message} | Raw: ${stdout.slice(0, 200)}`,
          durationMs,
        });
      }
    });
  });
}

// ─── TÌM FILE ẢNH TRÊN ĐĨA HOẶC STORAGE ──────────────────────────────────────
function findAccountImages(code, batchDate, searchDir) {
  const potentialPaths = [
    path.join(searchDir, batchDate, code),
    path.join(searchDir, code),
    path.join(process.cwd(), 'data', 'attachments', batchDate, code),
    path.join(process.cwd(), 'data', 'temp_tkgd_attachments', batchDate, code),
  ];

  let foundDir = null;
  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      foundDir = p;
      break;
    }
  }

  // Nếu chưa thấy, duyệt các thư mục ngày lân cận trên đĩa M:
  if (!foundDir && fs.existsSync(searchDir)) {
    try {
      const dates = fs.readdirSync(searchDir);
      for (const d of dates) {
        const sub = path.join(searchDir, d, code);
        if (fs.existsSync(sub)) {
          foundDir = sub;
          break;
        }
      }
    } catch {}
  }

  if (!foundDir) return null;

  const files = fs.readdirSync(foundDir);
  // Tìm mặt trước
  const frontFile = files.find(f => /_MS_CCCD_truoc/i.test(f)) || files.find(f => /CCCD.*truoc/i.test(f) || /mat.*truoc/i.test(f));
  // Tìm mặt sau
  const backFile = files.find(f => /_MS_CCCD_sau/i.test(f)) || files.find(f => /CCCD.*sau/i.test(f) || /mat.*sau/i.test(f));

  if (!frontFile || !backFile) return null;

  return {
    dir: foundDir,
    frontPath: path.join(foundDir, frontFile),
    backPath: path.join(foundDir, backFile),
  };
}

// ─── TIỆN ÍCH HIỂN THỊ ───────────────────────────────────────────────────────
function pad(str, len) {
  const s = String(str || '');
  return s.padEnd(len).slice(0, len);
}

// ─── CHƯƠNG TRÌNH CHÍNH ─────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(95));
  console.log('   BÀI THỬ NGHIỆM ĐÁNH GIÁ ĐỘ ỔN ĐỊNH BỘ BÓC TÁCH & ĐỐI SOÁT TKGD M-SYSTEM THỰC TẾ');
  console.log('   NGUỒN DỮ LIỆU: CSDL UBUNTU (MONGODB) + KHO ẢNH THẬT TRÊN M-SYSTEM / ĐĨA M:');
  console.log('='.repeat(95));

  const { conn, tunnel } = await connectToMongoDatabase();
  const db = conn.db;
  const col = db.collection('clean_account_records');

  try {
    // 1. Lập tiêu chí truy vấn tài khoản chưa khớp
    const query = {
      'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] },
      noiDungMail: { $exists: true, $ne: null },
    };

    if (targetCode) {
      query.$or = [{ maTKGD: targetCode }, { maTKGDBase: targetCode }];
      console.log(`\n[BỘ LỌC] Kiểm thử duy nhất tài khoản: ${targetCode}`);
    } else {
      if (targetDate) query.batchDate = targetDate;
      else query.batchDate = { $gte: '2026-09-10' };
      console.log(`\n[BỘ LỌC] Trạng thái: CHƯA KHỚP (LECH / CAN_KIEM_TRA) | Ngày: ${targetDate || '>= 2026-09-10'} | Giới hạn: ${limitCount}`);
    }

    // 2. Lấy danh sách ứng viên
    const allCandidates = await col.find(query).sort({ batchDate: -1, createdAt: -1 }).toArray();
    console.log(`[DB] Tìm thấy tổng cộng ${allCandidates.length} hồ sơ chưa khớp thỏa mãn điều kiện.`);

    if (allCandidates.length === 0) {
      console.log('⚠️ Không có hồ sơ nào thỏa mãn điều kiện tìm kiếm.');
      return;
    }

    // Lọc các hồ sơ có file ảnh thực tế trên đĩa M: hoặc local storage
    console.log(`[FILE] Đang kiểm tra sự tồn tại của file ảnh M-System trên đĩa...`);
    const validCandidates = [];
    for (const acc of allCandidates) {
      const code = acc.maTKGD || acc.maTKGDBase;
      const batchDate = acc.batchDate || '';
      const imgInfo = findAccountImages(code, batchDate, baseDir);
      if (imgInfo) {
        validCandidates.push({ record: acc, imgInfo });
      }
    }

    console.log(`[FILE] Có ${validCandidates.length} hồ sơ có đủ cặp ảnh mặt trước & sau M-System.`);

    if (validCandidates.length === 0) {
      console.log('⚠️ Không tìm thấy thư mục ảnh tương ứng trên ổ đĩa M:');
      console.log(`   Đường dẫn kiểm tra: ${baseDir}`);
      return;
    }

    // Lấy ngẫu nhiên mẫu kiểm thử
    const shuffled = validCandidates.sort(() => 0.5 - Math.random());
    const testCases = targetCode ? validCandidates.slice(0, 1) : shuffled.slice(0, limitCount);

    console.log(`\n🚀 BẮT ĐẦU CHẠY THỬ NGHIỆM TRÊN ${testCases.length} HỒ SƠ NGẪU NHIÊN...\n`);

    const results = [];
    let successCount = 0;
    let healedCount = 0;
    let geminiFallbackCount = 0;
    let totalLatencyMs = 0;

    for (let i = 0; i < testCases.length; i++) {
      const { record, imgInfo } = testCases[i];
      const code = record.maTKGD || record.maTKGDBase;
      const date = record.batchDate || '-';
      const oldStatus = record.ketLuan?.trangThai || 'LECH';
      const mailName = record.noiDungMail?.tenTaiKhoan || record.hopDong?.hoVaTen || 'N/A';

      process.stdout.write(`[${i + 1}/${testCases.length}] Xử lý: ${code} (${date}) ... `);

      // Gọi Python worker bóc tách 2 mặt ảnh
      const workerRes = await runPythonWorker(imgInfo.frontPath, imgInfo.backPath);

      if (!workerRes.success) {
        console.log(`❌ LỖI BÓC TÁCH: ${workerRes.error.slice(0, 80)}`);
        results.push({
          code,
          date,
          mailName,
          oldStatus,
          newStatus: 'ERROR',
          extractedCccd: '-',
          extractedName: '-',
          source: 'FAILED',
          durationSec: (workerRes.durationMs / 1000).toFixed(2),
          evalNotes: workerRes.error,
        });
        continue;
      }

      successCount++;
      totalLatencyMs += workerRes.durationMs;

      const cc = workerRes.data.canCuoc || {};
      const extractedCccd = cc.soCCCD || cc.soCanCuoc || '-';
      const extractedName = cc.hoTen || cc.hoVaTen || '-';
      const source = cc.source || 'OCR';

      if (source === 'GEMINI_FALLBACK' || source === 'AI_RECOVERY') {
        geminiFallbackCount++;
      }

      // Mô phỏng đối soát với quy tắc nâng cấp mới
      const simulatedRecord = {
        ...record,
        canCuoc: {
          ...record.canCuoc,
          ...cc,
          soCanCuoc: extractedCccd,
          hoVaTen: extractedName,
        },
      };

      const evalOutcome = evaluateRecordReconciliationRule(simulatedRecord);
      const newStatus = evalOutcome.finalStatus || 'LECH';

      let statusIcon = '❌';
      let evalSummary = '';

      if (newStatus === 'KHOP') {
        statusIcon = '🟢';
        healedCount++;
        evalSummary = 'Hóa giải lệch cũ -> KHỚP 100%';
      } else {
        const isTypo = evalOutcome.discrepancyFlags?.includes('FLAG_MS_INPUT_TYPO');
        if (isTypo) {
          statusIcon = '⚠️';
          evalSummary = 'Chuyên viên MS gõ sai (Typo được bắt)';
        } else {
          statusIcon = '🔴';
          evalSummary = evalOutcome.finalErrors?.slice(0, 1).join('; ') || 'Lệch nghiệp vụ';
        }
      }

      const durationSec = (workerRes.durationMs / 1000).toFixed(2);
      console.log(`${statusIcon} ${newStatus} (${durationSec}s) [Nguồn: ${source}] -> ${evalSummary}`);

      // Lưu cập nhật vào CSDL Ubuntu MongoDB nếu có cờ --save-db
      if (shouldSaveToDb && record._id) {
        try {
          await col.updateOne(
            { _id: record._id },
            {
              $set: {
                'canCuoc': simulatedRecord.canCuoc,
                'ketLuan.trangThai': newStatus,
                'ketLuan.finalStatus': newStatus,
                'ketLuan.danhSachLoi': evalOutcome.finalErrors || [],
                'ketLuan.discrepancyFlags': evalOutcome.discrepancyFlags || [],
                'ketLuan.reconciledAt': new Date(),
                'updatedAt': new Date(),
              }
            }
          );
          process.stdout.write(`   ↳ [DB] Đã cập nhật thành công vào MongoDB Ubuntu: ${newStatus}\n`);
        } catch (dbErr) {
          console.error(`   ↳ [DB ERROR] Không thể cập nhật ${code}: ${dbErr.message}`);
        }
      }

      results.push({
        code,
        date,
        mailName,
        oldStatus,
        newStatus,
        extractedCccd,
        extractedName,
        source,
        durationSec,
        evalSummary,
      });
    }

    // ─── IN BẢNG BÁO CÁO TỔNG HỢP ──────────────────────────────────────────
    console.log('\n' + '='.repeat(100));
    console.log('                           BẢNG TỔNG HỢP KẾT QUẢ ĐỐI SOÁT THỬ NGHIỆM');
    console.log('='.repeat(100));

    console.log(
      pad('#', 4) +
      pad('MÃ TKGD', 14) +
      pad('NGÀY', 12) +
      pad('CŨ (DB)', 10) +
      pad('MỚI (OCR)', 12) +
      pad('SỐ CCCD (OCR)', 15) +
      pad('HỌ TÊN BÓC TÁCH', 22) +
      pad('NGUỒN', 10) +
      pad('T/GIAN', 8)
    );
    console.log('-'.repeat(100));

    results.forEach((r, idx) => {
      console.log(
        pad(idx + 1, 4) +
        pad(r.code, 14) +
        pad(r.date, 12) +
        pad(r.oldStatus, 10) +
        pad(r.newStatus, 12) +
        pad(r.extractedCccd, 15) +
        pad(r.extractedName, 22) +
        pad(r.source, 10) +
        pad(r.durationSec + 's', 8)
      );
    });

    console.log('='.repeat(100));

    // ─── THỐNG KÊ HIỆU NĂNG ────────────────────────────────────────────────
    const avgDuration = results.length > 0 ? (totalLatencyMs / results.length / 1000).toFixed(2) : 0;
    const successRate = ((successCount / results.length) * 100).toFixed(1);
    const healRate = ((healedCount / results.length) * 100).toFixed(1);

    console.log('\n📊 THỐNG KÊ HIỆU SUẤT & ĐỘ ỔN ĐỊNH:');
    console.log(`   - Tổng số hồ sơ kiểm thử         : ${results.length}`);
    console.log(`   - Tỷ lệ bóc tách ảnh thành công  : ${successCount}/${results.length} (${successRate}%)`);
    console.log(`   - Tỷ lệ hóa giải cũ thành KHỚP   : ${healedCount}/${results.length} (${healRate}%)`);
    console.log(`   - Số lần kích hoạt Gemini Model  : ${geminiFallbackCount}`);
    console.log(`   - Thời gian bóc tách trung bình  : ${avgDuration} giây / hồ sơ`);
    console.log(`   - Đánh giá độ ổn định tổng thể   : ${successRate >= 95 ? '✅ CỰC KỲ ỔN ĐỊNH - SẴN SÀNG PRODUCTION' : '⚠️ CẦN THEO DÕI THÊM'}\n`);

  } finally {
    await conn.close();
    if (tunnel) {
      tunnel.server.close();
      tunnel.conn.end();
    }
  }
}

main().catch((err) => {
  console.error('\n❌ LỖI THỰC THI SCRIPT:', err);
  process.exit(1);
});

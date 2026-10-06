/**
 * CÔNG CỤ CHẨN ĐOÁN TOÀN DIỆN ĐỐI CHIẾU KHỚP LỆNH (KLGD FORENSIC DIAGNOSTIC TOOL)
 * Hỗ trợ chạy cả trên Windows (tự động SSH sang Ubuntu) và trực tiếp trên Server Ubuntu.
 *
 * Cú pháp sử dụng:
 * 1. Xem tổng quan lịch sử các lượt chạy gần nhất trong ngày:
 *    node src/scripts/diagnose_klgd_realtime.js
 *    (hoặc: node src/scripts/diagnose_klgd_realtime.js --jobs)
 *
 * 2. Phân tích chi tiết các lệnh chênh lệch của lượt chạy mới nhất:
 *    node src/scripts/diagnose_klgd_realtime.js --diff
 *
 * 3. Kiểm tra tính đồng bộ và thời gian sửa đổi (mtime) các file trên đĩa:
 *    node src/scripts/diagnose_klgd_realtime.js --files
 *
 * 4. Truy vết chuyên sâu 1 mã lệnh cụ thể trên cả M-System và CQG:
 *    node src/scripts/diagnose_klgd_realtime.js --order=115612129
 *
 * 5. Truy vết toàn bộ giao dịch của 1 tài khoản cụ thể:
 *    node src/scripts/diagnose_klgd_realtime.js --account=048C1161268
 *
 * 6. Chạy báo cáo chẩn đoán toàn diện (Jobs + Files + Diff Analysis):
 *    node src/scripts/diagnose_klgd_realtime.js --all
 *
 * 7. Kiểm tra một ngày cụ thể trong quá khứ:
 *    node src/scripts/diagnose_klgd_realtime.js --date=29.09.2026 --all
 *
 * 8. Kiểm tra chi tiết ĐÍCH DANH theo Job ID:
 *    node src/scripts/diagnose_klgd_realtime.js --job=6abc74c517fb960fe8132968
 */

const path = require('path');
const fs = require('fs');

// Bóc tách tham số dòng lệnh
const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f) || args.some((a) => a.startsWith(f + '='));
const getArg = (f) => {
  const item = args.find((a) => a.startsWith(f + '='));
  return item ? item.split('=')[1].trim() : null;
};

const targetJobId = getArg('--job') || getArg('--job-id') || getArg('--id');
const showAll = hasFlag('--all');
const showJobs = !targetJobId && (showAll || hasFlag('--jobs') || (!hasFlag('--files') && !hasFlag('--diff') && !getArg('--order') && !getArg('--account')));
const showFiles = showAll || hasFlag('--files');
const showDiff = showAll || hasFlag('--diff') || !!targetJobId;
const targetOrder = getArg('--order');
const targetAccount = getArg('--account');

const dateArg = getArg('--date');
let targetDay, targetMonth, targetYear;
if (dateArg) {
  const parts = dateArg.split(/[.-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      targetYear = parts[0];
      targetMonth = parts[1].padStart(2, '0');
      targetDay = parts[2].padStart(2, '0');
    } else {
      targetDay = parts[0].padStart(2, '0');
      targetMonth = parts[1].padStart(2, '0');
      targetYear = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    }
  }
}
if (!targetDay) {
  const now = new Date();
  targetDay = String(now.getDate()).padStart(2, '0');
  targetMonth = String(now.getMonth() + 1).padStart(2, '0');
  targetYear = String(now.getFullYear());
}
const dateStrVi = `${targetDay}.${targetMonth}.${targetYear}`;
const dateIsoPrefix = `${targetYear}-${targetMonth}-${targetDay}`;

const isRunningOnUbuntu = fs.existsSync('/opt/mxv-checklist/backend');

// Script thực thi logic chẩn đoán lõi trên máy chủ
const remoteDiagnosisScript = `
const fs = require('fs');
const path = require('path');
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const xlsx = require('/opt/mxv-checklist/backend/node_modules/xlsx');
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });

const TARGET_DAY = '${targetDay}';
const TARGET_MONTH = '${targetMonth}';
const TARGET_YEAR = '${targetYear}';
const DATE_STR_VI = '${dateStrVi}';
const DATE_ISO_PREFIX = '${dateIsoPrefix}';

const SHOW_JOBS = ${showJobs};
const SHOW_FILES = ${showFiles};
const SHOW_DIFF = ${showDiff};
const TARGET_JOB_ID = ${targetJobId ? `'${targetJobId}'` : 'null'};
const TARGET_ORDER = ${targetOrder ? `'${targetOrder}'` : 'null'};
const TARGET_ACCOUNT = ${targetAccount ? `'${targetAccount}'` : 'null'};

async function runDiagnosis() {
  console.log('='.repeat(95));
  console.log('  HỆ THỐNG CHẨN ĐOÁN TOÀN DIỆN ĐỐI CHIẾU KHỚP LỆNH (KLGD FORENSIC TOOL)');
  console.log('  Ngày kiểm tra : ' + DATE_STR_VI + ' | Thời điểm quét : ' + new Date().toLocaleString('vi-VN'));
  console.log('='.repeat(95) + '\\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/checklist');
  const db = mongoose.connection.db;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TỔNG QUAN LỊCH SỬ CÁC LƯỢT CHẠY TRONG NGÀY
  // ─────────────────────────────────────────────────────────────────────────────
  if (SHOW_JOBS) {
    console.log('=== [1] LỊCH SỬ CÁC LƯỢT CHẠY CHECK_KLGD TRONG NGÀY ===');
    const startOfDay = new Date(TARGET_YEAR + '-' + TARGET_MONTH + '-' + TARGET_DAY + 'T00:00:00.000Z');
    const endOfDay = new Date(TARGET_YEAR + '-' + TARGET_MONTH + '-' + TARGET_DAY + 'T23:59:59.999Z');

    const jobs = await db.collection('bot_jobs')
      .find({
        jobType: 'CHECK_KLGD',
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (jobs.length === 0) {
      console.log('   Không tìm thấy lượt chạy CHECK_KLGD nào trong ngày ' + DATE_STR_VI + '\\n');
    } else {
      const summaryTable = jobs.map((j, idx) => {
        const res = j.payload?.result || {};
        const totals = res.totals || {};
        const createdVi = new Date(j.createdAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const cutoffVi = res.cutoffTime ? new Date(res.cutoffTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '--';
        const differ = totals.differ !== undefined ? totals.differ : (totals.totalFR - totals.totalDSGD);
        const mismatches = res.mismatchedTrades?.length || 0;
        return {
          'Lượt': '#' + (jobs.length - idx),
          'Job ID': j._id.toString(),
          'Giờ chạy': createdVi,
          'Trạng thái': j.status === 'COMPLETED' ? (res.passed ? 'KHỚP' : 'LỆCH (' + differ + ' lot)') : j.status,
          'MS (lot)': totals.totalDSGD || 0,
          'CQG (lot)': totals.totalFR || 0,
          'Lệch (lot)': Math.abs(differ || 0),
          'Lệnh lệch': mismatches,
          'Mốc chốt (Cutoff)': cutoffVi
        };
      });
      console.table(summaryTable);
      console.log('   (Tìm thấy ' + jobs.length + ' lượt chạy. Chi tiết lượt mới nhất hiển thị bên dưới)\\n');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. KIỂM TRA FILE TRÊN ĐĨA VÀ TÍNH ĐỒNG BỘ MTIME
  // ─────────────────────────────────────────────────────────────────────────────
  const msDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/' + TARGET_YEAR + '/T' + TARGET_MONTH + '.' + TARGET_YEAR + '/' + TARGET_DAY + '.' + TARGET_MONTH;
  const cqgDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/' + TARGET_YEAR + '/T' + TARGET_MONTH + '.' + TARGET_YEAR + '/' + TARGET_DAY + '.' + TARGET_MONTH;
  const acmDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/' + TARGET_YEAR + '/T' + TARGET_MONTH + '.' + TARGET_YEAR + '/' + TARGET_DAY + '.' + TARGET_MONTH;

  if (SHOW_FILES) {
    console.log('=== [2] TÌNH TRẠNG FILE BACKUP TRÊN Ổ ĐĨA (/mnt/qlgd-it) ===');
    const checkList = [
      { source: 'M-System', dir: msDir, file: 'DSGD.xlsx' },
      { source: 'M-System', dir: msDir, file: 'TTM.xlsx' },
      { source: 'M-System', dir: msDir, file: 'TTTT.xlsx' },
      { source: 'CQG Merge', dir: cqgDir, file: 'FR.xlsx' },
      { source: 'CQG Raw 1', dir: cqgDir, file: 'FR1.xlsx' },
      { source: 'CQG Raw 2', dir: cqgDir, file: 'FR2.xlsx' },
      { source: 'ACM Sàn', dir: acmDir, pattern: /Straits|Fill/i }
    ];

    const fileDetails = [];
    for (const item of checkList) {
      let targetFile = item.file;
      if (item.pattern && fs.existsSync(item.dir)) {
        const found = fs.readdirSync(item.dir).find(f => item.pattern.test(f));
        if (found) targetFile = found;
      }

      const fullPath = targetFile ? path.join(item.dir, targetFile) : null;
      if (fullPath && fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        fileDetails.push({
          'Nguồn': item.source,
          'Tên file': targetFile,
          'Kích thước': (stat.size / 1024).toFixed(1) + ' KB',
          'Thời điểm sửa đổi (mtime)': stat.mtime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' ' + stat.mtime.toLocaleDateString('vi-VN'),
          'Tồn tại': 'CÓ'
        });
      } else {
        fileDetails.push({
          'Nguồn': item.source,
          'Tên file': item.file || 'Chưa thấy',
          'Kích thước': '--',
          'Thời điểm sửa đổi (mtime)': '--',
          'Tồn tại': 'THIẾU'
        });
      }
    }
    console.table(fileDetails);

    // Cảnh báo lệch pha mtime giữa file gộp FR.xlsx và file thô FR1/FR2
    const frPath = path.join(cqgDir, 'FR.xlsx');
    const fr1Path = path.join(cqgDir, 'FR1.xlsx');
    const fr2Path = path.join(cqgDir, 'FR2.xlsx');
    if (fs.existsSync(frPath) && (fs.existsSync(fr1Path) || fs.existsSync(fr2Path))) {
      const mtimeFR = fs.statSync(frPath).mtimeMs;
      const mtimeFR1 = fs.existsSync(fr1Path) ? fs.statSync(fr1Path).mtimeMs : 0;
      const mtimeFR2 = fs.existsSync(fr2Path) ? fs.statSync(fr2Path).mtimeMs : 0;
      if (mtimeFR < mtimeFR1 || mtimeFR < mtimeFR2) {
        console.log('   ⚠️  CẢNH BÁO LỆCH PHA: File gộp FR.xlsx CŨ HƠN file thô FR1/FR2!');
        console.log('       → Cần kích hoạt forceRemerge để gộp lại file mới nhất.\\n');
      } else {
        console.log('   ✓ File gộp FR.xlsx đã được cập nhật đồng bộ sau các file thô.\\n');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PHÂN TÍCH CHÊNH LỆCH & ĐỘ TRỄ ĐỒNG BỘ (DIFF ANALYSIS)
  // ─────────────────────────────────────────────────────────────────────────────
  let activeJob = null;
  if (TARGET_JOB_ID) {
    const { ObjectId } = require('/opt/mxv-checklist/backend/node_modules/mongodb');
    try {
      activeJob = await db.collection('bot_jobs').findOne({ _id: new ObjectId(TARGET_JOB_ID) });
    } catch {
      activeJob = await db.collection('bot_jobs').findOne({ _id: TARGET_JOB_ID });
    }
    if (!activeJob) {
      console.log('=== [3] CHI TIẾT JOB ĐÍCH DANH ===');
      console.log('   ❌ Không tìm thấy bản ghi bot_jobs nào với ID: [' + TARGET_JOB_ID + ']\\n');
    }
  } else {
    activeJob = await db.collection('bot_jobs')
      .find({ jobType: 'CHECK_KLGD' })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();
  }

  if (SHOW_DIFF && activeJob) {
    const res = activeJob.payload?.result || {};
    const mismatches = res.mismatchedTrades || [];
    const totals = res.totals || {};
    const title = TARGET_JOB_ID
      ? '=== [3] CHI TIẾT JOB ĐÍCH DANH [' + activeJob._id + '] ==='
      : '=== [3] PHÂN TÍCH LỆCH KHỚP LỆNH CỦA LƯỢT CHẠY MỚI NHẤT ===';
    console.log(title);
    console.log('   • Job ID             : ' + activeJob._id);
    console.log('   • Trạng thái Job     : ' + activeJob.status + ' (Lần thử: ' + (activeJob.attempts || 1) + '/' + (activeJob.maxAttempts || 3) + ')');
    console.log('   • Thời điểm chạy      : ' + new Date(activeJob.createdAt).toLocaleString('vi-VN'));
    console.log('   • Mốc cắt (Cutoff)   : ' + (res.cutoffTime ? new Date(res.cutoffTime).toLocaleTimeString('vi-VN') : 'Không'));
    const differLot = totals.differ !== undefined ? totals.differ : ((totals.totalFR || 0) - (totals.totalDSGD || 0));
    console.log('   • M-System | CQG     : ' + (totals.totalDSGD || 0) + ' lot | ' + (totals.totalFR || 0) + ' lot (Lệch: ' + differLot + ' lot)');
    console.log('   • Số lệnh chênh lệch  : ' + mismatches.length + ' lệnh\\n');

    if (mismatches.length === 0) {
      console.log('   ✓ TUYỆT VỜI: Lượt chạy mới nhất KHÔNG CÓ BẤT KỲ LỆNH LỆCH NÀO (Khớp 100%)!\\n');
    } else {
      console.log('--- DANH SÁCH CHI TIẾT CÁC LỆNH LỆCH (Tối đa 15 lệnh đầu) ---');
      const diffTable = mismatches.slice(0, 15).map((m, i) => ({
        'STT': i + 1,
        'Nguồn': m.source,
        'Mã lệnh': m.maLenh || '--',
        'Mã TKGD': m.maTKGD,
        'Mã HĐ': m.maHD,
        'Giá': m.giaKhop,
        'KL': m.klGiaoDich,
        'Giờ khớp': m.ngayGio,
        'Lý do': m.reason
      }));
      console.table(diffTable);
      if (mismatches.length > 15) {
        console.log('   (...và ' + (mismatches.length - 15) + ' lệnh chênh lệch khác)\\n');
      }

      // Tự động phân loại nguyên nhân
      const cutoffMs = res.cutoffTime ? new Date(res.cutoffTime).getTime() : 0;
      let latencyCount = 0;
      let missingCount = 0;
      for (const m of mismatches) {
        if (m.source === 'CQG' && m.ngayGio) {
          latencyCount++;
        } else {
          missingCount++;
        }
      }

      console.log('--- KẾT LUẬN NGUYÊN NHÂN LỆCH ---');
      if (latencyCount > 0) {
        console.log('   • Có ' + latencyCount + ' lệnh CQG báo thiếu bên M-System.');
        console.log('     → Khả năng cao do ĐỘ TRỄ ĐỒNG BỘ GATEWAY (M-System chưa kịp nạp lệnh tức thời từ CQG).');
        console.log('     → Kiểm tra xem các lượt chạy sau có tự động hết lệch không bằng cách chạy lại lệnh này.\\n');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. TRUY VẾT MÃ LỆNH HOẶC TÀI KHOẢN CỤ THỂ (--order / --account)
  // ─────────────────────────────────────────────────────────────────────────────
  if (TARGET_ORDER || TARGET_ACCOUNT) {
    console.log('=== [4] TRUY VẾT DỮ LIỆU ĐẶC THÙ ===');
    const msFile = path.join(msDir, 'DSGD.xlsx');
    const cqgFile = path.join(cqgDir, 'FR.xlsx');

    if (!fs.existsSync(msFile) || !fs.existsSync(cqgFile)) {
      console.log('   Không đủ file DSGD.xlsx và FR.xlsx để thực hiện so khớp chi tiết!\\n');
    } else {
      const msWb = xlsx.readFile(msFile);
      const msRows = xlsx.utils.sheet_to_json(msWb.Sheets[msWb.SheetNames[0]]);
      const cqgWb = xlsx.readFile(cqgFile);
      const cqgRows = xlsx.utils.sheet_to_json(cqgWb.Sheets[cqgWb.SheetNames[0]]);

      if (TARGET_ORDER) {
        console.log('-> Đang truy vết Mã Lệnh: [' + TARGET_ORDER + ']');
        const cqgMatches = cqgRows.filter(r => String(r['Ord #'] || '').includes(TARGET_ORDER));
        const msMatches = msRows.filter(r => String(r['Mã lệnh'] || '').includes(TARGET_ORDER) || String(r['Mã giao dịch'] || '').includes(TARGET_ORDER));

        console.log('   • Tìm thấy bên CQG      : ' + cqgMatches.length + ' bản ghi');
        if (cqgMatches.length > 0) console.log('     Dữ liệu CQG:', cqgMatches[0]);
        console.log('   • Tìm thấy bên M-System : ' + msMatches.length + ' bản ghi');
        if (msMatches.length > 0) console.log('     Dữ liệu M-System:', msMatches[0]);
        console.log('');
      }

      if (TARGET_ACCOUNT) {
        console.log('-> Đang truy vết Mã Tài Khoản: [' + TARGET_ACCOUNT + ']');
        const cleanAcc = TARGET_ACCOUNT.replace(/[Ff]$/, '');
        const cqgMatches = cqgRows.filter(r => String(r['Account'] || '').includes(cleanAcc));
        const msMatches = msRows.filter(r => String(r['Mã TKGD'] || '').includes(cleanAcc));

        let cqgQty = 0;
        cqgMatches.forEach(r => cqgQty += Number(r['Qty'] || 0));
        let msQty = 0;
        msMatches.forEach(r => msQty += Number(r['KL giao dịch'] || 0));

        console.log('   • CQG      : ' + cqgMatches.length + ' lệnh | Tổng KL: ' + cqgQty + ' lot');
        console.log('   • M-System : ' + msMatches.length + ' lệnh | Tổng KL: ' + msQty + ' lot');
        console.log('   • Lệch     : ' + Math.abs(cqgQty - msQty) + ' lot\\n');
      }
    }
  }

  await mongoose.disconnect();
  console.log('='.repeat(95));
  console.log('  HOÀN TẤT CHẨN ĐOÁN HỆ THỐNG');
  console.log('='.repeat(95));
}

runDiagnosis().catch(e => {
  console.error('Lỗi chẩn đoán:', e.message);
  process.exit(1);
});
`;

if (isRunningOnUbuntu) {
  // Đang chạy trực tiếp trên Ubuntu
  eval(remoteDiagnosisScript);
} else {
  // Đang chạy từ máy Windows -> Kết nối SSH sang Ubuntu 10.0.0.26 để thực thi
  let Client;
  try {
    Client = require('ssh2').Client;
  } catch (e) {
    try {
      Client = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2').Client;
    } catch (e2) {
      Client = require('../../../mock-sftp/node_modules/ssh2').Client;
    }
  }

  const conn = new Client();
  conn.on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error('Lỗi SFTP:', err.message);
        conn.end();
        return;
      }
      const remoteFile = '/tmp/run_diagnose_klgd.js';
      const stream = sftp.createWriteStream(remoteFile);
      stream.on('close', () => {
        conn.exec('node /tmp/run_diagnose_klgd.js', (execErr, execStream) => {
          if (execErr) {
            console.error('Lỗi SSH exec:', execErr.message);
            conn.end();
            return;
          }
          execStream.on('data', (d) => process.stdout.write(d.toString()));
          execStream.stderr.on('data', (d) => process.stderr.write(d.toString()));
          execStream.on('close', () => conn.end());
        });
      });
      stream.end(remoteDiagnosisScript);
    });
  }).on('error', (err) => {
    console.error('❌ Không thể kết nối SSH tới máy chủ Ubuntu (10.0.0.26):', err.message);
  }).connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
  });
}

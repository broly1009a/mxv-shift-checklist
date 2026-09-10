const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

/**
 * Script Chẩn Đoán & Tái Kiểm Tra Toàn Diện Các Tài Khoản TKGD Bị Lệch
 * Hỗ trợ:
 *   1. Chẩn đoán 6 nhóm nguyên nhân gây lệch (Mặc định - An toàn 100%, Read-Only).
 *   2. Tái chạy bóc tách (Reparse) với QR Code & Gemini Vision cho các tài khoản thiếu CCCD (--reparse-missing).
 *   3. Chạy lại bước Đối Soát Chéo toàn bộ batch để chốt dữ liệu sạch & xuất Excel (--run-recon).
 */

const targetBatch = process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '2026-09-09';
const shouldReparseMissing = process.argv.includes('--reparse-missing');
const shouldRunRecon = process.argv.includes('--run-recon');
const shouldApply = process.argv.includes('--apply');

console.log('='.repeat(90));
console.log(`🔎 CÔNG CỤ CHẨN ĐOÁN & TÁI KIỂM TRA HỒ SƠ TKGD BỊ LỆCH (BATCH: ${targetBatch})`);
console.log(`   - Chế độ Reparse tài khoản thiếu CCCD (--reparse-missing): ${shouldReparseMissing ? 'BẬT' : 'TẮT'}`);
console.log(`   - Chế độ chạy lại Đối Soát Chéo (--run-recon): ${shouldRunRecon ? 'BẬT' : 'TẮT'}`);
console.log('='.repeat(90));

const conn = new Client();

function runRemoteCommand(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}

conn.on('ready', async () => {
  try {
    // 1. Query dữ liệu từ mongosh trên máy chủ Ubuntu
    const mongoScript = `
      const recs = db.clean_account_records.find({ batchDate: "${targetBatch}" }).toArray();
      print("###DATA_START###" + JSON.stringify(recs) + "###DATA_END###");
    `;

    const { stdout: rawOut } = await runRemoteCommand(
      `mongosh mxv_shift_checklist --quiet --eval '${mongoScript.replace(/\n/g, ' ')}'`
    );

    const { stats, reevaluatedList, missingCodes } = analyzeRecords(rawOut);

    // 2. Nếu có cờ --reparse-missing: Kích hoạt reparse cho các tài khoản thiếu CCCD
    if (shouldReparseMissing && missingCodes.length > 0) {
      console.log('\n' + '='.repeat(90));
      console.log(`🚀 BẮT ĐẦU TÁI BÓC TÁCH (REPARSE VỚI QR CODE & GEMINI VISION) CHO ${missingCodes.length} HỒ SƠ:`);
      console.log('='.repeat(90));

      for (let i = 0; i < missingCodes.length; i++) {
        const code = missingCodes[i];
        process.stdout.write(`   [${i + 1}/${missingCodes.length}] Đang bóc tách lại ${code}... `);
        const curlCmd = `curl -s -X POST http://localhost:3001/api/v1/tkgd/reparse-account -H "Content-Type: application/json" -d '{"accountCode":"${code}","batchDate":"${targetBatch}"}'`;
        const res = await runRemoteCommand(curlCmd);
        try {
          const parsed = JSON.parse(res.stdout);
          if (parsed.success) {
            console.log(`✅ Thành công`);
          } else {
            console.log(` Phản hồi: ${parsed.message || res.stdout.slice(0, 80)}`);
          }
        } catch (e) {
          console.log(` Xong (${res.stdout.slice(0, 60)}...)`);
        }
      }
      console.log('\n✅ Đã gửi toàn bộ yêu cầu Reparse sang hệ thống!');
    }

    // 3. Nếu có cờ --run-recon: Kích hoạt đối soát chéo lại toàn bộ batch
    if (shouldRunRecon) {
      console.log('\n' + '='.repeat(90));
      console.log(`🔄 ĐANG CHẠY LẠI "BƯỚC 3: ĐỐI SOÁT CHÉO" CHO TOÀN BỘ BATCH ${targetBatch}...`);
      console.log('='.repeat(90));
      const reconCmd = `curl -s -X POST http://localhost:3001/api/v1/tkgd/run -H "Content-Type: application/json" -d '{"userEmail":"hieptruong@mxv.vn","batchDate":"${targetBatch}"}'`;
      const res = await runRemoteCommand(reconCmd);
      try {
        const parsed = JSON.parse(res.stdout);
        console.log('✅ Kết quả đối soát:', parsed);
      } catch (e) {
        console.log('Kết quả:', res.stdout);
      }
    }

  } catch (err) {
    console.error('❌ Lỗi thực thi:', err.message);
  } finally {
    conn.end();
  }
}).on('error', (err) => {
  console.error('Lỗi kết nối SSH tới 10.0.0.26:', err.message);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000,
});

function normalizeName(s) {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDate(d) {
  if (!d) return '';
  const s = String(d).trim().split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = s.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return s;
}

function isGarbageName(s) {
  if (!s) return true;
  const clean = s.trim().toLowerCase();
  const garbagePhrases = [
    'để thực hiện', 'de thuc hien', 'lối', 'loi', 'thực hiện', 'dien thoai', 'điện thoại',
    'chưa ký', 'đã ký', 'hợp đồng', 'phụ lục', 'kính gửi', 'tài khoản'
  ];
  return garbagePhrases.some(g => clean.includes(g)) || clean.length < 3;
}

function analyzeRecords(rawOut) {
  const match = rawOut.match(/###DATA_START###([\s\S]*?)###DATA_END###/);
  if (!match) {
    console.error('❌ Không bóc tách được dữ liệu từ MongoDB:', rawOut);
    return { stats: {}, reevaluatedList: [], missingCodes: [] };
  }

  let records = [];
  try {
    records = JSON.parse(match[1]);
  } catch (e) {
    console.error('❌ Lỗi parse JSON:', e.message);
    return { stats: {}, reevaluatedList: [], missingCodes: [] };
  }

  console.log(`\n TỔNG QUAN DỮ LIỆU BATCH ${targetBatch}:`);
  console.log(`   - Tổng số hồ sơ: ${records.length}`);
  const khopList = records.filter(r => r.ketLuan?.trangThai === 'KHOP');
  const lechList = records.filter(r => r.ketLuan?.trangThai === 'LECH' || !r.ketLuan?.trangThai);
  console.log(`   - Trạng thái hiện tại: ✅ KHỚP: ${khopList.length} | ❌ LỆCH / CHƯA XỬ LÝ: ${lechList.length}`);

  console.log('\n' + '='.repeat(90));
  console.log('🔍 PHÂN LOẠI CHI TIẾT CÁC NGUYÊN NHÂN GÂY LỆCH HIỆN TẠI:');
  console.log('='.repeat(90));

  const stats = {
    staleMsStatus: [],        // 1. MS đã cào xong nhưng Đối Soát chưa chạy lại
    garbageNameParsed: [],    // 2. HĐ bóc dính chữ rác ("để thực hiện", "Lối")
    dateFormatFalseAlarm: [], // 3. Format YYYY-MM-DD bị coi là lỗi nghiêm trọng
    photoWarningFalseAlarm: [],// 4. Chỉ bị cảnh báo độ phân giải ảnh thấp, text khớp 100%
    missingCccdInOldRun: [],  // 5. File thiếu CCCD trong lượt chạy cũ (chưa qua QR/Gemini)
    nameOcrTypo: [],          // 6. Lệch 1 ký tự OCR (VD: THUANK vs THUẬN)
  };

  const reevaluatedList = [];
  const missingCodes = [];

  for (const r of lechList) {
    const code = r.maTKGD || r.maTKGDBase;
    const ms = r.ms || {};
    const mail = r.noiDungMail || {};
    const hd = r.hopDong || {};
    const cc = r.canCuoc || {};
    const errs = r.ketLuan?.danhSachLoi || [];

    // 1. MS đã có dữ liệu nhưng ketLuan vẫn ghi "Tài khoản chưa được tạo trên M-System"
    const hasMsData = ms.isFoundOnMS && ms.hoVaTen && ms.soCMND_HoChieu;
    const hasStaleMsError = errs.some(e => e.includes('chưa được tạo trên M-System'));
    if (hasMsData && hasStaleMsError) {
      stats.staleMsStatus.push({
        code,
        name: ms.hoVaTen,
        cccd: ms.soCMND_HoChieu,
        reason: 'MS đã cào thành công nhưng bước "Đối Soát Chéo" chưa được chạy lại sau khi MS hoàn tất.'
      });
    }

    // 2. Phân tích Tên
    let candidateName = hd.hoVaTen;
    let nameSource = 'Hợp Đồng';
    if (isGarbageName(candidateName)) {
      if (cc.hoVaTen && !isGarbageName(cc.hoVaTen)) {
        candidateName = cc.hoVaTen;
        nameSource = 'CCCD';
      } else if (mail.tenTaiKhoan && !isGarbageName(mail.tenTaiKhoan)) {
        candidateName = mail.tenTaiKhoan;
        nameSource = 'Email';
      }
      stats.garbageNameParsed.push({
        code,
        garbageName: hd.hoVaTen,
        chosenName: candidateName,
        source: nameSource,
        msName: ms.hoVaTen
      });
    }

    // 3. Phân tích Số CCCD
    const targetCccd = (cc.soCanCuoc || hd.soCanCuoc || '').replace(/\D/g, '');
    const msCccd = (ms.soCMND_HoChieu || '').replace(/\D/g, '');
    if (!targetCccd) {
      stats.missingCccdInOldRun.push({
        code,
        name: candidateName || ms.hoVaTen,
        msCccd
      });
      missingCodes.push(code);
    }

    // 4. Phân tích Format ngày
    const hdDob = hd.rawNgaySinh || '';
    const hdCap = hd.rawNgayCap || '';
    const msDob = ms.rawNgaySinh || '';
    const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if ((isIsoDate(hdDob) || isIsoDate(hdCap)) && (normalizeDate(hdDob) === normalizeDate(msDob) || !msDob)) {
      stats.dateFormatFalseAlarm.push({
        code,
        hdDob,
        msDob,
        hdCap,
        msCap: ms.rawNgayCap
      });
    }

    // 5. Phân tích Cảnh báo ảnh độ phân giải thấp
    const photoWarnings = cc.canhBaoChatLuong || [];
    const isTextMatch = normalizeName(candidateName) === normalizeName(ms.hoVaTen) && targetCccd && targetCccd === msCccd;
    if (photoWarnings.length > 0 && isTextMatch) {
      stats.photoWarningFalseAlarm.push({
        code,
        name: ms.hoVaTen,
        warnings: photoWarnings
      });
    }

    // 6. Mô phỏng Đối Soát Lại Thông Minh (Smart Re-Evaluation)
    const newErrors = [];
    if (!ms.isFoundOnMS) {
      newErrors.push('Tài khoản chưa được tạo trên M-System');
    } else {
      const normTargetName = normalizeName(candidateName);
      const normMsName = normalizeName(ms.hoVaTen);
      if (normTargetName && normMsName && normTargetName !== normMsName) {
        if (normTargetName.startsWith(normMsName) && normTargetName.length === normMsName.length + 1) {
          stats.nameOcrTypo.push({
            code,
            target: candidateName,
            ms: ms.hoVaTen,
            note: 'Dính 1 ký tự rác ở đuôi do OCR'
          });
          if (normalizeName(mail.tenTaiKhoan) === normMsName) {
            candidateName = mail.tenTaiKhoan;
          } else {
            newErrors.push(`Lệch họ tên (Yêu cầu: ${candidateName} != MS: ${ms.hoVaTen})`);
          }
        } else {
          newErrors.push(`Lệch họ tên (Yêu cầu: ${candidateName} != MS: ${ms.hoVaTen})`);
        }
      }

      if (!targetCccd) {
        newErrors.push('Hồ sơ thiếu số CCCD (Cần bóc tách lại bằng QR Code / Gemini Vision)');
      } else if (msCccd && targetCccd !== msCccd) {
        newErrors.push(`Lệch số CCCD (Yêu cầu: ${targetCccd} != MS: ${msCccd})`);
      }

      const normHdDob = normalizeDate(hdDob || cc.rawNgaySinh);
      const normMsDob = normalizeDate(msDob);
      if (normHdDob && normMsDob && normHdDob.length === 10 && normMsDob.length === 10) {
        if (normHdDob !== normMsDob) {
          newErrors.push(`Lệch ngày sinh (HĐ/CCCD: ${normHdDob} != MS: ${normMsDob})`);
        }
      }
    }

    const newStatus = newErrors.length === 0 ? 'KHOP' : 'LECH';
    reevaluatedList.push({
      code,
      name: candidateName || ms.hoVaTen,
      oldStatus: r.ketLuan?.trangThai || 'CHUA_XU_LY',
      oldErrors: errs,
      newStatus,
      newErrors,
    });
  }

  // IN BÁO CÁO PHÂN TÍCH
  console.log(`\n1️⃣  [LỖI STALE DO CHƯA CHẠY LẠI ĐỐI SOÁT SAU KHI MS CÀO XONG]: ${stats.staleMsStatus.length} tài khoản`);
  console.log(`    → Nguyên nhân: Bot cào M-System xong và điền data vào DB, nhưng chưa bấm "3. Đối Soát Chéo" nên bảng kết luận vẫn lưu lỗi "chưa được tạo trên M-System" từ lượt chạy trước.`);
  stats.staleMsStatus.slice(0, 4).forEach(s => {
    console.log(`       • ${s.code} - ${s.name} (CCCD: ${s.cccd})`);
  });
  if (stats.staleMsStatus.length > 4) console.log(`       ... và ${stats.staleMsStatus.length - 4} tài khoản khác`);

  console.log(`\n2️⃣  [LỖI LỆCH TÊN DO PDF PARSER BẮT NHẦM CHỮ RÁC]: ${stats.garbageNameParsed.length} tài khoản`);
  console.log(`    → Nguyên nhân: PDF hợp đồng có bảng đặc thù khiến regex lấy nhầm chuỗi "để thực hiện", "Lối" thay vì tên.`);
  stats.garbageNameParsed.forEach(s => {
    console.log(`       • ${s.code}: Bắt nhầm "${s.garbageName}" -> Cứu bằng ${s.source}: "${s.chosenName}" (MS: "${s.msName}")`);
  });

  console.log(`\n3️⃣  [LỖI PHẠT ĐỊNH DẠNG NGÀY YYYY-MM-DD]: ${stats.dateFormatFalseAlarm.length} tài khoản`);
  console.log(`    → Nguyên nhân: HĐ ghi ngày chuẩn ISO (YYYY-MM-DD) khớp hoàn toàn với MS nhưng bị hệ thống cũ phạt làm đổi trạng thái thành LỆCH.`);
  stats.dateFormatFalseAlarm.slice(0, 4).forEach(s => {
    console.log(`       • ${s.code}: HĐ ghi "${s.hdDob}" == MS ghi "${s.msDob}"`);
  });
  if (stats.dateFormatFalseAlarm.length > 4) console.log(`       ... và ${stats.dateFormatFalseAlarm.length - 4} tài khoản khác`);

  console.log(`\n4️⃣  [LỖI DO CẢNH BÁO ẢNH PHÂN GIẢI THẤP]: ${stats.photoWarningFalseAlarm.length} tài khoản`);
  console.log(`    → Nguyên nhân: Toàn bộ thông tin Text (Tên, CCCD, Ngày sinh) khớp 100%, nhưng bị coi là LỆCH vì ảnh upload lên MS kích thước nhỏ (270x172px).`);
  stats.photoWarningFalseAlarm.slice(0, 4).forEach(s => {
    console.log(`       • ${s.code} - ${s.name}: ${s.warnings[0]}`);
  });

  console.log(`\n5️⃣  [HỒ SƠ THIẾU SỐ CCCD TRONG LƯỢT CHẠY CŨ]: ${stats.missingCccdInOldRun.length} tài khoản`);
  console.log(`    → Nguyên nhân: Ở lượt chạy cũ chưa có QR Code Decoder & Gemini Vision, Tesseract OCR thất bại nên số CCCD bị null.`);
  stats.missingCccdInOldRun.slice(0, 5).forEach(s => {
    console.log(`       • ${s.code} - ${s.name} (Số MS mong đợi: ${s.msCccd})`);
  });
  if (stats.missingCccdInOldRun.length > 5) console.log(`       ... và ${stats.missingCccdInOldRun.length - 5} tài khoản khác`);

  console.log('\n' + '='.repeat(90));
  console.log('🎯 KẾT QUẢ MÔ PHỎNG NẾU ĐỐI SOÁT LẠI (SMART RE-EVALUATION):');
  console.log('='.repeat(90));

  const becomeKhop = reevaluatedList.filter(r => r.newStatus === 'KHOP');
  const stillLech = reevaluatedList.filter(r => r.newStatus === 'LECH');

  console.log(`   - Tổng số tài khoản bị LỆCH hiện tại: ${records.filter(r => r.ketLuan?.trangThai === 'LECH' || !r.ketLuan?.trangThai).length}`);
  console.log(`   - Số tài khoản SẼ CHUYỂN THÀNH ✅ KHỚP NGAY: ${becomeKhop.length} (${Math.round((becomeKhop.length / (records.filter(r => r.ketLuan?.trangThai === 'LECH' || !r.ketLuan?.trangThai).length || 1)) * 100)}%)`);
  console.log(`   - Số tài khoản CẦN REPARSE VỚI QR/GEMINI MỚI: ${missingCodes.length}`);
  console.log(`   - Số tài khoản LỆCH THỰC SỰ: ${stillLech.filter(r => !missingCodes.includes(r.code)).length}`);

  return { stats, reevaluatedList, missingCodes };
}

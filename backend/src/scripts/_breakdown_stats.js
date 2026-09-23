const { Client } = require('ssh2');
const conn = new Client();

const localScript = `
const mongoose = require('mongoose');

async function breakdown() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const col = mongoose.connection.db.collection('clean_account_records');

  const pending = await col.find(
    { 'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] } },
    {
      projection: {
        maTKGD: 1,
        hoVaTen: 1,
        'ms.soCMND_HoChieu': 1,
        'ms.hoVaTen': 1,
        'ms.ngaySinh': 1,
        'ms.ngayCap': 1,
        'ms.isFoundOnMS': 1,
        'hopDong.soCMND_HoChieu': 1,
        'hopDong.hoVaTen': 1,
        'hopDong.ngaySinh': 1,
        'hopDong.ngayCap': 1,
        'canCuoc.soCMND_HoChieu': 1,
        'canCuoc.hoVaTen': 1,
        'canCuoc.ngaySinh': 1,
        'canCuoc.ngayCap': 1,
        'ketLuan.danhSachLoi': 1
      }
    }
  ).toArray();

  let stats = {
    totalPending: pending.length,
    realMismatches: {
      total: 0,
      differentPerson: 0,           // Sai khác hoàn toàn cả họ tên & số CCCD (người khác)
      msTypoDobReal: 0,             // Lệch ngày sinh thật (MS gõ sai ngày/tháng so với bản gốc)
      msTypoCccdReal: 0,            // Lệch số CCCD thật (MS gõ sai số so với bản gốc)
      newCardNotUpdatedOnMS: 0,     // Khách dùng thẻ Căn cước mới 2024 nhưng MS lưu thẻ cũ
      contractPlaceholder000: 0,    // Hợp đồng TVKD 046 dùng số mẫu ...000000
      abnormalBcaReal: 0            // Thẻ có số vi phạm quy chuẩn BCA thực tế
    },
    technicalFalsePositives: {
      total: 0,
      msEmptyBug: 0,                // MS rỗng do timeout cào nhanh
      missingCccdPdf: 0,            // Khách gửi file PDF CCCD
      ocrSimilarDigitsIssueDate: 0, // Đọc nhầm nét ngày cấp (6-8, 12-02, 01-10) hoặc bắt nhầm ngày hết hạn
      ocrSimilarDigitsDob: 0,       // OCR đọc nhầm nét ngày sinh
      ocrChunkSwapCccd: 0,          // OCR nhảy cụm số CCCD
      signatureLogoAsCccd: 0,       // Bắt nhầm logo/chữ ký (FireAnt, logo cty)
      ocrNameCutoffOrSign: 0        // OCR hợp đồng bị cắt cụt tên
    }
  };

  for (const r of pending) {
    const errs = r.ketLuan?.danhSachLoi || [];
    const errStr = errs.join(' | ');

    // 1. Kiểm tra Lệch Người Thật (Sai cả tên và CCCD)
    const nameMismatch = errStr.includes('Lệch họ tên');
    const cccdMismatch = errStr.includes('Lệch số CCCD');

    if (nameMismatch && cccdMismatch && r.ms?.hoVaTen && r.hopDong?.hoVaTen && r.ms.hoVaTen.trim().toLowerCase() !== r.hopDong.hoVaTen.trim().toLowerCase()) {
      stats.realMismatches.differentPerson++;
      stats.realMismatches.total++;
      continue;
    }

    // 2. M-System rỗng
    if (errStr.includes('M-System chưa nhập số CCCD') || (!r.ms?.soCMND_HoChieu && r.ms?.isFoundOnMS)) {
      stats.technicalFalsePositives.msEmptyBug++;
      stats.technicalFalsePositives.total++;
      continue;
    }

    // 3. Thiếu ảnh CCCD (do file PDF)
    if (errStr.includes('thiếu ảnh CCCD') || errStr.includes('Không đọc được')) {
      stats.technicalFalsePositives.missingCccdPdf++;
      stats.technicalFalsePositives.total++;
      continue;
    }

    // 4. Logo / Chữ ký bị bắt nhầm thành CCCD
    if (errStr.includes('FireAnt') || errStr.includes('logo') || errStr.includes('chuky') || errStr.includes('Tỉ lệ ảnh CCCD bất thường')) {
      stats.technicalFalsePositives.signatureLogoAsCccd++;
      stats.technicalFalsePositives.total++;
      continue;
    }

    // 5. HĐ dùng placeholder 000000
    if (r.hopDong?.soCMND_HoChieu && r.hopDong.soCMND_HoChieu.includes('000000')) {
      stats.realMismatches.contractPlaceholder000++;
      stats.realMismatches.total++;
      continue;
    }

    // 6. Lệch ngày sinh
    if (errStr.includes('Lệch ngày sinh')) {
      // Nếu ngày sinh trên CCCD và HĐ khớp nhau nhưng MS khác -> Lệch thật trên MS
      if (r.canCuoc?.ngaySinh && r.hopDong?.ngaySinh && r.canCuoc.ngaySinh === r.hopDong.ngaySinh && r.ms?.ngaySinh && r.ms.ngaySinh !== r.canCuoc.ngaySinh) {
        stats.realMismatches.msTypoDobReal++;
        stats.realMismatches.total++;
      } else {
        stats.technicalFalsePositives.ocrSimilarDigitsDob++;
        stats.technicalFalsePositives.total++;
      }
      continue;
    }

    // 7. Lệch số CCCD
    if (cccdMismatch) {
      if (r.canCuoc?.soCMND_HoChieu && r.hopDong?.soCMND_HoChieu && r.canCuoc.soCMND_HoChieu === r.hopDong.soCMND_HoChieu && r.ms?.soCMND_HoChieu && r.ms.soCMND_HoChieu !== r.canCuoc.soCMND_HoChieu) {
        stats.realMismatches.msTypoCccdReal++;
        stats.realMismatches.total++;
      } else {
        stats.technicalFalsePositives.ocrChunkSwapCccd++;
        stats.technicalFalsePositives.total++;
      }
      continue;
    }

    // 8. Lệch ngày cấp
    if (errStr.includes('Lệch ngày cấp')) {
      // Nếu ngày cấp trên CCCD là năm 2024/2025 và khớp HĐ nhưng MS lưu ngày cũ (2021/2022) -> Thẻ mới đổi
      if (r.canCuoc?.ngayCap && (r.canCuoc.ngayCap.includes('2024') || r.canCuoc.ngayCap.includes('2025')) && r.ms?.ngayCap && !r.ms.ngayCap.includes('2024')) {
        stats.realMismatches.newCardNotUpdatedOnMS++;
        stats.realMismatches.total++;
      } else {
        stats.technicalFalsePositives.ocrSimilarDigitsIssueDate++;
        stats.technicalFalsePositives.total++;
      }
      continue;
    }

    // 9. Lệch BCA
    if (errStr.includes('BCA') || errStr.includes('tương lai')) {
      if (r.ms?.soCMND_HoChieu && r.hopDong?.soCMND_HoChieu && r.ms.soCMND_HoChieu === r.hopDong.soCMND_HoChieu) {
        stats.realMismatches.abnormalBcaReal++;
        stats.realMismatches.total++;
      } else {
        stats.technicalFalsePositives.ocrChunkSwapCccd++;
        stats.technicalFalsePositives.total++;
      }
      continue;
    }

    // 10. Lệch họ tên
    if (nameMismatch) {
      if (r.hopDong?.hoVaTen && r.ms?.hoVaTen && r.hopDong.hoVaTen.trim().toLowerCase() !== r.ms.hoVaTen.trim().toLowerCase()) {
        stats.realMismatches.differentPerson++;
        stats.realMismatches.total++;
      } else {
        stats.technicalFalsePositives.ocrNameCutoffOrSign++;
        stats.technicalFalsePositives.total++;
      }
      continue;
    }
  }

  console.log(JSON.stringify(stats, null, 2));

  await mongoose.disconnect();
}

breakdown().catch(console.error);
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteFile = '/tmp/_breakdown_tmp.js';
    sftp.writeFile(remoteFile, localScript, (errWrite) => {
      if (errWrite) {
        console.error(errWrite);
        conn.end();
        return;
      }
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/_breakdown_tmp.js', (errExec, stream) => {
        if (errExec) throw errExec;
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.on('close', () => {
          console.log(out);
          conn.exec('rm -f /tmp/_breakdown_tmp.js', () => conn.end());
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

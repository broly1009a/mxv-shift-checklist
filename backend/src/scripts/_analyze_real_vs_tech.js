const { Client } = require('ssh2');
const conn = new Client();

const scriptContent = `
const mongoose = require('mongoose');

async function checkRealMismatches() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const col = mongoose.connection.db.collection('clean_account_records');

  const records = await col.find({ 'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] } }).toArray();

  let realMismatches = {
    bcaRealFraudOrAbnormal: 0,
    msTypoDob: 0,
    msTypoCccd: 0,
    msTypoName: 0,
    tvkdDummyContract: 0,
    newCccdNotUpdatedOnMS: 0
  };

  let technicalFalsePositives = {
    msEmptyAwaitingScrape: 0,
    pdfCccdNotRasterized: 0,
    ocrNumIssueDate: 0,
    ocrNumCccdOrDob: 0,
    ocrNameCutoff: 0,
    ocrChunkSwapBca: 0
  };

  const realExamples = [];

  for (const r of records) {
    const errs = r.ketLuan?.danhSachLoi || [];
    const errText = errs.join(' | ');

    if (errText.includes('M-System chưa nhập số CCCD') || (!r.ms?.soCMND_HoChieu && r.ms?.isFoundOnMS)) {
      technicalFalsePositives.msEmptyAwaitingScrape++;
      continue;
    }

    if (errText.includes('thiếu ảnh CCCD') || errText.includes('Không đọc được')) {
      technicalFalsePositives.pdfCccdNotRasterized++;
      continue;
    }

    if (errText.includes('BCA') || errText.includes('tương lai') || errText.includes('bất thường')) {
      if (r.ms?.soCMND_HoChieu && r.hopDong?.soCMND_HoChieu && r.ms.soCMND_HoChieu === r.hopDong.soCMND_HoChieu) {
        realMismatches.bcaRealFraudOrAbnormal++;
        if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'BCA Bất thường thật', chiTiet: errs });
      } else {
        technicalFalsePositives.ocrChunkSwapBca++;
      }
      continue;
    }

    if (errText.includes('Lệch số CCCD')) {
      if (r.hopDong?.soCMND_HoChieu && r.hopDong.soCMND_HoChieu.includes('000000')) {
        realMismatches.tvkdDummyContract++;
        if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'HĐ mẫu TVKD 000000', chiTiet: errs });
      } else if (r.canCuoc?.soCMND_HoChieu && r.hopDong?.soCMND_HoChieu && r.canCuoc.soCMND_HoChieu === r.hopDong.soCMND_HoChieu && r.ms?.soCMND_HoChieu && r.ms.soCMND_HoChieu !== r.canCuoc.soCMND_HoChieu) {
        realMismatches.msTypoCccd++;
        if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'MS gõ sai số CCCD', chiTiet: errs });
      } else {
        technicalFalsePositives.ocrNumCccdOrDob++;
      }
      continue;
    }

    if (errText.includes('Lệch ngày sinh')) {
      if (r.canCuoc?.ngaySinh && r.hopDong?.ngaySinh && r.canCuoc.ngaySinh === r.hopDong.ngaySinh && r.ms?.ngaySinh && r.ms.ngaySinh !== r.canCuoc.ngaySinh) {
        realMismatches.msTypoDob++;
        if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'MS nhập sai ngày sinh', chiTiet: errs });
      } else {
        technicalFalsePositives.ocrNumCccdOrDob++;
      }
      continue;
    }

    if (errText.includes('Lệch ngày cấp')) {
      if (r.canCuoc?.ngayCap && r.ms?.ngayCap && r.canCuoc.ngayCap !== r.ms.ngayCap) {
        if (r.canCuoc.ngayCap.includes('2024') || r.canCuoc.ngayCap.includes('2025')) {
          realMismatches.newCccdNotUpdatedOnMS++;
          if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'Thẻ Căn cước 2024 chưa cập nhật MS', chiTiet: errs });
        } else {
          technicalFalsePositives.ocrNumIssueDate++;
        }
      } else {
        technicalFalsePositives.ocrNumIssueDate++;
      }
      continue;
    }

    if (errText.includes('Lệch họ tên')) {
      if (r.hopDong?.hoVaTen && r.ms?.hoVaTen && r.hopDong.hoVaTen.trim().toLowerCase() !== r.ms.hoVaTen.trim().toLowerCase()) {
        realMismatches.msTypoName++;
        if (realExamples.length < 10) realExamples.push({ ma: r.maTKGD, ten: r.hoVaTen, loai: 'Lệch họ tên thật giữa MS và Khách', chiTiet: errs });
      } else {
        technicalFalsePositives.ocrNameCutoff++;
      }
      continue;
    }
  }

  console.log('=== KẾT QUẢ PHÂN TÍCH LỆCH THẬT VS LỆCH KỸ THUẬT ===');
  console.log('LỆCH THẬT (NGHIỆP VỤ / CON NGƯỜI):', JSON.stringify(realMismatches, null, 2));
  const totalReal = Object.values(realMismatches).reduce((a, b) => a + b, 0);
  console.log('TỔNG SỐ CA LỆCH THẬT:', totalReal);

  console.log('LỆCH GIẢ DO KỸ THUẬT (AUTO-HEAL KHI QUÉT LẠI):', JSON.stringify(technicalFalsePositives, null, 2));
  const totalTech = Object.values(technicalFalsePositives).reduce((a, b) => a + b, 0);
  console.log('TỔNG SỐ CA LỆCH KỸ THUẬT:', totalTech);

  console.log('MỘT SỐ VÍ DỤ LỆCH THẬT:', JSON.stringify(realExamples, null, 2));

  await mongoose.disconnect();
}

checkRealMismatches().catch(console.error);
`;

const b64 = Buffer.from(scriptContent).toString('base64');
const cmd = `echo "${b64}" | base64 -d > /tmp/_check_real.js && NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/_check_real.js && rm -f /tmp/_check_real.js`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => errOut += d.toString());
    stream.on('close', () => {
      console.log(out);
      if (errOut) console.error('ERR:', errOut);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

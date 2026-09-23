const { Client } = require('ssh2');
const path = require('path');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;

    const localScript = `
const mongoose = require('mongoose');

async function analyze() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const col = mongoose.connection.db.collection('clean_account_records');

  const total = await col.countDocuments({});
  const khop = await col.countDocuments({ 'ketLuan.trangThai': 'KHOP' });
  const lech = await col.countDocuments({ 'ketLuan.trangThai': 'LECH' });
  const canKiemTra = await col.countDocuments({ 'ketLuan.trangThai': 'CAN_KIEM_TRA' });
  const chuaDoiSoat = await col.countDocuments({ 'daDoiSoat': false });

  console.log('=== THỐNG KÊ TỔNG QUAN TẠI DATABASE ===');
  console.log('Tổng số hồ sơ:', total);
  console.log('Khớp:', khop);
  console.log('Lệch:', lech);
  console.log('Cần kiểm tra:', canKiemTra);
  console.log('Chưa đối soát:', chuaDoiSoat);

  const records = await col.find({ 'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] } }).toArray();

  const errorCategories = {
    msEmpty: 0,
    missingCccd: 0,
    issueDateMismatch: 0,
    bcaAbnormal: 0,
    dobMismatch: 0,
    cccdNumMismatch: 0,
    nameMismatch: 0,
    other: 0
  };

  const samples = {
    msEmpty: [],
    missingCccd: [],
    issueDateMismatch: [],
    bcaAbnormal: [],
    dobMismatch: [],
    cccdNumMismatch: [],
    nameMismatch: []
  };

  for (const r of records) {
    const errors = r.ketLuan?.danhSachLoi || [];
    const errText = errors.join(' | ');

    if (errText.includes('M-System chưa nhập số CCCD') || (!r.ms?.soCMND_HoChieu && r.ms?.isFoundOnMS)) {
      errorCategories.msEmpty++;
      if (samples.msEmpty.length < 3) samples.msEmpty.push({ ma: r.maTKGD, ten: r.hoVaTen });
    }
    if (errText.includes('thiếu ảnh CCCD') || errText.includes('Không đọc được')) {
      errorCategories.missingCccd++;
      if (samples.missingCccd.length < 3) samples.missingCccd.push({ ma: r.maTKGD, ten: r.hoVaTen });
    }
    if (errText.includes('Lệch ngày cấp')) {
      errorCategories.issueDateMismatch++;
      if (samples.issueDateMismatch.length < 3) samples.issueDateMismatch.push({ ma: r.maTKGD, ten: r.hoVaTen, err: errors.find(e => e.includes('ngày cấp')) });
    }
    if (errText.includes('vi phạm quy chuẩn BCA') || errText.includes('ở tương lai') || errText.includes('bất thường')) {
      errorCategories.bcaAbnormal++;
      if (samples.bcaAbnormal.length < 3) samples.bcaAbnormal.push({ ma: r.maTKGD, ten: r.hoVaTen, err: errors.find(e => e.includes('BCA') || e.includes('tương lai') || e.includes('bất thường')) });
    }
    if (errText.includes('Lệch ngày sinh')) {
      errorCategories.dobMismatch++;
      if (samples.dobMismatch.length < 3) samples.dobMismatch.push({ ma: r.maTKGD, ten: r.hoVaTen, err: errors.find(e => e.includes('ngày sinh')) });
    }
    if (errText.includes('Lệch số CCCD')) {
      errorCategories.cccdNumMismatch++;
      if (samples.cccdNumMismatch.length < 3) samples.cccdNumMismatch.push({ ma: r.maTKGD, ten: r.hoVaTen, err: errors.find(e => e.includes('số CCCD')) });
    }
    if (errText.includes('Lệch họ tên')) {
      errorCategories.nameMismatch++;
      if (samples.nameMismatch.length < 3) samples.nameMismatch.push({ ma: r.maTKGD, ten: r.hoVaTen, err: errors.find(e => e.includes('họ tên')) });
    }
  }

  console.log('\\n=== PHÂN LOẠI CÁC CA LỆCH TRONG DB ===');
  console.log(JSON.stringify(errorCategories, null, 2));
  console.log('\\n=== MẪU ĐẠI DIỆN TỪNG NHÓM LỆCH ===');
  console.log(JSON.stringify(samples, null, 2));

  await mongoose.disconnect();
}

analyze().catch(console.error);
`;

    const remoteFile = '/tmp/_count_mismatches_tmp.js';
    sftp.writeFile(remoteFile, localScript, (errWrite) => {
      if (errWrite) {
        console.error('Lỗi ghi file:', errWrite);
        conn.end();
        return;
      }
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/_count_mismatches_tmp.js', (errExec, stream) => {
        if (errExec) throw errExec;
        let out = '';
        let errOut = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => errOut += d.toString());
        stream.on('close', () => {
          console.log(out);
          if (errOut) console.error('ERR:', errOut);
          conn.exec('rm -f /tmp/_count_mismatches_tmp.js', () => conn.end());
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

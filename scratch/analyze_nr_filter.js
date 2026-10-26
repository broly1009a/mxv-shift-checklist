const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/nr_audit_result.json', 'utf8'));

const filtered = data.filter(d => {
  const dLog = String(d.DATELOG || d['Ngày duyệt'] || d['Ngày yêu cầu'] || d['Ngày tạo'] || '');
  return /23\/10|24\/10|25\/10|26\/10|2026-10-23|2026-10-24|2026-10-25|2026-10-26/.test(dLog);
});

// Group by account
const byAcc = {};
filtered.forEach(item => {
  const acc = item['Số TKGD'] || item['Mã TKGD'] || 'Unknown';
  if (!byAcc[acc]) byAcc[acc] = [];
  byAcc[acc].push({
    loai: item['Loại giao dịch'],
    tien: item['Số tiền nộp/rút'],
    ngayYeuCau: item['Ngày yêu cầu'],
    ngayDuyet: item['Ngày duyệt'],
    gioDuyet: item['Giờ duyệt'],
    nguoiDuyet: item['Người duyệt'],
    dateLog: item.DATELOG,
    file: item.__source_file__.split('/').slice(-3).join('/')
  });
});

for (const [acc, list] of Object.entries(byAcc)) {
  console.log('==================================================');
  console.log('ACCOUNT:', acc, `(Total events: ${list.length})`);
  const seen = new Set();
  list.forEach(tx => {
    const key = `${tx.loai}_${tx.tien}_${tx.ngayDuyet}_${tx.gioDuyet}_${tx.nguoiDuyet}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(` -> ${tx.loai} ${Number(tx.tien).toLocaleString()} VND | NgàyDuyệt: ${tx.ngayDuyet} ${tx.gioDuyet} | NgườiDuyệt: ${tx.nguoiDuyet} | NgàyYC: ${tx.ngayYeuCau} | DATELOG: ${tx.dateLog}`);
    }
  });
}

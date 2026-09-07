const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  
  const query = { batchDate: '2026-09-04' };
  const rawRecords = await coll.find(query).sort({ createdAt: -1 }).toArray();

  const extractBaseCode = (record) => {
    if (record.maTKGDBase && record.maTKGDBase.trim()) return record.maTKGDBase.trim();
    if (record.noiDungMail?.maTKGD_Futures && record.noiDungMail.maTKGD_Futures.trim()) {
      return record.noiDungMail.maTKGD_Futures.trim();
    }
    if (record.maTKGD && record.maTKGD.trim()) {
      return record.maTKGD.trim().split('-')[0];
    }
    if (record.ms?.maTKGD && record.ms.maTKGD.trim()) {
      return record.ms.maTKGD.trim().split('-')[0];
    }
    return '';
  };

  const groupedMap = new Map();

  for (const r of rawRecords) {
    const baseCode = extractBaseCode(r);
    const groupKey = baseCode || r._id.toString();

    if (!groupedMap.has(groupKey)) {
      const primaryDoc = {
        ...r,
        maTKGD: baseCode || r.maTKGD,
        maTKGDBase: baseCode,
        accountTypes: [r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES')],
        subAccounts: [],
      };

      if (r.maTKGD?.includes('-')) {
        primaryDoc.subAccounts.push({
          code: r.maTKGD,
          type: r.accountType || (r.maTKGD.endsWith('-A') ? 'ACM' : 'SUB'),
          status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
        });
      }
      if (r.noiDungMail?.hasACMRequest && !primaryDoc.accountTypes.includes('ACM')) {
        primaryDoc.accountTypes.push('ACM');
      }

      groupedMap.set(groupKey, primaryDoc);
    } else {
      const existing = groupedMap.get(groupKey);
      const rType = r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES');
      if (!existing.accountTypes.includes(rType)) {
        existing.accountTypes.push(rType);
      }
      if (r.noiDungMail?.hasACMRequest && !existing.accountTypes.includes('ACM')) {
        existing.accountTypes.push('ACM');
      }

      if (r.maTKGD?.includes('-')) {
        if (!existing.subAccounts.some((s) => s.code === r.maTKGD)) {
          existing.subAccounts.push({
            code: r.maTKGD,
            type: rType,
            status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
          });
        }
      }

      // Hợp nhất hồ sơ: ưu tiên hồ sơ hoàn thiện nhất
      if (!existing.hopDong?.soCanCuoc && r.hopDong?.soCanCuoc) {
        existing.hopDong = r.hopDong;
      }
      if (!existing.phuLuc?.soCanCuoc && r.phuLuc?.soCanCuoc) {
        existing.phuLuc = r.phuLuc;
      }
      if (!existing.canCuoc?.soCanCuoc && r.canCuoc?.soCanCuoc) {
        existing.canCuoc = r.canCuoc;
      }
      if ((!existing.ms?.hoVaTen || existing.ms?.maTKGD?.includes('001C')) && r.ms?.hoVaTen && !r.ms?.maTKGD?.includes('001C')) {
        existing.ms = r.ms;
      }

      if (r.ketLuan?.trangThai === 'KHOP' && existing.ketLuan?.trangThai !== 'LECH') {
        existing.ketLuan = r.ketLuan;
      }
    }
  }

  const items = Array.from(groupedMap.values());
  console.log(`Total grouped items: ${items.length}`);
  const target = items.find((i) => i.maTKGDBase === '003C2333888');
  console.log('Target 003C2333888 in grouped result:', {
    maTKGD: target?.maTKGD,
    maTKGDBase: target?.maTKGDBase,
    accountTypes: target?.accountTypes,
    hasHopDong: !!target?.hopDong,
    hasPhuLuc: !!target?.phuLuc,
    hasCanCuoc: !!target?.canCuoc,
    hopDong_soCanCuoc: target?.hopDong?.soCanCuoc,
    hopDong_ngaySinh: target?.hopDong?.ngaySinh,
    hopDong_ngayKyHD: target?.hopDong?.ngayKyHD,
    subAccounts: target?.subAccounts,
    ms: target?.ms ? { hoVaTen: target.ms.hoVaTen, soCMND: target.ms.soCMND_HoChieu } : null,
  });

  await mongoose.disconnect();
}

main().catch(console.error);

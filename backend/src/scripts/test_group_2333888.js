const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv-shift-checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  const rawRecords = await coll.find({}).sort({ createdAt: -1 }).toArray();

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
      groupedMap.set(groupKey, { ...r });
    } else {
      const existing = groupedMap.get(groupKey);
      if (!existing.hopDong?.soCanCuoc && r.hopDong?.soCanCuoc) {
        existing.hopDong = r.hopDong;
      }
      if (!existing.phuLuc?.soCanCuoc && r.phuLuc?.soCanCuoc) {
        existing.phuLuc = r.phuLuc;
      }
      if (!existing.canCuoc?.soCanCuoc && r.canCuoc?.soCanCuoc) {
        existing.canCuoc = r.canCuoc;
      }
    }
  }

  const result = groupedMap.get('003C2333888');
  console.log('Grouped result for 003C2333888:');
  console.log('hopDong:', result?.hopDong);
  console.log('canCuoc:', result?.canCuoc);
  console.log('phuLuc:', result?.phuLuc);

  await mongoose.disconnect();
}

main().catch(console.error);

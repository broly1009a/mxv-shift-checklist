const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  const docs = await coll.find({ $or: [{ maTKGDBase: '003C2333888' }, { maTKGD: /003C2333888/ }] }).toArray();
  console.log('Found', docs.length, 'records:');
  docs.forEach((d, idx) => {
    console.log(`\n--- Record ${idx + 1} ---`);
    console.log('ID:', d._id);
    console.log('batchDate:', d.batchDate, '| createdAt:', d.createdAt, '| updatedAt:', d.updatedAt);
    console.log('maTKGD:', d.maTKGD, '| base:', d.maTKGDBase, '| type:', d.accountType);
    console.log('noiDungMail:', d.noiDungMail);
    console.log('hopDong:', d.hopDong);
    console.log('phuLuc:', d.phuLuc);
    console.log('canCuoc:', d.canCuoc);
    console.log('ms:', d.ms ? { hoVaTen: d.ms.hoVaTen, soCMND_HoChieu: d.ms.soCMND_HoChieu, ngaySinh: d.ms.ngaySinh, ngayThamGia: d.ms.ngayThamGia, chuKy: d.ms.chuKy } : null);
  });
  await mongoose.disconnect();
}
main().catch(console.error);

const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  const docs = await coll.find({ batchDate: '2026-09-04' }).toArray();
  console.log(`Found ${docs.length} docs for batchDate 2026-09-04:`);
  docs.forEach((d, idx) => {
    console.log(`\n[${idx + 1}] ID: ${d._id} | maTKGD: ${d.maTKGD} | base: ${d.maTKGDBase}`);
    console.log('  noiDungMail:', d.noiDungMail?.maTKGD_Futures, '|', d.noiDungMail?.tenTaiKhoan?.substring(0, 30));
    console.log('  hopDong:', d.hopDong ? { soCanCuoc: d.hopDong.soCanCuoc, ngaySinh: d.hopDong.ngaySinh } : 'NONE');
    console.log('  canCuoc:', d.canCuoc ? { soCanCuoc: d.canCuoc.soCanCuoc } : 'NONE');
    console.log('  ms:', d.ms ? { hoVaTen: d.ms.hoVaTen, soCMND_HoChieu: d.ms.soCMND_HoChieu } : 'NONE');
  });
  await mongoose.disconnect();
}
main().catch(console.error);

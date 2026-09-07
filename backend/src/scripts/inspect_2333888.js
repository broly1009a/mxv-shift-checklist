const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  const docs = await coll.find({}).toArray();
  docs.forEach((d, i) => {
    console.log(`\n--- [${i+1}] ID: ${d._id} | maTKGD: ${d.maTKGD} | maTKGDBase: ${d.maTKGDBase} | batchDate: ${d.batchDate} ---`);
    console.log('noiDungMail:', d.noiDungMail?.tenTaiKhoan?.substring(0, 40));
    console.log('hopDong:', d.hopDong ? { soCanCuoc: d.hopDong.soCanCuoc, ngaySinh: d.hopDong.ngaySinh, ngayCap: d.hopDong.ngayCap } : 'NONE');
    console.log('canCuoc:', d.canCuoc ? { soCanCuoc: d.canCuoc.soCanCuoc } : 'NONE');
    console.log('ms:', d.ms ? { hoVaTen: d.ms.hoVaTen, soCMND_HoChieu: d.ms.soCMND_HoChieu, ngaySinh: d.ms.ngaySinh } : 'NONE');
    console.log('ketLuan:', d.ketLuan);
  });
  await mongoose.disconnect();
}

main().catch(console.error);

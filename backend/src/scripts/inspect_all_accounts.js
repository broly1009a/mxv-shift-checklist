const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('clean_account_records');
  const docs = await coll.find({}).toArray();
  console.log(`Found ${docs.length} records in MongoDB:`);
  docs.forEach((d, i) => {
    console.log(`[${i+1}] ${d.maTKGD || d.maTKGDBase} - ${d.noiDungMail?.tenTaiKhoan?.substring(0, 30)}`);
    console.log(`    hasHopDong: ${!!d.hopDong}, hasCanCuoc: ${!!d.canCuoc}, hasPhuLuc: ${!!d.phuLuc}, hasMS: ${!!d.ms?.isFoundOnMS}`);
    if (d.hopDong) {
      console.log(`    hopDong: soCanCuoc=${d.hopDong.soCanCuoc}, ngaySinh=${d.hopDong.ngaySinh}`);
    }
  });
  await mongoose.disconnect();
}

main().catch(console.error);

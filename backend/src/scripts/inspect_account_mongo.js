const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const codes = ['003C1399395', '003C8946619', '003C9462626'];
  const cleanColl = mongoose.connection.collection('clean_account_records');
  const rawColl = mongoose.connection.collection('raw_account_mails');

  for (const code of codes) {
    console.log('==============================================');
    console.log('CODE:', code);
    const raw = await rawColl.findOne({ maTKGD: code });
    if (raw) {
      console.log('RAW MAIL:');
      console.log('  Subject:', raw.subject);
      console.log('  Received:', raw.receivedDateTime);
      console.log('  Attachments:', (raw.attachments || []).map(a => ({ name: a.name, contentType: a.contentType, size: a.size, localPath: a.localPath })));
    } else {
      console.log('RAW MAIL: NOT FOUND');
    }

    const clean = await cleanColl.findOne({ $or: [{ maTKGD: code }, { maTKGDBase: code }] });
    if (clean) {
      console.log('CLEAN RECORD:');
      console.log('  mail:', clean.noiDungMail);
      console.log('  hopDong:', clean.hopDong);
      console.log('  canCuoc:', clean.canCuoc);
      console.log('  phuLuc:', clean.phuLuc);
      console.log('  ms:', clean.ms);
      console.log('  ketLuan:', clean.ketLuan);
    } else {
      console.log('CLEAN RECORD: NOT FOUND');
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('raw_account_mails');
  const docs = await coll.find({}).sort({ receivedDateTime: -1 }).toArray();
  console.log('Total raw_account_mails:', docs.length);
  docs.forEach((d, i) => {
    console.log(`\n--- [${i + 1}] ---`);
    console.log('ID:', d._id);
    console.log('messageId:', d.messageId);
    console.log('Subject:', d.subject);
    console.log('Received:', d.receivedDateTime);
    console.log('Attachments count:', (d.attachments || []).length);
    (d.attachments || []).forEach(a => {
      console.log('  -> File:', a.name, 'Size:', a.size, 'localPath:', a.localPath);
    });
    const body = (d.bodyRawText || d.bodyText || '').replace(/\r?\n/g, ' ');
    console.log('Body start:', body.substring(0, 300));
  });
  await mongoose.disconnect();
}

main().catch(console.error);

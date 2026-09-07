const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const coll = mongoose.connection.collection('raw_account_mails');
  const docs = await coll.find({}).toArray();
  for (const d of docs) {
    const body = (d.bodyRawText || d.bodyText || '');
    const m = body.match(/003C\d{7}/g);
    console.log('ID:', d._id, 'Subj:', d.subject, 'Date:', d.receivedDateTime, 'Accounts in body:', m, 'Attachments:', (d.attachments||[]).length);
  }
  await mongoose.disconnect();
}

main().catch(console.error);

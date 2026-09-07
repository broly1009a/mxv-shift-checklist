const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const coll = mongoose.connection.collection('raw_account_mails');
  const docs = await coll.find({ messageId: /AAMkADg4NzQ3/ }).toArray();
  for (const d of docs) {
    console.log('==============================================');
    console.log('MSG ID:', d.messageId);
    console.log('SUBJECT:', d.subject);
    console.log('DATE:', d.receivedDateTime);
    console.log('BODY:\n', d.bodyRawText || d.bodyText);
  }
  await mongoose.disconnect();
}

run().catch(console.error);

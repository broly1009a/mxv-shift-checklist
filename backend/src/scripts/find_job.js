const mongoose = require('mongoose');
const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const targetId = new mongoose.Types.ObjectId('6ad237c831a9aa9799e5a144');
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const doc = await db.collection(c.name).findOne({ _id: targetId });
    if (doc) {
      console.log('FOUND _id IN COLLECTION:', c.name);
      console.log(JSON.stringify({
        _id: doc._id,
        jobType: doc.jobType,
        status: doc.status,
        payloadResult: doc.payload?.result,
        totals: doc.payload?.result?.totals,
        mismatchedTrades: doc.payload?.result?.mismatchedTrades
      }, null, 2));
      break;
    }
    const doc2 = await db.collection(c.name).findOne({
      $or: [
        { id: '6ad237c831a9aa9799e5a144' },
        { jobId: '6ad237c831a9aa9799e5a144' },
        { taskId: '6ad237c831a9aa9799e5a144' },
        { 'details.jobId': '6ad237c831a9aa9799e5a144' },
        { logs: { $regex: '6ad237c831a9aa9799e5a144' } }
      ]
    });
    if (doc2) {
      console.log('FOUND reference IN COLLECTION:', c.name);
      console.log(JSON.stringify(doc2, null, 2));
      break;
    }
  }
  console.log('Done searching.');
  await mongoose.disconnect();
}

main().catch(console.error);

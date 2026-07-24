const mongoose = require('mongoose');
require('dotenv').config();

async function inspectSodResultNote() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log('Connecting to Mongo:', uri);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const targetLog = await db.collection('shift_logs').findOne({ _id: new mongoose.Types.ObjectId('6a62bc8887337d723fab15c8') });
  if (targetLog) {
    const tasks = targetLog.details || targetLog.items || targetLog.tasks || [];
    const item = tasks.find(t => t.taskId === 'TASK_CHECK_CQG_s1');
    if (item) {
      console.log(`FOUND TASK_CHECK_CQG_s1:`);
      console.log(`ResultNote Length: ${item.resultNote.length}`);
      const parsed = JSON.parse(item.resultNote);
      console.log(`parsed.type:`, parsed.type);
      console.log(`parsed.result type:`, typeof parsed.result, Array.isArray(parsed.result));
      if (Array.isArray(parsed.result)) {
        console.log(`parsed.result length:`, parsed.result.length);
        console.log(`First item of parsed.result:`, parsed.result[0]);
      } else {
        console.log(`parsed.result value:`, parsed.result);
      }
    }
  }

  await mongoose.disconnect();
}

inspectSodResultNote().catch(console.error);

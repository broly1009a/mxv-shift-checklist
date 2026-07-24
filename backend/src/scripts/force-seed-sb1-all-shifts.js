const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;

  for (const s of shifts) {
    if (s.details && Array.isArray(s.details)) {
      const hasParent = s.details.some(d => d.taskId === 'ops_during_01');
      const hasSb1 = s.details.some(d => d.taskId === 'ops_during_01_sb1');

      if (hasParent && !hasSb1) {
        const parentIdx = s.details.findIndex(d => d.taskId === 'ops_during_01');
        const newDetailItem = {
          taskId: 'ops_during_01_sb1',
          taskNameSnapshot: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
          prioritySnapshot: 'HIGH',
          sortOrderSnapshot: parentIdx + 1,
          isChecked: false,
          checkedAt: null,
          status: 'PENDING',
          note: '',
          isBotCheckSnapshot: true,
          botCheckTypeSnapshot: 'CHECK_MARGIN_DECISION',
          resultNote: '',
          parentTaskId: 'ops_during_01',
          parentTaskIdSnapshot: 'ops_during_01'
        };
        s.details.splice(parentIdx + 1, 0, newDetailItem);
        await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { details: s.details } });
        shiftLogsUpdated++;
      }
    }
  }

  console.log(`Force updated ${shiftLogsUpdated} shift_log documents.`);
  await client.close();
}

main().catch(console.error);

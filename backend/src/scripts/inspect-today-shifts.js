const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({ shiftDate: '2026-07-21' }).toArray();
  console.log(`Found ${shifts.length} shifts for today 2026-07-21.`);

  for (const s of shifts) {
    console.log(`Shift ID: ${s._id}, status: ${s.status}, slot: ${s.shiftSlotId}`);
    (s.tasks || []).forEach(t => {
      if (!t.parentTaskIdSnapshot) {
        console.log(`  Parent Task: [${t.taskId}] "${t.taskName}"`);
      } else {
        console.log(`     Sub Task: [${t.taskId}] "${t.taskName}" -> Parent: ${t.parentTaskIdSnapshot}`);
      }
    });
  }

  await client.close();
}

main().catch(console.error);

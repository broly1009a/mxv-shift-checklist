const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function check() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const todayStr = '2026-08-11';
  const shiftLogs = await db.collection('shift_logs').find({ shiftDate: todayStr }).toArray();

  console.log(`Found ${shiftLogs.length} shift logs for ${todayStr}:`);
  for (const log of shiftLogs) {
    console.log(`\nShift Log ID: ${log._id}`);
    console.log(`  Shift Date : ${log.shiftDate}`);
    console.log(`  Shift Status: ${log.status}`);
    console.log(`  Shift Name  : ${log.shiftName || log.slotId}`);
    
    const targets = ['ops_open_04_s2', 'ops_open_04_s3'];
    for (const t of log.details) {
      if (targets.includes(t.taskId)) {
        console.log(`    [Task: ${t.taskId}] "${t.taskNameSnapshot.substring(0, 40)}"`);
        console.log(`      Status    : ${t.status}`);
        console.log(`      isChecked : ${t.isChecked}`);
        console.log(`      resultNote: ${t.resultNote}`);
        console.log(`      botCheckType: ${t.botCheckTypeSnapshot}`);
      }
    }
  }

  await client.close();
}

check().catch(e => { console.error(e.message); process.exit(1); });

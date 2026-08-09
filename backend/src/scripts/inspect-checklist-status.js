const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const shiftLogId = '6a74bdceb2d1fe16fd7c7af8';
  console.log(`--- INSPECTING SHIFT LOG ${shiftLogId} ---`);
  const shiftLogsCol = db.collection('shift_logs');
  
  const log = await shiftLogsCol.findOne({ _id: new ObjectId(shiftLogId) });
  if (!log) {
    console.log('Shift log not found!');
    await client.close();
    return;
  }

  console.log(`Shift Date: ${log.shiftDate}`);
  console.log(`Shift Log Status: ${log.status}`);

  // Find all tasks related to CHECK_KLGD or reconciliation
  const tasks = log.details.filter(d => 
    d.taskId.includes('KLGD') || 
    (d.botCheckTypeSnapshot && d.botCheckTypeSnapshot.includes('KLGD'))
  );

  tasks.forEach(t => {
    console.log(`Task: [${t.taskId}] ${t.taskNameSnapshot}`);
    console.log(`- Status: ${t.status}`);
    console.log(`- IsChecked: ${t.isChecked}`);
    console.log(`- BotCheckType: ${t.botCheckTypeSnapshot}`);
    console.log(`- Note: ${t.note}`);
    console.log(`- ResultNote: ${t.resultNote}`);
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

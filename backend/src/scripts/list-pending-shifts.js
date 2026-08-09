const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const shiftLogsCol = db.collection('shift_logs');
  const pendingShifts = await shiftLogsCol.find({ status: 'PENDING' }).toArray();

  console.log(`Found ${pendingShifts.length} PENDING shift logs:`);
  for (const s of pendingShifts) {
    console.log(`- ID: ${s._id}, Date: ${s.shiftDate}, Slot: ${s.shiftSlotName}`);
    if (s.details) {
      const snapshotTasks = s.details.filter(d => d.taskNameSnapshot?.includes('Job Snapshot') || d.taskId?.includes('snapshot') || d.taskId?.includes('open_01'));
      console.log(`  * Has ${s.details.length} subtasks total.`);
      if (snapshotTasks.length > 0) {
        console.log('  * Found matching snapshot subtasks:');
        snapshotTasks.forEach(t => {
          console.log(`    - TaskId: "${t.taskId}", Name: "${t.taskNameSnapshot}", Status: "${t.status}"`);
        });
      } else {
        console.log('  * No snapshot subtasks in this shift log.');
      }
    }
  }

  await client.close();
}

main().catch(console.error);

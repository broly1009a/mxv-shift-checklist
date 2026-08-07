const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const log = await db.collection('shift_logs').findOne({ _id: new ObjectId('6a74bdceb2d1fe16fd7c7af8') });
  const task = log.details.find(t => t.taskId === 'TASK_CHECK_KLGD_s1');
  console.log('--- TASK_CHECK_KLGD_s1 DETAILS (AUG 7) ---');
  console.log(JSON.stringify(task, null, 2));

  await client.close();
}

main().catch(console.error);

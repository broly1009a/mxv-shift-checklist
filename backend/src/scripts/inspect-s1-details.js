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
  const shift = await shiftLogsCol.findOne({ _id: new (require('mongodb').ObjectId)('6a74bdcdb2d1fe16fd7c7af4') });

  if (shift && shift.details) {
    const s1 = shift.details.find(d => d.taskId === 'ops_open_01_s1');
    console.log('--- DETAILS of ops_open_01_s1 in active shift ---');
    console.log(JSON.stringify(s1, null, 2));
  } else {
    console.log('Shift or details not found');
  }

  await client.close();
}

main().catch(console.error);

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
  console.log(`--- AUDIT LOGS FOR KLGD TASKS IN SHIFT ${shiftLogId} ---`);
  const auditLogsCol = db.collection('audit_logs');
  
  const logs = await auditLogsCol.find({
    shiftLogId: new ObjectId(shiftLogId),
    taskId: { $in: ['TASK_CHECK_KLGD', 'TASK_CHECK_KLGD_s1', 'TASK_CHECK_KLGD_s2'] }
  }).sort({ createdAt: 1 }).toArray();

  logs.forEach(l => {
    console.log(`[${l.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}] User: ${l.userId} | Action: ${l.action} | Task: [${l.taskId}]`);
    console.log(`  Details: ${l.details.substring(0, 150)}`);
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

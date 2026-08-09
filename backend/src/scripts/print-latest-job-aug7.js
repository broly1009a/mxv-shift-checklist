const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- LATEST BOT JOB FOR AUG 7 ---');
  const job = await db.collection('bot_jobs').findOne(
    { 'payload.shiftLogId': '6a74bdceb2d1fe16fd7c7af8' },
    { sort: { createdAt: -1 } }
  );
  if (job) {
    console.log(`Job ID: ${job._id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created At: ${job.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    console.log(`Logs:`, job.logs);
    console.log(`Result:`, JSON.stringify(job.payload?.result, null, 2));
  } else {
    console.log('No job found for August 7!');
  }

  await client.close();
}

main().catch(console.error);

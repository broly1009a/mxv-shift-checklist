const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- BOT JOBS FOR SHIFT AUG 7 ---');
  const jobsCol = db.collection('bot_jobs');
  
  const jobs = await jobsCol.find({
    'payload.shiftLogId': '6a74bdceb2d1fe16fd7c7af8'
  }).sort({ createdAt: -1 }).toArray();

  jobs.forEach(j => {
    console.log(`Job ID: ${j._id} | Type: ${j.jobType} | Status: ${j.status} | Created: ${j.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    console.log(`  Logs:`, j.logs);
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

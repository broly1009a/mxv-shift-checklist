const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- RECENT BOT JOBS ---');
  const jobsCol = db.collection('bot_jobs');
  
  const jobs = await jobsCol.find({
    jobType: 'CHECK_KLGD'
  }).sort({ createdAt: -1 }).limit(10).toArray();

  jobs.forEach(j => {
    console.log(`Job ID: ${j._id} | Type: ${j.jobType} | Status: ${j.status} | Created: ${j.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} | Shift: ${j.payload?.shiftLogId}`);
    if (j.logs && j.logs.length > 0) {
      console.log(`  Last Log: ${j.logs[j.logs.length - 1]}`);
    }
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

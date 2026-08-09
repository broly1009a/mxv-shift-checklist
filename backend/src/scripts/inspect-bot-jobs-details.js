const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const shiftLogId = '6a74bdcdb2d1fe16fd7c7af4';
  console.log(`--- INSPECTING BOT JOBS FOR SHIFT LOG ${shiftLogId} ---`);

  const botJobsCol = db.collection('bot_jobs');
  const jobs = await botJobsCol.find({
    'payload.shiftLogId': shiftLogId
  }).sort({ createdAt: -1 }).toArray();

  console.log(`Found ${jobs.length} jobs connected to this shift:`);
  jobs.forEach((job, idx) => {
    console.log(`[Job ${idx + 1}] ID=${job._id}, Type=${job.jobType}, Status=${job.status}`);
    console.log(`- Attempts: ${job.attempts}/${job.maxAttempts}`);
    console.log(`- CreatedAt: ${job.createdAt}`);
    console.log(`- Payload: ${JSON.stringify(job.payload)}`);
    console.log(`- Logs: ${JSON.stringify(job.logs || [])}`);
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

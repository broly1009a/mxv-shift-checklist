const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- INSPECTING RECENT CHECK_KLGD JOBS ---');
  const botJobsCol = db.collection('bot_jobs');
  const jobs = await botJobsCol.find({
    jobType: 'CHECK_KLGD'
  }).sort({ createdAt: -1 }).limit(6).toArray();

  jobs.forEach((job, idx) => {
    console.log(`[Job ${idx + 1}] ID=${job._id}, Status=${job.status}`);
    console.log(`- CreatedAt: ${job.createdAt}`);
    console.log(`- Payload: ${JSON.stringify(job.payload)}`);
    console.log(`- Logs:`);
    (job.logs || []).forEach(l => console.log(`  ${l}`));
    console.log('------------------------------------');
  });

  await client.close();
}

main().catch(console.error);

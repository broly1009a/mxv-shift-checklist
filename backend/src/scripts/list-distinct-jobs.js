const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- DISTINCT JOB TYPES AND STATUSES ---');
  const botJobsCol = db.collection('bot_jobs');
  
  const agg = await botJobsCol.aggregate([
    {
      $group: {
        _id: { jobType: '$jobType', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  agg.forEach(item => {
    console.log(`- JobType: "${item._id.jobType}", Status: "${item._id.status}", Count: ${item.count}`);
  });

  console.log('\n--- SYSTEM SETTING FOR SIMULATE_BOT_CHECKS ---');
  console.log('process.env.SIMULATE_BOT_CHECKS =', process.env.SIMULATE_BOT_CHECKS);

  await client.close();
}

main().catch(console.error);

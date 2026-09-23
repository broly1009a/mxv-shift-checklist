const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('✅ Connected to MongoDB');

  // Lấy các job gần nhất của ngày 17/09 và 18/09
  const jobs = await db.collection('bot_jobs')
    .find({ jobType: 'CHECK_KLGD' })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  for (const j of jobs) {
    console.log(`\n========================================`);
    console.log(`Job ID: ${j._id} | Status: ${j.status} | Created: ${j.createdAt}`);
    console.log(`Payload Keys:`, Object.keys(j.payload || {}));
    if (j.payload?.result) {
      console.log(`Result Keys:`, Object.keys(j.payload.result));
      console.log(`Totals:`, JSON.stringify(j.payload.result.totals, null, 2));
    } else {
      console.log(`Result: undefined / null`);
    }
  }

  await client.close();
}

main().catch(console.error);

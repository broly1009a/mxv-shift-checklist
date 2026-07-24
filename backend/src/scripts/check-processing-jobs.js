const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const jobs = await db.collection('bot_jobs').find({ status: { $in: ['PROCESSING', 'PENDING'] } }).toArray();
  console.log(`Currently ${jobs.length} jobs in PROCESSING or PENDING status:`);
  jobs.forEach(j => {
    console.log(`- Job ${j._id} (${j.jobType}): Status = ${j.status}, Attempts = ${j.attempts}`);
    console.log(`  Logs count: ${j.logs?.length || 0}`);
    console.log(`  Last log: ${j.logs && j.logs.length > 0 ? j.logs[j.logs.length - 1] : 'NONE'}`);
  });

  await client.close();
}

main().catch(console.error);

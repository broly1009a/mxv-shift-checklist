import { MongoClient } from 'mongodb';

const URI =
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const jobs = await db
    .collection('bot_jobs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  console.log('\n--- LAST 5 BOT JOBS ---');
  for (const job of jobs) {
    console.log(`\nID: ${job._id}`);
    console.log(`Type: ${job.jobType}`);
    console.log(`Status: ${job.status}`);
    console.log(`Logs:`);
    if (job.logs && job.logs.length > 0) {
      job.logs.forEach((l: any) => console.log(`  ${l}`));
    } else {
      console.log('  (No logs)');
    }
  }
  await client.close();
}

main().catch(console.error);

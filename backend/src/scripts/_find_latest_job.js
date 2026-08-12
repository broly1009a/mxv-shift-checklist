const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function check() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  for (const colName of ['botjobs', 'bot_jobs']) {
    const job = await db.collection(colName).findOne(
      { jobType: 'FILE_AUDIT_CQG', status: 'COMPLETED' },
      { sort: { createdAt: -1 } }
    );
    if (job) {
      console.log(`[Collection: ${colName}] Latest COMPLETED job ID: ${job._id}, Created: ${job.createdAt}`);
      console.log(`  Payload result:`, JSON.stringify(job.payload?.result || job.payload?.get?.('result'), null, 2));
    } else {
      console.log(`[Collection: ${colName}] No completed job found.`);
    }
  }

  await client.close();
}

check().catch(e => { console.error(e.message); process.exit(1); });

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  // Reset all stuck PROCESSING jobs back to FAILED/PENDING
  const res = await db.collection('bot_jobs').updateMany(
    { status: 'PROCESSING' },
    {
      $set: {
        status: 'FAILED',
        updatedAt: new Date()
      },
      $push: {
        logs: `[${new Date().toISOString()}] Job tự động reset do Server restart hoặc bị treo.`
      }
    }
  );
  console.log(`Reset ${res.modifiedCount} stuck PROCESSING jobs to FAILED.`);

  await client.close();
}

main().catch(console.error);

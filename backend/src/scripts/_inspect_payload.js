const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function check() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const doc = await db.collection('bot_jobs').findOne({ jobType: 'FILE_AUDIT_CQG' }, { sort: { createdAt: -1 } });
  console.log('MongoDB Raw Document payload:', JSON.stringify(doc.payload, null, 2));
  
  await client.close();
}

check().catch(e => { console.error(e.message); process.exit(1); });

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`Collection "${c.name}": ${count} documents`);
  }

  await client.close();
}

main().catch(console.error);

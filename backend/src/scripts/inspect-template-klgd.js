const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const collections = await db.listCollections().toArray();
  console.log('Collections in database:');
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(` - ${col.name}: ${count} docs`);
  }

  await client.close();
}

main().catch(console.error);

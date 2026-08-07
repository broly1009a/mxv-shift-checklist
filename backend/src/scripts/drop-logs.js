const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('Connected to MongoDB.');

  const collections = ['system_logs', 'audit_logs', 'notification_logs'];
  for (const colName of collections) {
    try {
      console.log(`Dropping collection: ${colName}`);
      await db.collection(colName).drop();
      console.log(`Dropped ${colName} successfully.`);
    } catch (err) {
      console.log(`Could not drop ${colName}: ${err.message}`);
    }
  }

  await client.close();
  console.log('Done.');
}

main().catch(console.error);

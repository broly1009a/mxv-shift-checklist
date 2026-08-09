const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- M365 SETTINGS IN SYSTEM_SETTINGS ---');
  const settingsCol = db.collection('system_settings');
  const settings = await settingsCol.find({
    key: { $regex: /m365/i }
  }).toArray();

  settings.forEach(s => {
    // Mask sensitive values
    let val = s.value;
    if (s.key.includes('secret') || s.key.includes('pass') || s.key.includes('token')) {
      val = '********';
    }
    console.log(`- Key: "${s.key}", Value: "${val}"`);
  });

  await client.close();
}

main().catch(console.error);

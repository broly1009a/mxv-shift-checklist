const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function run() {
  await mongoose.connect('mongodb://10.0.0.26:27017/mxv-checklist');
  const collection = mongoose.connection.collection('system_settings');
  const docs = await collection.find({}).toArray();
  console.log('--- SYSTEM SETTINGS ---');
  for (const doc of docs) {
    if (doc.key && (doc.key.includes('backup') || doc.key.includes('path') || doc.key.includes('acm'))) {
      console.log(`${doc.key}: ${doc.value}`);
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);


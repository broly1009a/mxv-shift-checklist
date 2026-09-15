const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const settings = await mongoose.connection.db.collection('system_settings').find({}).toArray();
  for (const s of settings) {
    if (s.key.includes('backup') || s.key.includes('path') || s.key.includes('dir')) {
      console.log(`${s.key} = ${s.value}`);
    }
  }
  await mongoose.disconnect();
}
run();

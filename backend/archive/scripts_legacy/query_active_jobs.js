const mongoose = require('mongoose');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(URI);
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  
  const activeJobs = await db.collection('bot_jobs').find({ status: { $in: ['PENDING', 'PROCESSING'] } }).toArray();
  
  console.log(`\nFound ${activeJobs.length} active (PENDING/PROCESSING) jobs:`);
  for (const j of activeJobs) {
    console.log(`\n========================================`);
    console.log(`ID: ${j._id}`);
    console.log(`Type: ${j.type}`);
    console.log(`Status: ${j.status}`);
    console.log(`Attempts: ${j.attempts}/${j.maxAttempts}`);
    console.log(`Created At: ${j.createdAt}`);
    console.log(`Updated At: ${j.updatedAt}`);
    console.log(`Logs:`);
    if (j.logs && j.logs.length > 0) {
      j.logs.forEach(l => console.log(`  ${l}`));
    } else {
      console.log(`  (No logs)`);
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);

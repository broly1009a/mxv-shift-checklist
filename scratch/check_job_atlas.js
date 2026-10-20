const mongoose = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'mongoose'));

const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const job = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad5f61e67544cdff20cac11') })
    || await db.collection('bot_jobs').findOne({ jobId: '6ad5f61e67544cdff20cac11' });

  if (job) {
    console.log('=== FOUND JOB ===');
    console.log('ID:', job._id);
    console.log('jobType:', job.jobType);
    console.log('status:', job.status);
    console.log('payload:', JSON.stringify(job.payload, null, 2));
    console.log('logs:');
    (job.logs || []).forEach(l => console.log(' ', l));
  } else {
    console.log('Job not found by ID! Most recent 5 jobs:');
    const recents = await db.collection('bot_jobs').find().sort({ _id: -1 }).limit(5).toArray();
    recents.forEach(j => {
      console.log(`ID: ${j._id}, Type: ${j.jobType}, Status: ${j.status}, Payload:`, JSON.stringify(j.payload));
    });
  }

  await mongoose.disconnect();
})();

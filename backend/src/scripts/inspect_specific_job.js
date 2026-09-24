const mongoose = require('mongoose');
require('dotenv').config();

async function inspectSpecific() {
  const uri = process.env.MONGODB_URI || 'mongodb://10.0.0.26:27017/mxv-shift-checklist';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const targetId = '6ab4a2f219e5e3ef94a5faa3';
  let job = null;
  try {
    job = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId(targetId) });
  } catch {
    job = await db.collection('bot_jobs').findOne({ _id: targetId });
  }

  console.log('=== JOB 6ab4a2f219e5e3ef94a5faa3 ===');
  if (job) {
    console.log('Found:', job._id, job.jobType, job.status);
    console.log('CreatedAt:', job.createdAt, 'UpdatedAt:', job.updatedAt);
    console.log('Payload result totals:', JSON.stringify(job.payload?.result?.totals, null, 2));
  } else {
    console.log('Not found by ID in bot_jobs. Searching by regex or limit...');
  }

  // Find all jobs created today
  const todayJobs = await db.collection('bot_jobs').find({}).sort({ updatedAt: -1 }).limit(3).toArray();
  console.log('=== TOP 3 RECENT UPDATED JOBS ===');
  for (const j of todayJobs) {
    console.log(j._id, j.jobType, j.status, 'Updated:', j.updatedAt, 'Totals:', j.payload?.result?.totals);
  }

  await mongoose.disconnect();
}

inspectSpecific().catch(console.error);

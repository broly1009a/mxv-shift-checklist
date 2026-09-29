const mongoose = require('mongoose');
require('dotenv').config();

async function inspect() {
  const uri = process.env.MONGODB_URI || 'mongodb://10.0.0.26:27017/mxv-shift-checklist';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const jobs = await db.collection('bot_jobs')
    .find({ jobType: { $in: ['CHECK_KLGD', 'DOWNLOAD_CCP'] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  console.log(`=== RECENT ${jobs.length} JOBS ===`);
  for (const j of jobs) {
    console.log(`\nID: ${j._id}`);
    console.log(`Type: ${j.jobType}, Status: ${j.status}`);
    console.log(`CreatedAt: ${j.createdAt}, UpdatedAt: ${j.updatedAt}`);
    const totals = j.payload?.result?.totals;
    console.log(`Totals:`, totals);
    const lastLogs = Array.isArray(j.logs) ? j.logs.slice(-5) : [];
    console.log(`Last logs:`, lastLogs);
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);

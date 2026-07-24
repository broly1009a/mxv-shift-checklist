const mongoose = require('mongoose');
require('dotenv').config();

async function inspectRpaLog() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log('Connecting to Mongo:', uri);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;

  // 1. Find jobs for RPA_DOWNLOAD_REPORTS in bot_jobs
  const jobs = await db.collection('bot_jobs').find({ jobType: 'RPA_DOWNLOAD_REPORTS' }).sort({ createdAt: -1 }).limit(5).toArray();

  console.log(`\n=== FOUND ${jobs.length} RECENT RPA_DOWNLOAD_REPORTS JOBS IN BOT_JOBS ===`);
  for (const job of jobs) {
    console.log(`\n----------------------------------------`);
    console.log(`Job ID: ${job._id}, Status: ${job.status}, Attempts: ${job.attempts}/${job.maxAttempts}`);
    console.log(`Created: ${job.createdAt}, Updated: ${job.updatedAt}`);
    console.log(`Logs (${job.logs?.length || 0} lines):`);
    console.log((job.logs || []).join('\n'));
    if (job.error) {
      console.log(`Error:`, job.error);
    }
  }

  // 2. Find shift log task ops_open_rpa_download in shift_logs
  const targetLog = await db.collection('shift_logs').findOne({ _id: new mongoose.Types.ObjectId('6a62bc8887337d723fab15c8') });
  if (targetLog) {
    const tasks = targetLog.details || targetLog.items || targetLog.tasks || [];
    const rpaTask = tasks.find(t => t.taskId === 'ops_open_rpa_download' || (t.title || '').includes('RPA'));
    if (rpaTask) {
      console.log(`\n=== FOUND ops_open_rpa_download IN SHIFT LOG ===`);
      console.log(`TaskId: ${rpaTask.taskId}, Status: ${rpaTask.status}`);
      console.log(`ResultNote:`, rpaTask.resultNote);
    }
  }

  await mongoose.disconnect();
}

inspectRpaLog().catch(console.error);

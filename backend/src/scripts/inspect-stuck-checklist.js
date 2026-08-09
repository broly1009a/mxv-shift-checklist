const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('--- INSPECTING STUCK CHECKLIST SUBTASK ---');

  // Find the active shift log (status PENDING or the latest one)
  const shiftLogsCol = db.collection('shift_logs');
  const activeShift = await shiftLogsCol.findOne(
    { status: 'PENDING' },
    { sort: { createdAt: -1 } }
  ) || await shiftLogsCol.findOne({}, { sort: { createdAt: -1 } });

  if (!activeShift) {
    console.log('No shift log found.');
    await client.close();
    return;
  }

  console.log(`Active Shift: ID=${activeShift._id}, Date=${activeShift.shiftDate}, Shift=${activeShift.shiftSlotName}, Status=${activeShift.status}`);

  // Print all task details in active shift
  if (activeShift.details) {
    console.log(`\nActive Shift has ${activeShift.details.length} subtasks.`);
    console.log('List of subtasks that are PROCESSING or isBotCheck:');
    activeShift.details.forEach(d => {
      const isBot = d.isBotCheck || d.isBotCheckSnapshot;
      if (d.status === 'PROCESSING' || isBot) {
        console.log(`- TaskId: "${d.taskId}", Name: "${d.taskNameSnapshot || d.taskName}", Status: "${d.status}", isBotCheck: ${isBot}`);
      }
    });
  } else {
    console.log('No details found in activeShift.');
  }

  // Query bot_jobs matching any job in the last 12 hours
  const botJobsCol = db.collection('bot_jobs');
  const matchingJobs = await botJobsCol.find({
    createdAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
  }).sort({ createdAt: -1 }).limit(10).toArray();

  console.log(`\nFound ${matchingJobs.length} bot jobs for "ops_open_01_s1":`);
  matchingJobs.forEach((job, idx) => {
    console.log(`[Job ${idx + 1}] ID=${job._id}`);
    console.log(`- Status: ${job.status}`);
    console.log(`- Attempts: ${job.attempts}/${job.maxAttempts}`);
    console.log(`- CreatedAt: ${job.createdAt}`);
    console.log(`- Payload: ${JSON.stringify(job.payload)}`);
    console.log(`- Logs (last 3 lines): ${JSON.stringify(job.logs?.slice(-3) || [])}`);
  });

  await client.close();
}

main().catch(console.error);

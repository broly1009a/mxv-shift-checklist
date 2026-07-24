const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  console.log('=== 1. RECENT BOT JOBS ===');
  const jobs = await db.collection('bot_jobs').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  jobs.forEach(j => {
    console.log(`Job ID: ${j._id}, Type: ${j.jobType}, Status: ${j.status}, Attempts: ${j.attempts}, TaskId: ${j.payload?.taskId}`);
    console.log('  Last 3 logs:', j.logs ? j.logs.slice(-3) : []);
  });

  console.log('\n=== 2. ACTIVE SHIFT LOG DETAILS (BOT TASKS) ===');
  const activeShift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (activeShift) {
    console.log(`Shift ID: ${activeShift._id}, Date: ${activeShift.shiftDate}`);
    const botTasks = activeShift.details.filter(d => d.isBotCheck);
    botTasks.forEach(t => {
      console.log(`  TaskId: ${t.taskId}, Name: ${t.taskName}, Status: ${t.status}, CheckType: ${t.botCheckType}`);
      console.log(`    ResultNote: ${t.resultNote ? t.resultNote.substring(0, 150) + '...' : 'NONE'}`);
    });
  } else {
    console.log('No PENDING shift log found.');
  }

  await client.close();
}

main().catch(console.error);

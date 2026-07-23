const mongoose = require('mongoose');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  const activeShiftLogs = await db.collection('shift_logs').find({ status: { $ne: 'COMPLETED' } }).toArray();
  console.log(`Found ${activeShiftLogs.length} active shift logs:`);
  
  for (const log of activeShiftLogs) {
    console.log(`\n- Shift Log ID: ${log._id}`);
    console.log(`  Template ID: ${log.templateId}`);
    console.log(`  Shift Date: ${log.shiftDate}`);
    console.log(`  Status: ${log.status}`);
    
    // Check if details contains TASK_CHECK_KLGD
    const hasKlgd = log.details.some(d => d.taskId === 'TASK_CHECK_KLGD');
    console.log(`  Contains TASK_CHECK_KLGD? ${hasKlgd}`);
    if (hasKlgd) {
      const klgdDetails = log.details.filter(d => d.taskId.startsWith('TASK_CHECK_KLGD'));
      klgdDetails.forEach(d => {
        console.log(`    Subtask ID: ${d.taskId} | Name: ${d.taskNameSnapshot} | BotCheckType: ${d.botCheckTypeSnapshot}`);
      });
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

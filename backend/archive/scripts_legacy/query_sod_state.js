const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  console.log('Connected to DB');

  const db = mongoose.connection.db;

  // Let's find shift log tasks that contain the string "Đối chiếu SOD thất bại"
  const shiftLogs = await db.collection('shift_logs').find().toArray();
  console.log(`Found ${shiftLogs.length} total shift logs`);

  for (const log of shiftLogs) {
    for (const task of log.details) {
      const note = task.note || '';
      const resultNote = task.resultNote || '';
      if (note.includes('Đối chiếu SOD') || resultNote.includes('Đối chiếu SOD') || task.taskId.includes('sod') || task.taskNameSnapshot.includes('SOD')) {
        console.log(`ShiftLog: ${log._id}, Date: ${log.shiftDate}`);
        console.log(`  Task ID: ${task.taskId}`);
        console.log(`  Name: ${task.taskNameSnapshot}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Note: ${note}`);
        console.log(`  ResultNote: ${resultNote}`);
        console.log('  -------------------');
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

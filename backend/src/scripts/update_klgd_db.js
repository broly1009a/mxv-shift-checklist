const mongoose = require('mongoose');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Update in shift_templates
  const templates = await db.collection('shift_templates').find({}).toArray();
  let updatedTemplatesCount = 0;
  for (const template of templates) {
    let changed = false;
    const details = template.details.map(task => {
      if (task.taskId === 'TASK_CHECK_KLGD_s1' && task.botCheckType !== 'CHECK_PRE_EOD') {
        task.botCheckType = 'CHECK_PRE_EOD';
        changed = true;
      }
      return task;
    });

    if (changed) {
      await db.collection('shift_templates').updateOne(
        { _id: template._id },
        { $set: { details } }
      );
      updatedTemplatesCount++;
    }
  }
  console.log(`Updated ${updatedTemplatesCount} shift templates.`);

  // 2. Update in active shift logs (status !== 'COMPLETED')
  const shiftLogs = await db.collection('shift_logs').find({ status: { $ne: 'COMPLETED' } }).toArray();
  let updatedShiftLogsCount = 0;
  for (const log of shiftLogs) {
    let changed = false;
    const details = log.details.map(task => {
      if (task.taskId === 'TASK_CHECK_KLGD_s1' && task.botCheckTypeSnapshot !== 'CHECK_PRE_EOD') {
        task.botCheckTypeSnapshot = 'CHECK_PRE_EOD';
        changed = true;
      }
      return task;
    });

    if (changed) {
      await db.collection('shift_logs').updateOne(
        { _id: log._id },
        { $set: { details } }
      );
      updatedShiftLogsCount++;
    }
  }
  console.log(`Updated ${updatedShiftLogsCount} active shift logs.`);

  await mongoose.disconnect();
}

main().catch(console.error);

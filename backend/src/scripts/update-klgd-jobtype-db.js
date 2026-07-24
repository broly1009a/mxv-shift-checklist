const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  // 1. Update checklist_templates
  const templates = await db.collection('checklist_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const template of templates) {
    let modified = false;
    if (template.tasks) {
      template.tasks.forEach((task) => {
        if (task.taskId === 'TASK_CHECK_KLGD_s1' && task.botCheckType !== 'CHECK_KLGD') {
          task.botCheckType = 'CHECK_KLGD';
          modified = true;
        }
      });
    }
    if (modified) {
      await db.collection('checklist_templates').updateOne({ _id: template._id }, { $set: { tasks: template.tasks } });
      templatesUpdated++;
    }
  }
  console.log(`Updated botCheckType = 'CHECK_KLGD' in ${templatesUpdated} checklist_templates.`);

  // 2. Update active shift_logs details
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftsUpdated = 0;
  for (const shift of shifts) {
    let modified = false;
    if (shift.details) {
      shift.details.forEach((item) => {
        if (item.taskId === 'TASK_CHECK_KLGD_s1') {
          if (item.botCheckType !== 'CHECK_KLGD' || item.botCheckTypeSnapshot !== 'CHECK_KLGD') {
            item.botCheckType = 'CHECK_KLGD';
            item.botCheckTypeSnapshot = 'CHECK_KLGD';
            modified = true;
          }
        }
      });
    }
    if (modified) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      shiftsUpdated++;
    }
  }
  console.log(`Updated botCheckType/Snapshot = 'CHECK_KLGD' in ${shiftsUpdated} shift_logs.`);

  await client.close();
}

main().catch(console.error);

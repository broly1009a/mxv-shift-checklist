const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  // 1. Fix shift_templates
  const templates = await db.collection('shift_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    let modified = false;
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (task.taskId === 'ops_during_01_s1' || task.taskId === 'ops_during_01_s2' || task.taskId === 'ops_during_01_sb1') {
          task.parentTaskId = 'ops_during_01';
          task.parentTaskIdSnapshot = 'ops_during_01';
          modified = true;
        }
      });
    }
    if (modified) {
      await db.collection('shift_templates').updateOne({ _id: t._id }, { $set: { tasks: t.tasks } });
      templatesUpdated++;
    }
  }
  console.log(`Updated ${templatesUpdated} shift_templates.`);

  // 2. Fix shift_logs
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;
  for (const s of shifts) {
    let modified = false;
    if (s.details && Array.isArray(s.details)) {
      s.details.forEach(d => {
        if (d.taskId === 'ops_during_01_s1' || d.taskId === 'ops_during_01_s2' || d.taskId === 'ops_during_01_sb1') {
          d.parentTaskId = 'ops_during_01';
          d.parentTaskIdSnapshot = 'ops_during_01';
          modified = true;
        }
      });
    }
    if (modified) {
      await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { details: s.details } });
      shiftLogsUpdated++;
    }
  }
  console.log(`Updated ${shiftLogsUpdated} shift_log documents.`);

  await client.close();
  console.log('Done fixing parentTaskIdSnapshot in DB!');
}

main().catch(console.error);

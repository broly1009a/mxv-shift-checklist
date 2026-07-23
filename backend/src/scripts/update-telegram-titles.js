const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  // 1. Update shift_templates
  const templates = await db.collection('shift_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    let modified = false;
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (task.taskName && task.taskName.includes('Telegram')) {
          task.taskName = task.taskName.replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (task.actionDescription && task.actionDescription.includes('Telegram')) {
          task.actionDescription = task.actionDescription.replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (task.subtasks && Array.isArray(task.subtasks)) {
          task.subtasks.forEach(st => {
            if (st.name && st.name.includes('Telegram')) {
              st.name = st.name.replace(/Telegram/g, 'hệ thống');
              modified = true;
            }
            if (st.taskName && st.taskName.includes('Telegram')) {
              st.taskName = st.taskName.replace(/Telegram/g, 'hệ thống');
              modified = true;
            }
            if (st.actionDescription && st.actionDescription.includes('Telegram')) {
              st.actionDescription = st.actionDescription.replace(/Telegram/g, 'hệ thống');
              modified = true;
            }
          });
        }
      });
    }
    if (modified) {
      await db.collection('shift_templates').updateOne({ _id: t._id }, { $set: { tasks: t.tasks } });
      templatesUpdated++;
    }
  }
  console.log(`Updated ${templatesUpdated} templates in shift_templates.`);

  // 2. Update shift_logs details
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;
  for (const s of shifts) {
    let modified = false;
    if (s.details && Array.isArray(s.details)) {
      s.details.forEach(d => {
        if (d.taskNameSnapshot && d.taskNameSnapshot.includes('Telegram')) {
          d.taskNameSnapshot = d.taskNameSnapshot.replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (d.resultNote && d.resultNote.includes('Telegram')) {
          d.resultNote = d.resultNote.replace(/cảnh báo Telegram/g, 'cảnh báo hệ thống').replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (d.subtasks && Array.isArray(d.subtasks)) {
          d.subtasks.forEach(st => {
            if (st.name && st.name.includes('Telegram')) {
              st.name = st.name.replace(/Telegram/g, 'hệ thống');
              modified = true;
            }
            if (st.taskNameSnapshot && st.taskNameSnapshot.includes('Telegram')) {
              st.taskNameSnapshot = st.taskNameSnapshot.replace(/Telegram/g, 'hệ thống');
              modified = true;
            }
          });
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
  console.log('Done database update!');
}

main().catch(console.error);

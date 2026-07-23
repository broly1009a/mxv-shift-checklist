const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  const oldTitle = 'Bot so sánh M-System vs CQG và gửi kết quả Telegram';
  const newTitle = 'Bot so sánh M-System vs CQG và gửi kết quả báo cáo hệ thống';

  // 1. Update shift_templates
  const templates = await db.collection('shift_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    let modified = false;
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (task.subtasks && Array.isArray(task.subtasks)) {
          task.subtasks.forEach(st => {
            if (st.name === oldTitle || st.taskName === oldTitle || (st.name && st.name.includes('Telegram'))) {
              st.name = st.name.replace('Telegram', 'báo cáo hệ thống');
              if (st.taskName) st.taskName = st.taskName.replace('Telegram', 'báo cáo hệ thống');
              if (st.actionDescription) st.actionDescription = st.actionDescription.replace('Telegram', 'báo cáo hệ thống');
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
          d.taskNameSnapshot = d.taskNameSnapshot.replace('Telegram', 'báo cáo hệ thống');
          modified = true;
        }
        if (d.subtasks && Array.isArray(d.subtasks)) {
          d.subtasks.forEach(st => {
            if (st.name && st.name.includes('Telegram')) {
              st.name = st.name.replace('Telegram', 'báo cáo hệ thống');
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

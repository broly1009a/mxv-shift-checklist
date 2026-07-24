const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  const newSubtask = {
    taskId: 'ops_during_01_sb1',
    taskName: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
    priority: 'HIGH',
    sortOrder: 1,
    isBotCheck: true,
    botCheckType: 'CHECK_MARGIN_DECISION',
    parentTaskId: 'ops_during_01',
    sessionType: 'DURING',
    actionDescription: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
  };

  // 1. Update templates
  const templates = await db.collection('shift_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (task.taskId === 'ops_during_01') {
          if (!task.subtasks) task.subtasks = [];
          const exists = task.subtasks.some(st => st.taskId === 'ops_during_01_sb1');
          if (!exists) {
            task.subtasks.unshift({
              taskId: 'ops_during_01_sb1',
              name: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
              isBotCheck: true,
              botCheckType: 'CHECK_MARGIN_DECISION',
              priority: 'HIGH'
            });
          }
        }
      });
      await db.collection('shift_templates').updateOne({ _id: t._id }, { $set: { tasks: t.tasks } });
      templatesUpdated++;
    }
  }
  console.log(`Updated ${templatesUpdated} templates.`);

  // 2. Update active shift logs
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;
  for (const s of shifts) {
    let modified = false;
    if (s.details && Array.isArray(s.details)) {
      s.details.forEach(d => {
        if (d.taskId === 'ops_during_01') {
          if (!d.subtasks) d.subtasks = [];
          const exists = d.subtasks.some(st => st.taskId === 'ops_during_01_sb1');
          if (!exists) {
            d.subtasks.unshift({
              taskId: 'ops_during_01_sb1',
              taskNameSnapshot: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
              prioritySnapshot: 'HIGH',
              sortOrderSnapshot: 1,
              isChecked: false,
              checkedAt: null,
              status: 'PENDING',
              note: '',
              isBotCheckSnapshot: true,
              botCheckTypeSnapshot: 'CHECK_MARGIN_DECISION',
              resultNote: ''
            });
            modified = true;
          }
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
  console.log('Done database update for ops_during_01_sb1!');
}

main().catch(console.error);

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  // 1. Clean checklist_templates
  const templates = await db.collection('checklist_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    let modified = false;
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (task.taskName && task.taskName.includes('Telegram')) {
          task.taskName = task.taskName.replace(/gửi cảnh báo Telegram/g, 'gửi cảnh báo hệ thống')
                                       .replace(/gửi kết quả Telegram/g, 'gửi kết quả báo cáo hệ thống')
                                       .replace(/báo cáo Telegram/g, 'báo cáo hệ thống')
                                       .replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (task.actionDescription && task.actionDescription.includes('Telegram')) {
          task.actionDescription = task.actionDescription.replace(/gửi cảnh báo Telegram/g, 'gửi cảnh báo hệ thống')
                                                           .replace(/gửi kết quả Telegram/g, 'gửi kết quả báo cáo hệ thống')
                                                           .replace(/báo cáo Telegram/g, 'báo cáo hệ thống')
                                                           .replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
      });
    }
    if (modified) {
      await db.collection('checklist_templates').updateOne({ _id: t._id }, { $set: { tasks: t.tasks } });
      templatesUpdated++;
    }
  }
  console.log(`Updated ${templatesUpdated} checklist_templates in MongoDB.`);

  // 2. Clean shift_logs
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;
  for (const s of shifts) {
    let modified = false;
    if (s.details && Array.isArray(s.details)) {
      s.details.forEach(d => {
        if (d.taskNameSnapshot && d.taskNameSnapshot.includes('Telegram')) {
          d.taskNameSnapshot = d.taskNameSnapshot.replace(/gửi cảnh báo Telegram/g, 'gửi cảnh báo hệ thống')
                                                 .replace(/gửi kết quả Telegram/g, 'gửi kết quả báo cáo hệ thống')
                                                 .replace(/báo cáo Telegram/g, 'báo cáo hệ thống')
                                                 .replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (d.actionDescriptionSnapshot && d.actionDescriptionSnapshot.includes('Telegram')) {
          d.actionDescriptionSnapshot = d.actionDescriptionSnapshot.replace(/gửi cảnh báo Telegram/g, 'gửi cảnh báo hệ thống')
                                                                     .replace(/gửi kết quả Telegram/g, 'gửi kết quả báo cáo hệ thống')
                                                                     .replace(/báo cáo Telegram/g, 'báo cáo hệ thống')
                                                                     .replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
        if (d.resultNote && d.resultNote.includes('Telegram')) {
          d.resultNote = d.resultNote.replace(/cảnh báo Telegram/g, 'cảnh báo hệ thống')
                                     .replace(/Telegram/g, 'hệ thống');
          modified = true;
        }
      });
    }
    if (modified) {
      await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { details: s.details } });
      shiftLogsUpdated++;
    }
  }
  console.log(`Updated ${shiftLogsUpdated} shift_logs in MongoDB.`);

  await client.close();
  console.log('Successfully cleaned all Telegram references from MongoDB!');
}

main().catch(console.error);

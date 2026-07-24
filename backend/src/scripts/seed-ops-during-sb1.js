const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  const db = client.db('mxv_shift_checklist');

  // 1. Insert into shift_templates.tasks
  const templates = await db.collection('shift_templates').find({}).toArray();
  let templatesUpdated = 0;
  for (const t of templates) {
    if (t.tasks && Array.isArray(t.tasks)) {
      const parentIdx = t.tasks.findIndex(item => item.taskId === 'ops_during_01');
      if (parentIdx !== -1) {
        const exists = t.tasks.some(item => item.taskId === 'ops_during_01_sb1');
        if (!exists) {
          const newSubtaskItem = {
            taskId: 'ops_during_01_sb1',
            taskName: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
            priority: 'HIGH',
            sortOrder: parentIdx + 1,
            isBotCheck: true,
            botCheckType: 'CHECK_MARGIN_DECISION',
            botTriggerTime: '',
            botCheckTarget: '',
            botSuccessCondition: '',
            botFailureAction: '',
            parentTaskId: 'ops_during_01',
            dependsOnTaskIds: [],
            sessionType: 'DURING',
            triggerTime: null,
            slaDeadline: null,
            slaWindowStart: null,
            slaWindowEnd: null,
            slaType: 'FIXED_TIME',
            actionDescription: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
            exceptionCode: '',
            frequencyMinutes: null,
            recurrenceGroupId: '',
            functionUrl: '',
            urdReference: '',
            fileLocation: '',
            timetable: '',
            deadline: null
          };
          t.tasks.splice(parentIdx + 1, 0, newSubtaskItem);
          await db.collection('shift_templates').updateOne({ _id: t._id }, { $set: { tasks: t.tasks } });
          templatesUpdated++;
        }
      }
    }
  }
  console.log(`Updated ${templatesUpdated} shift_templates.`);

  // 2. Insert into shift_logs.details
  const shifts = await db.collection('shift_logs').find({}).toArray();
  let shiftLogsUpdated = 0;
  for (const s of shifts) {
    if (s.details && Array.isArray(s.details)) {
      const parentIdx = s.details.findIndex(item => item.taskId === 'ops_during_01');
      if (parentIdx !== -1) {
        const exists = s.details.some(item => item.taskId === 'ops_during_01_sb1');
        if (!exists) {
          const newDetailItem = {
            taskId: 'ops_during_01_sb1',
            taskNameSnapshot: 'Bot quét thư mục Quyết định thay đổi ký quỹ & báo cáo hệ thống',
            prioritySnapshot: 'HIGH',
            sortOrderSnapshot: parentIdx + 1,
            isChecked: false,
            checkedAt: null,
            status: 'PENDING',
            note: '',
            isBotCheckSnapshot: true,
            botCheckTypeSnapshot: 'CHECK_MARGIN_DECISION',
            resultNote: '',
            parentTaskId: 'ops_during_01'
          };
          s.details.splice(parentIdx + 1, 0, newDetailItem);
          await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { details: s.details } });
          shiftLogsUpdated++;
        }
      }
    }
  }
  console.log(`Updated ${shiftLogsUpdated} shift_log documents.`);

  await client.close();
  console.log('Successfully seeded ops_during_01_sb1 as subtask item!');
}

main().catch(console.error);

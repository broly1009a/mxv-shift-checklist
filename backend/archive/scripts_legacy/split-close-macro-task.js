/**
 * split-close-macro-task.js
 * Thay thế task cũ ops_close_01_s4 (RUN_MACRO gộp chung) trong template
 * "Checklist Đóng Cửa - Trading Operations" bằng 3 task con riêng biệt:
 *   - ops_close_01_s4_lot   (RUN_LOT_MACRO)
 *   - ops_close_01_s4_value (RUN_VALUE_MACRO)
 *   - ops_close_01_s4_ccp   (RUN_MACRO - Pilot Bạc Thỏi)
 * 
 * Chạy: node split-close-macro-task.js
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
const DB_NAME = 'mxv_shift_checklist';

// ID của template "Checklist Đóng Cửa - Trading Operations" (từ backup gốc)
const CLOSE_TEMPLATE_ID = '6a56f1165e8144acc73753b9';

// 3 task mới thay thế ops_close_01_s4
const NEW_TASKS = [
  {
    taskId: 'ops_close_01_s4_lot',
    taskName: 'Bot tự động tính toán thống kê số lốt giao dịch cuối ngày',
    priority: 'HIGH',
    sortOrder: 4,
    isBotCheck: true,
    botCheckType: 'RUN_LOT_MACRO',
    botTriggerTime: '',
    botCheckTarget: '',
    botSuccessCondition: '',
    botFailureAction: '',
    parentTaskId: 'ops_close_01',
    dependsOnTaskIds: [],
    sessionType: 'CLOSE',
    triggerTime: null,
    slaDeadline: null,
    slaWindowStart: null,
    slaWindowEnd: null,
    slaType: 'FIXED_TIME',
    actionDescription: 'Bot tự động tính toán thống kê số lốt giao dịch cuối ngày',
    exceptionCode: '',
    frequencyMinutes: null,
    recurrenceGroupId: '',
    functionUrl: '',
    urdReference: '',
    fileLocation: '',
    timetable: '',
    deadline: null,
  },
  {
    taskId: 'ops_close_01_s4_value',
    taskName: 'Bot tự động tính toán thống kê giá trị giao dịch cuối ngày',
    priority: 'HIGH',
    sortOrder: 5,
    isBotCheck: true,
    botCheckType: 'RUN_VALUE_MACRO',
    botTriggerTime: '',
    botCheckTarget: '',
    botSuccessCondition: '',
    botFailureAction: '',
    parentTaskId: 'ops_close_01',
    dependsOnTaskIds: [],
    sessionType: 'CLOSE',
    triggerTime: null,
    slaDeadline: null,
    slaWindowStart: null,
    slaWindowEnd: null,
    slaType: 'FIXED_TIME',
    actionDescription: 'Bot tự động tính toán thống kê giá trị giao dịch cuối ngày',
    exceptionCode: '',
    frequencyMinutes: null,
    recurrenceGroupId: '',
    functionUrl: '',
    urdReference: '',
    fileLocation: '',
    timetable: '',
    deadline: null,
  },
  {
    taskId: 'ops_close_01_s4_ccp',
    taskName: 'Bot tự động chạy báo cáo CCP Pilot Bạc Thỏi cuối ngày',
    priority: 'HIGH',
    sortOrder: 6,
    isBotCheck: true,
    botCheckType: 'RUN_MACRO',
    botTriggerTime: '',
    botCheckTarget: '',
    botSuccessCondition: '',
    botFailureAction: '',
    parentTaskId: 'ops_close_01',
    dependsOnTaskIds: [],
    sessionType: 'CLOSE',
    triggerTime: null,
    slaDeadline: null,
    slaWindowStart: null,
    slaWindowEnd: null,
    slaType: 'FIXED_TIME',
    actionDescription: 'Bot tự động chạy báo cáo CCP Pilot Bạc Thỏi cuối ngày',
    exceptionCode: '',
    frequencyMinutes: null,
    recurrenceGroupId: '',
    functionUrl: '',
    urdReference: '',
    fileLocation: '',
    timetable: '',
    deadline: null,
  },
];

async function run() {
  console.log('=== Split ops_close_01_s4 into 3 separate bot tasks ===');
  
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to MongoDB.');
  
  const db = client.db(DB_NAME);
  const col = db.collection('checklist_templates');

  // Tìm template
  const template = await col.findOne({ _id: new ObjectId(CLOSE_TEMPLATE_ID) });
  if (!template) {
    console.error(`ERROR: Template not found with ID ${CLOSE_TEMPLATE_ID}`);
    await client.close();
    process.exit(1);
  }
  console.log(`Found template: "${template.title}" — ${template.tasks?.length || 0} tasks`);

  // Hiển thị tasks hiện tại
  console.log('\nCurrent tasks:');
  (template.tasks || []).forEach(t => console.log(`  [${t.sortOrder}] ${t.taskId} - ${t.taskName}`));

  // Xóa task cũ ops_close_01_s4 và các task đã tách ra trước đó (nếu có)
  const OLD_TASK_IDS = ['ops_close_01_s4', 'ops_close_01_s4_lot', 'ops_close_01_s4_value', 'ops_close_01_s4_ccp'];
  let filteredTasks = (template.tasks || []).filter(t => !OLD_TASK_IDS.includes(t.taskId));

  // Tăng sortOrder các task sau vị trí 3 lên để nhường chỗ 3 task mới (sortOrder 4,5,6)
  filteredTasks = filteredTasks.map(t => {
    if (t.sortOrder >= 4) {
      return { ...t, sortOrder: t.sortOrder + 2 }; // +2 vì thêm 2 task nữa (cũ là 1, mới là 3)
    }
    return t;
  });

  // Ghép 3 task mới vào
  const updatedTasks = [...filteredTasks, ...NEW_TASKS].sort((a, b) => a.sortOrder - b.sortOrder);

  console.log('\nUpdated task list to be saved:');
  updatedTasks.forEach(t => console.log(`  [${t.sortOrder}] ${t.taskId} - ${t.taskName} (botCheckType: ${t.botCheckType || '-'})`));

  // Cập nhật vào MongoDB
  const result = await col.updateOne(
    { _id: new ObjectId(CLOSE_TEMPLATE_ID) },
    { $set: { tasks: updatedTasks, updatedAt: new Date() } }
  );

  console.log(`\nUpdate result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  await client.close();
  console.log('\n=== Done! Template updated successfully. ===');
  console.log('Restart backend server to reflect changes on the Admin Template page.');
}

run().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

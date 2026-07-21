const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function updateActiveShift() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({}).toArray();
  console.log(`Auditing ${shifts.length} shift logs...`);

  for (const activeShift of shifts) {
    const tasks = activeShift.tasks || [];
    const parentIdx = tasks.findIndex(t => t.taskId === 'TASK_CHECK_EOD');
    if (parentIdx === -1) continue;

    console.log(`Found TASK_CHECK_EOD in shift ${activeShift._id} (status: ${activeShift.status})`);
    
    const hasBotSub1 = tasks.some(t => t.taskId === 'TASK_CHECK_EOD_sb1');
    if (!hasBotSub1) {
      const parentTask = tasks[parentIdx];
      const newBotSub1 = {
        taskId: 'TASK_CHECK_EOD_sb1',
        taskName: 'Bot kiểm tra & xác minh email kết quả EOD M-System SUCCESS (m-system@mxv.vn)',
        parentTaskIdSnapshot: 'TASK_CHECK_EOD',
        isBotCheck: true,
        botCheckType: 'EMAIL_PARSE',
        priority: 'HIGH',
        status: 'PENDING',
        sortOrder: parentTask.sortOrder + 1,
        createdAt: new Date()
      };
      const newBotSub2 = {
        taskId: 'TASK_CHECK_EOD_sb2',
        taskName: 'Bot tự động chạy đối chiếu dữ liệu 3 bên (M-System vs CQG vs ACM)',
        parentTaskIdSnapshot: 'TASK_CHECK_EOD',
        isBotCheck: true,
        botCheckType: 'CHECK_PRE_EOD',
        priority: 'HIGH',
        status: 'PENDING',
        sortOrder: parentTask.sortOrder + 2,
        createdAt: new Date()
      };

      tasks.splice(parentIdx + 1, 0, newBotSub1, newBotSub2);

      await db.collection('shift_logs').updateOne(
        { _id: activeShift._id },
        { $set: { tasks: tasks } }
      );
      console.log(`✅ Inserted 2 Bot subtasks into shift ${activeShift._id}`);
    }
  }

  await client.close();
}

updateActiveShift().catch(console.error);

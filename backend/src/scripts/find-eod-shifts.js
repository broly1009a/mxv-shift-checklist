const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({ 'tasks.taskName': { $regex: 'EOD', $options: 'i' } }).toArray();
  console.log(`Found ${shifts.length} shifts matching EOD.`);

  for (const s of shifts) {
    console.log(`\nShift ID: ${s._id}, status: ${s.status}, date: ${s.shiftDate}`);
    const eodTasks = s.tasks.filter(t => t.taskName.includes('EOD') || t.parentTaskIdSnapshot === 'TASK_CHECK_EOD' || t.taskId.includes('EOD'));
    eodTasks.forEach(t => {
      console.log(`   Task: [${t.taskId}] "${t.taskName}" (isBotCheck=${t.isBotCheck}, parent=${t.parentTaskIdSnapshot || 'PARENT'})`);
    });

    // Add Bot subtasks if missing
    const parentIdx = s.tasks.findIndex(t => t.taskId === 'TASK_CHECK_EOD' || t.taskName.includes('Đối chiếu & Chạy EOD M-System'));
    if (parentIdx !== -1) {
      const parentTask = s.tasks[parentIdx];
      const hasBotSub1 = s.tasks.some(t => t.taskId === 'TASK_CHECK_EOD_sb1');
      if (!hasBotSub1) {
        console.log(`>>> Injecting 2 Bot subtasks into shift ${s._id}...`);
        const newBotSub1 = {
          taskId: 'TASK_CHECK_EOD_sb1',
          taskName: 'Bot kiểm tra & xác minh email kết quả EOD M-System SUCCESS (m-system@mxv.vn)',
          parentTaskIdSnapshot: parentTask.taskId,
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
          parentTaskIdSnapshot: parentTask.taskId,
          isBotCheck: true,
          botCheckType: 'CHECK_PRE_EOD',
          priority: 'HIGH',
          status: 'PENDING',
          sortOrder: parentTask.sortOrder + 2,
          createdAt: new Date()
        };
        s.tasks.splice(parentIdx + 1, 0, newBotSub1, newBotSub2);
        await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { tasks: s.tasks } });
        console.log(`✅ Updated shift ${s._id} successfully!`);
      }
    }
  }

  await client.close();
}

main().catch(console.error);

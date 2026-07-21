const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({ shiftDate: '2026-07-21' }).toArray();
  console.log(`Found ${shifts.length} shifts for today 2026-07-21.`);

  for (const s of shifts) {
    console.log(`\nInspecting shift ${s._id}... Tasks count: ${(s.tasks || []).length}`);
    const tasks = s.tasks || [];
    
    // Find parent task TASK_CHECK_EOD or taskName containing "Đối chiếu & Chạy EOD"
    const parentIdx = tasks.findIndex(t => t.taskId === 'TASK_CHECK_EOD' || (t.taskName && t.taskName.includes('Đối chiếu & Chạy EOD')));
    
    if (parentIdx !== -1) {
      const parentTask = tasks[parentIdx];
      console.log(`  Found Parent Task: [${parentTask.taskId}] "${parentTask.taskName}" at index ${parentIdx}`);
      
      const hasBotSub1 = tasks.some(t => t.taskId === 'TASK_CHECK_EOD_sb1');
      if (!hasBotSub1) {
        console.log(`  --> Injecting 2 Bot subtasks for TASK_CHECK_EOD into shift ${s._id}...`);
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

        tasks.splice(parentIdx + 1, 0, newBotSub1, newBotSub2);
        await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { tasks: tasks } });
        console.log(`  ✅ Successfully updated shift ${s._id}!`);
      } else {
        console.log(`  Bot subtasks already present in shift ${s._id}`);
      }
    } else {
      console.log(`  No EOD parent task found in shift ${s._id}`);
    }
  }

  await client.close();
}

main().catch(console.error);

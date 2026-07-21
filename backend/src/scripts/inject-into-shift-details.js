const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shifts = await db.collection('shift_logs').find({ shiftDate: '2026-07-21' }).toArray();
  console.log(`Found ${shifts.length} shifts for today 2026-07-21.`);

  for (const s of shifts) {
    const details = s.details || [];
    console.log(`\nShift ${s._id} (status: ${s.status}): details count = ${details.length}`);
    const parentIdx = details.findIndex(d => d.taskId === 'TASK_CHECK_EOD' || (d.taskNameSnapshot && d.taskNameSnapshot.includes('Đối chiếu & Chạy EOD')));
    
    if (parentIdx !== -1) {
      const parentTask = details[parentIdx];
      console.log(`  Found Parent Task in shift ${s._id}: [${parentTask.taskId}] "${parentTask.taskNameSnapshot}"`);
      
      const hasBotSub1 = details.some(d => d.taskId === 'TASK_CHECK_EOD_sb1');
      if (!hasBotSub1) {
        console.log(`  --> Injecting 2 Bot subtasks for TASK_CHECK_EOD into shift ${s._id}...`);
        const newBotSub1 = {
          taskId: 'TASK_CHECK_EOD_sb1',
          taskNameSnapshot: 'Bot kiểm tra & xác minh email kết quả EOD M-System SUCCESS (m-system@mxv.vn)',
          parentTaskIdSnapshot: parentTask.taskId,
          isBotCheckSnapshot: true,
          botCheckTypeSnapshot: 'EMAIL_PARSE',
          botTriggerTimeSnapshot: '06:00',
          botCheckTargetSnapshot: '{"subject": "EOD M-System SUCCESS", "sender": "m-system@mxv.vn"}',
          botSuccessConditionSnapshot: 'SUCCESS',
          botFailureActionSnapshot: 'ALERT_TELEGRAM',
          prioritySnapshot: 'HIGH',
          status: 'PENDING',
          createdAt: new Date()
        };
        const newBotSub2 = {
          taskId: 'TASK_CHECK_EOD_sb2',
          taskNameSnapshot: 'Bot tự động chạy đối chiếu dữ liệu 3 bên (M-System vs CQG vs ACM)',
          parentTaskIdSnapshot: parentTask.taskId,
          isBotCheckSnapshot: true,
          botCheckTypeSnapshot: 'CHECK_PRE_EOD',
          botTriggerTimeSnapshot: '06:00',
          botSuccessConditionSnapshot: 'SUCCESS',
          botFailureActionSnapshot: 'ALERT_TELEGRAM',
          prioritySnapshot: 'HIGH',
          status: 'PENDING',
          createdAt: new Date()
        };

        details.splice(parentIdx + 1, 0, newBotSub1, newBotSub2);
        await db.collection('shift_logs').updateOne({ _id: s._id }, { $set: { details: details } });
        console.log(`  ✅ Successfully updated shift ${s._id}!`);
      } else {
        console.log(`  Bot subtasks already present in shift ${s._id}`);
      }
    }
  }

  await client.close();
}

main().catch(console.error);

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    const tasks = shift.details.filter(t => t.resultNote && t.resultNote.includes('Phát hiện 181 tài khoản âm ký quỹ'));
    console.log(`Found ${tasks.length} tasks matching resultNote:`);
    tasks.forEach(t => {
      console.log(`- TaskId: ${t.taskId}, Name: ${t.taskName}, Status: ${t.status}`);
      t.status = 'COMPLETED';
    });

    if (tasks.length > 0) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      console.log('Successfully updated active shift tasks to COMPLETED.');
    }
  }

  await client.close();
}

main().catch(console.error);

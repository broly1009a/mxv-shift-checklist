const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    let updated = false;
    shift.details.forEach(task => {
      if (task.taskId === 'ops_open_04_s4' && task.resultNote && task.resultNote.includes('Phát hiện 181 tài khoản âm ký quỹ')) {
        task.status = 'COMPLETED';
        updated = true;
      }
    });

    if (updated) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      console.log('Updated ops_open_04_s4 task status to COMPLETED in active shift_log.');
    } else {
      console.log('Task ops_open_04_s4 was not updated (or not found).');
    }
  }

  await client.close();
}

main().catch(console.error);

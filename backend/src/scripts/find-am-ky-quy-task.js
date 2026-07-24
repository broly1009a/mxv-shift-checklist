const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    console.log(`Shift ID: ${shift._id}, Date: ${shift.shiftDate}`);
    let updated = false;
    shift.details.forEach(t => {
      const name = t.taskName || '';
      const note = t.resultNote || '';
      if (name.includes('âm ký quỹ') || note.includes('âm ký quỹ')) {
        console.log(`- TaskId: ${t.taskId}, Name: ${name}, Current Status: ${t.status}`);
        console.log(`  ResultNote: ${note}`);
        t.status = 'COMPLETED';
        updated = true;
      }
    });

    if (updated) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      console.log('Successfully updated task status to COMPLETED.');
    }
  }

  await client.close();
}

main().catch(console.error);

const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    let updated = false;
    shift.details.forEach(t => {
      if (t.resultNote && t.resultNote.includes('181')) {
        console.log(`FOUND TASK! TaskId: ${t.taskId}, Name: ${t.taskName}, Status: ${t.status}`);
        t.status = 'COMPLETED';
        updated = true;
      }
    });

    if (updated) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      console.log('Successfully updated task status to COMPLETED.');
    } else {
      console.log('No task matched resultNote with 181.');
    }
  }

  await client.close();
}

main().catch(console.error);

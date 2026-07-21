const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function inspect() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const shift = await db.collection('shift_logs').findOne({}, { sort: { createdAt: -1 } });
  
  if (shift) {
    console.log(`Latest Shift: ID=${shift._id}, status=${shift.status}, date=${shift.shiftDate}`);
    console.log('Tasks list:');
    (shift.tasks || []).forEach(t => {
      console.log(`  - [${t.taskId}] "${t.taskName}" (isBotCheck=${t.isBotCheck}, parent=${t.parentTaskIdSnapshot || 'NONE'})`);
    });
  } else {
    console.log('No shift found.');
  }
  await client.close();
}

inspect().catch(console.error);

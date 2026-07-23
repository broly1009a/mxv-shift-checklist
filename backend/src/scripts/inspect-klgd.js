const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const shift = await db.collection('shift_logs').findOne({}, { sort: { createdAt: -1 } });
  
  if (shift) {
    console.log(`Latest Shift: ID=${shift._id}, status=${shift.status}, date=${shift.shiftDate}`);
    const details = shift.details || [];
    details.forEach(d => {
      if (d.taskId.includes('KLGD') || d.taskId.includes('EOD') || d.taskNameSnapshot.includes('đối chiếu') || d.taskNameSnapshot.includes('Đối chiếu')) {
        console.log(`=========================================`);
        console.log(`Task ID: ${d.taskId}`);
        console.log(`Task Name: ${d.taskNameSnapshot}`);
        console.log(`Status: ${d.status}`);
        console.log(`Result Note Length: ${d.resultNote ? d.resultNote.length : 0}`);
        if (d.resultNote) {
          console.log(`Result Note Snippet:`, d.resultNote.substring(0, 300));
        }
      }
    });
  } else {
    console.log('No shift found.');
  }
  await client.close();
}

main().catch(console.error);

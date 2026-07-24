const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    const items = shift.details.filter(d => (d.parentTaskIdSnapshot === 'ops_during_01' || d.parentTaskId === 'ops_during_01'));
    console.log('Found child items of ops_during_01:', items.length);
    items.forEach(c => console.log(' - Child:', c.taskId, 'parentSnapshot:', c.parentTaskIdSnapshot, 'parent:', c.parentTaskId, 'name:', c.taskNameSnapshot));
  }

  await client.close();
}

main().catch(console.error);

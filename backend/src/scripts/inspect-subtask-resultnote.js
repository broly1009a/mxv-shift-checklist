const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ 'details.taskId': 'ops_open_02_s2' });
  if (shift) {
    const detail = shift.details.find(d => d.taskId === 'ops_open_02_s2');
    console.log('Task ops_open_02_s2 detail:');
    console.log('Status:', detail.status);
    console.log('Result Note:', detail.resultNote);
    console.log('Checked At:', detail.checkedAt);
  } else {
    console.log('No shift found with ops_open_02_s2.');
  }

  await client.close();
}

main().catch(console.error);

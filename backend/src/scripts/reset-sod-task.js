const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({}, { sort: { createdAt: -1 } });
  if (!shift) {
    console.error('No shift log found.');
    await client.close();
    return;
  }

  console.log(`Resetting TASK_CHECK_CQG_s1 to WAITING for Shift ${shift._id}...`);
  
  await db.collection('shift_logs').updateOne(
    { _id: shift._id, 'details.taskId': 'TASK_CHECK_CQG_s1' },
    {
      $set: {
        'details.$.status': 'WAITING',
        'details.$.note': 'Đang chờ bot chạy lại đối chiếu...',
        'details.$.resultNote': 'Đang chờ bot chạy lại đối chiếu...'
      }
    }
  );

  console.log('Successfully reset.');
  await client.close();
}

main().catch(console.error);

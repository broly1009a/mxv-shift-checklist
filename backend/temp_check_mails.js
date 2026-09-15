const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const rawSample = await db.collection('raw_account_mails').findOne({
    $or: [
      { subject: /0807375/i },
      { subject: /2311200/i },
      { subject: /TRƯƠNG/i },
      { body: /0807375/i },
      { 'attachments.name': /0807375/i }
    ]
  });

  console.log('raw_account_mails found:', rawSample ? {
    subject: rawSample.subject,
    receivedDateTime: rawSample.receivedDateTime,
    from: rawSample.from,
    attachments: (rawSample.attachments || []).map(a => a.name)
  } : 'none');

  // Let's count total raw_account_mails and check a few subjects
  const totalRaw = await db.collection('raw_account_mails').countDocuments();
  console.log('Total raw_account_mails:', totalRaw);
  const sampleSubjects = await db.collection('raw_account_mails').find({}, { projection: { subject: 1 } }).limit(5).toArray();
  console.log('Sample subjects:', sampleSubjects);

  // Check how many clean_account_records exist and what their maTVKD / maTKGD are
  const totalClean = await db.collection('clean_account_records').countDocuments();
  console.log('Total clean_account_records:', totalClean);
  const sampleClean = await db.collection('clean_account_records').find({}, { projection: { maTKGD: 1, maTKGDBase: 1, maTVKD: 1 } }).limit(5).toArray();
  console.log('Sample clean:', sampleClean);

  await client.close();
}
run().catch(console.error);

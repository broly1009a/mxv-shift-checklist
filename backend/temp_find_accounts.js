const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  // Search in clean_account_records for regex "0807375" or "TRUONG CAM TU" or "HOANG KIM CONG"
  const col = db.collection('clean_account_records');
  const sample = await col.findOne();
  console.log('Sample clean record fields:', sample ? Object.keys(sample) : 'none');
  if (sample) console.log('Sample maTKGD:', sample.maTKGD);

  const foundByNum = await col.find({
    $or: [
      { maTKGD: /0807375/i },
      { maTKGD: /2311200/i },
      { 'canCuoc.hoVaTen': /TRƯƠNG CẨM TÚ/i },
      { 'canCuoc.hoVaTen': /HOÀNG KIM CÔNG/i },
      { 'ms.hoVaTen': /TRƯƠNG CẨM TÚ/i },
      { 'noiDungMail.subject': /0807375/i }
    ]
  }).toArray();

  console.log('Found in clean_account_records:', foundByNum.length);
  for (const r of foundByNum) {
    console.log('-> maTKGD:', r.maTKGD, 'hoTen:', r.canCuoc?.hoVaTen || r.ms?.hoVaTen);
  }

  // Also search raw_mail_records or similar if exists
  for (const c of collections) {
    if (c.name.includes('mail') || c.name.includes('tkgd') || c.name.includes('raw')) {
      const cnt = await db.collection(c.name).countDocuments({
        $or: [
          { subject: /0807375/i },
          { body: /0807375/i },
          { subject: /TRƯƠNG CẨM TÚ/i },
          { text: /0807375/i }
        ]
      });
      if (cnt > 0) console.log(`Found ${cnt} in collection ${c.name}`);
    }
  }

  await client.close();
}
run().catch(console.error);

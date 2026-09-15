const mongoose = require('mongoose');

const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(uri);
  console.log('Connected to Atlas');
  
  const count = await mongoose.connection.db.collection('clean_account_records').countDocuments();
  console.log('Total records in clean_account_records on Atlas:', count);
  const all = await mongoose.connection.db.collection('clean_account_records').find({}, { projection: { maTKGD: 1, batchDate: 1 } }).limit(20).toArray();
  console.log('Sample records:', all);

  await mongoose.disconnect();
}

check().catch(console.error);

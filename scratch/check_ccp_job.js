const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function main() {
  await mongoose.connect('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  const db = mongoose.connection.db;
  
  // Find jobs created around 06:57 today
  const jobs = await db.collection('bot_jobs').find({
    createdAt: {
      $gte: new Date('2026-10-19T06:50:00Z'),
      $lte: new Date('2026-10-19T07:10:00Z')
    }
  }).toArray();
  
  console.log('Found jobs count:', jobs.length);
  jobs.forEach(j => {
    console.log('ID:', j._id.toString());
    console.log('jobType:', j.jobType);
    console.log('Payload:', JSON.stringify(j.payload, null, 2));
    console.log('Logs:', j.logs);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);

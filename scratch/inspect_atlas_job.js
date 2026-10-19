const pathMod = require('path');
const mongoose = require(pathMod.join(__dirname, '../backend/node_modules/mongoose'));
const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const recent = await db.collection('bot_jobs').find({}).sort({ _id: -1 }).limit(5).toArray();
  for (const j of recent) {
    console.log('--- JOB ID:', j._id.toString(), 'type:', j.jobType, 'status:', j.status, 'attempts:', j.attempts, '/', j.maxAttempts, 'created:', j.createdAt);
    console.log('Error:', j.error);
    console.log('Last 3 logs:', (j.logs || []).slice(-3));
  }
  await mongoose.disconnect();
}
main().catch(console.error);

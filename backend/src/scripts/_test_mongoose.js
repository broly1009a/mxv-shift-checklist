const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

// Define BotJob Schema
const BotJobSchema = new mongoose.Schema({
  jobType: String,
  status: String,
  payload: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true, collection: 'bot_jobs' });

const BotJob = mongoose.model('BotJob', BotJobSchema);

async function test() {
  await mongoose.connect(MONGO_URI);

  const job = await BotJob.findOne(
    { jobType: 'FILE_AUDIT_CQG', status: 'COMPLETED' },
    {},
    { sort: { createdAt: -1 } }
  );

  if (!job) {
    console.log('No completed job found.');
    await mongoose.connection.close();
    return;
  }

  console.log('Job ID:', job._id);
  console.log('Job status:', job.status);
  
  console.log('\n--- Test 1: Direct payload field ---');
  console.log('Type of job.payload:', typeof job.payload, job.payload.constructor.name);
  if (job.payload instanceof Map) {
    console.log('Map keys:', Array.from(job.payload.keys()));
    console.log('Using Map.get("result"):', job.payload.get('result'));
    console.log('result.isWaitingFiles:', job.payload.get('result')?.isWaitingFiles);
  }

  console.log('\n--- Test 2: job.toObject({ flattenMaps: true }) ---');
  const jobObj = job.toObject({ flattenMaps: true });
  console.log('Type of jobObj.payload:', typeof jobObj.payload, jobObj.payload.constructor.name);
  if (jobObj.payload instanceof Map) {
    console.log('toObject payload is still Map! keys:', Array.from(jobObj.payload.keys()));
    console.log('isWaitingFiles:', jobObj.payload.get('result')?.isWaitingFiles);
  } else {
    console.log('toObject payload is plain object! keys:', Object.keys(jobObj.payload));
    console.log('isWaitingFiles:', jobObj.payload.result?.isWaitingFiles);
  }

  await mongoose.connection.close();
}

test().catch(e => { console.error(e.message); process.exit(1); });

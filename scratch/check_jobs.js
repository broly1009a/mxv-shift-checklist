const mongoose = require('../backend/node_modules/mongoose');
(async () => {
  await mongoose.connect('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  const jobs = await mongoose.connection.collection('bot_jobs').find({
    jobType: { $in: ['CHECK_KLGD', 'CHECK_PRE_EOD', 'CHECK_EOD_CCP', 'DOWNLOAD_CCP_FILES'] }
  }).sort({ createdAt: -1 }).limit(10).toArray();
  for (const j of jobs) {
    console.log(j._id, j.jobType, j.status, j.createdAt, JSON.stringify(j.payload?.result?.totals || j.payload?.metrics || {}));
  }
  await mongoose.disconnect();
})();

const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const mongoose = require('mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;
      
      const targetDate = '2026-10-21';
      const slashDate = '21/10/2026';
      const dayStartVN = new Date(targetDate + 'T00:00:00.000+07:00');
      const dayEndVN = new Date(targetDate + 'T23:59:59.999+07:00');
      const dayStartUTC = new Date(targetDate + 'T00:00:00.000Z');
      const dayEndUTC = new Date(targetDate + 'T23:59:59.999Z');
      const minDate = new Date(Math.min(dayStartVN.getTime(), dayStartUTC.getTime()));
      const maxDate = new Date(Math.max(dayEndVN.getTime(), dayEndUTC.getTime()));

      const dateFilterCondition = {
        \\$or: [
          { createdAt: { \\$gte: minDate, \\$lte: maxDate } },
          { 'payload.targetDate': { \\$in: [targetDate, slashDate] } },
          { 'payload.sessionDay': { \\$in: [targetDate, slashDate] } },
          { 'payload.shiftDate': { \\$in: [targetDate, slashDate] } },
          { 'payload.date': { \\$in: [targetDate, slashDate] } },
        ],
      };

      const marginJob = await db.collection('bot_jobs').findOne({
        jobType: { \\$in: ['SCAN_NEGATIVE_MARGIN', 'CHECK_MARGIN_DECISION', 'CHECK_EOD_MS'] },
        ...dateFilterCondition
      }, { sort: { createdAt: -1 } });

      const eodJob = await db.collection('bot_jobs').findOne({
        jobType: { \\$in: ['CHECK_EOD_MS', 'CHECK_EOD_CCP'] },
        ...dateFilterCondition
      }, { sort: { createdAt: -1 } });

      const ccpCheckJob = await db.collection('bot_jobs').findOne({
        jobType: 'CHECK_EOD_CCP',
        ...dateFilterCondition
      }, { sort: { createdAt: -1 } });

      console.log('marginJob:', marginJob ? { id: marginJob._id, jobType: marginJob.jobType, createdAt: marginJob.createdAt } : null);
      console.log('eodJob:', eodJob ? { id: eodJob._id, jobType: eodJob.jobType, createdAt: eodJob.createdAt, payloadResult: eodJob.payload?.result } : null);
      console.log('ccpCheckJob:', ccpCheckJob ? { id: ccpCheckJob._id, jobType: ccpCheckJob.jobType, createdAt: ccpCheckJob.createdAt } : null);

      await mongoose.disconnect();
    }
    run().catch(console.error);
  "`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 10000
});

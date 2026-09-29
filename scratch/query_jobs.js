const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `mongosh mxv_shift_checklist --eval 'db.bot_jobs.find({ status: { $in: ["PENDING", "PROCESSING", "AWAITING_CAPTCHA"] } }, { jobType: 1, status: 1, attempts: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 }).toArray()'`;
  conn.exec(query, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

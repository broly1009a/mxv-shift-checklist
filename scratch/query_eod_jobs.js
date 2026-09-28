const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;

      // 1. Check m365 token
      const tokenSetting = await db.collection('system_settings').findOne({ key: 'm365_refresh_token' });
      console.log('m365_refresh_token in DB:', tokenSetting ? 'EXISTS (length: ' + tokenSetting.value?.length + ')' : 'NOT_FOUND');

      const pathMs = await db.collection('system_settings').findOne({ key: 'bot_backup_path_ms' });
      console.log('bot_backup_path_ms in DB:', pathMs ? pathMs.value : 'NOT_SET');

      // 2. Check recent jobs today
      const jobs = await db.collection('bot_jobs').find({}).sort({ createdAt: -1 }).limit(10).toArray();

      for (const j of jobs) {
        console.log('--- JOB:', j.type, j.status, j.createdAt, '---');
        console.log('Logs count:', j.logs?.length || 0);
        if (j.logs && j.logs.length > 0) {
          console.log('First log:', j.logs[0]);
          console.log('Last log:', j.logs[j.logs.length - 1]);
        }
      }
      await mongoose.disconnect();
    }
    run().catch(console.error);
  `;
  const b64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `cd /opt/mxv-checklist/backend && node -e "eval(Buffer.from('${b64}', 'base64').toString())"`;
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', () => {
      console.log('=== DB RESULT ===');
      console.log(output);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

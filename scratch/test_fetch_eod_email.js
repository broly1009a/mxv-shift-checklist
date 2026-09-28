const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');

    async function run() {
      const connChecklist = await mongoose.createConnection('mongodb://127.0.0.1:27017/mxv_shift_checklist').asPromise();
      const connTrading = await mongoose.createConnection('mongodb://127.0.0.1:27017/trading_mxv').asPromise();

      console.log('=== mxv_shift_checklist collections ===');
      const cols1 = await connChecklist.db.listCollections().toArray();
      console.log(cols1.map(c => c.name));

      console.log('=== trading_mxv collections ===');
      const cols2 = await connTrading.db.listCollections().toArray();
      console.log(cols2.map(c => c.name));

      const token1 = await connChecklist.db.collection('system_settings').findOne({ key: 'm365_refresh_token' });
      const token2 = await connTrading.db.collection('system_settings').findOne({ key: 'm365_refresh_token' });

      console.log('token in mxv_shift_checklist:', token1 ? token1.value.substring(0, 30) + '...' : 'NULL');
      console.log('token in trading_mxv:', token2 ? token2.value.substring(0, 30) + '...' : 'NULL');

      const shifts1 = await connChecklist.db.collection('shift_logs').countDocuments();
      const shifts2 = await connTrading.db.collection('shift_logs').countDocuments();
      console.log('shift_logs count: mxv_shift_checklist =', shifts1, '| trading_mxv =', shifts2);

      await connChecklist.close();
      await connTrading.close();
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

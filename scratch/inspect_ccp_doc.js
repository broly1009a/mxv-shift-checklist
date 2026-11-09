const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist')
  .then(async () => {
    const doc = await mongoose.connection.collection('system_settings').findOne({ key: 'bot_backup_path_ccp' });
    console.log('DOC:', doc);
    const all = await mongoose.connection.collection('system_settings').find({ key: /ccp/i }).toArray();
    console.log('ALL CCP KEYS:', all.map(x => ({ key: x.key, val: x.value })));
    process.exit(0);
  });
`;
    sftp.writeFile('/tmp/inspect_ccp_doc.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_ccp_doc.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

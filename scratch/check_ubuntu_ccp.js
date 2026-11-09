const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((sErr, sftp) => {
    if (sErr) throw sErr;
    const remoteScript = `
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist')
      .then(async () => {
        const s = await mongoose.connection.collection('system_settings').findOne({ key: 'bot_backup_path_ccp' });
        console.log('bot_backup_path_ccp in DB:', s ? s.value : 'KHONG CO');
        const sMs = await mongoose.connection.collection('system_settings').findOne({ key: 'bot_backup_path_ms' });
        console.log('bot_backup_path_ms in DB:', sMs ? sMs.value : 'KHONG CO');
        process.exit(0);
      })
      .catch(e => { console.error(e); process.exit(1); });
    `;
    sftp.writeFile('/tmp/check_db_paths.js', remoteScript, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_db_paths.js', (err, stream) => {
        if (err) throw err;
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

const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('mongoose');
    async function run() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;
      const all = await db.collection('system_settings').find({}).toArray();
      console.log('ALL SETTINGS in system_settings:');
      for (const item of all) {
        if (item.key.includes('cred') || item.key.includes('password')) {
          console.log(item.key, '= [HIDDEN]');
        } else {
          console.log(item.key, '=', item.value);
        }
      }
      await mongoose.disconnect();
    }
    run().catch(e => console.error(e));
  `;

  conn.exec(`cat << 'EOF' > /tmp/check_all_settings.js\n${remoteScript}\nEOF\nNODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_all_settings.js\nrm -f /tmp/check_all_settings.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

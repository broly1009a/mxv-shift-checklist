const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/trading_mxv')
  .then(async () => {
    const list = await mongoose.connection.collection('system_settings').find({}).toArray();
    console.log('DOCS IN trading_mxv.system_settings:');
    list.forEach(item => {
      console.log(' - ' + item.key + ' => ' + item.value);
    });
    process.exit(0);
  });
`;
    sftp.writeFile('/tmp/dump_trading_mxv.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/dump_trading_mxv.js', (cErr, stream) => {
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


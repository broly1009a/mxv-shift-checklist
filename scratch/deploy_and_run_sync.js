const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const localFile = path.resolve('scratch/remote_sync.js');
    const remoteFile = '/home/mxvadmin/remote_sync.js';
    sftp.fastPut(localFile, remoteFile, (putErr) => {
      if (putErr) throw putErr;
      console.log('Uploaded remote_sync.js. Executing...');
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /home/mxvadmin/remote_sync.js', (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log('Execution finished with code:', code);
          conn.end();
        });
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});


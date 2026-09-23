const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const localPy = path.resolve(__dirname, 'test_046_mrz.py');
    const remotePy = '/tmp/test_046_mrz.py';
    sftp.writeFile(remotePy, fs.readFileSync(localPy), (err) => {
      conn.exec('python3 /tmp/test_046_mrz.py', (err, stream) => {
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

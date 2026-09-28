const { Client } = require('../backend/node_modules/ssh2');
const fs = require('fs');
const path = require('path');

const scriptPath = process.argv[2] || path.join(__dirname, 'sync_templates_ms_to_ccp.py');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remotePath = '/tmp/remote_script.py';
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.write(scriptContent);
    writeStream.end();
    writeStream.on('close', () => {
      conn.exec('python3 /tmp/remote_script.py', (err2, stream) => {
        if (err2) throw err2;
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
        stream.on('close', (code) => {
          conn.exec('rm -f /tmp/remote_script.py', () => conn.end());
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

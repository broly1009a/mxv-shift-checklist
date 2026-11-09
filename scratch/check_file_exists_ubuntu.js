const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((sErr, sftp) => {
    if (sErr) throw sErr;
    const remoteScript = `
    const fs = require('fs');
    const path = require('path');
    const p = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/06.10/DSGD CCP.xlsx';
    console.log('Path:', p);
    console.log('Exists:', fs.existsSync(p));
    if (fs.existsSync(p)) {
      console.log('Size:', fs.statSync(p).size);
    }
    process.exit(0);
    `;
    sftp.writeFile('/tmp/check_file_exists.js', remoteScript, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_file_exists.js', (err, stream) => {
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


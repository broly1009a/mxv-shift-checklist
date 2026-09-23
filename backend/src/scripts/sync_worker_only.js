const { Client } = require('ssh2');
const path = require('path');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const local = path.resolve(__dirname, 'python/tkgd_extractor_worker.py');
    const remote = '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py';
    sftp.fastPut(local, remote, (e) => {
      if (e) throw e;
      console.log('SFTP UPLOAD SUCCESS: tkgd_extractor_worker.py');
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Check the last modified date of dist files to confirm new code is deployed
  const cmd = `ls -l /opt/mxv-checklist/backend/dist/modules/bot-engine/ccp-ce-downloader.service.js /opt/mxv-checklist/backend/dist/modules/bot-engine/bot-job-queue.service.js`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

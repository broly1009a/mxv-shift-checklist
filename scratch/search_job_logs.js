const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `grep -E 'Processing job|QUEUE|JOB_CANCEL|Attempt' /home/mxvadmin/.pm2/logs/mxv-backend-out.log | tail -n 40`;
  conn.exec(query, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

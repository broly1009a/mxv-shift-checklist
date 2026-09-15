const { Client } = require('ssh2');
const fs = require('fs');
const crypto = require('crypto');

const localContent = fs.readFileSync('src/modules/bot-engine/rpa-downloader.service.ts', 'utf8');
const localMd5 = crypto.createHash('md5').update(localContent).digest('hex');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('md5sum /opt/mxv-checklist/backend/src/modules/bot-engine/rpa-downloader.service.ts', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => {
      const remoteMd5 = d.toString().split(' ')[0].trim();
      console.log('Local MD5 :', localMd5);
      console.log('Remote MD5:', remoteMd5);
      console.log('Is identical?:', localMd5 === remoteMd5);
    });
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localDir = path.join(__dirname, '../../test_data_2109');
if (!fs.existsSync(localDir)) {
  fs.mkdirSync(localDir, { recursive: true });
}

const remoteDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/21.09';
const filesToFetch = ['DSGD.csv', 'TTM.csv', 'TTTT.csv', 'HH.csv', 'QLTTTVKD.csv'];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected. Opening SFTP...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    let completed = 0;
    filesToFetch.forEach((filename) => {
      const remotePath = `${remoteDir}/${filename}`;
      const localPath = path.join(localDir, filename);
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) {
          console.log(`Failed to fetch ${filename}:`, err.message);
        } else {
          const stat = fs.statSync(localPath);
          console.log(`Downloaded ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
        completed++;
        if (completed === filesToFetch.length) {
          conn.end();
        }
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

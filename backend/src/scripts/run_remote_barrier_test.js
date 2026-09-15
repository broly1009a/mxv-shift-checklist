const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localScriptPath = path.join(__dirname, 'test_4_chromes_barrier_live.js');
const remoteScriptPath = '/opt/mxv-checklist/backend/src/scripts/test_4_chromes_barrier_live.js';

const conn = new Client();

console.log('Đang kết nối SSH tới Ubuntu Server 10.0.0.26...');

conn.on('ready', () => {
  console.log('✅ Đã kết nối SSH thành công. Đang tải script test lên máy chủ qua SFTP...');
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('Lỗi SFTP:', err);
      conn.end();
      return;
    }

    const readStream = fs.createReadStream(localScriptPath);
    const writeStream = sftp.createWriteStream(remoteScriptPath);

    writeStream.on('close', () => {
      console.log('✅ Đã upload script lên server. Bắt đầu kích hoạt kiểm thử trực tiếp...');
      console.log('--------------------------------------------------------------------------------');

      const cmd = `cd /opt/mxv-checklist/backend && node src/scripts/test_4_chromes_barrier_live.js`;
      conn.exec(cmd, (execErr, stream) => {
        if (execErr) {
          console.error('Lỗi exec:', execErr);
          conn.end();
          return;
        }

        stream.on('data', (d) => {
          process.stdout.write(d.toString());
        });

        stream.stderr.on('data', (d) => {
          process.stderr.write(d.toString());
        });

        stream.on('close', (code) => {
          console.log('\n--------------------------------------------------------------------------------');
          console.log(`Kiểm thử hoàn tất với exit code: ${code}`);
          // Dọn dẹp script test trên server
          conn.exec(`rm -f ${remoteScriptPath}`, () => {
            conn.end();
          });
        });
      });
    });

    readStream.pipe(writeStream);
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

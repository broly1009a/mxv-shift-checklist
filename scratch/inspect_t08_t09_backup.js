const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    `curl -s "http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/9/export-excel" -o /tmp/Bao_cao_thang_09.2026.xlsx && curl -s "http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10/export-excel" -o /tmp/Bao_cao_thang_10.2026.xlsx && ls -lh /tmp/Bao_cao_thang_*.xlsx`,
    (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d));
      stream.on('close', () => {
        conn.sftp((sftpErr, sftp) => {
          if (sftpErr) throw sftpErr;
          sftp.fastGet(
            '/tmp/Bao_cao_thang_09.2026.xlsx',
            path.resolve('6thang11nam2026.TinhNangMoi/Bao cao thang 09.2026 - System.xlsx'),
            (e1) => {
              if (e1) console.error(e1);
              sftp.fastGet(
                '/tmp/Bao_cao_thang_10.2026.xlsx',
                path.resolve('6thang11nam2026.TinhNangMoi/Bao cao thang 10.2026 - System.xlsx'),
                (e2) => {
                  if (e2) console.error(e2);
                  console.log('Downloaded both Excel files successfully!');
                  conn.end();
                }
              );
            }
          );
        });
      });
    }
  );
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

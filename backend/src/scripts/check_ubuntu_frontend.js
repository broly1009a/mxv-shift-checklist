const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    'grep -n "trigger-download" /opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx -A 6',
    (err, stream) => {
      let out = '';
      stream.on('data', (d) => (out += d));
      stream.on('close', () => {
        console.log('=== UBUNTU FRONTEND TRIGGER-DOWNLOAD CODE ===');
        console.log(out);
        conn.exec(
          'grep -n "type=\\"date\\"" /opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx -A 5 -B 2',
          (err2, stream2) => {
            let out2 = '';
            stream2.on('data', (d) => (out2 += d));
            stream2.on('close', () => {
              console.log('=== UBUNTU FRONTEND DATE INPUT ===');
              console.log(out2);
              conn.end();
            });
          }
        );
      });
    }
  );
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

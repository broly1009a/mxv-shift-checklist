const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -rn "Ghi Vào Các File Lũy Kế Excel (Toàn Bộ Báo Cáo)" /opt/mxv-checklist/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

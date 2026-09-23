const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -B 5 -A 25 "BAO CAO: KẾT QUẢ EOD" ~/.pm2/logs/mxv-backend-out.log || grep -B 5 -A 25 "EOD" ~/.pm2/logs/mxv-backend-out.log | head -n 35', (err, stream) => {
    let data = '';
    stream.on('data', c => data += c);
    stream.on('close', () => {
      console.log('--- OUTPUT ---');
      console.log(data);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

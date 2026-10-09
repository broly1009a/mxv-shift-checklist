const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 show mxv-backend | grep -i "cwd"', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('Backend cwd:', out.trim());
      conn.exec('cd $(pm2 show mxv-backend | grep "exec cwd" | awk \'{print $4}\') && git log -n 3 --oneline', (err2, stream2) => {
        let out2 = '';
        stream2.on('data', d => out2 += d);
        stream2.on('close', () => {
          console.log('Git log on server:\n', out2);
          conn.end();
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

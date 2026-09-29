const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `grep -i "fetch-eod-email\\|eod\\|003C0531975" /home/mxvadmin/.pm2/logs/mxv-backend* | tail -n 80`;
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', () => {
      console.log('=== PM2 GREP LOGS ===');
      console.log(output);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

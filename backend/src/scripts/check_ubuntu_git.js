const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    'cd /opt/mxv-checklist && git status -s',
    (err, stream) => {
      let out = '';
      stream.on('data', (d) => (out += d));
      stream.on('close', () => {
        console.log('=== GIT STATUS ON UBUNTU BACKEND ===');
        console.log(out);
        conn.end();
      });
    }
  );
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

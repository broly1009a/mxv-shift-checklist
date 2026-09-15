const { Client } = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const remoteCmd = `find / -name "chrome" 2>/dev/null | grep -E "playwright|chromium"`;

  c.exec(remoteCmd, (err, s) => {
    s.on('data', d => process.stdout.write(d));
    s.stderr.on('data', d => process.stderr.write(d));
    s.on('close', () => c.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

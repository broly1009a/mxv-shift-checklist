const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("pm2 list && echo '--- NGINX ---' && cat /etc/nginx/sites-enabled/* 2>/dev/null | grep -E 'proxy_pass|root|listen' | head -n 30 && echo '--- GIT STATUS FRONTEND/BACKEND ---' && cd /opt/mxv-checklist && git status -s && git log -n 1 --oneline", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("pm2 jlist", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      try {
        const list = JSON.parse(out);
        for (const item of list) {
          console.log(`[PM2] id: ${item.pm_id}, name: ${item.name}, cwd: ${item.pm2_env.pm_cwd}, status: ${item.pm2_env.status}, script: ${item.pm2_env.pm_exec_path}`);
        }
      } catch (e) {
        console.log('Error parsing:', e.message);
      }
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

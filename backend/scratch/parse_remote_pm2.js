const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      try {
        const apps = JSON.parse(out);
        console.table(apps.map(a => ({
          name: a.name,
          pm_id: a.pm_id,
          status: a.pm2_env.status,
          memory_MB: Math.round(a.monit.memory / 1024 / 1024),
          node_args: a.pm2_env.node_args,
          max_memory_restart: a.pm2_env.max_memory_restart,
          exec_mode: a.pm2_env.exec_mode,
        })));
      } catch (e) {
        console.log('Error parsing:', e.message);
      }
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

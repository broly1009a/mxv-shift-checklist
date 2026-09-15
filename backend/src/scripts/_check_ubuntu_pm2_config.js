const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    cat /opt/mxv-checklist/ecosystem.config.js 2>/dev/null || echo "No ecosystem.config.js"
    pm2 jlist
  `;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.on('close', () => {
      try {
        const lines = out.split('\n');
        const jsonLine = lines.find(l => l.trim().startsWith('['));
        if (jsonLine) {
          const list = JSON.parse(jsonLine);
          list.forEach(p => {
            console.log({
              name: p.name,
              pm_id: p.pm_id,
              status: p.pm2_env?.status,
              restart_time: p.pm2_env?.restart_time,
              max_memory_restart: p.pm2_env?.max_memory_restart,
              pm_exec_path: p.pm2_env?.pm_exec_path,
            });
          });
        } else {
          console.log(out.slice(0, 500));
        }
      } catch (e) {
        console.log(out.slice(0, 500));
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

const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `printjson(db.system_settings.find({ key: { \\$in: ['bot_auto_recon_enabled', 'bot_auto_backup_enabled', 'bot_scheduler_config', 'bot_periodic_check_frequency'] } }).toArray())`;
  conn.exec(`mongosh mxv_shift_checklist --eval "${query}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.stderr.on('data', (d) => out += '[STDERR] ' + d.toString());
    stream.on('close', () => {
      console.log('ACTIVE AUTOMATION SETTINGS IN MONGODB:');
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

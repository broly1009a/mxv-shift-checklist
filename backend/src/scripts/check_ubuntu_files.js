const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mkdir -p /opt/mxv-checklist/backend/temp/check-klgd
    mkdir -p /opt/mxv-checklist/backend/temp/recon-results
    mkdir -p /opt/mxv-checklist/backend/temp/gtt
    echo "Done creating temp directories"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});

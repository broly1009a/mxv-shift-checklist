const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localSummary = path.join(__dirname, 'audit_summary_14.json');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    sftp.fastGet('/opt/mxv-checklist/backend/data/audit_14_accounts/summary.json', localSummary, (ge) => {
      if (ge) console.error('Get summary error:', ge);
      else {
        console.log('Summary saved to:', localSummary);
        const data = JSON.parse(fs.readFileSync(localSummary, 'utf8'));
        data.forEach(item => {
          console.log(`\n=== ${item.code} - ${item.name} ===`);
          console.log(`Messages: ${item.messages.length}`);
          console.log('Files:');
          item.downloadedFiles.forEach(f => {
            console.log(`  - ${f.name} (${f.contentType}, ${Math.round(f.size / 1024)} KB)`);
          });
        });
      }
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

const { Client } = require('ssh2');
const path = require('path');
const conn = new Client();
const fs = require('fs');
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const local = path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/TkgdRecordsTable.tsx');
    const remote = '/opt/mxv-checklist/frontend/src/features/tkgd/components/TkgdRecordsTable.tsx';
    const content = fs.readFileSync(local);
    console.log('Local file read, size:', content.length);
    sftp.writeFile(remote, content, (wErr) => {
      if (wErr) {
        console.error('Write error:', wErr);
        conn.end();
      } else {
        console.log('Written successfully! Verifying...');
        conn.exec('grep -n "Mail size" /opt/mxv-checklist/frontend/src/features/tkgd/components/TkgdRecordsTable.tsx', (e2, stream) => {
          let out = '';
          stream.on('data', (d) => out += d.toString());
          stream.on('close', () => {
            console.log('Remote grep result:', out);
            conn.end();
          });
        });
      }
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

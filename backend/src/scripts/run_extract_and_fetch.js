const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localPy = path.join(__dirname, 'extract_cccd_images.py');
const remotePy = '/opt/mxv-checklist/backend/extract_cccd_images.py';
const localDestDir = path.join(__dirname, 'extracted_cccd_local');

if (!fs.existsSync(localDestDir)) fs.mkdirSync(localDestDir, { recursive: true });

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu.');
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    sftp.fastPut(localPy, remotePy, (e) => {
      if (e) { console.error(e); conn.end(); return; }
      console.log('Uploaded extract script. Executing python3...');
      conn.exec(`python3 ${remotePy}`, (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', code => {
          console.log('\nExtract completed with code:', code);
          // Download all extracted images from each account
          const baseRemote = '/opt/mxv-checklist/backend/data/audit_14_accounts';
          sftp.readdir(baseRemote, (re, list) => {
            if (re) { console.error(re); conn.end(); return; }
            const dirs = list.filter(item => item.attrs.isDirectory() && !item.filename.startsWith('.'));
            let pending = dirs.length;
            if (pending === 0) { conn.end(); return; }

            dirs.forEach(d => {
              const accCode = d.filename;
              const accRemote = `${baseRemote}/${accCode}/extracted_cccd`;
              const accLocal = path.join(localDestDir, accCode);
              if (!fs.existsSync(accLocal)) fs.mkdirSync(accLocal, { recursive: true });

              sftp.readdir(accRemote, (re2, files) => {
                if (re2 || !files) {
                  if (--pending === 0) conn.end();
                  return;
                }
                let filePending = files.length;
                if (filePending === 0) {
                  if (--pending === 0) conn.end();
                  return;
                }
                files.forEach(f => {
                  const remFile = `${accRemote}/${f.filename}`;
                  const locFile = path.join(accLocal, f.filename);
                  sftp.fastGet(remFile, locFile, (ge) => {
                    if (!ge) console.log(`Downloaded: ${accCode}/${f.filename}`);
                    if (--filePending === 0) {
                      if (--pending === 0) {
                        console.log('All images downloaded successfully to:', localDestDir);
                        conn.end();
                      }
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

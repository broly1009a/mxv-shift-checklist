const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const fs = require('fs');
const path = require('path');

const filesToSync = [
  'backend/src/shared/helpers/crypto.ts',
  'backend/src/shared/domain-configs/external-systems.config.ts',
  'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
  'backend/src/modules/ingress/adapters/coreex-api.adapter.ts',
  'backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts',
];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established. Uploading modified files...');
  conn.sftp(async (err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    for (const relPath of filesToSync) {
      const localFile = path.join(__dirname, '..', relPath);
      const remoteFile = '/opt/mxv-checklist/' + relPath.replace(/\\/g, '/');
      const content = fs.readFileSync(localFile);

      await new Promise((resolve, reject) => {
        const stream = sftp.createWriteStream(remoteFile);
        stream.write(content);
        stream.end(() => {
          console.log(`Uploaded ${relPath} -> ${remoteFile}`);
          resolve();
        });
        stream.on('error', reject);
      });
    }

    console.log('All files uploaded. Building backend on Ubuntu...');
    const buildCmd = 'cd /opt/mxv-checklist/backend && npm run build && pm2 restart mxv-backend';
    conn.exec(buildCmd, (err2, stream2) => {
      if (err2) { console.error(err2); conn.end(); return; }
      stream2.on('data', d => process.stdout.write(d.toString()));
      stream2.stderr.on('data', d => process.stderr.write(d.toString()));
      stream2.on('close', (code) => {
        console.log(`Build & restart finished with exit code ${code}`);
        conn.end();
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

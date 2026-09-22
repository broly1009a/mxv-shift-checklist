const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const filesToUpload = [
  {
    local: path.resolve(__dirname, '../modules/bot-engine/bot-engine.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/bot-engine.service.ts',
  },
  {
    local: path.resolve(__dirname, '../modules/bot-engine/scheduler.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/scheduler.service.ts',
  },
  {
    local: path.resolve(__dirname, '../../../frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx',
  },
  {
    local: path.resolve(__dirname, '../../../frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
  },
  {
    local: path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts',
  },
  {
    local: path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.controller.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.controller.ts',
  },
];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established to Ubuntu 10.0.0.26');
  conn.sftp((err, sftp) => {
    if (err) throw err;

    let index = 0;
    function uploadNext() {
      if (index >= filesToUpload.length) {
        console.log('All files uploaded successfully via SFTP.');
        rebuildAndRestart();
        return;
      }
      const item = filesToUpload[index++];
      console.log(`Uploading ${path.basename(item.local)} -> ${item.remote}...`);
      sftp.fastPut(item.local, item.remote, (err2) => {
        if (err2) {
          console.error(`Upload error for ${item.local}:`, err2);
          conn.end();
          return;
        }
        uploadNext();
      });
    }

    uploadNext();
  });

  function rebuildAndRestart() {
    console.log('Building backend on Ubuntu...');
    const cmd = `
      cd /opt/mxv-checklist/backend && npm run build && pm2 reload mxv-backend &&
      cd /opt/mxv-checklist/frontend && npm run build && pm2 reload mxv-frontend
    `;
    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        console.log(`Remote build & restart finished with exit code: ${code}`);
        conn.end();
      });
    });
  }
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../../..');

const filesToUpload = [
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/src/modules/bot-engine/helpers/tkgd-python-bridge.helper.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-python-bridge.helper.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/modules/bot-engine/helpers/tkgd-doc-extractor.helper.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-doc-extractor.helper.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/modules/tkgd-automation/tkgd-automation.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-reconcile-exporter.helper.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/schemas/clean-account-record.schema.ts'),
    remote: '/opt/mxv-checklist/backend/src/schemas/clean-account-record.schema.ts',
  },
  {
    local: path.join(repoRoot, 'frontend/src/app/admin/tkgd-dashboard/page.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/admin/tkgd-dashboard/page.tsx',
  },
];

const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');

  // 1. Tạo thư mục từ xa
  conn.exec('mkdir -p /opt/mxv-checklist/backend/src/scripts/python /opt/mxv-checklist/backend/src/modules/bot-engine/helpers', (err, stream) => {
    stream.on('data', d => console.log(d.toString()));
    stream.on('close', () => {
      console.log('Remote directories ready.');

      // 2. Mở SFTP và upload tuần tự
      conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          console.error('SFTP Error:', sftpErr);
          conn.end();
          return;
        }

        let idx = 0;
        function uploadNext() {
          if (idx >= filesToUpload.length) {
            console.log('\nAll files uploaded successfully!');
            runBuildAndRestart();
            return;
          }
          const item = filesToUpload[idx++];
          console.log(`[${idx}/${filesToUpload.length}] Uploading: ${path.basename(item.local)} -> ${item.remote}`);
          sftp.fastPut(item.local, item.remote, (putErr) => {
            if (putErr) {
              console.error(`  ❌ Error uploading ${item.remote}:`, putErr.message);
            } else {
              console.log(`  ✅ Uploaded: ${item.remote}`);
            }
            uploadNext();
          });
        }
        uploadNext();
      });
    });
  });

  function runBuildAndRestart() {
    console.log('\nBuilding Backend & Frontend on Ubuntu...');
    const cmd = 'cd /opt/mxv-checklist/backend && npm run build && pm2 restart mxv-backend && cd /opt/mxv-checklist/frontend && npm run build && pm2 restart mxv-frontend';
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Exec error:', err);
        conn.end();
        return;
      }
      stream.on('data', d => process.stdout.write(d.toString()));
      stream.stderr.on('data', d => process.stderr.write(d.toString()));
      stream.on('close', code => {
        console.log(`\nBuild and restart completed with exit code: ${code}`);
        conn.end();
      });
    });
  }
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000,
});

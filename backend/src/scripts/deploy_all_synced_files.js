const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');

const singleFiles = [
  {
    local: path.join(rootDir, 'backend/src/modules/reconciliation/services/recon-console-summary.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/reconciliation/services/recon-console-summary.service.ts',
  },
  {
    local: path.join(rootDir, 'backend/src/modules/bot-engine/bot-engine.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/bot-engine.service.ts',
  },
  {
    local: path.join(rootDir, 'backend/src/modules/bot-engine/scheduler.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/scheduler.service.ts',
  },
  {
    local: path.join(rootDir, 'backend/src/modules/tkgd-automation/tkgd-automation.service.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts',
  },
  {
    local: path.join(rootDir, 'backend/src/modules/tkgd-automation/tkgd-automation.controller.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.controller.ts',
  },
  {
    local: path.join(rootDir, 'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx',
  },
  {
    local: path.join(rootDir, 'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
  },
  {
    local: path.join(rootDir, 'CHANGELOG_AI.md'),
    remote: '/opt/mxv-checklist/CHANGELOG_AI.md',
  },
];

// Thư mục inputExampleCppFull_2
const dirToUpload = path.join(rootDir, 'backend/src/modules/ccp-statistics/inputExampleCppFull_2');
const remoteDir = '/opt/mxv-checklist/backend/src/modules/ccp-statistics/inputExampleCppFull_2';

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

const input2Files = getFilesRecursively(dirToUpload).map((f) => ({
  local: f,
  remote: f.replace(dirToUpload, remoteDir).replace(/\\/g, '/'),
}));

const allFiles = [...singleFiles, ...input2Files];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established to Ubuntu 10.0.0.26');
  conn.sftp((err, sftp) => {
    if (err) throw err;

    function ensureRemoteDir(remotePath, cb) {
      const dir = path.posix.dirname(remotePath);
      conn.exec(`mkdir -p "${dir}"`, (err2, stream) => {
        if (err2) return cb(err2);
        stream.on('close', () => cb(null));
      });
    }

    let index = 0;
    function uploadNext() {
      if (index >= allFiles.length) {
        console.log(`\nAll ${allFiles.length} files uploaded successfully via SFTP.`);
        rebuildAndRestart();
        return;
      }
      const item = allFiles[index++];
      ensureRemoteDir(item.remote, (dirErr) => {
        if (dirErr) {
          console.error(`Error creating dir for ${item.remote}:`, dirErr);
          conn.end();
          return;
        }
        process.stdout.write(`[${index}/${allFiles.length}] Uploading ${path.basename(item.local)}... `);
        sftp.fastPut(item.local, item.remote, (err2) => {
          if (err2) {
            console.error(`FAILED:`, err2);
            conn.end();
            return;
          }
          console.log(`OK`);
          uploadNext();
        });
      });
    }

    uploadNext();
  });

  function rebuildAndRestart() {
    console.log('\n========================================================');
    console.log('BUILDING & RESTARTING PM2 SERVICES ON UBUNTU 10.0.0.26');
    console.log('========================================================\n');
    const cmd = `
      echo "=== BUILDING BACKEND ===" &&
      cd /opt/mxv-checklist/backend && npm run build && pm2 reload mxv-backend &&
      echo "=== BUILDING FRONTEND ===" &&
      cd /opt/mxv-checklist/frontend && npm run build && pm2 reload mxv-frontend &&
      echo "=== PM2 STATUS ===" &&
      pm2 status
    `;
    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        console.log(`\nDeployment finished with exit code: ${code}`);
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

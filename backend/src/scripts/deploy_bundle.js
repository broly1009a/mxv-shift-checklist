const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../../..');
const tempDeployDir = path.join(rootDir, 'temp_deploy');
const archivePath = path.join(rootDir, 'deploy_bundle.tar.gz');

console.log('=== BƯỚC 1: CHUẨN BỊ GÓI TRIỂN KHAI (DEPLOY BUNDLE) ===');

if (fs.existsSync(tempDeployDir)) {
  fs.rmSync(tempDeployDir, { recursive: true, force: true });
}
if (fs.existsSync(archivePath)) {
  fs.rmSync(archivePath, { force: true });
}

function copyFileWithDir(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(rootDir, src)}`);
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Files cần copy
const filesToDeploy = [
  'backend/src/modules/bot-engine/bot-engine.controller.ts',
  'backend/src/modules/bot-engine/bot-engine.service.ts',
  'backend/src/modules/bot-engine/scheduler.service.ts',
  'backend/src/modules/bot-engine/ccp-ce-downloader.service.ts',
  'backend/src/modules/bot-engine/handlers/ccp-ce-download.handler.ts',
  'backend/src/modules/bot-engine/handlers/rpa-download.handler.ts',
  'backend/src/modules/bot-engine/handlers/file-audit.handler.ts',
  'backend/src/modules/bot-engine/helpers/bot-path.helper.ts',
  'backend/src/modules/reconciliation/services/recon-console-summary.service.ts',
  'backend/src/modules/reconciliation/services/klgd-recon.service.ts',
  'backend/src/modules/reconciliation/services/pre-eod-recon.service.ts',
  'backend/src/modules/reconciliation/parsers/ccp-excel.parser.ts',
  'backend/src/modules/system-settings/system-settings.service.ts',
  'backend/src/schemas/ccp-lot-run-history.schema.ts',
  'backend/src/modules/tkgd-automation/tkgd-automation.service.ts',
  'backend/src/modules/tkgd-automation/tkgd-automation.controller.ts',
  'frontend/src/app/trading-manager/page.tsx',
  'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx',
  'backend/src/modules/reconciliation/helpers/recon-number-parser.helper.ts',
  'backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts',
  'frontend/src/app/trading-manager/utils/reconLogParser.ts',
  'frontend/src/app/trading-manager/components/legacy-ms-cqg/ReconLogSummaryModal.tsx',
  'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
  'frontend/src/app/trading-manager/components/core-ccp/CoreCcpBackupSection.tsx',
  'frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx',
  'frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx',
  'CHANGELOG_AI.md',
  'docs/BAN_THIET_KE_MASTER_SWITCH_TAT_BAT_TU_DONG_TRADING_MANAGER.md',
];

for (const rel of filesToDeploy) {
  copyFileWithDir(path.join(rootDir, rel), path.join(tempDeployDir, rel));
}

// 1.1 Toàn bộ thư mục frontend job-queue
const srcJobQueue = path.join(rootDir, 'frontend/src/app/trading-manager/components/job-queue');
if (fs.existsSync(srcJobQueue)) {
  const destJobQueue = path.join(tempDeployDir, 'frontend/src/app/trading-manager/components/job-queue');
  copyDirRecursive(srcJobQueue, destJobQueue);
  console.log('Copied full frontend job-queue folder.');
}

// 2. Toàn bộ thư mục ccp-statistics (bao gồm cả inputExampleCppFull_2 và review_output)
const srcCcpStats = path.join(rootDir, 'backend/src/modules/ccp-statistics');
const destCcpStats = path.join(tempDeployDir, 'backend/src/modules/ccp-statistics');
copyDirRecursive(srcCcpStats, destCcpStats);
console.log('Copied full backend/src/modules/ccp-statistics folder.');

// 2.1 Toàn bộ thư mục frontend/src/features/tkgd (đồng bộ chuẩn types & components)
const srcTkgd = path.join(rootDir, 'frontend/src/features/tkgd');
const destTkgd = path.join(tempDeployDir, 'frontend/src/features/tkgd');
copyDirRecursive(srcTkgd, destTkgd);
console.log('Copied full frontend/src/features/tkgd folder.');

// 2.2 Toàn bộ thư mục backend/scripts
const srcBackendScripts = path.join(rootDir, 'backend/scripts');
if (fs.existsSync(srcBackendScripts)) {
  const destBackendScripts = path.join(tempDeployDir, 'backend/scripts');
  copyDirRecursive(srcBackendScripts, destBackendScripts);
  console.log('Copied full backend/scripts folder.');
}

// 3. Nén file tar.gz
console.log('\n=== BƯỚC 2: NÉN FILE TAR.GZ ===');
execSync(`tar -czf "${archivePath}" -C "${tempDeployDir}" .`);
console.log(`Created archive: ${archivePath} (${fs.statSync(archivePath).size} bytes)`);

// 4. Upload qua SFTP và giải nén trên Ubuntu
console.log('\n=== BƯỚC 3: KẾT NỐI SSH VÀ UPLOAD LÊN UBUNTU 10.0.0.26 ===');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established to Ubuntu 10.0.0.26');
  conn.sftp((err, sftp) => {
    if (err) throw err;

    console.log('Uploading deploy_bundle.tar.gz -> /tmp/deploy_bundle.tar.gz...');
    sftp.fastPut(archivePath, '/tmp/deploy_bundle.tar.gz', (err2) => {
      if (err2) {
        console.error('Upload failed:', err2);
        conn.end();
        return;
      }
      console.log('Upload OK! Extracting and deploying on Ubuntu...');

      const cmd = `
        echo "=== 1. EXTRACTING BUNDLE ===" &&
        tar -xzf /tmp/deploy_bundle.tar.gz -C /opt/mxv-checklist/ &&
        rm -f /tmp/deploy_bundle.tar.gz &&
        rm -f /opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts &&

        echo "=== 2. BUILDING BACKEND ===" &&
        cd /opt/mxv-checklist/backend && npm run build &&
        pm2 reload mxv-backend &&

        echo "=== 3. BUILDING FRONTEND ===" &&
        cd /opt/mxv-checklist/frontend && npm run build &&
        pm2 reload mxv-frontend &&

        echo "=== 4. PM2 STATUS ===" &&
        pm2 status
      `;

      conn.exec(cmd, (err3, stream) => {
        if (err3) throw err3;
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
        stream.on('close', (code) => {
          console.log(`\nDeployment finished with exit code: ${code}`);
          // Dọn dẹp file nén local
          try {
            fs.rmSync(tempDeployDir, { recursive: true, force: true });
            fs.rmSync(archivePath, { force: true });
          } catch (e) {}
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

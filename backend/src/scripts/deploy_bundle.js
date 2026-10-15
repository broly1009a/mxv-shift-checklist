let Client;
try {
  Client = require('ssh2').Client;
} catch {
  Client = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2').Client;
}
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
  if (!fs.existsSync(src)) {
    console.warn(`Skip non-existent file: ${path.relative(rootDir, src)}`);
    return;
  }
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(rootDir, src)}`);
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir);
  for (const name of entries) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    try {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (err) {
      console.warn(`Skip error on ${srcPath}:`, err.message);
    }
  }
}

// 1. Files cần copy
const filesToDeploy = [
  'backend/src/app.module.ts',
  'backend/tsconfig.json',
  'backend/tsconfig.build.json',
  'backend/src/database/database.module.ts',
  'backend/src/database/seed.service.ts',
  'backend/sso-auto-assign.config.json',
  'backend/src/modules/auth/auth.service.ts',
  'backend/src/modules/system-settings/system-settings.service.ts',
  'backend/src/schemas/ccp-lot-run-history.schema.ts',
  'frontend/src/app/trading-manager/page.tsx',
  'frontend/src/app/admin/tkgd-dashboard/page.tsx',
  'frontend/src/app/admin/tkgd-config/page.tsx',
  'CHANGELOG_AI.md',
];

for (const rel of filesToDeploy) {
  copyFileWithDir(path.join(rootDir, rel), path.join(tempDeployDir, rel));
}

// 1. Đồng bộ toàn bộ các module Backend V1 & Modular V2
const backendDirs = [
  'backend/src/modules/bot-engine',
  'backend/src/modules/reconciliation',
  'backend/src/modules/ccp-statistics',
  'backend/src/modules/lot-statistics',
  'backend/src/modules/ingress',
  'backend/src/modules/trading-ops',
  'backend/src/modules/checklist-hub',
  'backend/src/shared',
  'backend/src/legacy',
];

backendDirs.forEach((dirRel) => {
  const src = path.join(rootDir, dirRel);
  if (fs.existsSync(src)) {
    const dest = path.join(tempDeployDir, dirRel);
    copyDirRecursive(src, dest);
    console.log(`Copied full ${dirRel} folder.`);
  }
});

// 2. Đồng bộ toàn bộ các thư mục Frontend mới & Legacy
const frontendDirs = [
  'frontend/src/app/trading-manager',
  'frontend/src/app/trading-manager-v2',
  'frontend/src/features/trading',
  'frontend/src/legacy',
];

frontendDirs.forEach((dirRel) => {
  const src = path.join(rootDir, dirRel);
  if (fs.existsSync(src)) {
    const dest = path.join(tempDeployDir, dirRel);
    copyDirRecursive(src, dest);
    console.log(`Copied full ${dirRel} folder.`);
  }
});

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
        rm -rf /opt/mxv-checklist/backend/src/modules/tkgd-automation /opt/mxv-checklist/frontend/src/features/tkgd /opt/mxv-checklist/frontend/src/components/tkgd &&
        rm -f /opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts &&
        rm -f /opt/mxv-checklist/backend/src/modules/reconciliation/reconciliation.service.backup.ts &&

        echo "=== 2. BUILDING BACKEND ===" &&
        cd /opt/mxv-checklist/backend && rm -f tsconfig*.tsbuildinfo && rm -rf dist && npm run build &&
        pm2 restart mxv-backend &&

        echo "=== 3. BUILDING FRONTEND ===" &&
        cd /opt/mxv-checklist/frontend && npm run build &&
        pm2 restart mxv-frontend &&

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

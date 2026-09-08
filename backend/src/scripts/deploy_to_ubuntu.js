const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../../..');

// Quét đệ quy tất cả file trong thư mục
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const baseFiles = [
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/dist/scripts/python/tkgd_extractor_worker.py',
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
    local: path.join(repoRoot, 'backend/src/modules/tkgd-automation/tkgd-automation.controller.ts'),
    remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.controller.ts',
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
  {
    local: path.join(repoRoot, 'frontend/src/tutorials/tkgdTutorial.ts'),
    remote: '/opt/mxv-checklist/frontend/src/tutorials/tkgdTutorial.ts',
  },
  {
    local: path.join(repoRoot, 'frontend/src/context/TutorialContext.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/context/TutorialContext.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/GlobalLayout.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/GlobalLayout.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/ui/TutorialOverlay.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/ui/TutorialOverlay.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/tkgd/TkgdConfigPanel.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/tkgd/TkgdConfigPanel.tsx',
  },
];

// Thêm toàn bộ các file trong thư mục module frontend/src/features/tkgd
const tkgdFeaturesDir = path.join(repoRoot, 'frontend/src/features/tkgd');
const tkgdFeatureFiles = getAllFiles(tkgdFeaturesDir).map((fullPath) => {
  const relPath = path.relative(path.join(repoRoot, 'frontend'), fullPath).replace(/\\/g, '/');
  return {
    local: fullPath,
    remote: `/opt/mxv-checklist/frontend/${relPath}`,
  };
});

const filesToUpload = [...baseFiles, ...tkgdFeatureFiles];

const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');

  // 1. Tạo tất cả thư mục cha từ xa
  const remoteDirs = Array.from(
    new Set(filesToUpload.map((item) => path.dirname(item.remote).replace(/\\/g, '/')))
  );

  const mkdirCmd = `mkdir -p ${remoteDirs.join(' ')}`;
  conn.exec(mkdirCmd, (err, stream) => {
    if (err) {
      console.error('Mkdir error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => console.log(d.toString()));
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
    const cmd =
      'cd /opt/mxv-checklist/backend && npm run build && pm2 restart mxv-backend && cd /opt/mxv-checklist/frontend && npm run build && pm2 restart mxv-frontend';
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Exec error:', err);
        conn.end();
        return;
      }
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (code) => {
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

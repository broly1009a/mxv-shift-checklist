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

// Danh sách các thư mục cần đồng bộ toàn bộ từ local sang Ubuntu
const syncDirs = [
  {
    localDir: path.join(repoRoot, 'backend/src/modules/shifts'),
    remoteDir: '/opt/mxv-checklist/backend/src/modules/shifts',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/modules/tkgd-automation'),
    remoteDir: '/opt/mxv-checklist/backend/src/modules/tkgd-automation',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/modules/bot-engine'),
    remoteDir: '/opt/mxv-checklist/backend/src/modules/bot-engine',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/modules/auth'),
    remoteDir: '/opt/mxv-checklist/backend/src/modules/auth',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/modules/lot-statistics'),
    remoteDir: '/opt/mxv-checklist/backend/src/modules/lot-statistics',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/schemas'),
    remoteDir: '/opt/mxv-checklist/backend/src/schemas',
  },
  {
    localDir: path.join(repoRoot, 'frontend/src/features/tkgd'),
    remoteDir: '/opt/mxv-checklist/frontend/src/features/tkgd',
  },
  {
    localDir: path.join(repoRoot, 'frontend/src/components/tkgd'),
    remoteDir: '/opt/mxv-checklist/frontend/src/components/tkgd',
  },
  {
    localDir: path.join(repoRoot, 'frontend/src/tutorials'),
    remoteDir: '/opt/mxv-checklist/frontend/src/tutorials',
  },
  {
    localDir: path.join(repoRoot, 'backend/src/scripts/python'),
    remoteDir: '/opt/mxv-checklist/backend/src/scripts/python',
  },
  {
    localDir: path.join(repoRoot, 'backend/test'),
    remoteDir: '/opt/mxv-checklist/backend/test',
  },
];

let filesToUpload = [];

// 1. Quét thư mục
syncDirs.forEach(({ localDir, remoteDir }) => {
  const files = getAllFiles(localDir);
  files.forEach((file) => {
    const rel = path.relative(localDir, file).replace(/\\/g, '/');
    filesToUpload.push({
      local: file,
      remote: `${remoteDir}/${rel}`,
    });
  });
});

// 2. Các file đơn lẻ quan trọng
const specificFiles = [
  {
    local: path.join(repoRoot, 'backend/package.json'),
    remote: '/opt/mxv-checklist/backend/package.json',
  },
  {
    local: path.join(repoRoot, 'backend/src/app.module.ts'),
    remote: '/opt/mxv-checklist/backend/src/app.module.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/interceptors/activity-log.interceptor.ts'),
    remote: '/opt/mxv-checklist/backend/src/interceptors/activity-log.interceptor.ts',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/dist/scripts/python/tkgd_extractor_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/assets/templates/Auto Data mail.xlsm'),
    remote: '/opt/mxv-checklist/backend/assets/templates/Auto Data mail.xlsm',
  },
  {
    local: path.join(repoRoot, 'frontend/src/app/admin/tkgd-dashboard/page.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/admin/tkgd-dashboard/page.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/app/admin/tkgd-config/page.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/app/admin/tkgd-config/page.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/GlobalLayout.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/GlobalLayout.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/Sidebar.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/Sidebar.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/components/ui/TutorialOverlay.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/components/ui/TutorialOverlay.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/context/TutorialContext.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/context/TutorialContext.tsx',
  },
  {
    local: path.join(repoRoot, 'frontend/src/context/AuthContext.tsx'),
    remote: '/opt/mxv-checklist/frontend/src/context/AuthContext.tsx',
  },
];

specificFiles.forEach((item) => {
  if (fs.existsSync(item.local)) {
    filesToUpload.push(item);
  }
});

// Loại bỏ trùng lặp remote path
const seen = new Set();
filesToUpload = filesToUpload.filter((item) => {
  if (seen.has(item.remote)) return false;
  seen.add(item.remote);
  return true;
});

console.log(`Tong so file can dong bo: ${filesToUpload.length}`);

const conn = new Client();

conn.on('ready', () => {
  console.log('Da ket noi SSH toi Ubuntu 10.0.0.26');

  // 1. Tạo tất cả thư mục cha từ xa
  const remoteDirs = Array.from(
    new Set(filesToUpload.map((item) => path.dirname(item.remote).replace(/\\/g, '/')))
  );

  const mkdirCmd = `mkdir -p ${remoteDirs.join(' ')}`;
  conn.exec(mkdirCmd, (err, stream) => {
    if (err) {
      console.error('Loi mkdir:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.on('close', () => {
      console.log('Cac thu muc tren Ubuntu da san sang.');

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
            console.log('\n=== TAT CA FILE DA DUOC DONG BO LEN UBUNTU THANH CONG! ===');
            runBuildAndRestart();
            return;
          }
          const item = filesToUpload[idx++];
          sftp.fastPut(item.local, item.remote, (putErr) => {
            if (putErr) {
              console.error(`  ❌ Loi upload ${item.remote}:`, putErr.message);
            } else {
              console.log(`  [${idx}/${filesToUpload.length}] ✅ Uploaded: ${path.basename(item.local)} -> ${item.remote}`);
            }
            uploadNext();
          });
        }
        uploadNext();
      });
    });
  });

  function runBuildAndRestart() {
    console.log('\n=== DANG BUILD BACKEND VA FRONTEND TREN UBUNTU ===');
    // Build backend, restart backend, build frontend, restart frontend
    const cmd = `
      echo "=== 1. BUILD BACKEND ==="
      cd /opt/mxv-checklist/backend && npm run build
      echo "=== 2. RESTART BACKEND PM2 ==="
      pm2 restart mxv-backend
      echo "=== 3. BUILD FRONTEND ==="
      cd /opt/mxv-checklist/frontend && npm run build
      echo "=== 4. RESTART FRONTEND PM2 ==="
      pm2 restart mxv-frontend
      echo "=== 5. PM2 LIST ==="
      pm2 list
    `;
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Exec error:', err);
        conn.end();
        return;
      }
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (code) => {
        console.log(`\n=== HOAN TAT BUILD VA RESTART VOI EXIT CODE: ${code} ===`);
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

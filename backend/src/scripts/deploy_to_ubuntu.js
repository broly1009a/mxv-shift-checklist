const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../../..');

// Quét đệ quy tất cả file trong thư mục (bỏ qua cache, build, env)
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    if (
      file === 'node_modules' ||
      file === '.git' ||
      file === '.next' ||
      file === 'dist' ||
      file.startsWith('.env') ||
      file.endsWith('.tsbuildinfo') ||
      file === '.DS_Store' ||
      file === 'Thumbs.db'
    ) {
      return;
    }
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
    localDir: path.join(repoRoot, 'backend/src'),
    remoteDir: '/opt/mxv-checklist/backend/src',
  },
  {
    localDir: path.join(repoRoot, 'backend/assets'),
    remoteDir: '/opt/mxv-checklist/backend/assets',
  },
  {
    localDir: path.join(repoRoot, 'frontend/src'),
    remoteDir: '/opt/mxv-checklist/frontend/src',
  },
  {
    localDir: path.join(repoRoot, 'frontend/legacy'),
    remoteDir: '/opt/mxv-checklist/frontend/legacy',
  },
  {
    localDir: path.join(repoRoot, 'frontend/public'),
    remoteDir: '/opt/mxv-checklist/frontend/public',
  },
  {
    localDir: path.join(repoRoot, 'docs'),
    remoteDir: '/opt/mxv-checklist/docs',
  },
];

let filesToUpload = [];

// 1. Quét thư mục với bộ lọc an toàn (không ghi đè .env, bỏ qua cache/build)
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
    local: path.join(repoRoot, 'frontend/package.json'),
    remote: '/opt/mxv-checklist/frontend/package.json',
  },
  {
    local: path.join(repoRoot, 'CHANGELOG_AI.md'),
    remote: '/opt/mxv-checklist/CHANGELOG_AI.md',
  },
  {
    local: path.join(repoRoot, 'frontend/next.config.ts'),
    remote: '/opt/mxv-checklist/frontend/next.config.ts',
  },
  {
    local: path.join(repoRoot, 'frontend/tsconfig.json'),
    remote: '/opt/mxv-checklist/frontend/tsconfig.json',
  },
  {
    local: path.join(repoRoot, 'backend/tsconfig.json'),
    remote: '/opt/mxv-checklist/backend/tsconfig.json',
  },
  {
    local: path.join(repoRoot, 'backend/tsconfig.build.json'),
    remote: '/opt/mxv-checklist/backend/tsconfig.build.json',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/tkgd_extractor_worker.py'),
    remote: '/opt/mxv-checklist/backend/dist/scripts/python/tkgd_extractor_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/recon_data_worker.py'),
    remote: '/opt/mxv-checklist/backend/dist/scripts/python/recon_data_worker.py',
  },
  {
    local: path.join(repoRoot, 'backend/src/scripts/python/excel_sheet_cloner.py'),
    remote: '/opt/mxv-checklist/backend/dist/scripts/python/excel_sheet_cloner.py',
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

  // Tao toan bo thu muc cha tren Ubuntu truoc khi upload
  const uniqueDirs = [...new Set(filesToUpload.map((f) => path.dirname(f.remote).replace(/\\/g, '/')))];
  console.log(`Dang kiem tra & tao ${uniqueDirs.length} thu muc tren Ubuntu...`);
  const dirBatches = [];
  for (let i = 0; i < uniqueDirs.length; i += 30) {
    dirBatches.push(uniqueDirs.slice(i, i + 30).map((d) => `"${d}"`).join(' '));
  }
  const mkdirCmd = dirBatches.map((batch) => `mkdir -p ${batch}`).join(' && ');

  conn.exec(mkdirCmd, (mkErr, mkStream) => {
    if (mkErr) {
      console.error('Mkdir error:', mkErr);
      conn.end();
      return;
    }
    mkStream.resume();
    mkStream.stderr.resume();
    mkStream.on('close', () => {
      console.log('Da tao/kiem tra toan bo thu muc con tren Ubuntu san sang.');

      // Mở SFTP và upload trực tiếp
      conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          console.error('SFTP Error:', sftpErr);
          conn.end();
          return;
        }
        console.log('SFTP san sang. Bat dau upload...');

        let completed = 0;
        let cursor = 0;
        let isDone = false;
        const CONCURRENCY = 8;

        function startWorker() {
          if (cursor >= filesToUpload.length) {
            if (completed >= filesToUpload.length && !isDone) {
              isDone = true;
              console.log('\n=== TAT CA FILE DA DUOC DONG BO LEN UBUNTU THANH CONG! ===');
              runBuildAndRestart();
            }
            return;
          }
          const item = filesToUpload[cursor++];
          const currentIdx = cursor;

          try {
            const content = fs.readFileSync(item.local);
            sftp.writeFile(item.remote, content, (writeErr) => {
              if (writeErr) {
                sftp.fastPut(item.local, item.remote, (putErr) => {
                  if (putErr) {
                    console.error(`   Loi upload ${item.remote}:`, putErr.message);
                  } else {
                    console.log(`  [${currentIdx}/${filesToUpload.length}]  Uploaded: ${path.basename(item.local)}`);
                  }
                  completed++;
                  startWorker();
                });
              } else {
                console.log(`  [${currentIdx}/${filesToUpload.length}]  Uploaded: ${path.basename(item.local)}`);
                completed++;
                startWorker();
              }
            });
          } catch (readErr) {
            console.error(`   Loi doc file ${item.local}:`, readErr.message);
            completed++;
            startWorker();
          }
        }

        for (let i = 0; i < CONCURRENCY; i++) {
          startWorker();
        }
      });
    });
  });

  function runBuildAndRestart() {
    console.log('\n=== DANG BUILD BACKEND VA FRONTEND TREN UBUNTU ===');
    const cmd = `
      echo "=== 0. CLEANUP ZOMBIE PROCESSES & PROFILE LOCKS ==="
      killall -9 chrome-headless-shell 2>/dev/null || true
      rm -f /opt/mxv-checklist/backend/temp/cqg_profile_*/Singleton* 2>/dev/null || true
      echo "=== 1. BUILD BACKEND ==="
      cd /opt/mxv-checklist/backend && rm -f tsconfig*.tsbuildinfo && rm -rf dist && npm run build
      mkdir -p /opt/mxv-checklist/backend/dist/scripts/python && cp -rf /opt/mxv-checklist/backend/src/scripts/python/* /opt/mxv-checklist/backend/dist/scripts/python/ 2>/dev/null || true
      echo "=== 2. RESTART BACKEND PM2 ==="
      pm2 restart mxv-backend
      echo "=== 3. BUILD FRONTEND ==="
      cd /opt/mxv-checklist/frontend && rm -rf .next && npm run build
      echo "=== 4. RESTART FRONTEND PM2 ==="
      pm2 restart mxv-frontend
      echo "=== 5. PM2 STATUS ==="
      pm2 status
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
  readyTimeout: 30000,
});

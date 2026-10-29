const { Client } = require('../backend/node_modules/ssh2');
const path = require('path');

function runRemoteCommand(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        stream.on('data', (d) => {
          stdout += d.toString();
          process.stdout.write(d.toString());
        });
        stream.stderr.on('data', (d) => {
          stderr += d.toString();
          process.stderr.write(d.toString());
        });
        stream.on('close', (code) => {
          conn.end();
          resolve({ code, stdout, stderr });
        });
      });
    }).on('error', reject).connect({
      host: '10.0.0.26',
      port: 22,
      username: 'mxvadmin',
      password: 'MxV!,#2o26',
      readyTimeout: 30000,
    });
  });
}

function uploadFile(localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        sftp.fastPut(localPath, remotePath, (putErr) => {
          conn.end();
          if (putErr) reject(putErr);
          else resolve();
        });
      });
    }).on('error', reject).connect({
      host: '10.0.0.26',
      port: 22,
      username: 'mxvadmin',
      password: 'MxV!,#2o26',
      readyTimeout: 30000,
    });
  });
}

async function main() {
  const arg = process.argv[2] || 'status';
  if (arg === 'upload') {
    const local = path.resolve(__dirname, '../backend/src/scripts/warmup_cqg_cache.js');
    const remote = '/opt/mxv-checklist/backend/src/scripts/warmup_cqg_cache.js';
    console.log(`Uploading ${local} to ${remote}...`);
    await uploadFile(local, remote);
    console.log('Upload done!');
  } else if (arg === 'status') {
    console.log('--- SYSTEM STATUS ---');
    await runRemoteCommand('free -h && swapon --show && df -h /');
  } else if (arg === 'add_swap') {
    console.log('--- ADDING 4GB SWAP ---');
    const swapCmd = `
      echo "MxV!,#2o26" | sudo -S bash -c '
        if [ ! -f /swap2.img ]; then
          fallocate -l 4G /swap2.img || dd if=/dev/zero of=/swap2.img bs=1M count=4096
          chmod 600 /swap2.img
          mkswap /swap2.img
        fi
        swapon /swap2.img 2>/dev/null || true
        grep -q "/swap2.img" /etc/fstab || echo "/swap2.img none swap sw 0 0" >> /etc/fstab
      '
      free -h
      swapon --show
    `;
    await runRemoteCommand(swapCmd);
  } else if (arg === 'check_profiles') {
    const cmd = `
      echo "=== PROFILE SIZES ==="
      du -sh /opt/mxv-checklist/backend/temp/cqg_profile_* 2>/dev/null || true
      echo "=== CACHE SIZES ==="
      du -sh /opt/mxv-checklist/backend/temp/cqg_profile_*/Default/Cache 2>/dev/null || true
      echo "=== CODE CACHE SIZES ==="
      du -sh /opt/mxv-checklist/backend/temp/cqg_profile_*/Default/Code\\ Cache 2>/dev/null || true
      echo "=== SINGLETON LOCKS ==="
      ls -la /opt/mxv-checklist/backend/temp/cqg_profile_*/Singleton* 2>/dev/null || echo "No locks found"
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'warmup') {
    const extraArgs = process.argv.slice(3).join(' ');
    console.log(`--- RUNNING WARMUP SCRIPT (${extraArgs || 'all'}) ---`);
    await runRemoteCommand(`cd /opt/mxv-checklist/backend && node src/scripts/warmup_cqg_cache.js ${extraArgs}`);
  } else if (arg === 'test_speed') {
    console.log('--- TESTING PARALLEL SPEED ---');
    await runRemoteCommand('cd /opt/mxv-checklist/backend && node src/scripts/test_measure_real_parallel_cqg_process.js');
  } else if (arg === 'investigate_backend') {
    console.log('--- DEEP BACKEND & SYSTEM INVESTIGATION ---');
    const cmd = `
      echo "=== 1. OS & USER LIMITS (ulimit) ==="
      ulimit -a
      echo ""
      echo "=== 2. KERNEL MEMORY SYSCTL ==="
      sysctl vm.swappiness vm.overcommit_memory vm.overcommit_ratio vm.max_map_count
      echo ""
      echo "=== 3. TOP 10 MEMORY CONSUMING PROCESSES ==="
      ps aux --sort=-%mem | head -n 12
      echo ""
      echo "=== 4. PM2 ERROR LOGS (LAST 40 LINES) ==="
      tail -n 40 /home/mxvadmin/.pm2/logs/mxv-backend-error.log 2>/dev/null || echo "No error log"
      echo ""
      echo "=== 5. CHECK FOR OUT OF MEMORY (OOM) IN DMESG/SYSLOG ==="
      dmesg -T | grep -i -E "oom|out of memory|killed process" | tail -n 15 || echo "No dmesg OOM"
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'check_500') {
    console.log('--- CHECK 500 ERROR ---');
    const cmd = `
      echo "=== NGINX ERROR LOG ==="
      echo "MxV!,#2o26" | sudo -S tail -n 30 /var/log/nginx/error.log 2>/dev/null || echo "No nginx error log"
      echo ""
      echo "=== PM2 STATUS ==="
      pm2 status
      echo ""
      echo "=== PM2 FRONTEND ERROR LOG ==="
      tail -n 30 /home/mxvadmin/.pm2/logs/mxv-frontend-error.log 2>/dev/null
      echo ""
      echo "=== PM2 FRONTEND OUT LOG ==="
      tail -n 30 /home/mxvadmin/.pm2/logs/mxv-frontend-out.log 2>/dev/null
      echo ""
      echo "=== CURL LOCALHOST 3000 (FRONTEND) ==="
      curl -I http://127.0.0.1:3000/
      echo ""
      echo "=== CURL LOCALHOST 3001 (BACKEND) ==="
      curl -I http://127.0.0.1:3001/api/v1/users
      echo ""
      echo "=== CURL HTTPS LOCALHOST 443 (NGINX) ==="
      curl -I -k https://127.0.0.1/
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'check_routes') {
    const routes = [
      '/',
      '/login',
      '/checklist',
      '/trading-manager',
      '/trading-manager/session-open/eod-result',
      '/trading-manager/ms-cqg',
      '/trading-manager/ccp-ce',
      '/api/v1/dashboard/system-status',
    ];
    const cmd = routes.map((r) => `echo -n "${r} -> " && curl -s -o /dev/null -w "%{http_code}\\n" -k "https://127.0.0.1${r}"`).join(' && ');
    await runRemoteCommand(cmd);
  } else if (arg === 'test_v8') {
    const cmd = `
      echo "=== NODE.JS VERSION & ARCH ==="
      node -p "process.version + ' ' + process.arch"
      echo "=== HEAP LIMIT WITH DEFAULT ==="
      node -e "console.log('Default limit:', (require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1) + ' MB')"
      echo "=== HEAP LIMIT WITH --max-old-space-size=3072 ==="
      node --max-old-space-size=3072 -e "console.log('3072 limit:', (require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1) + ' MB')"
      echo "=== HEAP LIMIT WITH --max-old-space-size=4096 ==="
      node --max-old-space-size=4096 -e "console.log('4096 limit:', (require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1) + ' MB')"
      echo "=== HEAP LIMIT WITH --max-old-space-size=5120 ==="
      node --max-old-space-size=5120 -e "console.log('5120 limit:', (require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1) + ' MB')"
      echo "=== HEAP LIMIT WITH --max-old-space-size=6144 ==="
      node --max-old-space-size=6144 -e "console.log('6144 limit:', (require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1) + ' MB')"
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'test_alloc') {
    const cmd = `
      node --max-old-space-size=4096 --expose-gc -e "
        console.log('Start allocating arrays in V8 Heap...');
        const chunks = [];
        for (let i = 0; i < 35; i++) {
          // Allocate 100MB array of objects
          chunks.push(new Array(1000000).fill({ a: 1, b: 2, c: 'test-string-data' }));
          const mem = process.memoryUsage();
          if (i % 5 === 0) {
            console.log('Allocated ' + (i * 100) + 'MB -> RSS: ' + (mem.rss / 1024 / 1024).toFixed(1) + ' MB, HeapUsed: ' + (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB');
          }
        }
        console.log('Final Peak -> RSS: ' + (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB, HeapUsed: ' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB');
        chunks.length = 0;
        if (global.gc) global.gc();
        console.log('After GC -> RSS: ' + (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB, HeapUsed: ' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB');
      "
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'find_excel') {
    const cmd = `find /opt/mxv-checklist -type f \\( -name "*QLTKGD*" -o -name "*FR*.xlsx" \\) 2>/dev/null | head -n 10`;
    await runRemoteCommand(cmd);
  } else if (arg === 'measure_excel') {
    const cmd = `
      node -e "
        const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');
        const file = '/opt/mxv-checklist/backend/data/benchmark_parallel/FR1_parallel.xlsx';
        const startMem = process.memoryUsage();
        console.log('Start: RSS=' + (startMem.rss/1024/1024).toFixed(1) + 'MB, Heap=' + (startMem.heapUsed/1024/1024).toFixed(1) + 'MB');
        const wb = XLSX.readFile(file);
        const readMem = process.memoryUsage();
        console.log('After XLSX.readFile: RSS=' + (readMem.rss/1024/1024).toFixed(1) + 'MB, Heap=' + (readMem.heapUsed/1024/1024).toFixed(1) + 'MB');
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const jsonMem = process.memoryUsage();
        console.log('After sheet_to_json (' + json.length + ' rows): RSS=' + (jsonMem.rss/1024/1024).toFixed(1) + 'MB, Heap=' + (jsonMem.heapUsed/1024/1024).toFixed(1) + 'MB');
      "
    `;
    await runRemoteCommand(cmd);
  } else if (arg === 'apply_backend_limits') {
    const cmd = `
      echo "=== APPLYING NEW LIMITS TO PM2 BACKEND (4GB V8 / 5GB PM2) ==="
      pm2 restart mxv-backend --node-args="--max-old-space-size=4096 --expose-gc" --max-memory-restart 5000M
      pm2 save
      echo ""
      echo "=== VERIFYING PM2 BACKEND CONFIGURATION ==="
      pm2 describe mxv-backend
    `;
    await runRemoteCommand(cmd);
  }
}

main().catch(console.error);

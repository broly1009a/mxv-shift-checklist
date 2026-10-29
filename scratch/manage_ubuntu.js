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
  }
}

main().catch(console.error);

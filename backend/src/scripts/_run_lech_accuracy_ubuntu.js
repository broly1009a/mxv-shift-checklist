/**
 * Deploy + E2E LECH accuracy audit on Ubuntu.
 * Usage: node src/scripts/_run_lech_accuracy_ubuntu.js
 */
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const deployScript = path.join(__dirname, 'deploy_to_ubuntu.js');
const remoteLocal = path.join(__dirname, '_e2e_lech_accuracy_remote.js');
const remotePath = '/opt/mxv-checklist/backend/_e2e_lech_accuracy_remote.js';
const localOut = path.join(__dirname, '_lech_accuracy_audit.json');

console.log('=== STEP 1: DEPLOY ===');
const dep = spawnSync('node', [deployScript], {
  cwd: path.join(repoRoot, 'backend'),
  encoding: 'utf8',
  stdio: 'inherit',
  env: process.env,
});
if (dep.status !== 0) {
  console.error('DEPLOY_FAILED', dep.status);
  process.exit(dep.status || 1);
}

console.log('\n=== STEP 2: WAIT PM2 READY ===');
// short wait after restart
const { Client: Ssh } = require('ssh2');

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => {
        out += d;
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        errOut += d;
        process.stderr.write(d);
      });
      stream.on('close', (code) => resolve({ code, out, errOut }));
    });
  });
}

const conn = new Ssh();
conn
  .on('ready', async () => {
    try {
      console.log('SSH_OK — waiting backend health');
      await sshExec(conn, 'sleep 8; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/v1/health || true; echo');

      await new Promise((resolve, reject) => {
        conn.sftp((e, sftp) => {
          if (e) return reject(e);
          sftp.fastPut(remoteLocal, remotePath, (pe) => {
            if (pe) return reject(pe);
            console.log('UPLOADED accuracy script — starting E2E (may take long)');
            sshExec(conn, `cd /opt/mxv-checklist/backend && node ${remotePath}`)
              .then(({ code }) => {
                console.log('\nE2E_EXIT', code);
                sftp.fastGet('/tmp/_lech_accuracy_audit.json', localOut, (ge) => {
                  if (ge) console.error('GET_RESULT', ge.message);
                  else console.log('SAVED', localOut);
                  sshExec(conn, `rm -f ${remotePath}`).finally(() => {
                    conn.end();
                    resolve();
                  });
                });
              })
              .catch(reject);
          });
        });
      });
    } catch (e) {
      console.error(e);
      conn.end();
      process.exit(1);
    }
  })
  .on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: process.env.UBUNTU_SSH_PASSWORD || 'MxV!,#2o26',
    readyTimeout: 20000,
  });

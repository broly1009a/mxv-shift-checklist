/**
 * Deploy + reparse CAN_KIEM_TRA/LECH/logo-hit trên Ubuntu.
 */
const { Client } = require('ssh2');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const deployScript = path.join(__dirname, 'deploy_to_ubuntu.js');
const remoteLocal = path.join(__dirname, '_e2e_cankt_reparse_remote.js');
const remotePath = '/opt/mxv-checklist/backend/_e2e_cankt_reparse_remote.js';
const localOut = path.join(__dirname, '_cankt_reparse_audit.json');

console.log('=== DEPLOY ===');
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

const conn = new Client();
conn
  .on('ready', () => {
    console.log('\nSSH_OK — upload & run reparse');
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      sftp.fastPut(remoteLocal, remotePath, (e) => {
        if (e) {
          console.error(e);
          conn.end();
          return;
        }
        conn.exec(`sleep 6; cd /opt/mxv-checklist/backend && node ${remotePath}`, (err2, stream) => {
          if (err2) {
            console.error(err2);
            conn.end();
            return;
          }
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', (code) => {
            console.log('\nEXIT', code);
            sftp.fastGet('/tmp/_cankt_reparse_audit.json', localOut, (ge) => {
              if (ge) console.error('GET', ge.message);
              else console.log('SAVED', localOut);
              conn.exec(`rm -f ${remotePath}`, () => conn.end());
            });
          });
        });
      });
    });
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

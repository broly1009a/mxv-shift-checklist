/**
 * Upload + chạy E2E LECH accuracy trên Ubuntu (đã deploy sẵn).
 */
const { Client } = require('ssh2');
const path = require('path');

const remoteLocal = path.join(__dirname, '_e2e_lech_accuracy_remote.js');
const remotePath = '/opt/mxv-checklist/backend/_e2e_lech_accuracy_remote.js';
const localOut = path.join(__dirname, '_lech_accuracy_audit.json');

const conn = new Client();
conn
  .on('ready', () => {
    console.log('SSH_OK');
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
        console.log('UPLOADED — E2E LECH accuracy (may take a while)');
        conn.exec(`sleep 5; cd /opt/mxv-checklist/backend && node ${remotePath}`, (err2, stream) => {
          if (err2) {
            console.error(err2);
            conn.end();
            return;
          }
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', (code) => {
            console.log('\nEXIT', code);
            sftp.fastGet('/tmp/_lech_accuracy_audit.json', localOut, (ge) => {
              if (ge) console.error('GET_RESULT', ge.message);
              else console.log('SAVED', localOut);
              conn.exec(`rm -f ${remotePath}`, () => conn.end());
            });
          });
        });
      });
    });
  })
  .on('error', (e) => console.error(e.message))
  .connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: process.env.UBUNTU_SSH_PASSWORD || 'MxV!,#2o26',
    readyTimeout: 20000,
  });

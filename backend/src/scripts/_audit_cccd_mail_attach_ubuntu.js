/**
 * Upload + chạy audit CCCD mail attachments trên Ubuntu.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localRemote = path.join(__dirname, '_audit_cccd_mail_attach_remote.js');
const remotePath = '/opt/mxv-checklist/backend/_audit_cccd_mail_attach_remote.js';
const localOut = path.join(__dirname, '_cccd_mail_attach_audit.json');

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
      sftp.fastPut(localRemote, remotePath, (e) => {
        if (e) {
          console.error(e);
          conn.end();
          return;
        }
        console.log('UPLOADED — auditing');
        conn.exec(`cd /opt/mxv-checklist/backend && node ${remotePath}`, (err2, stream) => {
          if (err2) {
            console.error(err2);
            conn.end();
            return;
          }
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', (code) => {
            console.log('\nEXIT', code);
            sftp.fastGet('/tmp/_cccd_mail_attach_audit.json', localOut, (ge) => {
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

/**
 * Deploy soft-warn fix + reparse 003C3748802 (HĐ OCR garbage DOB but CCCD clear)
 */
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const serviceLocal = path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.service.ts');
const serviceRemote = '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts';

const reparseRemote = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const http = require('http');
function post(body) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body);
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/v1/tkgd/reparse-account',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
          'x-user-email': 'hieptruong@mxv.vn',
        },
        timeout: 300000,
      },
      (x) => {
        let b = '';
        x.on('data', (c) => (b += c));
        x.on('end', () => {
          try {
            resolve(JSON.parse(b || '{}'));
          } catch {
            resolve({});
          }
        });
      },
    );
    r.on('error', reject);
    r.write(d);
    r.end();
  });
}
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await c.connect();
  const col = c.db().collection('clean_account_records');
  // reparse soft-warn DOB cases that may now clear
  const codes = ['003C3748802', '003C1250359', '048C5952972', '076C9999999', '076C3131313', '003C9992222', '003C1059483'];
  for (const code of codes) {
    const doc = await col.findOne({ $or: [{ maTKGDBase: code }, { maTKGD: code }] }, { sort: { batchDate: -1 } });
    if (!doc) {
      console.log(code, 'NOT_FOUND');
      continue;
    }
    const before = doc.ketLuan?.trangThai;
    const beforeErr = (doc.ketLuan?.danhSachLoi || [])[0];
    const out = await post({ recordId: String(doc._id), accountCode: code, batchDate: doc.batchDate });
    const after = out.record?.ketLuan?.trangThai;
    const afterErr = (out.record?.ketLuan?.danhSachLoi || [])[0];
    console.log(
      code,
      before,
      '->',
      after,
      '| before:',
      String(beforeErr || '').slice(0, 50),
      '| after:',
      String(afterErr || '').slice(0, 50),
    );
  }
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      sftp.fastPut(serviceLocal, serviceRemote, (pe) => {
        if (pe) {
          console.error(pe);
          conn.end();
          return;
        }
        console.log('UPLOADED service — build');
        conn.exec('cd /opt/mxv-checklist/backend && npm run build && pm2 restart mxv-backend', (e2, stream) => {
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', (code) => {
            console.log('BUILD', code);
            const remotePath = '/opt/mxv-checklist/backend/_reparse_hd_dob_soft.js';
            sftp.writeFile(remotePath, reparseRemote, (we) => {
              if (we) {
                console.error(we);
                conn.end();
                return;
              }
              conn.exec(`sleep 5; cd /opt/mxv-checklist/backend && node ${remotePath}`, (e3, s3) => {
                s3.on('data', (d) => process.stdout.write(d));
                s3.stderr.on('data', (d) => process.stderr.write(d));
                s3.on('close', (c3) => {
                  console.log('REPARSE_EXIT', c3);
                  conn.exec(`rm -f ${remotePath}`, () => conn.end());
                });
              });
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

/**
 * Deploy horizontal composite CCCD split + reparse 001C0120575
 */
const { Client } = require('ssh2');
const path = require('path');

const localPy = path.resolve(__dirname, 'python/tkgd_extractor_worker.py');
const remotePy = '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py';

const reparseRemote = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const http = require('http');
function post(body) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body);
    const r = http.request({
      hostname: '127.0.0.1', port: 3001, path: '/api/v1/tkgd/reparse-account', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), 'x-user-email': 'hieptruong@mxv.vn' },
      timeout: 300000,
    }, (x) => { let b=''; x.on('data', c => b+=c); x.on('end', () => { try { resolve(JSON.parse(b||'{}')); } catch { resolve({}); } }); });
    r.on('error', reject); r.write(d); r.end();
  });
}
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await c.connect();
  const col = c.db().collection('clean_account_records');
  const code = '001C0120575';
  const doc = await col.findOne({ $or: [{ maTKGDBase: code }, { maTKGD: code }] }, { sort: { batchDate: -1 } });
  if (!doc) { console.log('NOT_FOUND'); await c.close(); return; }
  const before = doc.ketLuan?.trangThai;
  const be = (doc.ketLuan?.danhSachLoi || [])[0];
  const out = await post({ recordId: String(doc._id), accountCode: code, batchDate: doc.batchDate });
  const after = out.record?.ketLuan?.trangThai;
  const errs = out.record?.ketLuan?.danhSachLoi || [];
  const warn = out.record?.canCuoc?.canhBaoChatLuong || [];
  console.log(code, before, '->', after);
  console.log('beforeErr', String(be || '').slice(0, 120));
  console.log('afterErrs', JSON.stringify(errs));
  console.log('afterWarn', JSON.stringify(warn));
  console.log('name', out.record?.canCuoc?.hoVaTen, 'ms', out.record?.ms?.hoVaTen);
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
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
      sftp.fastPut(localPy, remotePy, (pe) => {
        if (pe) {
          console.error('PUT_FAIL', pe.message);
          conn.end();
          return;
        }
        console.log('OK tkgd_extractor_worker.py');
        // Also copy to dist if present
        const distPy = '/opt/mxv-checklist/backend/dist/scripts/python/tkgd_extractor_worker.py';
        sftp.fastPut(localPy, distPy, (pe2) => {
          if (pe2) console.log('dist skip', pe2.message);
          else console.log('OK dist python');
          const rp = '/opt/mxv-checklist/backend/_reparse_001_comp.js';
          sftp.writeFile(rp, reparseRemote, (we) => {
            if (we) {
              console.error(we);
              conn.end();
              return;
            }
            conn.exec(`node ${rp}; rm -f ${rp}`, (e3, s3) => {
              s3.on('data', (d) => process.stdout.write(d));
              s3.stderr.on('data', (d) => process.stderr.write(d));
              s3.on('close', (c3) => {
                console.log('EXIT', c3);
                conn.end();
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

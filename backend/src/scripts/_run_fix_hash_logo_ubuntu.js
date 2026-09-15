/**
 * Deploy + reparse accounts with hash logo e0b6f9cd / CCCD-as-PDF
 */
const { Client } = require('ssh2');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const deployScript = path.join(__dirname, 'deploy_to_ubuntu.js');

console.log('=== DEPLOY ===');
const dep = spawnSync('node', [deployScript], {
  cwd: path.join(repoRoot, 'backend'),
  encoding: 'utf8',
  stdio: 'inherit',
  env: process.env,
});
if (dep.status !== 0) process.exit(dep.status || 1);

const remoteScript = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const http = require('http');

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'x-user-email': 'hieptruong@mxv.vn' },
      timeout: 300000,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }); }
        catch { resolve({ status: res.statusCode, body: { raw: buf.slice(0, 300) } }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}
function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path: urlPath, method: 'GET',
      headers: { 'x-user-email': 'hieptruong@mxv.vn' }, timeout: 60000,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await client.connect();
  const col = client.db().collection('clean_account_records');
  const codes = ['076C3131313', '076C9999999', '076C6868688'];
  // also scan for e0b6f9cd.png folders
  const hoso = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem';
  if (fs.existsSync(hoso)) {
    for (const d of fs.readdirSync(hoso)) {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d)) continue;
      for (const acc of fs.readdirSync(path.join(hoso, d))) {
        const p = path.join(hoso, d, acc);
        try {
          if (!fs.statSync(p).isDirectory()) continue;
          if (fs.readdirSync(p).some((f) => /^[a-f0-9]{6,20}\\.(png|jpe?g)$/i.test(f))) {
            if (!codes.includes(acc)) codes.push(acc);
          }
        } catch {}
      }
    }
  }
  console.log('CODES=' + JSON.stringify(codes));
  for (const code of codes) {
    const doc = await col.findOne(
      { $or: [{ maTKGDBase: code }, { maTKGD: code }] },
      { sort: { batchDate: -1 } },
    );
    if (!doc) { console.log(code + ' NOT_FOUND'); continue; }
    process.stdout.write('reparse ' + code + ' ... ');
    const res = await postJson('/api/v1/tkgd/reparse-account', {
      recordId: String(doc._id), accountCode: code, batchDate: doc.batchDate,
    });
    const st = res.body?.record?.ketLuan?.trangThai;
    const err = (res.body?.record?.ketLuan?.danhSachLoi || [])[0];
    console.log(res.status + ' -> ' + st + (err ? ' | ' + String(err).slice(0, 70) : ''));
  }
  const m = await getJson('/api/v1/tkgd/files/manifest/076C3131313?batchDate=2026-09-09');
  const files = m.body?.files || {};
  console.log('MANIFEST_076C3131313=' + JSON.stringify({
    http: m.status,
    mailFront: files.mailCccdFront?.fileName || null,
    mailBack: files.mailCccdBack?.fileName || null,
    hashStillFront: /^[a-f0-9]{6,20}\\./i.test(files.mailCccdFront?.fileName || ''),
  }));
  // list dir after reparse
  const dir = hoso + '/2026-09-09/076C3131313';
  console.log('FILES_AFTER=' + JSON.stringify(fs.existsSync(dir) ? fs.readdirSync(dir) : []));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
`;

const remotePath = '/opt/mxv-checklist/backend/_fix_hash_logo_remote.js';
const localTmp = path.join(__dirname, '_fix_hash_logo_remote.js');
require('fs').writeFileSync(localTmp, remoteScript);

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
      sftp.fastPut(localTmp, remotePath, (e) => {
        if (e) {
          console.error(e);
          conn.end();
          return;
        }
        conn.exec(`sleep 5; cd /opt/mxv-checklist/backend && node ${remotePath}`, (e2, stream) => {
          if (e2) {
            console.error(e2);
            conn.end();
            return;
          }
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', (code) => {
            console.log('\\nEXIT', code);
            conn.exec(`rm -f ${remotePath}`, () => conn.end());
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

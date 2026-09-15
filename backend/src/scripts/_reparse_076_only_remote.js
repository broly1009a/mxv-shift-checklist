#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const http = require('http');

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'x-user-email': 'hieptruong@mxv.vn',
        },
        timeout: 300000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: {} });
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(data);
    req.end();
  });
}
function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: urlPath,
        method: 'GET',
        headers: { 'x-user-email': 'hieptruong@mxv.vn' },
        timeout: 60000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: {} });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  // smoke rasterize
  const { spawnSync } = require('child_process');
  const pdf =
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/076C3131313/CCCD Hồ Bá Huỳnh.pdf';
  const py = `
import sys
sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import rasterize_pdf_first_page
print(rasterize_pdf_first_page(${JSON.stringify(pdf)}))
`;
  const rr = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  console.log('RASTERIZE', rr.status, rr.stdout.trim(), rr.stderr.slice(0, 200));

  const client = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await client.connect();
  const col = client.db().collection('clean_account_records');
  const code = '076C3131313';
  const doc = await col.findOne({ $or: [{ maTKGDBase: code }, { maTKGD: code }] }, { sort: { batchDate: -1 } });
  console.log('reparse...');
  const res = await postJson('/api/v1/tkgd/reparse-account', {
    recordId: String(doc._id),
    accountCode: code,
    batchDate: doc.batchDate,
  });
  console.log(
    'RESULT',
    res.status,
    res.body?.record?.ketLuan?.trangThai,
    (res.body?.record?.ketLuan?.danhSachLoi || []).slice(0, 2),
  );
  const m = await getJson('/api/v1/tkgd/files/manifest/076C3131313?batchDate=2026-09-09');
  const files = m.body?.files || {};
  console.log(
    'MANIFEST',
    JSON.stringify({
      mailFront: files.mailCccdFront?.fileName,
      mailBack: files.mailCccdBack?.fileName,
      hashStill: /^[a-f0-9]{6,20}\./i.test(files.mailCccdFront?.fileName || ''),
    }),
  );
  const dir =
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/076C3131313';
  console.log('FILES', fs.readdirSync(dir));
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Reparse LECH + CAN_KIEM_TRA (+ optional logo-hit codes) trên Ubuntu.
 */
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
            resolve({ status: res.statusCode, body: { raw: buf.slice(0, 400) } });
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
            resolve({ status: res.statusCode, body: { raw: buf.slice(0, 400) } });
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function findLogoHitCodes(hosoBase) {
  const hits = new Set();
  if (!fs.existsSync(hosoBase)) return hits;
  for (const d of fs.readdirSync(hosoBase)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const dateDir = path.join(hosoBase, d);
    let accounts = [];
    try {
      accounts = fs.readdirSync(dateDir);
    } catch {
      continue;
    }
    for (const acc of accounts) {
      const accPath = path.join(dateDir, acc);
      try {
        if (!fs.statSync(accPath).isDirectory()) continue;
        const files = fs.readdirSync(accPath);
        if (files.some((f) => /fireant|@2x\.|logo|horizontal@/i.test(f))) {
          hits.add(acc.split('_')[0]);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return hits;
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection('clean_account_records');

  const countBy = async () => {
    const by = {};
    for (const s of ['KHOP', 'LECH', 'CAN_KIEM_TRA', 'CHUA_XU_LY']) {
      by[s] = await col.countDocuments({ 'ketLuan.trangThai': s });
    }
    return { total: await col.countDocuments(), by };
  };

  const before = await countBy();
  console.log('BEFORE=' + JSON.stringify(before));

  const logoHits = findLogoHitCodes(
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
  );
  console.log('LOGO_HIT_CODES=' + JSON.stringify([...logoHits]));

  const docs = await col
    .find({
      $or: [
        { 'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] } },
        { maTKGDBase: { $in: [...logoHits] } },
        { maTKGD: { $in: [...logoHits, '048C8201013'] } },
      ],
    })
    .project({ _id: 1, maTKGD: 1, maTKGDBase: 1, batchDate: 1, 'ketLuan.trangThai': 1, 'ketLuan.danhSachLoi': 1 })
    .sort({ batchDate: -1 })
    .toArray();

  const seen = new Set();
  const targets = [];
  // Prioritize known FireAnt case
  const priority = ['048C8201013', '048C7324877'];
  for (const p of priority) {
    const hit = docs.find((d) => (d.maTKGDBase || d.maTKGD || '').startsWith(p));
    if (hit) {
      const key = (hit.maTKGDBase || hit.maTKGD || '').split('-')[0];
      if (!seen.has(key)) {
        seen.add(key);
        targets.push(hit);
      }
    }
  }
  for (const d of docs) {
    const key = (d.maTKGDBase || d.maTKGD || '').split('-')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(d);
  }

  console.log('TARGETS=' + targets.length);
  console.log(
    'TARGET_LIST=' +
      JSON.stringify(targets.map((t) => ({ code: t.maTKGD || t.maTKGDBase, st: t.ketLuan?.trangThai }))),
  );

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const code = t.maTKGD || t.maTKGDBase;
    process.stdout.write(`[${i + 1}/${targets.length}] reparse ${code} (${t.ketLuan?.trangThai}) ... `);
    try {
      const res = await postJson('/api/v1/tkgd/reparse-account', {
        recordId: String(t._id),
        accountCode: code,
        batchDate: t.batchDate,
      });
      const status = res.body?.record?.ketLuan?.trangThai || 'UNKNOWN';
      const errs = res.body?.record?.ketLuan?.danhSachLoi || [];
      console.log(res.status + ' -> ' + status + (errs[0] ? ' | ' + String(errs[0]).slice(0, 70) : ''));
      results.push({
        code,
        before: t.ketLuan?.trangThai,
        after: status,
        errs: errs.slice(0, 2),
        ok: !!res.body?.success,
      });
    } catch (e) {
      console.log('ERR ' + e.message);
      results.push({ code, before: t.ketLuan?.trangThai, after: 'ERROR', errs: [e.message], ok: false });
    }
  }

  // Check manifest for 048C8201013
  let manifestCheck = null;
  try {
    const m = await getJson(
      '/api/v1/tkgd/files/manifest/048C8201013?batchDate=' + encodeURIComponent('2026-09-09'),
    );
    const files = m.body?.files || m.body?.data?.files || m.body;
    manifestCheck = {
      http: m.status,
      mailFront: files?.mailCccdFront?.fileName || null,
      mailBack: files?.mailCccdBack?.fileName || null,
      msFront: files?.msCccdFront?.fileName || null,
      msBack: files?.msCccdBack?.fileName || null,
      fireantStillFront: /fireant/i.test(files?.mailCccdFront?.fileName || ''),
    };
    console.log('MANIFEST_048C8201013=' + JSON.stringify(manifestCheck));
  } catch (e) {
    console.log('MANIFEST_ERR=' + e.message);
  }

  const after = await countBy();
  const transitions = {};
  for (const r of results) {
    const key = `${r.before}->${r.after}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }

  const summary = {
    before,
    after,
    transitions,
    results,
    manifestCheck,
    flippedToKhop: results.filter((r) => r.after === 'KHOP').map((r) => r.code),
    stillCanKiemTra: results.filter((r) => r.after === 'CAN_KIEM_TRA').map((r) => r.code),
    stillLech: results.filter((r) => r.after === 'LECH').map((r) => r.code),
  };

  console.log(
    'SUMMARY=' +
      JSON.stringify({
        before,
        after,
        transitions,
        flippedToKhop: summary.flippedToKhop,
        stillCanKiemTraCount: summary.stillCanKiemTra.length,
        stillLechCount: summary.stillLech.length,
        manifestCheck,
      }),
  );

  fs.writeFileSync('/tmp/_cankt_reparse_audit.json', JSON.stringify(summary, null, 2));
  console.log('WROTE=/tmp/_cankt_reparse_audit.json');
  await client.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

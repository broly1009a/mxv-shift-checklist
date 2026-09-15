/**
 * E2E: reparse all LECH records on Ubuntu via local API, then report counts.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const remoteScript = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient, ObjectId } = require('mongodb');
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
            resolve({ status: res.statusCode, body: { raw: buf.slice(0, 500) } });
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

  // Unique by maTKGDBase (latest batchDate)
  const lechDocs = await col
    .find({ 'ketLuan.trangThai': 'LECH' })
    .project({ _id: 1, maTKGD: 1, maTKGDBase: 1, batchDate: 1, 'ketLuan.danhSachLoi': 1 })
    .sort({ batchDate: -1 })
    .toArray();

  const seen = new Set();
  const targets = [];
  for (const d of lechDocs) {
    const key = (d.maTKGDBase || d.maTKGD || '').split('-')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(d);
  }

  console.log('LECH_RECORDS=' + lechDocs.length + ' UNIQUE_BASE=' + targets.length);
  console.log('TARGETS=' + JSON.stringify(targets.map((t) => t.maTKGD || t.maTKGDBase)));

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const code = t.maTKGD || t.maTKGDBase;
    process.stdout.write('[' + (i + 1) + '/' + targets.length + '] reparse ' + code + ' ... ');
    try {
      const res = await postJson('/api/v1/tkgd/reparse-account', {
        recordId: String(t._id),
        accountCode: code,
        batchDate: t.batchDate,
      });
      const status = res.body?.record?.ketLuan?.trangThai || res.body?.ketLuan?.trangThai || 'UNKNOWN';
      const errs = res.body?.record?.ketLuan?.danhSachLoi || [];
      console.log(res.status + ' -> ' + status + (errs[0] ? ' | ' + String(errs[0]).slice(0, 80) : ''));
      results.push({ code, http: res.status, status, errs: errs.slice(0, 3), ok: !!res.body?.success });
    } catch (e) {
      console.log('ERR ' + e.message);
      results.push({ code, http: 0, status: 'ERROR', errs: [e.message], ok: false });
    }
  }

  // Final evaluate-only pass for ALL records to heal siblings/same base on other batch dates
  // using API run is slow; instead re-fetch and call evaluate via a second lightweight loop:
  // Reparse already evaluates that record. For other batchDate duplicates of same base still LECH,
  // reparse those too if still LECH.
  const stillLech = await col
    .find({ 'ketLuan.trangThai': 'LECH' })
    .project({ _id: 1, maTKGD: 1, maTKGDBase: 1, batchDate: 1 })
    .toArray();
  console.log('STILL_LECH_AFTER_FIRST_PASS=' + stillLech.length);

  // Second pass: any remaining LECH not yet reparsed in this run
  const doneIds = new Set(results.filter((r) => r.ok).map((r) => r.code));
  for (let i = 0; i < stillLech.length; i++) {
    const t = stillLech[i];
    const code = t.maTKGD || t.maTKGDBase;
    // skip if same base already successfully went non-LECH conceptually; still reparse remaining LECH docs
    process.stdout.write('[2nd ' + (i + 1) + '/' + stillLech.length + '] reparse ' + code + ' @' + t.batchDate + ' ... ');
    try {
      const res = await postJson('/api/v1/tkgd/reparse-account', {
        recordId: String(t._id),
        accountCode: code,
        batchDate: t.batchDate,
      });
      const status = res.body?.record?.ketLuan?.trangThai || 'UNKNOWN';
      console.log(res.status + ' -> ' + status);
    } catch (e) {
      console.log('ERR ' + e.message);
    }
  }

  const after = await countBy();
  console.log('AFTER=' + JSON.stringify(after));

  const transitions = { to_KHOP: 0, to_CAN_KIEM_TRA: 0, stay_LECH: 0, error: 0, other: 0 };
  for (const r of results) {
    if (!r.ok || r.status === 'ERROR') transitions.error++;
    else if (r.status === 'KHOP') transitions.to_KHOP++;
    else if (r.status === 'CAN_KIEM_TRA') transitions.to_CAN_KIEM_TRA++;
    else if (r.status === 'LECH') transitions.stay_LECH++;
    else transitions.other++;
  }
  console.log('FIRST_PASS_TRANSITIONS=' + JSON.stringify(transitions));
  console.log(
    'SUMMARY=' +
      JSON.stringify({
        beforeLech: before.by.LECH,
        afterLech: after.by.LECH,
        afterKhop: after.by.KHOP,
        afterCanKiemTra: after.by.CAN_KIEM_TRA,
        deltaLech: after.by.LECH - before.by.LECH,
      }),
  );

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

const localRemote = path.join(__dirname, '_e2e_lech_reeval_remote.js');
fs.writeFileSync(localRemote, remoteScript, 'utf8');

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
      const remotePath = '/opt/mxv-checklist/backend/_e2e_lech_reeval_remote.js';
      sftp.fastPut(localRemote, remotePath, (e) => {
        if (e) {
          console.error(e);
          conn.end();
          return;
        }
        console.log('UPLOADED — starting E2E (may take a while)');
        conn.exec(`cd /opt/mxv-checklist/backend && node ${remotePath}`, (err2, stream) => {
          if (err2) {
            console.error(err2);
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
    password: 'MxV!,#2o26',
    readyTimeout: 20000,
  });

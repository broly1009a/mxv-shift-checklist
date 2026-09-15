/**
 * Probe 001C0120575 CCCD paths + quality warnings on Ubuntu
 */
const { Client } = require('ssh2');

const remote = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await c.connect();
  const d = await c.db().collection('clean_account_records').findOne(
    { $or: [{ maTKGDBase: '001C0120575' }, { maTKGD: '001C0120575' }] },
    { sort: { batchDate: -1 } },
  );
  const cc = d?.canCuoc || {};
  const out = {
    status: d?.ketLuan?.trangThai,
    errors: d?.ketLuan?.danhSachLoi,
    canhBao: cc.canhBaoChatLuong,
    front: cc.anhMatTruoc || cc.frontImagePath || cc.frontPath,
    back: cc.anhMatSau || cc.backImagePath || cc.backPath,
    previewFront: cc.canCuocPreviewFront || d?.canCuocPreviewFront,
    previewBack: cc.canCuocPreviewBack || d?.canCuocPreviewBack,
    name: cc.hoVaTen,
    so: cc.soCanCuoc,
    attachments: (d?.fileDinhKem || d?.attachments || []).slice(0, 20),
    keys: Object.keys(cc),
  };
  console.log(JSON.stringify(out, null, 2));
  // try locate image dims via python if path exists
  const paths = [out.front, out.back, out.previewFront, out.previewBack].filter(Boolean);
  for (const p of paths) {
    const exists = fs.existsSync(p);
    console.log('PATH', p, exists ? 'EXISTS' : 'MISSING');
  }
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
      const rp = '/opt/mxv-checklist/backend/_probe_001.js';
      sftp.writeFile(rp, remote, (we) => {
        if (we) {
          console.error(we);
          conn.end();
          return;
        }
        conn.exec(`node ${rp}; rm -f ${rp}`, (e2, stream) => {
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', () => conn.end());
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

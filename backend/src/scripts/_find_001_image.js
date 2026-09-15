/**
 * Find image file for 001C0120575 and measure dims
 */
const { Client } = require('ssh2');

const remote = `#!/usr/bin/env node
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { MongoClient } = require('mongodb');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  await c.connect();
  const d = await c.db().collection('clean_account_records').findOne(
    { $or: [{ maTKGDBase: '001C0120575' }, { maTKGD: '001C0120575' }] },
    { sort: { batchDate: -1 } },
  );
  console.log('batch', d?.batchDate);
  console.log('localFiles', JSON.stringify(d?.localFiles || d?.files || d?.savedFiles || null));
  console.log('mailMeta', JSON.stringify(d?.mailMeta || d?.emailMeta || null)?.slice(0,500));
  const raw = JSON.stringify(d);
  const hits = [...raw.matchAll(/CCCD[^"\\\\]{0,80}\\.(jpg|jpeg|png|pdf)/gi)].map(m => m[0]);
  console.log('nameHits', [...new Set(hits)].slice(0,20));
  // search disk
  const roots = ['/opt/mxv-checklist/data', '/opt/mxv-checklist/backend/uploads', '/opt/mxv-checklist/storage', '/home/mxvadmin'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      const out = execSync(\`find \${root} -iname '*Diep*' -o -iname '*0120575*' 2>/dev/null | head -40\`, { encoding: 'utf8' });
      if (out.trim()) console.log('FIND', root, '\\n' + out);
    } catch {}
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
      const rp = '/opt/mxv-checklist/backend/_find_001.js';
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
  .connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: process.env.UBUNTU_SSH_PASSWORD || 'MxV!,#2o26',
    readyTimeout: 20000,
  });

const { Client } = require('ssh2');
const conn = new Client();

const scriptContent = `
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function inspectCases() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const col = mongoose.connection.db.collection('clean_account_records');

  // Case 3: 046C0002949
  const c3 = await col.findOne({ maTKGD: { $regex: '046C0002949' } });
  console.log('=== CASE 046C0002949 ===');
  console.log('maTKGD:', c3?.maTKGD, 'batchDate:', c3?.batchDate);
  console.log('hopDong:', JSON.stringify(c3?.hopDong, null, 2));
  console.log('canCuoc:', JSON.stringify(c3?.canCuoc, null, 2));
  console.log('ms:', JSON.stringify(c3?.ms, null, 2));
  console.log('ketLuan:', JSON.stringify(c3?.ketLuan, null, 2));

  // Files for 046C0002949
  for (const d of ['2026-09-16', '2026-09-17', '2026-09-04', '2026-09-07']) {
    const p = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/' + d + '/046C0002949';
    if (fs.existsSync(p)) {
      console.log('Found folder:', p, fs.readdirSync(p));
    }
  }

  // Case 2: 046C0002960
  const c2 = await col.findOne({ maTKGD: '046C0002960' });
  console.log('\\n=== CASE 2: 046C0002960 ===');
  console.log('hoVaTen (top-level):', c2?.hoVaTen);
  console.log('canCuocPreviewFront:', c2?.canCuocPreviewFront);
  console.log('canCuocPreviewBack:', c2?.canCuocPreviewBack);
  console.log('canCuoc:', JSON.stringify(c2?.canCuoc, null, 2));
  console.log('hopDong:', JSON.stringify(c2?.hopDong, null, 2));
  console.log('ms:', JSON.stringify(c2?.ms, null, 2));
  console.log('ketLuan:', JSON.stringify(c2?.ketLuan, null, 2));

  // Kiểm tra các file trong thư mục lưu trữ của Case 2
  const dir2 = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/046C0002960';
  if (fs.existsSync(dir2)) {
    console.log('\\nFiles in dir2:', dir2);
    const files = fs.readdirSync(dir2);
    for (const f of files) {
      const stat = fs.statSync(path.join(dir2, f));
      console.log(' -', f, '(' + Math.round(stat.size / 1024) + ' KB)');
    }
  } else {
    console.log('dir2 not found:', dir2);
  }

  await mongoose.disconnect();
}

inspectCases().catch(console.error);
`;

const b64 = Buffer.from(scriptContent).toString('base64');
conn.on('ready', () => {
  const cmd = `echo "${b64}" | base64 -d > /tmp/_inspect_2_bugs.js && NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/_inspect_2_bugs.js && rm -f /tmp/_inspect_2_bugs.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => errOut += d.toString());
    stream.on('close', () => {
      console.log(out);
      if (errOut) console.error('ERR:', errOut);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

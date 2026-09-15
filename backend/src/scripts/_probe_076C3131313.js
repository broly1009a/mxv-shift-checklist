#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Prefer dist if built, else compile via require ts path won't work — use inline copies + probe from dist
let m;
try {
  m = require('/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-mail-parser.helper');
} catch (e) {
  console.error('LOAD_HELPER_FAIL', e.message);
  process.exit(1);
}

const dir =
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/076C3131313';
console.log('DIR', dir, 'exists', fs.existsSync(dir));
const files = fs.readdirSync(dir);
console.log('FILES', files);

const mailImgs = [];
for (const f of files) {
  const full = path.join(dir, f);
  const st = fs.statSync(full);
  if (!st.isFile()) continue;
  const dims = /\.(png|jpe?g|webp|gif)$/i.test(f) ? m.probeImageDimensions(full) : null;
  const ignored = m.isIgnoredEmailAttachment(f, st.size, dims);
  const logo = m.isDecorativeOrLogoAttachment(f);
  const score = m.scoreCccdImageCandidate({
    fileName: f,
    size: st.size,
    width: dims?.width,
    height: dims?.height,
  });
  console.log(
    JSON.stringify({
      f,
      size: st.size,
      dims,
      ignored,
      logo,
      score,
      namedCccd: m.isNamedCccdImage(f),
      contract: m.isNamedContractImage(f),
    }),
  );
  if (/\.(png|jpe?g|webp)$/i.test(f) && !/_ms_/i.test(f)) {
    mailImgs.push({ name: f, filePath: full, size: st.size });
  }
}
console.log('PICK', m.pickCccdImagePaths(mailImgs));

#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir =
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-09/076C3131313';
const pdf = path.join(dir, 'CCCD Hồ Bá Huỳnh.pdf');
console.log('pdf exists', fs.existsSync(pdf), 'size', fs.existsSync(pdf) ? fs.statSync(pdf).size : 0);

const py = `
import sys
sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python')
from tkgd_extractor_worker import rasterize_pdf_first_page, ensure_cccd_image_path
p = ${JSON.stringify(pdf)}
print('rasterize', rasterize_pdf_first_page(p))
print('ensure', ensure_cccd_image_path(p))
`;
const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
console.log('stdout', r.stdout);
console.log('stderr', r.stderr);
console.log('status', r.status);
console.log('files', fs.readdirSync(dir));

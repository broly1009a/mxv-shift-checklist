import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_script = """
const fs = require('fs');
const path = require('path');
const { parseTTM, parseTTTTForVolume } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/ms-excel.parser');
const { parseOP, parsePSForVolume } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser');

const msDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/19.10';
const cqgDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/19.10';

// 1. TTM vs OP
const ttmBuf = fs.readFileSync(path.join(msDir, 'TTM.xlsx'));
const opBuf = fs.readFileSync(path.join(cqgDir, 'OP.xlsx'));

const ttmData = parseTTM(ttmBuf);
const opData = parseOP(opBuf);

let totalTTM = 0;
let totalACM_TTM = 0;
const ttmSummary = {};
ttmData.forEach(t => {
  const qty = t.tongMua + t.tongBan;
  const acc = String(t.maTKGD || '').trim().toUpperCase();
  if (acc.endsWith('A')) {
    totalACM_TTM += qty;
  } else {
    totalTTM += qty;
  }
  ttmSummary[acc] = (ttmSummary[acc] || 0) + qty;
});

let totalOP = 0;
const opSummary = {};
opData.forEach(o => {
  const acc = String(o.account || '').trim().toUpperCase();
  const qty = o.lValue + o.sValue;
  if (!acc.endsWith('A')) {
    totalOP += qty;
  }
  opSummary[acc] = (opSummary[acc] || 0) + qty;
});

console.log('=== TTM vs OP ===');
console.log('Total TTM (Non-A):', totalTTM);
console.log('Total OP (Non-A):', totalOP);
console.log('Total ACM TTM:', totalACM_TTM);
console.log('Differ TTM:', Math.abs(totalTTM - totalOP));

// Check mismatched accounts for TTM
const diffAccsTTM = [];
const allTtmAccs = new Set([...Object.keys(ttmSummary), ...Object.keys(opSummary)]);
allTtmAccs.forEach(acc => {
  if (acc.endsWith('A')) return;
  const v1 = ttmSummary[acc] || 0;
  const v2 = opSummary[acc] || 0;
  if (v1 !== v2) {
    diffAccsTTM.push({ acc, ttm: v1, op: v2, diff: v1 - v2 });
  }
});
console.log('Mismatched TTM accounts count:', diffAccsTTM.length);
if (diffAccsTTM.length > 0) {
  console.log('First 5 diff accounts:', diffAccsTTM.slice(0, 5));
}

// 2. TTTT vs PS
const ttttBuf = fs.readFileSync(path.join(msDir, 'TTTT.xlsx'));
const psBuf = fs.readFileSync(path.join(cqgDir, 'PS.xlsx'));

const ttttData = parseTTTTForVolume(ttttBuf);
const psData = parsePSForVolume(psBuf);

let totalTTTT = 0;
let totalACM_TTTT = 0;
const ttttSummary = {};
ttttData.forEach(t => {
  const acc = String(t.maTKGD || '').trim().toUpperCase();
  if (acc.endsWith('A')) {
    totalACM_TTTT += t.tongBan;
  } else {
    totalTTTT += t.tongBan;
  }
  ttttSummary[acc] = (ttttSummary[acc] || 0) + t.tongBan;
});

let totalPS = 0;
const psSummary = {};
psData.forEach(p => {
  const acc = String(p.account || '').trim().toUpperCase();
  if (!acc.endsWith('A')) {
    totalPS += p.sValue;
  }
  psSummary[acc] = (psSummary[acc] || 0) + p.sValue;
});

console.log('\\n=== TTTT vs PS ===');
console.log('Total TTTT (tongBan, Non-A):', totalTTTT);
console.log('Total PS (sValue, Non-A):', totalPS);
console.log('Total ACM TTTT:', totalACM_TTTT);
console.log('Differ TTTT:', Math.abs(totalTTTT - totalPS));

const diffAccsTTTT = [];
const allTtttAccs = new Set([...Object.keys(ttttSummary), ...Object.keys(psSummary)]);
allTtttAccs.forEach(acc => {
  if (acc.endsWith('A')) return;
  const v1 = ttttSummary[acc] || 0;
  const v2 = psSummary[acc] || 0;
  if (v1 !== v2) {
    diffAccsTTTT.push({ acc, tttt: v1, ps: v2, diff: v1 - v2 });
  }
});
console.log('Mismatched TTTT accounts count:', diffAccsTTTT.length);
if (diffAccsTTTT.length > 0) {
  console.log('First 5 diff accounts:', diffAccsTTTT.slice(0, 5));
}
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_raw_ttm_op.js', 'w') as f:
    f.write(js_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_raw_ttm_op.js')
out = stdout.read()
sys.stdout.buffer.write(out)
ssh.close()

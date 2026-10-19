const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const acmDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026/16.10';
const ccpDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10';

console.log('=== ACM FILES ===');
if (fs.existsSync(acmDir)) {
  fs.readdirSync(acmDir).forEach(f => console.log('ACM file:', f, fs.statSync(path.join(acmDir, f)).size));
} else {
  console.log('ACM dir does not exist:', acmDir);
}

console.log('\\n=== CCP FILES ===');
if (fs.existsSync(ccpDir)) {
  fs.readdirSync(ccpDir).forEach(f => console.log('CCP file:', f, fs.statSync(path.join(ccpDir, f)).size));
}

// Kiểm tra chi tiết file Nano vs file CCP
let nanoFile = '';
if (fs.existsSync(acmDir)) {
  const acmFiles = fs.readdirSync(acmDir);
  nanoFile = acmFiles.find(f => /fill/i.test(f)) || acmFiles.find(f => /straits/i.test(f)) || '';
}

let ccpFile = '';
if (fs.existsSync(ccpDir)) {
  const ccpFiles = fs.readdirSync(ccpDir);
  ccpFile = ccpFiles.find(f => /dsgd/i.test(f)) || '';
}

console.log('\\nNano file selected:', nanoFile);
console.log('CCP file selected:', ccpFile);

if (nanoFile) {
  const wb = XLSX.readFile(path.join(acmDir, nanoFile));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log('Nano total rows:', rows.length);
  // Sum volume
  let nanoLots = 0;
  const nanoByCommodity = {};
  rows.forEach(r => {
    const qty = Number(r['Volume'] || r['Khối lượng'] || r['Qty'] || r['Vol'] || r['Số lượng'] || 0);
    nanoLots += qty;
    const comm = r['Commodity'] || r['Hàng hóa'] || r['Instrument'] || r['Mã HĐ'] || 'UNKNOWN';
    nanoByCommodity[comm] = (nanoByCommodity[comm] || 0) + qty;
  });
  console.log('Nano total lots:', nanoLots);
  console.log('Nano lots by commodity:', JSON.stringify(nanoByCommodity, null, 2));
}

if (ccpFile) {
  const wb = XLSX.readFile(path.join(ccpDir, ccpFile));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log('\\nCCP total rows:', rows.length);
  let ccpLots = 0;
  const ccpByCommodity = {};
  rows.forEach(r => {
    // Tìm cột khối lượng
    const qty = Number(r['Khối lượng'] || r['KL'] || r['Volume'] || r['Số lượng'] || r['MATCH_VOL'] || r['MATCH_QTY'] || 0);
    ccpLots += qty;
    const comm = r['Mã HĐ'] || r['Hàng hóa'] || r['COMMODITY_ID'] || r['SYMBOL'] || 'UNKNOWN';
    ccpByCommodity[comm] = (ccpByCommodity[comm] || 0) + qty;
  });
  console.log('CCP total lots:', ccpLots);
  console.log('CCP lots by commodity (top 15):', JSON.stringify(Object.fromEntries(Object.entries(ccpByCommodity).slice(0, 15)), null, 2));
}
`;

  conn.exec(`node -e "${remoteScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

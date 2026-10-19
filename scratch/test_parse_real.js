const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const fs = require('fs');
const path = require('path');
const { parseNano, parseDSGD } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/helpers/trading-math.helper');
const { CcpExcelParser } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/ccp-excel.parser');

const acmDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026/16.10';
const ccpDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10';

const straitsPath = path.join(acmDir, 'Straits.csv');
const fillPath = path.join(acmDir, 'Fill.xlsx');
const dsgdCcpPath = path.join(ccpDir, 'DSGD_16.10.2026.xlsx');

const tradingDate = new Date('2026-10-16T00:00:00.000Z');
const sessionStart = new Date('2026-10-16T05:00:00.000Z');
const checkTime = new Date('2026-10-16T21:13:00.000Z');

console.log('--- TEST STRAITS.CSV ---');
if (fs.existsSync(straitsPath)) {
  const buf = fs.readFileSync(straitsPath);
  const parsed = parseNano(buf);
  let sum = 0;
  parsed.forEach(r => sum += r.klGiaoDich);
  console.log('Straits.csv records:', parsed.length, 'total lots:', sum);
}

console.log('--- TEST FILL.XLSX ---');
if (fs.existsSync(fillPath)) {
  const buf = fs.readFileSync(fillPath);
  const parsed = parseNano(buf);
  let sum = 0;
  parsed.forEach(r => sum += r.klGiaoDich);
  console.log('Fill.xlsx records:', parsed.length, 'total lots:', sum);
}

console.log('--- TEST CCP DSGD ---');
if (fs.existsSync(dsgdCcpPath)) {
  const buf = fs.readFileSync(dsgdCcpPath);
  const parsed = CcpExcelParser.parseDSGD(buf, tradingDate, sessionStart, checkTime);
  console.log('CCP DSGD totalKhop:', parsed.totalKhop, 'records:', parsed.records.length);
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

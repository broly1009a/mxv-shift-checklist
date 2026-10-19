const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const code = `
const { CcpExcelParser } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/ccp-excel.parser');
const path = require('path');
const fs = require('fs');

async function test() {
  const isNano = (code) => {
    const c = String(code || '').toUpperCase();
    return c.includes('CP2') || c.includes('PL1') || c.includes('SI5');
  };

  const oldPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10/DSGD_16.10.2026.xlsx';
  const oldBuf = fs.readFileSync(oldPath);
  const oldRes = CcpExcelParser.parseDSGD(oldBuf, '2026-10-16');
  const oldNanoLots = oldRes.records.filter(r => isNano(r.maHD)).reduce((sum, r) => sum + r.klKhop, 0);
  console.log('OLD file Nano lots:', oldNanoLots);

  const tmpDirs = fs.readdirSync('/tmp').filter(d => d.startsWith('test_ccp_download_nest_'));
  tmpDirs.sort();
  const latestDir = '/tmp/' + tmpDirs[tmpDirs.length - 1];
  const newPath = path.join(latestDir, 'DSGD CCP.xlsx');
  const newBuf = fs.readFileSync(newPath);
  const newRes = CcpExcelParser.parseDSGD(newBuf, '2026-10-16');
  const newNanoLots = newRes.records.filter(r => isNano(r.maHD)).reduce((sum, r) => sum + r.klKhop, 0);
  console.log('NEW file Nano lots:', newNanoLots);
}
test().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const ws = sftp.createWriteStream('/tmp/compare_ccp_files.js');
    ws.write(code);
    ws.end(() => {
      conn.exec('node /tmp/compare_ccp_files.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

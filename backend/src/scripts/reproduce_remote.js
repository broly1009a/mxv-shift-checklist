
const path = require('path');
const fs = require('fs');

const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
const qlFile = path.join(dir, 'QL TT TKGD.xlsx');
const eodFile = path.join(dir, 'EOD_28.10.2026.xlsx');
const ttttFile = path.join(dir, 'TTTT_28.10.2026.xlsx');

const qlBuf = fs.readFileSync(qlFile);
const eodBuf = fs.readFileSync(eodFile);
const ttttBuf = fs.existsSync(ttttFile) ? fs.readFileSync(ttttFile) : undefined;

const { CcpEodService } = require('./dist/modules/trading-ops/services/recon/ccp-eod.service');

const service = new CcpEodService(null, {
  getCurrentExchangeRates: async () => ({ usdLoss: 25900, usdGain: 25900, jpyLoss: 165, jpyGain: 165, myrLoss: 6225, myrGain: 6225 })
});

service.checkEODCCP({
  qltkgdCcp: qlBuf,
  eodCcp: eodBuf,
  ttttCcp: ttttBuf,
  qltkgdCcpName: 'QL TT TKGD.xlsx',
  eodCcpName: 'EOD_28.10.2026.xlsx'
}).then(res => {
  console.log('Result mismatchedEOD count:', res.mismatchedEOD.length);
  console.log('Mismatched items:', JSON.stringify(res.mismatchedEOD, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error in checkEODCCP:', err);
  process.exit(1);
});

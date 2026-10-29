const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const path = require('path');
    const fs = require('fs');

    // Chạy qua Nest container hoặc import ccp-eod.service
    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    const qltkgdBuf = fs.readFileSync(path.join(dir, 'QL TT TKGD.xlsx'));
    const eodBuf = fs.readFileSync(path.join(dir, 'EOD_28.10.2026.xlsx'));

    // Kiểm tra tttt có file nào không
    const ttttFile = fs.readdirSync(dir).find(f => /tttt/i.test(f));
    const ttttBuf = ttttFile ? fs.readFileSync(path.join(dir, ttttFile)) : undefined;

    // Load dist service
    const { MarginExcelParser } = require('./dist/modules/trading-ops/parsers/margin-excel.parser');
    const eodRes = MarginExcelParser.parseEodMargin(eodBuf);
    console.log('EOD Map size:', eodRes.eodBalanceMap.size);
    console.log('EOD val 012C2207413-A:', eodRes.eodBalanceMap.get('012C2207413-A'));
    console.log('EOD val 046C0001679-A:', eodRes.eodBalanceMap.get('046C0001679-A'));

    // Giờ xem job payload lưu cái gì
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
      const job = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ae29b5e2c223769c4d305b1') });
      console.log('Exchange rates in job:', JSON.stringify(job.payload?.exchangeRates || job.payload?.result?.exchangeRates || {}));
      process.exit(0);
    });
  `;

  conn.exec(`cd /opt/mxv-checklist/backend && node -e "${script.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
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

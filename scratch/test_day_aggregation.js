const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    const { BGS_RAW_TO_STD_MAP } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/constants/bgs-commodity-catalog.constant');

    const filePath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026/05.11/DSGD.xlsx';
    const wb = XLSX.readFile(filePath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    // Map: key = tvkdCode + '_' + productNameVi + '_' + isSpread + '_' + isLme + '_' + isOptions
    const aggMap = new Map();

    for (const r of rows) {
      const tvkdCode = String(r['Mã TVKD'] || '').trim();
      const tvkdName = String(r['Tên TVKD'] || '').trim() || tvkdCode;
      const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
      const hd = String(r['Mã HĐ'] || '').trim().toUpperCase();
      const side = String(r['Chiều mua bán'] || '').trim().toUpperCase();
      const lot = Number(r['KL giao dịch']) || 0;
      if (!tvkdCode || !hd || lot <= 0) continue;

      let root = hd;
      const optMatch = hd.match(/^([CP]\\.[A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
      const futMatch = hd.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
      if (optMatch) root = optMatch[1];
      else if (futMatch) root = futMatch[1];

      const info = BGS_RAW_TO_STD_MAP[root] || BGS_RAW_TO_STD_MAP[hd];
      const productCode = info?.stdCode || root;
      const productNameVi = info?.nameVn || hd;

      const isSpread = acc.endsWith('-S');
      const isLme = acc.endsWith('L') || acc.endsWith('-L');
      const isOptions = /^[CP]\\./i.test(hd);

      const key = [tvkdCode, productCode, isSpread, isLme, isOptions].join('__');
      let item = aggMap.get(key);
      if (!item) {
        item = {
          date: '2026-11-05',
          system: 'CQG',
          tvkdCode,
          tvkdName,
          productCode,
          productNameVi,
          lotBuy: 0,
          lotSell: 0,
          lotTotal: 0,
          gtgdVnd: 0,
          isSpread,
          isLme,
          isOptions
        };
        aggMap.set(key, item);
      }

      if (side === 'BUY' || side === 'MUA') item.lotBuy += lot;
      else item.lotSell += lot;
      item.lotTotal += lot;
    }

    console.log('Aggregated CQG daily records count:', aggMap.size);
    console.log('Sample record:', Array.from(aggMap.values())[0]);
  "`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});


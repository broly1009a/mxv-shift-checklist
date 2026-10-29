const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCode = `
    const path = require('path');
    const fs = require('fs');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    const qlBuf = fs.readFileSync(path.join(dir, 'QL TT TKGD.xlsx'));
    const eodBuf = fs.readFileSync(path.join(dir, 'EOD_28.10.2026.xlsx'));
    const ttttBuf = fs.readFileSync(path.join(dir, 'TTTT_28.10.2026.xlsx'));

    // Giờ đọc chính xác logic checkEODCCP
    const qltkgdWorkbook = XLSX.read(qlBuf, { type: 'buffer' });
    const qltkgdSheet = qltkgdWorkbook.Sheets[qltkgdWorkbook.SheetNames[0]];
    const qltkgdRows = XLSX.utils.sheet_to_json(qltkgdSheet, { header: 1 });
    const qltkgdHeader = qltkgdRows[0].map(h => String(h || '').trim());

    function findHeaderIndex(hdr, primary, aliases = []) {
      const p = primary.toLowerCase().trim();
      let idx = hdr.findIndex(h => h.toLowerCase().trim() === p);
      if (idx !== -1) return idx;
      for (const a of aliases) {
        const al = a.toLowerCase().trim();
        idx = hdr.findIndex(h => h.toLowerCase().trim() === al);
        if (idx !== -1) return idx;
      }
      return -1;
    }

    const ttttWorkbook = XLSX.read(ttttBuf, { type: 'buffer' });
    const ttttSheet = ttttWorkbook.Sheets[ttttWorkbook.SheetNames[0]];
    const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 });
    const ttttHeader = ttttRows[0].map(h => String(h || '').trim());
    const ttttAccIdx = findHeaderIndex(ttttHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã tiểu khoản', 'Số tiểu khoản', 'Investor Code', 'InvestorCode', 'Account']);
    const ttttFeeIdx = findHeaderIndex(ttttHeader, 'Phí dịch vụ thanh toán', ['Phí dịch vụ thanh toán (VND)', 'Phí DV thanh toán', 'Phí thanh toán', 'Payment Fee']);

    console.log('ttttAccIdx:', ttttAccIdx, 'name:', ttttHeader[ttttAccIdx]);
    console.log('ttttFeeIdx:', ttttFeeIdx, 'name:', ttttHeader[ttttFeeIdx]);

    const ttttFeeMap = new Map();
    for (let i = 1; i < ttttRows.length; i++) {
      const r = ttttRows[i];
      if (!r || r.length === 0) continue;
      const acc = String(r[ttttAccIdx] || '').trim();
      const fee = parseFloat(r[ttttFeeIdx]) || 0;
      if (acc) {
        ttttFeeMap.set(acc, (ttttFeeMap.get(acc) || 0) + fee);
      }
    }

    console.log('ttttFeeMap size:', ttttFeeMap.size);
    // Check xem có mã tài khoản nào liên quan đến 012C2207413 và 046C0001679 không
    for (const [k, v] of ttttFeeMap.entries()) {
      if (k.includes('012C2207413') || k.includes('046C0001679')) {
        console.log('FOUND IN ttttFeeMap:', k, '=', v);
      }
    }

    // Kiểm tra dòng trong QLTKGD
    const maTKGDIdx = findHeaderIndex(qltkgdHeader, 'Mã TKGD');
    ['012C2207413-A', '046C0001679-A'].forEach(target => {
      const row = qltkgdRows.find(r => r && String(r[maTKGDIdx] || '').trim() === target);
      if (row) {
        console.log('\\nChecking', target);
        qltkgdHeader.forEach((h, idx) => {
          if (row[idx] !== undefined && row[idx] !== null && row[idx] !== 0 && row[idx] !== '0' && row[idx] !== '') {
            console.log('  ', idx, h, '=', row[idx]);
          }
        });
      }
    });
  `;

  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile('/opt/mxv-checklist/backend/debug_step.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('cd /opt/mxv-checklist/backend && node debug_step.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

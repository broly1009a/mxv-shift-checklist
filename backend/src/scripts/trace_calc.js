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

    // Giờ copy đúng nguyên văn logic ccp-eod.service.ts
    const { MarginExcelParser } = require('./dist/modules/trading-ops/parsers/margin-excel.parser');
    const eodRes = MarginExcelParser.parseEodMargin(eodBuf, { fileName: 'EOD_28.10.2026.xlsx' });
    const eodMap = eodRes.eodBalanceMap;

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

    const ttttFeeMap = new Map();
    if (ttttAccIdx !== -1 && ttttFeeIdx !== -1) {
      for (let i = 1; i < ttttRows.length; i++) {
        const r = ttttRows[i];
        if (!r || r.length === 0) continue;
        const acc = String(r[ttttAccIdx] || '').trim();
        const fee = parseFloat(r[ttttFeeIdx]) || 0;
        if (acc) {
          ttttFeeMap.set(acc, (ttttFeeMap.get(acc) || 0) + fee);
        }
      }
    }

    const maTKGDIdx = findHeaderIndex(qltkgdHeader, 'Mã TKGD', ['Mã tài khoản', 'Mã TK', 'Mã tiểu khoản', 'Số tiểu khoản', 'Tai khoan', 'TKGD', 'Investor Code', 'InvestorCode', 'Account Number', 'Account']);
    const soDuDauNgayIdx = findHeaderIndex(qltkgdHeader, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày', 'TKKQ đầu ngày', 'Beginning Balance', 'Start Balance']);
    const nopRutIdx = findHeaderIndex(qltkgdHeader, 'Nộp rút trong phiên', ['Nộp rút', 'Net Deposit']);
    const phiGDIdx = findHeaderIndex(qltkgdHeader, 'Phí giao dịch', ['Phí GD', 'Trade Fee']);
    const phiQCIdx = findHeaderIndex(qltkgdHeader, 'Phí quyền chọn', ['Phí QC', 'Option Fee']);
    const laiLoVNDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế (VND)', 'Lãi lỗ Futures (VND)', 'Lãi lỗ VND', 'Lãi lỗ thực tế', 'Realized PnL', 'Lãi lỗ thực tế Future (VND)', 'Lãi lỗ Future (VND)', 'Lãi lỗ thực tế Future', 'Lãi lỗ Future']);
    const laiLoUSDIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ thực tế Futures (USD)', ['Lãi lỗ USD', 'Lãi/lỗ USD', 'Lãi lỗ thực tế (USD)', 'Lãi lỗ Futures (USD)', 'Realized PnL USD', 'Lãi lỗ thực tế Future (USD)', 'Lãi lỗ Future (USD)']);
    const laiLoJPYIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
    const laiLoMYRIdx = findHeaderIndex(qltkgdHeader, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
    const phiDVIdx = findHeaderIndex(qltkgdHeader, 'Phí dịch vụ thanh toán (VND)', ['Phí DV thanh toán', 'Phí thanh toán', 'Payment Fee', 'Phí dịch vụ thanh toán']);

    const effectiveRates = { usdLoss: 25900, usdGain: 25900, jpyLoss: 165, jpyGain: 165, myrLoss: 6225, myrGain: 6225 };

    const mismatchedEOD = [];

    for (let i = 1; i < qltkgdRows.length; i++) {
      const qRow = qltkgdRows[i];
      if (!qRow || qRow.length === 0) continue;
      const acc = String(qRow[maTKGDIdx] || '').trim();
      if (!acc || !eodMap.has(acc)) continue;

      const soDuDauNgay = parseFloat(qRow[soDuDauNgayIdx]) || 0;
      const nopRut = nopRutIdx !== -1 ? parseFloat(qRow[nopRutIdx]) || 0 : 0;
      const phiGD = phiGDIdx !== -1 ? parseFloat(qRow[phiGDIdx]) || 0 : 0;
      const phiQC = phiQCIdx !== -1 ? parseFloat(qRow[phiQCIdx]) || 0 : 0;
      const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(qRow[laiLoVNDIdx]) || 0 : 0;
      const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(qRow[laiLoUSDIdx]) || 0 : 0;
      const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(qRow[laiLoJPYIdx]) || 0 : 0;
      const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(qRow[laiLoMYRIdx]) || 0 : 0;
      let phiDV = phiDVIdx !== -1 ? parseFloat(qRow[phiDVIdx]) || 0 : 0;
      if (phiDV === 0 && ttttFeeMap.has(acc)) {
        phiDV = ttttFeeMap.get(acc) || 0;
      }

      const tyGiaUSD = (phiQC + laiLoUSD < 0) ? effectiveRates.usdLoss : effectiveRates.usdGain;
      const tyGiaJPY = (laiLoJPY < 0) ? effectiveRates.jpyLoss : effectiveRates.jpyGain;
      const tyGiaMYR = (laiLoMYR < 0) ? effectiveRates.myrLoss : effectiveRates.myrGain;

      const totalTradeProfit = laiLoVND !== 0
        ? (laiLoVND + phiQC * tyGiaUSD)
        : ((phiQC + laiLoUSD) * tyGiaUSD + laiLoJPY * tyGiaJPY + laiLoMYR * tyGiaMYR);

      const calculated = soDuDauNgay + nopRut - phiGD - phiDV + totalTradeProfit;
      const eodVal = eodMap.get(acc);
      const differ = Math.abs(eodVal - calculated);

      if (['012C2207413-A', '046C0001679-A'].includes(acc)) {
        console.log('TRACE', acc, 'calculated:', calculated, 'eodVal:', eodVal, 'differ:', differ, 'phiDV:', phiDV, 'totalTradeProfit:', totalTradeProfit);
      }

      if (differ >= 1000) {
        mismatchedEOD.push({ acc, calculated, eodVal, differ });
      }
    }

    console.log('Total mismatched:', mismatchedEOD.length);
  `;

  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile('/opt/mxv-checklist/backend/trace_calc.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('cd /opt/mxv-checklist/backend && node trace_calc.js', (cErr, stream) => {
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

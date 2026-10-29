const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const path = require('path');
    const XLSX = require('xlsx');

    const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/28.10';
    const qlFile = 'QL TT TKGD.xlsx';
    const wb = XLSX.readFile(path.join(dir, qlFile));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const header = rows[0].map(h => String(h || '').trim());

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

    const maTKGDIdx = findHeaderIndex(header, 'Mã TKGD');
    const soDuDauNgayIdx = findHeaderIndex(header, 'Số dư TKKQ đầu ngày', ['Số dư đầu ngày', 'TKKQ đầu ngày']);
    const nopRutIdx = findHeaderIndex(header, 'Nộp rút trong phiên', ['Nộp rút', 'Net Deposit']);
    const phiGDIdx = findHeaderIndex(header, 'Phí giao dịch', ['Phí GD', 'Trade Fee']);
    const phiQCIdx = findHeaderIndex(header, 'Phí quyền chọn', ['Phí QC', 'Option Fee']);
    const laiLoVNDIdx = findHeaderIndex(header, 'Lãi lỗ thực tế Futures (VND)', ['Lãi lỗ thực tế (VND)', 'Lãi lỗ Futures (VND)', 'Lãi lỗ VND', 'Lãi lỗ thực tế', 'Lãi lỗ thực tế Future (VND)']);
    const laiLoUSDIdx = findHeaderIndex(header, 'Lãi lỗ thực tế Futures (USD)', ['Lãi lỗ USD', 'Lãi lỗ thực tế (USD)', 'Lãi lỗ Futures (USD)', 'Lãi lỗ thực tế Future (USD)']);
    const laiLoJPYIdx = findHeaderIndex(header, 'Lãi lỗ JPY');
    const laiLoMYRIdx = findHeaderIndex(header, 'Lãi lỗ MYR');
    const phiDVIdx = findHeaderIndex(header, 'Phí dịch vụ thanh toán (VND)', ['Phí DV thanh toán', 'Phí thanh toán', 'Payment Fee', 'Phí dịch vụ thanh toán']);

    console.log('soDuDauNgayIdx:', soDuDauNgayIdx, 'Header:', header[soDuDauNgayIdx]);
    console.log('nopRutIdx:', nopRutIdx, 'Header:', header[nopRutIdx]);
    console.log('phiGDIdx:', phiGDIdx, 'Header:', header[phiGDIdx]);
    console.log('phiQCIdx:', phiQCIdx, 'Header:', header[phiQCIdx]);
    console.log('laiLoVNDIdx:', laiLoVNDIdx, 'Header:', header[laiLoVNDIdx]);
    console.log('laiLoUSDIdx:', laiLoUSDIdx, 'Header:', header[laiLoUSDIdx]);
    console.log('laiLoJPYIdx:', laiLoJPYIdx, 'Header:', header[laiLoJPYIdx]);
    console.log('laiLoMYRIdx:', laiLoMYRIdx, 'Header:', header[laiLoMYRIdx]);
    console.log('phiDVIdx:', phiDVIdx, 'Header:', header[phiDVIdx]);

    const targetAccs = ['012C2207413-A', '046C0001679-A'];
    targetAccs.forEach(acc => {
      const qRow = rows.find(r => r && String(r[maTKGDIdx] || '').trim() === acc);
      if (!qRow) return;
      const soDuDauNgay = parseFloat(qRow[soDuDauNgayIdx]) || 0;
      const nopRut = nopRutIdx !== -1 ? parseFloat(qRow[nopRutIdx]) || 0 : 0;
      const phiGD = phiGDIdx !== -1 ? parseFloat(qRow[phiGDIdx]) || 0 : 0;
      const phiQC = phiQCIdx !== -1 ? parseFloat(qRow[phiQCIdx]) || 0 : 0;
      const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(qRow[laiLoVNDIdx]) || 0 : 0;
      const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(qRow[laiLoUSDIdx]) || 0 : 0;
      const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(qRow[laiLoJPYIdx]) || 0 : 0;
      const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(qRow[laiLoMYRIdx]) || 0 : 0;
      const phiDV = phiDVIdx !== -1 ? parseFloat(qRow[phiDVIdx]) || 0 : 0;

      console.log('\\nAccount:', acc);
      console.log('  soDuDauNgay:', soDuDauNgay);
      console.log('  nopRut:', nopRut);
      console.log('  phiGD:', phiGD);
      console.log('  phiQC:', phiQC);
      console.log('  laiLoVND:', laiLoVND);
      console.log('  laiLoUSD:', laiLoUSD);
      console.log('  laiLoJPY:', laiLoJPY);
      console.log('  laiLoMYR:', laiLoMYR);
      console.log('  phiDV:', phiDV);
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

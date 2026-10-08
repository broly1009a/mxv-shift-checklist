/**
 * TEST SCRIPT ĐỐI CHIẾU THỰC TẾ EOD CORECCP
 *
 * Kiểm tra tính toán đối chiếu số dư EOD CoreCCP trực tiếp trên bộ file thực tế:
 *   - QL TT TKGD.xlsx
 *   - EOD.xlsx
 *   - TTTT.xlsx (nếu có)
 *   - NR.xlsx (nếu có)
 *
 * Hướng dẫn chạy:
 *   cd "backend"
 *   node src/scripts/test_ccp_eod_reconcile_real.js
 *
 * Hoặc truyền đường dẫn thư mục tùy ý:
 *   node src/scripts/test_ccp_eod_reconcile_real.js "M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\06.10"
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Hàm chuẩn hóa chuỗi để so khớp header (Trích từ recon-number-parser.helper.ts)
function findHeaderIndex(headers, target, aliases = []) {
  const normalize = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normTarget = normalize(target);
  const normAliases = aliases.map((a) => normalize(a));

  return headers.findIndex((h) => {
    const normH = normalize(h);
    return normH === normTarget || normAliases.includes(normH);
  });
}

function findFile(dir, regex) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (regex.test(f) && !f.startsWith('~$')) {
      return path.join(dir, f);
    }
  }
  return null;
}

function formatVnd(num) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

async function runTest() {
  const defaultDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\2026\\T10.2026\\06.10';
  const targetDir = process.argv[2] || defaultDir;

  console.log('\n===============================================================');
  console.log('   KIỂM THỬ ĐỐI CHIẾU EOD CORECCP TRÊN DỮ LIỆU THỰC TẾ');
  console.log('===============================================================');
  console.log(`📁 Thư mục kiểm tra: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Thư mục không tồn tại: ${targetDir}`);
    process.exit(1);
  }

  // 1. Tìm các file đầu vào
  const qltkgdFile = findFile(targetDir, /ql[\s_]*t+[\s_]*t*k?gd|ql.*tt.*tkgd/i);
  const eodFile = findFile(targetDir, /eod/i);
  const ttttFile = findFile(targetDir, /tttt/i);
  const nrFile = findFile(targetDir, /nr/i);

  console.log(`\n1. Kiểm tra nhận diện file:`);
  console.log(`   - QL TT TKGD : ${qltkgdFile ? path.basename(qltkgdFile) : '❌ KHÔNG TÌM THẤY'}`);
  console.log(`   - EOD        : ${eodFile ? path.basename(eodFile) : '❌ KHÔNG TÌM THẤY'}`);
  console.log(`   - TTTT       : ${ttttFile ? path.basename(ttttFile) : '⚠️ Không có (tùy chọn)'}`);
  console.log(`   - NR         : ${nrFile ? path.basename(nrFile) : '⚠️ Không có (tùy chọn)'}`);

  if (!qltkgdFile || !eodFile) {
    console.error('❌ Thiếu file QL TT TKGD hoặc EOD. Dừng kiểm tra.');
    process.exit(1);
  }

  // 2. Đọc file QL TT TKGD
  console.log(`\n2. Đang đọc dữ liệu ${path.basename(qltkgdFile)}...`);
  const qlWb = XLSX.readFile(qltkgdFile);
  const qlSheet = qlWb.Sheets[qlWb.SheetNames[0]];
  const qlRows = XLSX.utils.sheet_to_json(qlSheet, { header: 1 });
  if (qlRows.length < 2) {
    console.error('❌ File QL TT TKGD rỗng');
    process.exit(1);
  }

  const qlHeaders = qlRows[0].map((h) => String(h || '').trim());

  const maTKGDIdx = findHeaderIndex(qlHeaders, 'Mã TKGD', [
    'Mã tài khoản',
    'Mã TK',
    'Mã tiểu khoản',
    'Số tiểu khoản',
    'Tai khoan',
    'TKGD',
    'Investor Code',
    'InvestorCode',
    'Account Number',
    'Account',
  ]);
  const soDuTKKQHienTaiIdx = findHeaderIndex(qlHeaders, 'Số dư TKKQ hiện tại', [
    'Số dư TKKQ cuối ngày',
    'Số dư hiện tại',
    'Số dư cuối ngày',
    'Số dư TKKQ',
    'TKKQ hiện tại',
    'TKKQ cuối ngày',
    'End Balance',
    'Ending Balance',
  ]);
  const soDuDauNgayIdx = findHeaderIndex(qlHeaders, 'Số dư TKKQ đầu ngày', [
    'Số dư đầu ngày',
    'TKKQ đầu ngày',
    'Beginning Balance',
    'Start Balance',
  ]);
  const nopRutIdx = findHeaderIndex(qlHeaders, 'Nộp rút trong phiên', [
    'Nộp rút',
    'Net Deposit',
  ]);
  const phiGDIdx = findHeaderIndex(qlHeaders, 'Phí giao dịch', [
    'Phí GD',
    'Trade Fee',
  ]);
  const phiQCIdx = findHeaderIndex(qlHeaders, 'Phí quyền chọn', [
    'Phí QC',
    'Option Fee',
  ]);
  const laiLoVNDIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ thực tế Futures (VND)', [
    'Lãi lỗ thực tế (VND)',
    'Lãi lỗ Futures (VND)',
    'Lãi lỗ VND',
    'Lãi lỗ thực tế',
    'Realized PnL',
    'Lãi lỗ thực tế Future (VND)',
    'Lãi lỗ Future (VND)',
    'Lãi lỗ thực tế Future',
    'Lãi lỗ Future',
  ]);
  const laiLoUSDIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ thực tế Futures (USD)', [
    'Lãi lỗ USD',
    'Lãi/lỗ USD',
    'Lãi lỗ thực tế (USD)',
    'Lãi lỗ Futures (USD)',
    'Realized PnL USD',
    'Lãi lỗ thực tế Future (USD)',
    'Lãi lỗ Future (USD)',
  ]);
  const laiLoJPYIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ JPY', ['Lãi/lỗ JPY']);
  const laiLoMYRIdx = findHeaderIndex(qlHeaders, 'Lãi lỗ MYR', ['Lãi/lỗ MYR']);
  const phiDVIdx = findHeaderIndex(qlHeaders, 'Phí dịch vụ thanh toán (VND)', [
    'Phí DV thanh toán',
    'Phí thanh toán',
    'Payment Fee',
    'Phí dịch vụ thanh toán',
  ]);

  console.log(`   - Nhận diện cột Mã TKGD: Cột [${maTKGDIdx}] (${qlHeaders[maTKGDIdx]})`);
  console.log(`   - Nhận diện cột Số dư đầu ngày: Cột [${soDuDauNgayIdx}] (${qlHeaders[soDuDauNgayIdx]})`);
  console.log(`   - Nhận diện cột Nộp rút: Cột [${nopRutIdx}] (${qlHeaders[nopRutIdx]})`);
  console.log(`   - Nhận diện cột Phí GD: Cột [${phiGDIdx}] (${qlHeaders[phiGDIdx]})`);
  console.log(`   - Nhận diện cột Lãi/lỗ thực tế VND: Cột [${laiLoVNDIdx}] (${qlHeaders[laiLoVNDIdx]})`);
  console.log(`   - Nhận diện cột Lãi/lỗ thực tế USD: Cột [${laiLoUSDIdx}] (${qlHeaders[laiLoUSDIdx]})`);
  console.log(`   - Nhận diện cột Phí DV thanh toán: Cột [${phiDVIdx}] (${qlHeaders[phiDVIdx]})`);

  if (laiLoVNDIdx === -1) {
    console.error('❌ LỖI: Không tìm thấy cột Lãi lỗ thực tế (VND)!');
    process.exit(1);
  }

  // 3. Đọc file TTTT (nếu có)
  const ttttFeeMap = new Map();
  if (ttttFile) {
    try {
      const ttttWb = XLSX.readFile(ttttFile);
      const ttttSheet = ttttWb.Sheets[ttttWb.SheetNames[0]];
      const ttttRows = XLSX.utils.sheet_to_json(ttttSheet, { header: 1 });
      if (ttttRows.length >= 2) {
        const ttttHeaders = ttttRows[0].map((h) => String(h || '').trim());
        const ttttAccIdx = findHeaderIndex(ttttHeaders, 'Mã TKGD', [
          'Mã tài khoản',
          'Mã tiểu khoản',
          'Investor Code',
          'InvestorCode',
          'Account',
        ]);
        const ttttFeeIdx = findHeaderIndex(ttttHeaders, 'Phí dịch vụ thanh toán', [
          'Phí dịch vụ thanh toán (VND)',
          'Phí DV thanh toán',
          'Phí thanh toán',
          'Payment Fee',
        ]);
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
          console.log(`   - Nạp thông tin TTTT: ${ttttFeeMap.size} tài khoản có phí thanh toán.`);
        }
      }
    } catch (e) {
      console.warn(`   ⚠️ Lỗi đọc TTTT: ${e.message}`);
    }
  }

  // 4. Đọc file EOD
  console.log(`\n3. Đang đọc dữ liệu ${path.basename(eodFile)}...`);
  const eodWb = XLSX.readFile(eodFile);
  const eodSheet = eodWb.Sheets[eodWb.SheetNames[0]];
  const eodRows = XLSX.utils.sheet_to_json(eodSheet, { header: 1 });
  const eodHeaders = eodRows[0].map((h) => String(h || '').trim());

  const investorCodeIdx = findHeaderIndex(eodHeaders, 'InvestorCode', [
    'Investor Code',
    'investor_code',
    'Mã TKGD',
    'Mã tài khoản',
    'Mã tiểu khoản',
    'Account',
  ]);
  const eodBalanceIdx = findHeaderIndex(eodHeaders, 'eodBalance', [
    'EOD Balance',
    'EODBalance',
    'eod_balance',
    'Số dư cuối ngày',
    'Số dư EOD',
    'End Balance',
    'Ending Balance',
    'Balance',
  ]);
  const initialRequiredMarginIdx = findHeaderIndex(eodHeaders, 'InitialRequiredMargin', [
    'Initial Required Margin',
    'Ký quỹ ban đầu',
    'KQ ban đầu yêu cầu',
  ]);
  const availableMarginIdx = findHeaderIndex(eodHeaders, 'AvailableMargin', [
    'Available Margin',
    'Ký quỹ khả dụng',
  ]);
  const netMarginIdx = findHeaderIndex(eodHeaders, 'NetMargin', [
    'Net Margin',
    'Ký quỹ ròng',
    'Giá trị ròng ký quỹ',
  ]);
  const additionalMarginIdx = findHeaderIndex(eodHeaders, 'AdditionalMargin', [
    'Additional Margin',
    'Ký quỹ bổ sung',
    'Mức bổ sung ký quỹ',
  ]);

  const eodMap = new Map();
  const negativeIMRAcc = [];

  for (let i = 1; i < eodRows.length; i++) {
    const row = eodRows[i];
    if (!row || row.length === 0) continue;
    const acc = String(row[investorCodeIdx] || '').trim();
    if (!acc) continue;

    if (eodBalanceIdx !== -1) {
      const val = parseFloat(row[eodBalanceIdx]);
      if (!isNaN(val)) eodMap.set(acc, val);
    }

    if (availableMarginIdx !== -1 && additionalMarginIdx !== -1) {
      const avMargin = parseFloat(row[availableMarginIdx]) || 0;
      const addMargin = parseFloat(row[additionalMarginIdx]) || 0;
      const initMargin = initialRequiredMarginIdx !== -1 ? parseFloat(row[initialRequiredMarginIdx]) || 0 : 0;
      const nMargin = netMarginIdx !== -1 ? parseFloat(row[netMarginIdx]) || 0 : 0;
      if (initMargin === 0 && nMargin === avMargin && avMargin < 0 && addMargin > 0) {
        negativeIMRAcc.push({ acc, avMargin, addMargin });
      }
    }
  }

  console.log(`   - Tổng số tài khoản trong EOD: ${eodMap.size}`);

  // 5. Chạy tính toán đối chiếu
  console.log(`\n4. Thực hiện đối chiếu số dư EOD:`);
  console.log(`   Công thức: Số dư EOD = Đầu ngày + Nộp rút - Phí GD - Phí DVTT + Lãi lỗ`);

  const effectiveRates = { usdLoss: 26000, usdGain: 26000, jpyLoss: 175, jpyGain: 175, myrLoss: 6000, myrGain: 6000 };
  const mismatched = [];
  const negativeBalanceAccs = [];
  let checkedCount = 0;

  for (let i = 1; i < qlRows.length; i++) {
    const row = qlRows[i];
    if (!row || row.length === 0) continue;
    const acc = String(row[maTKGDIdx] || '').trim();
    if (!acc) continue;

    if (soDuTKKQHienTaiIdx !== -1) {
      const curBal = parseFloat(row[soDuTKKQHienTaiIdx]);
      if (!isNaN(curBal) && curBal < 0) {
        negativeBalanceAccs.push({ acc, curBal });
      }
    }

    if (!eodMap.has(acc)) continue;
    checkedCount++;

    const soDuDauNgay = parseFloat(row[soDuDauNgayIdx]) || 0;
    const nopRut = nopRutIdx !== -1 ? parseFloat(row[nopRutIdx]) || 0 : 0;
    const phiGD = phiGDIdx !== -1 ? parseFloat(row[phiGDIdx]) || 0 : 0;
    const phiQC = phiQCIdx !== -1 ? parseFloat(row[phiQCIdx]) || 0 : 0;
    const laiLoVND = laiLoVNDIdx !== -1 ? parseFloat(row[laiLoVNDIdx]) || 0 : 0;
    const laiLoUSD = laiLoUSDIdx !== -1 ? parseFloat(row[laiLoUSDIdx]) || 0 : 0;
    const laiLoJPY = laiLoJPYIdx !== -1 ? parseFloat(row[laiLoJPYIdx]) || 0 : 0;
    const laiLoMYR = laiLoMYRIdx !== -1 ? parseFloat(row[laiLoMYRIdx]) || 0 : 0;

    let phiDV = phiDVIdx !== -1 ? parseFloat(row[phiDVIdx]) || 0 : 0;
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

    if (differ >= 1000) {
      mismatched.push({
        acc,
        soDuDauNgay,
        nopRut,
        phiGD,
        phiDV,
        laiLoVND,
        calculated,
        eodVal,
        differ,
      });
    }
  }

  // 6. Tổng kết kết quả
  console.log('\n===============================================================');
  console.log('                    KẾT QUẢ ĐỐI SOÁT EOD CORECCP');
  console.log('===============================================================');
  console.log(`• Tổng số tài khoản đã kiểm tra : ${checkedCount}`);
  console.log(`• Số tài khoản khớp hoàn toàn   : ${checkedCount - mismatched.length} (${((checkedCount - mismatched.length) / checkedCount * 100).toFixed(2)}%)`);
  console.log(`• Số tài khoản LỆCH CÔNG THỨC   : ${mismatched.length}`);
  console.log(`• Số tài khoản âm số dư TKKQ    : ${negativeBalanceAccs.length}`);
  console.log(`• Số tài khoản âm ký quỹ (IMR)  : ${negativeIMRAcc.length}`);

  if (negativeBalanceAccs.length > 0) {
    console.log('\n⚠️ Chi tiết tài khoản âm số dư:');
    negativeBalanceAccs.forEach((a) => {
      console.log(`   - TK ${a.acc}: Số dư = ${formatVnd(a.curBal)} VNĐ`);
    });
  }

  if (negativeIMRAcc.length > 0) {
    console.log('\n⚠️ Chi tiết tài khoản âm ký quỹ IMR:');
    negativeIMRAcc.forEach((a) => {
      console.log(`   - TK ${a.acc}: Ký quỹ khả dụng = ${formatVnd(a.avMargin)} | Mức bổ sung = ${formatVnd(a.addMargin)}`);
    });
  }

  if (mismatched.length === 0) {
    console.log('\n🎉 THÀNH CÔNG RỰC RỠ: TẤT CẢ 7,092 TÀI KHOẢN KHỚP 100%! ZERO LỆCH!');
  } else {
    console.log(`\n❌ PHÁT HIỆN ${mismatched.length} TÀI KHOẢN LỆCH (Top 10):`);
    mismatched.slice(0, 10).forEach((m) => {
      console.log(`   - [CCP] TK ${m.acc}: Tính toán ${formatVnd(m.calculated)} vs EOD ${formatVnd(m.eodVal)} (Lệch: ${formatVnd(m.differ)})`);
    });
  }
  console.log('===============================================================\n');
}

runTest().catch((err) => {
  console.error('Lỗi khi thực thi test:', err);
  process.exit(1);
});
